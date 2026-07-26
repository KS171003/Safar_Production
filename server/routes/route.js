const express = require("express");
const Route = require("../models/Route");
const Bus = require("../models/Bus");
const router = express.Router();

// Get all routes
router.get("/", async (req, res) => {
  try {
    const routes = await Route.find({ isActive: true }).populate(
      "createdBy",
      "name email"
    );
    res.json(routes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get route by ID
router.get("/:id", async (req, res) => {
  try {
    const route = await Route.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new route
router.post("/", async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update route
router.put("/:id", async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete route
router.delete("/:id", async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }

    res.json({ message: "Route deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search routes by location
router.get("/search/location", async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get active buses on route
router.get("/:id/buses", async (req, res) => {
  try {
    const buses = await Bus.find({
      routeId: req.params.id,
      isActive: true,
      isOnRoute: true,
    }).populate("conductorId", "name phone");

    res.json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

module.exports = router;
