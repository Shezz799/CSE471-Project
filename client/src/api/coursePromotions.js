import api from "./axios";

export const listCourseCatalog = (params) => api.get("/api/course-promotions/catalog", { params });

export const getCoursePromotion = (id) => api.get(`/api/course-promotions/${id}`);

export const getMyCourseEnrollment = (id) => api.get(`/api/course-promotions/${id}/enrollment`);

export const buyCourseWithCredits = (id) => api.post(`/api/course-promotions/${id}/purchase/credits`);

export const startCourseBkashPurchase = (id) => api.post(`/api/course-promotions/${id}/purchase/bkash/start`);

export const getCourseBkashDemoOrder = (orderId) => api.get(`/api/course-promotions/purchase/bkash/demo/${orderId}`);

export const completeCourseBkashDemoPurchase = (orderId) =>
  api.post(`/api/course-promotions/purchase/bkash/demo/complete`, { orderId });

export const adminCreateCoursePromotion = (body) => api.post(`/api/course-promotions/admin/promotions`, body);

export const adminListCoursePromotions = () => api.get(`/api/course-promotions/admin/promotions`);

export const adminUpdateCoursePromotion = (id, body) => api.patch(`/api/course-promotions/admin/promotions/${id}`, body);

export const adminDeleteCoursePromotion = (id) => api.delete(`/api/course-promotions/admin/promotions/${id}`);

export const getPromotionInbox = () => api.get("/api/course-promotions/inbox/me");

export const markPromotionInboxRead = (promotionId) => api.post(`/api/course-promotions/inbox/${promotionId}/read`);
