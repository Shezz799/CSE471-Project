import { io } from "socket.io-client";

let socket;
let lastAuthToken = null;

const socketApiBase = () =>
  (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).replace(/\/$/, "")) || "http://localhost:5000";

export const connectChatSocket = (token) => {
  if (!token) return null;
  if (socket && socket.connected && lastAuthToken === token) {
    return socket;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  lastAuthToken = token;
  socket = io(socketApiBase(), {
    transports: ["websocket"],
    auth: { token },
  });

  return socket;
};

export const getChatSocket = () => socket;

export const disconnectChatSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  lastAuthToken = null;
};
