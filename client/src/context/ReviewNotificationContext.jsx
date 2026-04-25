import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getPromotionInbox, markPromotionInboxRead } from "../api/coursePromotions";
import { connectChatSocket } from "../socket/chatSocket";
import { useAuth } from "./AuthContext";

const ReviewNotificationContext = createContext(null);

const mergePromotionInboxIntoItems = (rows) => (prev) => {
  const nonPromo = prev.filter((i) => i.notificationKind !== "promotion");
  const fromServer = (rows || [])
    .filter((r) => r.promotionId)
    .map((r) => ({
      title: r.title,
      message: r.message,
      link: r.link || `/courses/promo/${r.promotionId}`,
      promotionId: String(r.promotionId),
      notificationKind: "promotion",
      localId: `promo-inbox-${r.promotionId}`,
      receivedAt: Date.now(),
      read: Boolean(r.read),
    }));
  const serverIds = new Set(fromServer.map((x) => x.promotionId));
  const orphanPromo = prev.filter(
    (i) => i.notificationKind === "promotion" && i.promotionId && !serverIds.has(String(i.promotionId))
  );
  return [...fromServer, ...orphanPromo, ...nonPromo].slice(0, 60);
};

export function ReviewNotificationProvider({ children }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);

  const refreshPromotionInbox = useCallback(() => {
    if (!token) return Promise.resolve();
    return getPromotionInbox()
      .then(({ data }) => {
        const rows = Array.isArray(data?.data) ? data.data : [];
        setItems(mergePromotionInboxIntoItems(rows));
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const tick = () => {
      if (document.visibilityState === "visible") {
        void refreshPromotionInbox();
      }
    };
    tick();
    const interval = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [token, refreshPromotionInbox]);

  useEffect(() => {
    if (!token) return;
    const socket = connectChatSocket(token);
    if (!socket) return;

    const pullPromotionInbox = () => {
      getPromotionInbox()
        .then(({ data }) => {
          const rows = Array.isArray(data?.data) ? data.data : [];
          setItems(mergePromotionInboxIntoItems(rows));
        })
        .catch(() => {});
    };

    const onReviewReceived = (payload) => {
      if (!payload?.reviewId) return;
      setItems((prev) =>
        [
          {
            ...payload,
            notificationKind: "review",
            localId: `${payload.reviewId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            receivedAt: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, 40)
      );
    };

    const onWalletUpdate = (payload) => {
      if (!payload?.title) return;
      setItems((prev) =>
        [
          {
            ...payload,
            notificationKind: "wallet",
            localId: `w-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            receivedAt: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, 40)
      );
    };

    const onPlatformIncome = (payload) => {
      if ((user?.role || "") !== "admin") return;
      if (!payload?.title) return;
      setItems((prev) =>
        [
          {
            ...payload,
            notificationKind: "admin_income",
            localId: `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            receivedAt: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, 40)
      );
    };

    const onComplaintUpdate = (payload) => {
      if (!payload?.title) return;
      setItems((prev) =>
        [
          {
            ...payload,
            notificationKind: "complaint",
            localId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            receivedAt: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, 40)
      );
    };

    const onPromotionNew = (payload) => {
      if (!payload?.title) return;
      const promotionId =
        payload.promotionId ||
        (typeof payload.link === "string" && payload.link.includes("/courses/promo/")
          ? payload.link.replace(/^.*\/courses\/promo\//, "").split(/[/?#]/)[0]
          : "");
      setItems((prev) => {
        if (
          promotionId &&
          prev.some((i) => i.notificationKind === "promotion" && String(i.promotionId || "") === String(promotionId))
        ) {
          return prev;
        }
        return [
          {
            ...payload,
            promotionId: promotionId || undefined,
            notificationKind: "promotion",
            localId: `pr-${promotionId || Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            receivedAt: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, 60);
      });
    };

    socket.on("review:received", onReviewReceived);
    socket.on("wallet:update", onWalletUpdate);
    socket.on("platform:income", onPlatformIncome);
    socket.on("complaint:update", onComplaintUpdate);
    socket.on("promotion:new", onPromotionNew);
    socket.on("connect", pullPromotionInbox);
    pullPromotionInbox();

    return () => {
      socket.off("review:received", onReviewReceived);
      socket.off("wallet:update", onWalletUpdate);
      socket.off("platform:income", onPlatformIncome);
      socket.off("complaint:update", onComplaintUpdate);
      socket.off("promotion:new", onPromotionNew);
      socket.off("connect", pullPromotionInbox);
    };
  }, [token, user?.role]);

  const markPromotionReadById = useCallback(
    async (promotionId) => {
      if (!token || !promotionId) return;
      try {
        await markPromotionInboxRead(promotionId);
      } catch {
        /* ignore */
      }
      setItems((prev) =>
        prev.map((i) => (String(i.promotionId) === String(promotionId) ? { ...i, read: true } : i))
      );
    },
    [token]
  );

  const dismiss = useCallback((localId) => {
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((i) => (i.read ? i : { ...i, read: true })));
  }, []);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const value = useMemo(
    () => ({
      items,
      dismiss,
      clearAll,
      markAllRead,
      unreadCount,
      markPromotionReadById,
      refreshPromotionInbox,
    }),
    [items, dismiss, clearAll, markAllRead, unreadCount, markPromotionReadById, refreshPromotionInbox]
  );

  return <ReviewNotificationContext.Provider value={value}>{children}</ReviewNotificationContext.Provider>;
}

export function useReviewNotifications() {
  const ctx = useContext(ReviewNotificationContext);
  if (!ctx) {
    throw new Error("useReviewNotifications must be used within ReviewNotificationProvider");
  }
  return ctx;
}
