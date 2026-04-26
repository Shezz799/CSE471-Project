import api from "./axios";

export const createReview = (body) => api.post("/api/reviews", body);

export const getReviewStats = (userId) => api.get(`/api/reviews/stats/${userId}`);

export const getReviewsForUser = (userId, params) =>
  api.get(`/api/reviews/user/${userId}`, { params });

export const getMyReviewsGiven = () => api.get("/api/reviews/me/given");

export const getMyReviewsReceived = () => api.get("/api/reviews/me/received");

export const deleteMyReview = (reviewId) => api.delete(`/api/reviews/${reviewId}`);
