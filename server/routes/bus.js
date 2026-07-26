const express = require("express");
const Bus = require("../models/Bus");
const Route = require("../models/Route");
const TrackingData = require("../models/TrackingData");
const router = express.Router();

// Get all buses
router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate("conductorId", "name email phone")
      .populate("routeId", "routeName routeNumber stops");
    res.json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bus by ID
router.get("/:id", async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate("conductorId", "name email phone")
      .populate("routeId", "routeName routeNumber stops");

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    res.json(bus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start route
router.post("/:id/start-route", async (req, res) => {
  try {
    const { routeId } = req.body;
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    // Update bus status
    bus.routeId = routeId;
    bus.isActive = true;
    bus.isOnRoute = true;
    bus.departureTime = new Date();
    bus.currentStopIndex = 0;

    await bus.save();

    // Get route details
    const route = await Route.findById(routeId);

    res.json({
      message: "Route started successfully",
      bus,
      route,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stop route
router.post("/:id/stop-route", async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    bus.isActive = false;
    bus.isOnRoute = false;
    bus.estimatedArrivalTime = null;

    await bus.save();

    res.json({ message: "Route stopped successfully", bus });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update bus location
router.post("/:id/location", async (req, res) => {
  try {
    const { latitude, longitude, speed, direction, accuracy } = req.body;
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    // Update bus location
    bus.currentLocation = {
      latitude,
      longitude,
      timestamp: new Date(),
    };
    bus.speed = speed || 0;
    bus.direction = direction || 0;
    bus.lastUpdateTime = new Date();

    await bus.save();

    // Save tracking data
    const trackingData = new TrackingData({
      busId: bus._id,
      location: { latitude, longitude },
      speed: speed || 0,
      direction: direction || 0,
      accuracy: accuracy || 0,
    });

    await trackingData.save();

    // Emit real-time update
    const io = req.app.get("io");
    io.to(`bus-${bus._id}`).emit("bus-location-update", {
      busId: bus._id,
      location: { latitude, longitude },
      speed: speed || 0,
      direction: direction || 0,
      timestamp: new Date(),
    });

    res.json({ message: "Location updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get buses by route
router.get("/route/:routeId", async (req, res) => {
  try {
    const buses = await Bus.find({
      routeId: req.params.routeId,
      isActive: true,
    }).populate("conductorId", "name phone");

    res.json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bus tracking history
router.get("/:id/tracking-history", async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    const query = { busId: req.params.id };

    if (startTime && endTime) {
      query.timestamp = {
        $gte: new Date(startTime),
        $lte: new Date(endTime),
      };
    }

    const trackingData = await TrackingData.find(query)
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(trackingData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
