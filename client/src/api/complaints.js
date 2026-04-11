import api from "./axios";

export const createComplaint = (body) => api.post("/api/complaints", body);

export const getMyComplaints = () => api.get("/api/complaints/mine");

export const getAllComplaints = (params) => api.get("/api/complaints", { params });

export const getComplaint = (id) => api.get(`/api/complaints/${id}`);

export const updateComplaint = (id, body) => api.patch(`/api/complaints/${id}`, body);
