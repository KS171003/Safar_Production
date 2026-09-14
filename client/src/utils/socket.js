import { io } from 'socket.io-client';

let socket;

export const createSocket = (token) => {
  if (socket) return socket;
  
  const url = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
  
  socket = io(url, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
