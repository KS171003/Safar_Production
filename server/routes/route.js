const express = require("express");
const Route = require("../models/Route");
const Bus = require("../models/Bus");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { validate, schemas } = require("../middleware/validate");
const { calculateDistance } = require("../utils/haversine");

const router = express.Router();

// Get all routes
router.get("/", asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const routes = await Route.find({ isActive: true })
    .populate("createdBy", "name email")
    .skip(skip)
    .limit(limit);
    
  const total = await Route.countDocuments({ isActive: true });

  res.json({
    routes,
    page,
    totalPages: Math.ceil(total / limit),
    total
  });
}));

// Get route by ID
router.get("/:id", asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id).populate(
    "createdBy",
    "name email"
  );

  if (!route) {
    return res.status(404).json({ message: "Route not found" });
  }

  res.json(route);
}));

// Create new route
router.post("/", authenticateToken, requireRole("conductor"), validate(schemas.createRoute), asyncHandler(async (req, res) => {
  const { routeName, routeNumber, description, stops, createdBy } = req.body;

  const route = new Route({
    routeName,
    routeNumber,
    description,
    stops,
    createdBy,
  });

  await route.save();

  res.status(201).json({
    message: "Route created successfully",
    route,
  });
}));

// Update route
router.put("/:id", authenticateToken, requireRole("conductor"), asyncHandler(async (req, res) => {
  const route = await Route.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!route) {
    return res.status(404).json({ message: "Route not found" });
  }

  res.json({
    message: "Route updated successfully",
    route,
  });
}));

// Delete route
router.delete("/:id", authenticateToken, requireRole("conductor"), asyncHandler(async (req, res) => {
  const route = await Route.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!route) {
    return res.status(404).json({ message: "Route not found" });
  }

  res.json({ message: "Route deleted successfully" });
}));

// Search routes by location
router.get("/search/location", asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 5 } = req.query;

  if (!latitude || !longitude) {
    return res
      .status(400)
      .json({ message: "Latitude and longitude are required" });
  }

  const routes = await Route.find({ isActive: true });

  // Filter routes by proximity to stops
  const nearbyRoutes = routes.filter((route) => {
    return route.stops.some((stop) => {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        stop.location.latitude,
        stop.location.longitude
      );
      return distance <= parseFloat(radius);
    });
  });

  res.json(nearbyRoutes);
}));

// Get active buses on route
router.get("/:id/buses", asyncHandler(async (req, res) => {
  const buses = await Bus.find({
    routeId: req.params.id,
    isActive: true,
    isOnRoute: true,
  }).populate("conductorId", "name phone");

  res.json(buses);
}));

module.exports = router;
