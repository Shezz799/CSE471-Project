import api from "./axios";

export const createComplaint = (body) => api.post("/api/complaints", body);

export const getMyComplaints = () => api.get("/api/complaints/mine");

export const getMyComplaint = (id) => api.get(`/api/complaints/mine/${id}`);

export const submitComplaintAppeal = (id, body) => api.post(`/api/complaints/mine/${id}/appeal`, body);

export const getAllComplaints = (params) => api.get("/api/complaints", { params });

export const getComplaint = (id) => api.get(`/api/complaints/${id}`);

export const updateComplaint = (id, body) => api.patch(`/api/complaints/${id}`, body);

export const resolveComplaint = (id, body) => api.post(`/api/complaints/${id}/resolve`, body);
