import api from "./axios";

export const getAdminStats = () => api.get("/api/admin/stats");

export const searchAdminUsers = (q) => api.get("/api/admin/users/search", { params: { q } });

export const getAdminUser = (id) => api.get(`/api/admin/users/${id}`);

export const listSuspendedUsers = () => api.get("/api/admin/users/suspended");

export const listBannedUsers = () => api.get("/api/admin/users/banned");

export const listLowRatedUsers = (params) => api.get("/api/admin/users/low-rating", { params });

export const suspendUser = (id, reason) => api.post(`/api/admin/users/${id}/suspend`, { reason });

export const banUser = (id, reason) => api.post(`/api/admin/users/${id}/ban`, { reason });

export const unsuspendUser = (id) => api.post(`/api/admin/users/${id}/unsuspend`);

export const unbanUser = (id) => api.post(`/api/admin/users/${id}/unban`);

export const releaseBannedEmail = (id) => api.post(`/api/admin/users/${id}/release-email`);

export const sendCoachEmail = (id, message) => api.post(`/api/admin/users/${id}/coach-email`, { message });
