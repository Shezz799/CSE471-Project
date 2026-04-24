import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPublicProfile } from "../api/users";
import { getReviewsForUser } from "../api/reviews";
import {
  banUser,
  getAdminUser,
  suspendUser,
  unsuspendUser,
  unbanUser,
  releaseBannedEmail,
} from "../api/admin";
import ProfileRatingSection from "../components/ratings/ProfileRatingSection";

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [filterStars, setFilterStars] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);
  const [modReason, setModReason] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  const showAdminTools = me?.isDashboardAdmin && me?.id && userId && me.id !== userId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await getPublicProfile(userId);
        if (!cancelled) setPayload(data.data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Could not load profile");
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !payload?.reviewStats?.reviewCount) {
      setReviews([]);
      setReviewsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setReviewsLoading(true);
      try {
        const params = { limit: 50 };
        if (filterStars != null) params.stars = filterStars;
        const { data } = await getReviewsForUser(userId, params);
        if (!cancelled) setReviews(data.data || []);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, payload?.reviewStats?.reviewCount, filterStars]);

  useEffect(() => {
    if (!showAdminTools) {
      setAdminInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getAdminUser(userId);
        if (!cancelled) setAdminInfo(data.data);
      } catch {
        if (!cancelled) setAdminInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAdminTools, userId]);

  const u = payload?.user;
  const stats = payload?.reviewStats;
  const adminUser = adminInfo?.user;
  const acct = adminUser?.accountStatus || "active";

  const runAdmin = async (fn) => {
    setAdminBusy(true);
    try {
      await fn();
      const { data } = await getAdminUser(userId);
      setAdminInfo(data.data);
    } catch (e) {
      alert(e.response?.data?.message || "Action failed");
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div className="module2-page user-profile-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Profile</h1>
          {u && <p className="module2-page__subtitle">{u.name}</p>}
        </div>
        <button type="button" className="button module2-page__back" onClick={() => navigate(-1)}>
          Back
        </button>
      </header>

      {loading && <p className="module2-muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && u && (
        <div className="user-profile-layout">
          <section className="card module2-card user-profile-about">
            <h2 className="module2-card__title">About</h2>
            <div className="user-profile-about__grid">
              <div className="user-profile-about__email-col">
                <span className="user-profile-label">Email</span>
                <p className="user-profile-about__email-line">
                  <span className="user-profile-email-text">{u.email}</span>
                </p>
              </div>
              <div>
                <span className="user-profile-label">Department</span>
                <p>{u.department || "—"}</p>
              </div>
            </div>
            <div className="user-profile-bio">
              <span className="user-profile-label">Bio</span>
              <p>{u.bio?.trim() ? u.bio : "No bio yet."}</p>
            </div>
            <div>
              <span className="user-profile-label">Skills</span>
              <div className="user-profile-skills">
                {(u.skills || []).length ? (
                  u.skills.map((s) => (
                    <span key={s} className="user-profile-skill-chip">
                      {s}
                    </span>
                  ))
                ) : (
                  <p className="module2-muted">No skills listed.</p>
                )}
              </div>
            </div>
            <p className="module2-hint user-profile-hint">
              <Link to={`/messages?with=${encodeURIComponent(u.id)}`} className="user-profile-message-link">
                Open Messages
              </Link>{" "}
              to chat with them — opens your existing thread if you already have one.
            </p>
          </section>

          {showAdminTools && adminUser && (
            <section className="card module2-card module2-admin">
              <h2 className="module2-card__title">Admin moderation</h2>
              <p className="module2-muted">
                Account status: <strong>{acct}</strong>
                {adminUser.appealPending ? " · appeal pending" : ""}
              </p>
              {adminUser.moderationReason ? (
                <p className="module2-muted">Last reason: {adminUser.moderationReason}</p>
              ) : null}
              <div className="field">
                <label className="label" htmlFor="mod-reason">
                  Reason (stored on user)
                </label>
                <input
                  id="mod-reason"
                  className="input"
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  placeholder="Shown to the user in moderation emails"
                />
              </div>
              <div className="skill-dashboard__modal-actions" style={{ flexWrap: "wrap" }}>
                {acct === "active" && (
                  <>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={adminBusy}
                      onClick={() =>
                        runAdmin(() => suspendUser(userId, modReason || "Administrative suspension"))
                      }
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={adminBusy}
                      onClick={() => runAdmin(() => banUser(userId, modReason || "Administrative ban"))}
                    >
                      Ban
                    </button>
                  </>
                )}
                {acct === "suspended" && (
                  <button
                    type="button"
                    className="button"
                    disabled={adminBusy}
                    onClick={() => runAdmin(() => unsuspendUser(userId))}
                  >
                    Unsuspend
                  </button>
                )}
                {acct === "banned" && (
                  <>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={adminBusy}
                      onClick={() => runAdmin(() => unbanUser(userId))}
                    >
                      Unban (restore account)
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={adminBusy}
                      onClick={() => runAdmin(() => releaseBannedEmail(userId))}
                    >
                      Release email (new signup)
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          <section className="card module2-card user-profile-ratings-card">
            <ProfileRatingSection
              stats={stats}
              reviews={reviews}
              reviewsLoading={reviewsLoading}
              filterStars={filterStars}
              onFilterStarsChange={setFilterStars}
            />
          </section>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
