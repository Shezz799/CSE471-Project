import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  buyCourseWithCredits,
  getCoursePromotion,
  getMyCourseEnrollment,
  startCourseBkashPurchase,
} from "../api/coursePromotions";
import { useAuth } from "../context/AuthContext";
import { useReviewNotifications } from "../context/ReviewNotificationContext";

const CoursePromoLanding = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user, setUserProfile } = useAuth();
  const { markPromotionReadById } = useReviewNotifications();

  const [promo, setPromo] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [creditConfirmOpen, setCreditConfirmOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const purchaseBanner = useMemo(() => {
    const p = searchParams.get("purchase");
    if (p === "success") return { kind: "ok", text: "Purchase completed. You are enrolled." };
    if (p === "failed") return { kind: "err", text: "bKash reported a failed payment." };
    if (p === "cancelled") return { kind: "err", text: "Checkout was cancelled." };
    if (p === "error") {
      const r = searchParams.get("reason");
      return { kind: "err", text: r ? `Payment issue: ${r.replace(/_/g, " ")}` : "Payment could not be completed." };
    }
    return null;
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError("");
    try {
      const { data } = await getCoursePromotion(id);
      setPromo(data?.data || null);
    } catch (e) {
      setPromo(null);
      setLoadError(e.response?.data?.message || "Could not load this course.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !id) return;
    void markPromotionReadById(id);
  }, [token, id, markPromotionReadById]);

  useEffect(() => {
    if (!token || !id) {
      setEnrollment(null);
      return;
    }
    let c = false;
    (async () => {
      try {
        const { data } = await getMyCourseEnrollment(id);
        if (!c) setEnrollment(data?.data || null);
      } catch {
        if (!c) setEnrollment(null);
      }
    })();
    return () => {
      c = true;
    };
  }, [token, id, load]);

  useEffect(() => {
    if (searchParams.get("purchase") !== "success" || !token || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getMyCourseEnrollment(id);
        if (!cancelled) setEnrollment(data?.data || null);
      } catch {
        if (!cancelled) setEnrollment(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, token, id]);

  const bdtPrice = Number(promo?.priceBdt ?? 0);
  const creditPrice = Math.max(0, Math.floor(Number(promo?.priceCredits ?? 0)));
  const canPayBkash = Number.isFinite(bdtPrice) && bdtPrice >= 1;
  const canPayCredits = creditPrice >= 1;
  const enrolled = Boolean(enrollment);

  const balance = Number(user?.totalCredits ?? user?.credits ?? 0);
  const afterPurchase = balance - creditPrice;

  const openBuy = () => {
    setActionMessage("");
    if (!token) {
      navigate("/login", { state: { from: `/courses/promo/${id}` } });
      return;
    }
    setBuyOpen(true);
  };

  const handleBkash = async () => {
    if (!canPayBkash) return;
    setBusy("bkash");
    setActionMessage("");
    try {
      const { data } = await startCourseBkashPurchase(id);
      const d = data?.data;
      if (d?.demoMode && d?.orderId && d?.promotionId) {
        navigate(`/courses/promo/bkash-demo?orderId=${d.orderId}&promotionId=${d.promotionId}`);
        return;
      }
      const url = d?.bkashURL;
      if (url) {
        window.location.assign(url);
        return;
      }
      setActionMessage(data?.message || "Could not start bKash checkout.");
    } catch (e) {
      setActionMessage(e.response?.data?.message || "Could not start bKash checkout.");
    } finally {
      setBusy("");
    }
  };

  const handleCreditsConfirm = async () => {
    setBusy("credits");
    setActionMessage("");
    try {
      const { data } = await buyCourseWithCredits(id);
      const w = data?.data?.wallet;
      if (w && user) {
        setUserProfile({
          ...user,
          credits: Number(w.totalCredits || 0),
          totalCredits: Number(w.totalCredits || 0),
          heldCredits: Number(w.heldCredits || 0),
        });
      }
      setCreditConfirmOpen(false);
      setBuyOpen(false);
      setEnrollment({ paidWith: "credits" });
      setActionMessage("You are enrolled. Thank you!");
    } catch (e) {
      setActionMessage(e.response?.data?.message || "Purchase failed.");
    } finally {
      setBusy("");
    }
  };

  if (loadError || !promo) {
    return (
      <div className="course-promo-page course-promo-page--center">
        <p className="error">{loadError || "Not found."}</p>
        <Link to="/dashboard" className="button">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="course-promo-page">
      <header className="course-promo-hero">
        <div className="course-promo-hero__inner">
          <p className="course-promo-hero__eyebrow">Featured external course</p>
          <h1 className="course-promo-hero__title">{promo.courseName}</h1>
          <p className="course-promo-hero__instructor">
            Instructor: <strong>{promo.instructorName}</strong>
          </p>
          <div className="course-promo-hero__chips">
            {canPayBkash ? <span className="course-promo-chip">৳{bdtPrice} with bKash</span> : null}
            {canPayCredits ? <span className="course-promo-chip">{creditPrice} credits</span> : null}
          </div>
        </div>
      </header>

      {purchaseBanner ? (
        <div className={`course-promo-banner course-promo-banner--${purchaseBanner.kind}`}>{purchaseBanner.text}</div>
      ) : null}

      <main className="course-promo-main">
        <section className="course-promo-section">
          <h2>About this course</h2>
          <div className="course-promo-body">{promo.content}</div>
        </section>

        <section className="course-promo-section course-promo-cta-wrap">
          {enrolled ? (
            <div className="course-promo-enrolled">
              <strong>You are enrolled.</strong> We will follow up with access details from the course provider if
              applicable.
            </div>
          ) : (
            <>
              <button type="button" className="button course-promo-cta" onClick={openBuy}>
                Buy this course now
              </button>
              {actionMessage ? <p className="module2-muted course-promo-action-msg">{actionMessage}</p> : null}
            </>
          )}
          <p className="module2-muted course-promo-back">
            <Link to="/dashboard">← Back to dashboard</Link>
            {" · "}
            <Link to="/notifications">Notifications</Link>
          </p>
        </section>
      </main>

      {buyOpen ? (
        <>
          <div className="course-promo-modal-overlay" role="presentation" onClick={() => !busy && setBuyOpen(false)} />
          <div className="course-promo-modal" role="dialog" aria-modal="true" aria-label="Choose payment">
            <h3>How would you like to pay?</h3>
            <div className="course-promo-modal__actions">
              {canPayBkash ? (
                <button type="button" className="button" disabled={Boolean(busy)} onClick={handleBkash}>
                  {busy === "bkash" ? "Starting…" : `Buy with money (৳${bdtPrice})`}
                </button>
              ) : (
                <p className="module2-muted">Cash checkout is not enabled for this listing.</p>
              )}
              {canPayCredits ? (
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setBuyOpen(false);
                    setCreditConfirmOpen(true);
                  }}
                >
                  Buy with credits ({creditPrice} cr)
                </button>
              ) : (
                <p className="module2-muted">Credit checkout is not enabled for this listing.</p>
              )}
            </div>
            <button type="button" className="button button--ghost course-promo-modal__close" disabled={Boolean(busy)} onClick={() => setBuyOpen(false)}>
              Close
            </button>
          </div>
        </>
      ) : null}

      {creditConfirmOpen ? (
        <>
          <div
            className="course-promo-modal-overlay"
            role="presentation"
            onClick={() => !busy && setCreditConfirmOpen(false)}
          />
          <div className="course-promo-modal" role="dialog" aria-modal="true" aria-label="Confirm credit purchase">
            <h3>Confirm credit purchase</h3>
            <p>
              Are you sure you want to buy <strong>{promo.courseName}</strong> for <strong>{creditPrice} credits</strong>?
            </p>
            <p className="course-promo-balance-line">
              Your balance: <strong>{balance}</strong> credits.
              <br />
              After purchase you would have: <strong>{afterPurchase >= 0 ? afterPurchase : "—"}</strong> credits.
            </p>
            {afterPurchase < 0 ? (
              <p className="error">Not enough credits for this purchase.</p>
            ) : null}
            <div className="course-promo-modal__actions">
              <button type="button" className="button" disabled={Boolean(busy) || afterPurchase < 0} onClick={handleCreditsConfirm}>
                {busy === "credits" ? "Processing…" : "Yes, buy with credits"}
              </button>
              <button
                type="button"
                className="button button--ghost"
                disabled={Boolean(busy)}
                onClick={() => setCreditConfirmOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default CoursePromoLanding;
