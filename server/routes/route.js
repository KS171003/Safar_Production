const express = require("express");
const Route = require("../models/Route");
const Bus = require("../models/Bus");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { validate, schemas } = require("../middleware/validate");

const router = express.Router();

// Get all active routes with pagination
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const routes = await Route.find({ isActive: true })
      .populate("createdBy", "name email")
      .skip(skip)
      .limit(limit);

    const total = await Route.countDocuments({ isActive: true });

    res.json({
      success: true,
      routes,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  })
);

// Get route by ID
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const route = await Route.findById(req.params.id).populate("createdBy", "name email");

    if (!route) {
      return res.status(404).json({ success: false, message: "Route not found" });
    }

    res.json(route);
  })
);

// Create new route (Dispatcher, Admin, or Conductor)
router.post(
  "/",
  authenticateToken,
  requireRole("dispatcher", "admin", "conductor"),
  validate(schemas.createRoute),
  asyncHandler(async (req, res) => {
    const { routeName, routeNumber, description, stops, totalDistance, estimatedDuration } = req.body;

    const route = new Route({
      routeName,
      routeNumber,
      description,
      stops,
      totalDistance: totalDistance || 0,
      estimatedDuration: estimatedDuration || 0,
      createdBy: req.user.userId, // Strictly derived server-side
    });

    await route.save();

    res.status(201).json({
      success: true,
      message: "Route created successfully",
      route,
    });
  })
);

// Update route with explicit field allowlist
router.put(
  "/:id",
  authenticateToken,
  requireRole("dispatcher", "admin", "conductor"),
  asyncHandler(async (req, res) => {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: "Route not found" });
    }

    // Explicit field updates to prevent mass assignment
    const allowedFields = ["routeName", "routeNumber", "description", "stops", "totalDistance", "estimatedDuration", "isActive"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        route[field] = req.body[field];
      }
    });

    await route.save();

    res.json({
      success: true,
      message: "Route updated successfully",
      route,
    });
  })
);

// Soft delete route
router.delete(
  "/:id",
  authenticateToken,
  requireRole("dispatcher", "admin"),
  asyncHandler(async (req, res) => {
    const route = await Route.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

    if (!route) {
      return res.status(404).json({ success: false, message: "Route not found" });
    }

    res.json({ success: true, message: "Route deactivated successfully" });
  })
);

// Native MongoDB Geospatial Proximity Search for Routes
router.get(
  "/search/location",
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 5 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: "Latitude and longitude are required" });
    }

    // Native MongoDB $nearSphere query on 2dsphere indexed stops
    const nearbyRoutes = await Route.find({
      isActive: true,
      "stops.location": {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseFloat(radius) * 1000, // convert km to meters
        },
      },
    }).populate("createdBy", "name email");

    res.json(nearbyRoutes);
  })
);

// Get active buses on route
router.get(
  "/:id/buses",
  asyncHandler(async (req, res) => {
    const buses = await Bus.find({
      routeId: req.params.id,
      isActive: true,
      isOnRoute: true,
    }).populate("conductorId", "name phone");

    res.json(buses);
  })
);

module.exports = router;
