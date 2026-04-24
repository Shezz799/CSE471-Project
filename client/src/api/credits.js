import api from "./axios";

export const getCreditStoreData = () => api.get("/api/credits/store");

export const purchaseCredits = (body) => api.post("/api/credits/purchase", body);

export const startBkashPurchase = (body) => api.post("/api/credits/purchase/bkash/start", body);

export const getBkashDemoOrder = (orderId) => api.get(`/api/credits/purchase/bkash/demo/${orderId}`);

export const completeBkashDemoPurchase = (orderId) =>
  api.post("/api/credits/purchase/bkash/demo/complete", { orderId });

export const redeemGift = (body) => api.post("/api/credits/redeem", body);

export const getMyCreditLedger = (params) => api.get("/api/credits/ledger/me", { params });
