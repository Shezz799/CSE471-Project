import { io } from "socket.io-client";

let socket;

export const connectChatSocket = (token) => {
  if (!token) return null;
  if (socket?.connected) return socket;

  socket = io(import.meta.env.VITE_API_URL, {
    transports: ["websocket"],
    auth: { token },
  });

  return socket;
};

export const getChatSocket = () => socket;

export const disconnectChatSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
