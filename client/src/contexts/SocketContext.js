import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { createSocket, disconnectSocket } from '../utils/socket';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      const newSocket = createSocket(token);
      setSocket(newSocket);

      const onConnect = () => setIsConnected(true);
      const onDisconnect = () => setIsConnected(false);

      if (newSocket.connected) {
        setIsConnected(true);
      }

      newSocket.on('connect', onConnect);
      newSocket.on('disconnect', onDisconnect);

      return () => {
        newSocket.off('connect', onConnect);
        newSocket.off('disconnect', onDisconnect);
        disconnectSocket();
        setSocket(null);
      };
    } else {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
