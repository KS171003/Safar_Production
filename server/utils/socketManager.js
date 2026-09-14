const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("./logger");

/**
 * Initialize Socket.io with JWT authentication
 * @param {import("http").Server} server - The HTTP server
 * @returns {import("socket.io").Server} - The socket.io instance
 */
function initializeSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers["authorization"]?.split(" ")[1];
    
    if (!token) {
      logger.warn("Socket connection attempt without token");
      return next(new Error("Authentication error: No token provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        logger.warn("Socket connection attempt with invalid token", { error: err.message });
        return next(new Error("Authentication error: Invalid token"));
      }
      
      socket.user = decoded;
      next();
    });
  });

  io.on("connection", (socket) => {
    logger.info("User connected via socket", { socketId: socket.id, userId: socket.user?.userId });

    // Join bus tracking room
    socket.on("join-bus-tracking", (busId) => {
      socket.join(`bus-${busId}`);
      logger.info(`Socket joined bus room`, { socketId: socket.id, busId });
    });

    // Join route tracking room
    socket.on("join-route-tracking", (routeId) => {
      socket.join(`route-${routeId}`);
      logger.info(`Socket joined route room`, { socketId: socket.id, routeId });
    });

    // Handle location updates from conductors
    socket.on("location-update", (data) => {
      const { busId, location, speed, direction } = data;

      // Broadcast to all passengers tracking this bus
      socket.to(`bus-${busId}`).emit("bus-location-update", {
        busId,
        location,
        speed,
        direction,
        timestamp: new Date(),
      });
    });

    // Handle emergency alerts
    socket.on("emergency-alert", (data) => {
      const { busId, alertType, description, location } = data;

      // Broadcast emergency to all connected clients
      io.emit("emergency-broadcast", {
        busId,
        alertType,
        description,
        location,
        timestamp: new Date(),
      });
    });

    socket.on("disconnect", () => {
      logger.info("User disconnected from socket", { socketId: socket.id, userId: socket.user?.userId });
    });
  });

  return io;
}

module.exports = {
  initializeSocket
};
