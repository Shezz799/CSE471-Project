import api from "./axios";

export const getPosts = () => api.get("/api/posts");
export const getPostById = (id) => api.get(`/api/posts/${id}`);
export const createPost = (data) => api.post("/api/posts", data);
export const deletePost = (id) => api.delete(`/api/posts/${id}`);
