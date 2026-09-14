const express = require("express");
const Bus = require("../models/Bus");
const Route = require("../models/Route");
const TrackingData = require("../models/TrackingData");
const TelemetryService = require("../services/telemetryService");
const { authenticateToken, requireRole, verifyBusOwnership } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { locationLimiter } = require("../middleware/rateLimiter");
const { validate, schemas } = require("../middleware/validate");

const router = express.Router();

// Get all buses with computed live/stale status
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const buses = await Bus.find()
      .populate("conductorId", "name email phone")
      .populate("routeId", "routeName routeNumber stops");

    const enriched = buses.map((b) => {
      const plain = b.toObject();
      plain.locationStatus = TelemetryService.getLivenessStatus(b);
      return plain;
    });

    res.json(enriched);
  })
);

// Get bus by ID
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const bus = await Bus.findById(req.params.id)
      .populate("conductorId", "name email phone")
      .populate("routeId", "routeName routeNumber stops");

    if (!bus) {
      return res.status(404).json({ success: false, message: "Bus not found" });
    }

    const plain = bus.toObject();
    plain.locationStatus = TelemetryService.getLivenessStatus(bus);
    res.json(plain);
  })
);

// Start route (Requires Conductor assigned to this bus, Dispatcher, or Admin)
router.post(
  "/:id/start-route",
  authenticateToken,
  requireRole("conductor", "dispatcher", "admin"),
  verifyBusOwnership,
  validate(schemas.startRoute),
  asyncHandler(async (req, res) => {
    const { routeId } = req.body;
    const bus = req.bus; // Attached by verifyBusOwnership middleware

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({ success: false, message: "Route not found" });
    }

    // Explicit field updates to prevent mass-assignment
    bus.routeId = route._id;
    bus.isActive = true;
    bus.isOnRoute = true;
    bus.departureTime = new Date();
    bus.currentStopIndex = 0;

    await bus.save();

    res.json({
      success: true,
      message: "Route started successfully",
      bus,
      route,
    });
  })
);

// Stop route (Requires Conductor assigned to this bus, Dispatcher, or Admin)
router.post(
  "/:id/stop-route",
  authenticateToken,
  requireRole("conductor", "dispatcher", "admin"),
  verifyBusOwnership,
  asyncHandler(async (req, res) => {
    const bus = req.bus;

    bus.isActive = false;
    bus.isOnRoute = false;
    bus.estimatedArrivalTime = null;

    await bus.save();

    res.json({ success: true, message: "Route stopped successfully", bus });
  })
);

// Canonical GPS Telemetry Ingestion via REST
router.post(
  "/:id/location",
  locationLimiter,
  authenticateToken,
  requireRole("conductor", "dispatcher", "admin"),
  verifyBusOwnership,
  validate(schemas.locationUpdate),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, speed, direction, accuracy, sequenceNumber, eventId, deviceTimestamp } = req.body;
    const io = req.app.get("io");

    const result = await TelemetryService.processLocationUpdate({
      busId: req.params.id,
      latitude,
      longitude,
      speed,
      direction,
      accuracy,
      sequenceNumber,
      eventId,
      deviceTimestamp,
      io,
    });

    if (result.status === "REJECTED_INVALID_QUALITY") {
      return res.status(400).json({
        success: false,
        message: `Telemetry rejected: ${result.reason}`,
        quality: result.quality,
      });
    }

    res.json({
      success: true,
      message: "Telemetry ingested into canonical pipeline",
      status: result.status,
      gpsQuality: result.gpsQuality,
      locationStatus: result.bus?.locationStatus,
    });
  })
);

// Get buses by route
router.get(
  "/route/:routeId",
  asyncHandler(async (req, res) => {
    const buses = await Bus.find({
      routeId: req.params.routeId,
      isActive: true,
    }).populate("conductorId", "name phone");

    const enriched = buses.map((b) => {
      const plain = b.toObject();
      plain.locationStatus = TelemetryService.getLivenessStatus(b);
      return plain;
    });

    res.json(enriched);
  })
);

// Get bus tracking history with pagination
router.get(
  "/:id/tracking-history",
  asyncHandler(async (req, res) => {
    const { startTime, endTime, limit = 100 } = req.query;
    const query = { busId: req.params.id };

    if (startTime && endTime) {
      query.serverTimestamp = {
        $gte: new Date(startTime),
        $lte: new Date(endTime),
      };
    }

    const trackingData = await TrackingData.find(query)
      .sort({ serverTimestamp: -1 })
      .limit(Math.min(parseInt(limit) || 100, 500));

    res.json(trackingData);
  })
);

module.exports = router;
