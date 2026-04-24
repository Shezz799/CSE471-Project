import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { connectChatSocket } from "../socket/chatSocket";
import { useAuth } from "./AuthContext";

const ReviewNotificationContext = createContext(null);

export function ReviewNotificationProvider({ children }) {
  const { token } = useAuth();
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
            localId: `${payload.reviewId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            receivedAt: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, 40)
      );
    };

    socket.on("review:received", onReviewReceived);
    return () => {
      socket.off("review:received", onReviewReceived);
    };
  }, [token]);

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
