import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pusher from "pusher-js";
import { useAuth } from "../context/AuthContext";
import toast, { Toaster } from "react-hot-toast";
import { connectChatSocket } from "../socket/chatSocket";
import { rejectHelpOffer } from "../api/posts";
import { fetchMyCredits, startSession } from "../api/session";

const OfferNotifications = () => {
  const navigate = useNavigate();
  const { user, token, setUserProfile } = useAuth();
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [creditsToHold, setCreditsToHold] = useState("1");
  const [actionLoading, setActionLoading] = useState("");

  const currentUserId = useMemo(() => {
    return String(user?.id || user?._id || "");
  }, [user?.id, user?._id]);

  const closeOfferModal = () => {
    if (actionLoading) return;
    setSelectedOffer(null);
    setCreditsToHold("1");
  };

  const openOfferModal = (payload) => {
    if (!payload?.postId || !payload?.helperUserId) return;

    const nextCredits = Number(payload.creditsOffered);
    const defaultCredits = Number.isFinite(nextCredits) && nextCredits > 0 ? Math.floor(nextCredits) : 1;
    setSelectedOffer(payload);
    setCreditsToHold(String(defaultCredits));
  };

  const handleStartSession = async () => {
    if (!selectedOffer) return;

    const parsedCredits = Number(creditsToHold);
    if (!Number.isInteger(parsedCredits) || parsedCredits <= 0) {
      toast.error("Enter a valid positive whole number of credits.");
      return;
    }

    setActionLoading("start");

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

      const sessionId = data?.data?.session?._id;
      toast.success("Session started. Credits are now held securely.");
      closeOfferModal();
      navigate(`/messages?with=${selectedOffer.helperUserId}${sessionId ? `&sessionId=${sessionId}` : ""}`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to start session");
    } finally {
      setActionLoading("");
    }
  };

  const handleRejectOffer = async () => {
    if (!selectedOffer) return;

    setActionLoading("reject");

    try {
      await rejectHelpOffer(selectedOffer.postId, selectedOffer.helperUserId);
      toast.success("Offer rejected.");
      closeOfferModal();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject offer");
    } finally {
      setActionLoading("");
    }
  };

  useEffect(() => {
    if (!token || !currentUserId) return;

    const socket = connectChatSocket(token);
    if (!socket) return;

    const onOfferNotification = (payload) => {
      const data = {
        postId: String(payload?.postId || ""),
        postSubject: payload?.postSubject || "your post",
        helperUserId: String(payload?.helperUserId || ""),
        helperName: payload?.helperName || "Someone",
        creditsOffered: Number(payload?.creditsOffered || 0),
      };

      if (!data.postId || !data.helperUserId) return;

      toast.custom(
        (toastObj) => (
          <button
            type="button"
            className="offer-notification-toast"
            onClick={() => {
              openOfferModal(data);
              toast.dismiss(toastObj.id);
            }}
          >
            <strong>{data.helperName}</strong> offered help on <strong>{data.postSubject}</strong>. Click to review.
          </button>
        ),
        { duration: 8000 }
      );
    };

    const onOfferRejected = (payload) => {
      toast(payload?.reason || "Your offer was rejected.", { icon: "!" });
    };

    const onSessionInvite = (payload) => {
      const fromUserName = payload?.fromUserName || "Someone";
      const fromUserId = payload?.fromUserId ? String(payload.fromUserId) : "";
      if (!fromUserId) return;

      toast.custom(
        (toastObj) => (
          <button
            type="button"
            className="offer-notification-toast"
            onClick={() => {
              navigate(`/messages?with=${fromUserId}`);
              toast.dismiss(toastObj.id);
            }}
          >
            <strong>{fromUserName}</strong> started a session with you. Click to join.
          </button>
        ),
        { duration: 9000 }
      );
    };

    const onSessionStarted = (payload) => {
      const helperUserId = payload?.helperUserId ? String(payload.helperUserId) : "";
      const fromUserId = payload?.fromUserId ? String(payload.fromUserId) : "";
      const targetUserId = helperUserId && helperUserId !== currentUserId ? helperUserId : fromUserId;

      if (targetUserId) {
        toast.success("Session started. Open messages to continue.");
      }
    };

    const onWalletUpdate = (payload) => {
      const t = String(payload?.title || "").toLowerCase();
      const m = String(payload?.message || "").toLowerCase();
      if (t.includes("streak") || m.includes("streak")) {
        toast.success(payload?.message || payload?.title || "Wallet updated", { duration: 6500 });
      }
    };

    const onPromotionNew = (payload) => {
      const link = payload?.link || "/notifications";
      const title = payload?.title || "New course";
      const message = payload?.message || "";
      toast.custom(
        (toastObj) => (
          <button
            type="button"
            className="offer-notification-toast"
            onClick={() => {
              navigate(link);
              toast.dismiss(toastObj.id);
            }}
          >
            <strong>{title}</strong>
            {message ? (
              <span style={{ display: "block", marginTop: 6, fontWeight: 400 }}>{message}</span>
            ) : null}
            <span style={{ display: "block", marginTop: 6, fontSize: 12, opacity: 0.9 }}>Tap to view →</span>
          </button>
        ),
        { duration: 10000 }
      );
    };

    const onSessionEnded = async (payload) => {
      const requesterId = String(payload?.requesterId || "");
      const helperId = String(payload?.helperId || "");
      const status = String(payload?.status || "");
      const creditsTransferred = Number(payload?.creditsTransferred || 0);

      if (!currentUserId || (currentUserId !== requesterId && currentUserId !== helperId)) {
        return;
      }

      if (status === "completed" && currentUserId === helperId && creditsTransferred > 0) {
        toast.success(`You received ${creditsTransferred} credit${creditsTransferred === 1 ? "" : "s"}.`);
      }

      const requesterCredits = payload?.requesterCredits;
      const helperCredits = payload?.helperCredits;

      if (currentUserId === requesterId && requesterCredits && user) {
        setUserProfile({
          ...user,
          credits: Number(requesterCredits.totalCredits || 0),
          totalCredits: Number(requesterCredits.totalCredits || 0),
          heldCredits: Number(requesterCredits.heldCredits || 0),
        });
        return;
      }

      if (currentUserId === helperId && helperCredits && user) {
        setUserProfile({
          ...user,
          credits: Number(helperCredits.totalCredits || 0),
          totalCredits: Number(helperCredits.totalCredits || 0),
          heldCredits: Number(helperCredits.heldCredits || 0),
        });
        return;
      }

      try {
        const { data } = await fetchMyCredits();
        const latest = data?.data;
        if (latest && user) {
          setUserProfile({
            ...user,
            credits: Number(latest.totalCredits || 0),
            totalCredits: Number(latest.totalCredits || 0),
            heldCredits: Number(latest.heldCredits || 0),
          });
        }
      } catch {
        // Wallet refresh fallback should not block UI events.
      }
    };

    socket.on("offer_notification", onOfferNotification);
    socket.on("offer_rejected", onOfferRejected);
    socket.on("session_invite", onSessionInvite);
    socket.on("session_started", onSessionStarted);
    socket.on("session_ended", onSessionEnded);
    socket.on("wallet:update", onWalletUpdate);
    socket.on("promotion:new", onPromotionNew);

    return () => {
      socket.off("offer_notification", onOfferNotification);
      socket.off("offer_rejected", onOfferRejected);
      socket.off("session_invite", onSessionInvite);
      socket.off("session_started", onSessionStarted);
      socket.off("session_ended", onSessionEnded);
      socket.off("wallet:update", onWalletUpdate);
      socket.off("promotion:new", onPromotionNew);
    };
  }, [token, currentUserId, navigate, user]);

  useEffect(() => {
    if (!currentUserId || !user) return;

    const pusherKey = import.meta.env.VITE_PUSHER_KEY || "dummy_key";
    const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || "mt1";

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    const globalChannel = pusher.subscribe("global");
    const onPostCreated = (data) => {
      if (String(data.authorId || "") === currentUserId) return;
      toast.success(`${data.authorName} just asked for help on: ${data.subject}`, {
        duration: 5000,
        icon: "!",
      });
    };
    globalChannel.bind("post:created", onPostCreated);

    let adminChannel = null;
    let onComplaintCreated = null;
    if (user.isDashboardAdmin || user.role === "admin") {
      adminChannel = pusher.subscribe("admin-channel");
      onComplaintCreated = (data) => {
        toast.error(`New Complaint Filed: ${data.category} by ${data.complainantName}`, {
          duration: 6000,
          icon: "!",
        });
      };
      adminChannel.bind("complaint:created", onComplaintCreated);
    }

    return () => {
      globalChannel.unbind("post:created", onPostCreated);
      globalChannel.unsubscribe();
      if (adminChannel && onComplaintCreated) {
        adminChannel.unbind("complaint:created", onComplaintCreated);
        adminChannel.unsubscribe();
      }
      pusher.disconnect();
    };
  }, [currentUserId, user]);

  return (
    <>
      <Toaster position="top-right" />

      {selectedOffer && (
        <>
          <div className="offer-notification-modal__overlay" onClick={closeOfferModal} aria-hidden />
          <section className="offer-notification-modal" role="dialog" aria-modal="true" aria-label="Offer notification">
            <h3>New Help Offer</h3>
            <p>
              <strong>{selectedOffer.helperName}</strong> offered to help with <strong>{selectedOffer.postSubject}</strong>.
            </p>

            <label htmlFor="offer-session-credits">Credits to hold for this session</label>
            <input
              id="offer-session-credits"
              type="number"
              min={1}
              step={1}
              value={creditsToHold}
              onChange={(event) => setCreditsToHold(event.target.value)}
              disabled={Boolean(actionLoading)}
            />

            <div className="offer-notification-modal__actions">
              <button
                type="button"
                className="offer-notification-modal__start"
                onClick={handleStartSession}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "start" ? "Starting..." : "Start Session"}
              </button>
              <button
                type="button"
                className="offer-notification-modal__reject"
                onClick={handleRejectOffer}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading === "reject" ? "Rejecting..." : "Reject Offer"}
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
};

export default OfferNotifications;
