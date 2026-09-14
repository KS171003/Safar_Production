const util = require('util');
util.isNullOrUndefined = util.isNullOrUndefined || ((val) => val === undefined || val === null);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
require("dotenv").config();

const logger = require("./utils/logger");
const { initializeSocket } = require("./utils/socketManager");
const { apiLimiter } = require("./middleware/rateLimiter");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const busRoutes = require("./routes/bus");
const routeRoutes = require("./routes/route");
const trackingRoutes = require("./routes/tracking");
const emergencyRoutes = require("./routes/emergency");
const mlRoutes = require("./routes/ml");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);
app.set("io", io);

// Security Middleware
app.use(helmet());
app.use(hpp());
app.use(mongoSanitize());

// Standard Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
}));
app.use(express.json());

// Global Rate Limiter
app.use("/api/", apiLimiter);

// Health & Ready endpoints
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "safar-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
app.get("/ready", (req, res) => {
  if (mongoose.connection.readyState === 1) {
    res.status(200).json({ status: "Ready" });
  } else {
    res.status(503).json({ status: "Not Ready" });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/bus", busRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/ml", mlRoutes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection with retry
const connectWithRetry = () => {
  logger.info("MongoDB connection with retry");
  mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/safar")
    .then(() => {
      logger.info("Connected to MongoDB");
    })
    .catch((err) => {
      logger.error("MongoDB connection error, retrying in 5 seconds...", { error: err.message });
      setTimeout(connectWithRetry, 5000);
    });
};

if (process.env.NODE_ENV !== "test") {
  connectWithRetry();

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info("Received kill signal, shutting down gracefully");
  server.close(() => {
    logger.info("Closed out remaining connections");
    mongoose.connection.close(false, () => {
      logger.info("MongoDB connection closed");
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

module.exports = { app, server };

