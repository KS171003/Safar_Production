const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const Bus = require("../models/Bus");
const TelemetryService = require("../services/telemetryService");
const logger = require("./logger");

/**
 * Initialize Socket.io with JWT authentication and canonical telemetry routing.
 * @param {import("http").Server} server - The HTTP server
 * @returns {import("socket.io").Server} - The socket.io instance
 */
function initializeSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000"],
      methods: ["GET", "POST"],
    },
  });

  // JWT authentication middleware for handshake
  io.use((socket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers["authorization"]?.split(" ")[1];

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
    logger.info("User connected via socket", {
      socketId: socket.id,
      userId: socket.user?.userId,
      userType: socket.user?.userType,
    });

    // Join bus tracking room
    socket.on("join-bus-tracking", (busId) => {
      socket.join(`bus-${busId}`);
      logger.info("Socket joined bus room", { socketId: socket.id, busId });
    });

    // Join route tracking room
    socket.on("join-route-tracking", (routeId) => {
      socket.join(`route-${routeId}`);
      logger.info("Socket joined route room", { socketId: socket.id, routeId });
    });

    // Canonical WebSocket Telemetry Ingestion Pipeline
    socket.on("location-update", async (data, callback) => {
      try {
        const { busId, location, speed, direction, accuracy, sequenceNumber, eventId, deviceTimestamp } = data;

        if (!busId) {
          if (typeof callback === "function") callback({ success: false, message: "Missing busId" });
          return;
        }

        // Ownership Authorization
        if (socket.user.userType === "conductor") {
          const bus = await Bus.findById(busId);
          if (!bus || bus.conductorId.toString() !== socket.user.userId) {
            logger.warn("Socket location update rejected: unauthorized bus access", {
              userId: socket.user.userId,
              busId,
            });
            if (typeof callback === "function") callback({ success: false, message: "Not authorized to operate this vehicle" });
            return;
          }
        } else if (socket.user.userType !== "admin" && socket.user.userType !== "dispatcher") {
          if (typeof callback === "function") callback({ success: false, message: "Role unauthorized for telemetry ingestion" });
          return;
        }

        const lat = location?.latitude !== undefined ? location.latitude : location?.lat;
        const lng = location?.longitude !== undefined ? location.longitude : location?.lng;

        // Route into authoritative TelemetryService
        const result = await TelemetryService.processLocationUpdate({
          busId,
          latitude: lat,
          longitude: lng,
          speed: speed || 0,
          direction: direction || 0,
          accuracy: accuracy || 0,
          sequenceNumber,
          eventId,
          deviceTimestamp,
          io,
        });

        if (typeof callback === "function") {
          callback({ success: true, status: result.status, gpsQuality: result.gpsQuality });
        }
      } catch (err) {
        logger.error("Socket telemetry ingestion failed", { error: err.message });
        if (typeof callback === "function") {
          callback({ success: false, error: err.message });
        }
      }
    });

    socket.on("disconnect", () => {
      logger.info("User disconnected from socket", {
        socketId: socket.id,
        userId: socket.user?.userId,
      });
    });
  });

  return io;
}

module.exports = {
  initializeSocket,
};
