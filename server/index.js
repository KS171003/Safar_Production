const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const busRoutes = require("./routes/bus");
const routeRoutes = require("./routes/route");
const trackingRoutes = require("./routes/tracking");
const emergencyRoutes = require("./routes/emergency");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/safar", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/bus", busRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/emergency", emergencyRoutes);

// Socket.io for real-time updates
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join bus tracking room
  socket.on("join-bus-tracking", (busId) => {
    socket.join(`bus-${busId}`);
    console.log(`Socket ${socket.id} joined bus-${busId}`);
  });

  // Join route tracking room
  socket.on("join-route-tracking", (routeId) => {
    socket.join(`route-${routeId}`);
    console.log(`Socket ${socket.id} joined route-${routeId}`);
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
    console.log("User disconnected:", socket.id);
  });
});

// Make io available to routes
app.set("io", io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
