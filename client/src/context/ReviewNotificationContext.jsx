import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { connectChatSocket } from "../socket/chatSocket";
import { useAuth } from "./AuthContext";

const ReviewNotificationContext = createContext(null);

export function ReviewNotificationProvider({ children }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!token) return;
    const socket = connectChatSocket(token);
    if (!socket) return;

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

    socket.on("review:received", onReviewReceived);
    socket.on("wallet:update", onWalletUpdate);
    socket.on("platform:income", onPlatformIncome);
    socket.on("complaint:update", onComplaintUpdate);
    return () => {
      socket.off("review:received", onReviewReceived);
      socket.off("wallet:update", onWalletUpdate);
      socket.off("platform:income", onPlatformIncome);
      socket.off("complaint:update", onComplaintUpdate);
    };
  }, [token, user?.role]);

  const dismiss = useCallback((localId) => {
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((i) => (i.read ? i : { ...i, read: true })));
  }, []);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const value = useMemo(
    () => ({ items, dismiss, clearAll, markAllRead, unreadCount }),
    [items, dismiss, clearAll, markAllRead, unreadCount]
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
