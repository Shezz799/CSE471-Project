import api from "./axios";

export const startSession = ({ postId, helperUserId, creditsToHold }) =>
  api.post("/api/session/start", { postId, helperUserId, creditsToHold });

export const requestEndSession = (sessionId) =>
  api.post("/api/session/end-request", { sessionId });

export const respondEndSession = (sessionId, action) =>
  api.post("/api/session/respond-end", { sessionId, action });

export const fetchPendingEndSessionRequests = () =>
  api.get("/api/session/end-requests/me");

export const fetchActiveSessionByChat = (chatId) =>
  api.get(`/api/session/chat/${chatId}/active`);

export const fetchMyCredits = () =>
  api.get("/api/session/credits/me");
