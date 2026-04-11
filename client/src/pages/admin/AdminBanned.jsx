import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listBannedUsers, unbanUser, releaseBannedEmail } from "../../api/admin";

const AdminBanned = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listBannedUsers();
      setList(data.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const doUnban = async (id) => {
    if (!window.confirm("Lift ban and restore the same account? User will be emailed.")) return;
    try {
      await unbanUser(id);
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed");
    }
  };

  const doRelease = async (id) => {
    if (
      !window.confirm(
        "Release this email? The account will be anonymized so they can register again with the same Google email."
      )
    ) {
      return;
    }
    try {
      await releaseBannedEmail(id);
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Banned users</h1>
          <p className="module2-page__subtitle">
            Unban restores the same login. Release email anonymizes the row so they can sign up fresh.
          </p>
        </div>
        <Link to="/admin" className="button module2-page__back">
          Admin home
        </Link>
      </header>

      {loading ? (
        <p className="module2-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="module2-muted">No banned users.</p>
      ) : (
        <ul className="module2-list">
          {list.map((u) => (
            <li key={u._id} className="module2-list-item">
              <div>
                <strong>{u.name}</strong> · {u.email}
                {u.appealPending ? (
                  <span className="module2-badge module2-badge--open"> Appeal pending</span>
                ) : null}
              </div>
              {u.moderationReason ? (
                <p className="module2-muted">Reason: {u.moderationReason}</p>
              ) : null}
              {u.appealMessage ? (
                <p className="module2-review-text">
                  <em>Appeal:</em> {u.appealMessage}
                </p>
              ) : null}
              <div className="skill-dashboard__modal-actions">
                <Link to={`/profile/${u._id}`} className="button button--ghost">
                  Profile
                </Link>
                <button type="button" className="button button--ghost" onClick={() => doUnban(u._id)}>
                  Unban (restore account)
                </button>
                <button type="button" className="button" onClick={() => doRelease(u._id)}>
                  Release email
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminBanned;
