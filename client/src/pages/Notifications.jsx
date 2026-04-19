import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReviewNotifications } from "../context/ReviewNotificationContext";
import { useAuth } from "../context/AuthContext";
import { connectChatSocket } from "../socket/chatSocket";
import { getMyOfferNotifications, rejectHelpOffer } from "../api/posts";
import { fetchPendingEndSessionRequests, respondEndSession, startSession } from "../api/session";

const Notifications = () => {
  const navigate = useNavigate();
  const { user, token, setUserProfile } = useAuth();
  const { items, dismiss, clearAll, markAllRead } = useReviewNotifications();
  const [offerItems, setOfferItems] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [endRequestItems, setEndRequestItems] = useState([]);
  const [endRequestsLoading, setEndRequestsLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [creditsToHold, setCreditsToHold] = useState("1");
  const [offerActionLoading, setOfferActionLoading] = useState("");
  const [endActionLoading, setEndActionLoading] = useState("");

  const loadOfferNotifications = useCallback(async () => {
    if (!token) {
      setOfferItems([]);
      setOffersLoading(false);
      return;
    }

    setOffersLoading(true);
    try {
      const { data } = await getMyOfferNotifications();
      setOfferItems(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setOfferItems([]);
    } finally {
      setOffersLoading(false);
    }
  }, [token]);

  const loadPendingEndRequests = useCallback(async () => {
    if (!token) {
      setEndRequestItems([]);
      setEndRequestsLoading(false);
      return;
    }

    setEndRequestsLoading(true);
    try {
      const { data } = await fetchPendingEndSessionRequests();
      setEndRequestItems(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setEndRequestItems([]);
    } finally {
      setEndRequestsLoading(false);
    }
  }, [token]);

  const closeOfferModal = (force = false) => {
    if (offerActionLoading && !force) return;
    setSelectedOffer(null);
    setCreditsToHold("1");
  };

  const openOfferModal = (offer) => {
    setSelectedOffer(offer);
    const suggested = Number(offer?.suggestedCredits || 0);
    const defaultCredits = Number.isFinite(suggested) && suggested > 0 ? Math.floor(suggested) : 1;
    setCreditsToHold(String(defaultCredits));
  };

  const handleStartSessionFromOffer = async () => {
    if (!selectedOffer) return;

    const parsedCredits = Number(creditsToHold);
    if (!Number.isInteger(parsedCredits) || parsedCredits <= 0) {
      alert("Please enter a valid positive whole number of credits.");
      return;
    }

    setOfferActionLoading("start");
    try {
      const { data } = await startSession({
        postId: selectedOffer.postId,
        helperUserId: selectedOffer.helperUserId,
        creditsToHold: parsedCredits,
      });

      const requesterCredits = data?.data?.requesterCredits;
      if (requesterCredits && user) {
        setUserProfile({
          ...user,
          credits: requesterCredits.totalCredits,
          totalCredits: requesterCredits.totalCredits,
          heldCredits: requesterCredits.heldCredits,
        });
      }

      await loadOfferNotifications();
      closeOfferModal(true);
      navigate(`/messages?with=${selectedOffer.helperUserId}`);
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to start session");
    } finally {
      setOfferActionLoading("");
    }
  };

  const handleRejectOfferFromModal = async () => {
    if (!selectedOffer) return;

    setOfferActionLoading("reject");
    try {
      await rejectHelpOffer(selectedOffer.postId, selectedOffer.helperUserId);
      await loadOfferNotifications();
      closeOfferModal(true);
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to reject offer");
    } finally {
      setOfferActionLoading("");
    }
  };

  const handleRespondToEndRequest = async (requestItem, decision) => {
    if (!requestItem?.sessionId) return;

    const loadingKey = `${requestItem.sessionId}:${decision}`;
    setEndActionLoading(loadingKey);

    try {
      const { data } = await respondEndSession(requestItem.sessionId, decision);
      const payload = data?.data;
      const session = payload?.session;

      if (decision === "accept" && user && session) {
        const currentUserId = String(user?.id || user?._id || "");
        const requesterId = String(session?.requesterId?._id || session?.requesterId || "");
        const helperId = String(session?.helperId?._id || session?.helperId || "");

        if (currentUserId && currentUserId === requesterId && payload?.requesterCredits) {
          setUserProfile({
            ...user,
            credits: Number(payload.requesterCredits.totalCredits || 0),
            totalCredits: Number(payload.requesterCredits.totalCredits || 0),
            heldCredits: Number(payload.requesterCredits.heldCredits || 0),
          });
        }

        if (currentUserId && currentUserId === helperId && payload?.helperCredits) {
          setUserProfile({
            ...user,
            credits: Number(payload.helperCredits.totalCredits || 0),
            totalCredits: Number(payload.helperCredits.totalCredits || 0),
            heldCredits: Number(payload.helperCredits.heldCredits || 0),
          });
        }
      }

      await Promise.all([loadPendingEndRequests(), loadOfferNotifications()]);
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to respond to end request");
    } finally {
      setEndActionLoading("");
    }
  };

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  useEffect(() => {
    loadOfferNotifications();
    loadPendingEndRequests();
  }, [loadOfferNotifications, loadPendingEndRequests]);

  useEffect(() => {
    if (!token) return;
    const socket = connectChatSocket(token);
    if (!socket) return;

    const refresh = () => {
      loadOfferNotifications();
      loadPendingEndRequests();
    };

    socket.on("offer_notification", refresh);
    socket.on("offer_rejected", refresh);
    socket.on("end_session_request", refresh);
    socket.on("session_started", refresh);
    socket.on("session_ended", refresh);

    return () => {
      socket.off("offer_notification", refresh);
      socket.off("offer_rejected", refresh);
      socket.off("end_session_request", refresh);
      socket.off("session_started", refresh);
      socket.off("session_ended", refresh);
    };
  }, [token, loadOfferNotifications, loadPendingEndRequests]);

  const reviewCount = items.length;

  return (
    <div className="module2-page notifications-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Notifications</h1>
          <p className="module2-page__subtitle">
            New <strong>reviews</strong> and other alerts appear here. Open{" "}
            <Link to="/reviews">Ratings &amp; reviews</Link> for your full received history.
          </p>
        </div>
        <div className="notifications-page__header-actions">
          {reviewCount > 0 && (
            <button type="button" className="button button--ghost notifications-page__clear" onClick={clearAll}>
              Clear all
            </button>
          )}
          <button type="button" className="button module2-page__back" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </header>

      <section className="card module2-card notifications-page__offer-card">
        <h2 className="notifications-page__section-title">Help offers on your posts</h2>
        <p className="notifications-page__section-subtitle">
          Missed a popup? You can still accept or reject pending offers here.
        </p>

        {offersLoading ? (
          <p className="module2-muted">Loading pending offers...</p>
        ) : offerItems.length === 0 ? (
          <p className="module2-muted">No pending help offers right now.</p>
        ) : (
          <ul className="notifications-page__offer-list">
            {offerItems.map((offer) => (
              <li key={offer.id} className="notifications-page__offer-item">
                <div className="notifications-page__offer-main">
                  <p className="notifications-page__offer-line">
                    <strong>{offer.helperName}</strong> offered to help with <strong>{offer.postSubject}</strong>
                    {offer.postTopic ? <span className="notifications-page__item-meta"> · {offer.postTopic}</span> : null}
                  </p>
                  <p className="notifications-page__offer-meta">
                    Suggested credits: {offer.suggestedCredits > 0 ? offer.suggestedCredits : "not set"}
                  </p>
                </div>
                <button
                  type="button"
                  className="button notifications-page__offer-action"
                  onClick={() => openOfferModal(offer)}
                >
                  Review offer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card module2-card notifications-page__end-card">
        <h2 className="notifications-page__section-title">End session requests</h2>
        <p className="notifications-page__section-subtitle">
          If someone asks to end a paid session and you miss the chat popup, respond here.
        </p>

        {endRequestsLoading ? (
          <p className="module2-muted">Loading end-session requests...</p>
        ) : endRequestItems.length === 0 ? (
          <p className="module2-muted">No pending end-session requests.</p>
        ) : (
          <ul className="notifications-page__end-list">
            {endRequestItems.map((requestItem) => {
              const acceptKey = `${requestItem.sessionId}:accept`;
              const rejectKey = `${requestItem.sessionId}:reject`;
              const isAccepting = endActionLoading === acceptKey;
              const isRejecting = endActionLoading === rejectKey;
              const isBusy = Boolean(endActionLoading);

              return (
                <li key={requestItem.id} className="notifications-page__end-item">
                  <div className="notifications-page__end-main">
                    <p className="notifications-page__end-line">
                      <strong>{requestItem.fromUserName}</strong> wants to end your session
                      {requestItem.postSubject ? <span className="notifications-page__item-meta"> · {requestItem.postSubject}</span> : null}
                      {requestItem.postTopic ? <span className="notifications-page__item-meta"> / {requestItem.postTopic}</span> : null}
                    </p>
                    <p className="notifications-page__offer-meta">Credits held in this session: {requestItem.creditsHeld}</p>
                  </div>

                  <div className="notifications-page__end-actions">
                    <button
                      type="button"
                      className="button notifications-page__offer-action"
                      onClick={() => navigate(`/messages?with=${requestItem.fromUserId}`)}
                      disabled={isBusy}
                    >
                      Open chat
                    </button>
                    <button
                      type="button"
                      className="button notifications-page__offer-action"
                      onClick={() => handleRespondToEndRequest(requestItem, "reject")}
                      disabled={isBusy}
                    >
                      {isRejecting ? "Keeping..." : "Keep session"}
                    </button>
                    <button
                      type="button"
                      className="button notifications-page__offer-action"
                      onClick={() => handleRespondToEndRequest(requestItem, "accept")}
                      disabled={isBusy}
                    >
                      {isAccepting ? "Ending..." : "Accept end"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {reviewCount === 0 ? (
        <section className="card module2-card notifications-page__empty-card">
          <p className="module2-muted notifications-page__empty-text">
            You&apos;re caught up. When someone rates you while you&apos;re online, it will show here. Other kinds of
            alerts will be added here as the app grows.
          </p>
        </section>
      ) : (
        <ul className="notifications-page__list">
          {items.map((n) => (
            <li key={n.localId} className="notifications-page__item">
              <button
                type="button"
                className="notifications-page__item-main"
                onClick={() => {
                  dismiss(n.localId);
                  navigate("/reviews/all-received");
                }}
              >
                <span className="notifications-page__item-type">Review</span>
                <span className="notifications-page__item-line">
                  <strong>{n.reviewerName}</strong> rated you <strong>{n.rating}★</strong>
                  {n.post?.subject ? (
                    <span className="notifications-page__item-meta">
                      {" "}
                      · {n.post.subject}
                      {n.post.topic ? ` / ${n.post.topic}` : ""}
                    </span>
                  ) : null}
                </span>
                {n.comment ? (
                  <span className="notifications-page__item-comment">&ldquo;{n.comment}&rdquo;</span>
                ) : (
                  <span className="notifications-page__item-comment notifications-page__item-comment--muted">
                    No written comment.
                  </span>
                )}
                <span className="notifications-page__item-cta">View in Ratings &amp; reviews →</span>
              </button>
              <button
                type="button"
                className="notifications-page__item-dismiss"
                onClick={() => dismiss(n.localId)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedOffer && (
        <>
          <div className="offer-notification-modal__overlay" onClick={closeOfferModal} aria-hidden />
          <section className="offer-notification-modal" role="dialog" aria-modal="true" aria-label="Offer action modal">
            <h3>Respond to help offer</h3>
            <p>
              <strong>{selectedOffer.helperName}</strong> offered help on <strong>{selectedOffer.postSubject}</strong>.
            </p>

            <label htmlFor="offer-credits-from-notification">Credits to hold for this session</label>
            <input
              id="offer-credits-from-notification"
              type="number"
              min={1}
              step={1}
              value={creditsToHold}
              onChange={(event) => setCreditsToHold(event.target.value)}
              disabled={Boolean(offerActionLoading)}
            />

            <div className="offer-notification-modal__actions">
              <button
                type="button"
                className="offer-notification-modal__start"
                onClick={handleStartSessionFromOffer}
                disabled={Boolean(offerActionLoading)}
              >
                {offerActionLoading === "start" ? "Starting..." : "Start Session"}
              </button>
              <button
                type="button"
                className="offer-notification-modal__reject"
                onClick={handleRejectOfferFromModal}
                disabled={Boolean(offerActionLoading)}
              >
                {offerActionLoading === "reject" ? "Rejecting..." : "Reject Offer"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Notifications;
