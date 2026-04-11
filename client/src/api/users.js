import api from "./axios";

export const lookupUserByEmail = (email) =>
  api.get("/api/users/lookup-by-email", { params: { email } });
