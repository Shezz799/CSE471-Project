import api from "./axios";

export const fetchChats = () => api.get("/api/chats");
export const fetchUsers = () => api.get("/api/chats/users");
export const fetchInvites = () => api.get("/api/invite");

export const sendInvite = (receiverId) =>
  api.post("/api/invite/send", { receiverId });

export const respondInvite = (inviteId, action) =>
  api.post("/api/invite/respond", { inviteId, action });

export const fetchMessages = (chatId) => api.get(`/api/messages/${chatId}`);

export const uploadMessageWithFile = (chatId, formData) =>
  api.post(`/api/messages/${chatId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
