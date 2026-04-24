import api from "./axios";

export const lookupUserByEmail = (email) =>
  api.get("/api/users/lookup-by-email", { params: { email } });

export const getPublicProfile = (userId) => api.get(`/api/users/public/${userId}`);

export const getUserAnalytics = () => api.get("/api/users/analytics");
