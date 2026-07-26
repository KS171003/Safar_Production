const express = require("express");
const Bus = require("../models/Bus");
const Route = require("../models/Route");
const TrackingData = require("../models/TrackingData");
const router = express.Router();

// Get live bus locations for a route
router.get("/route/:routeId/live", async (req, res) => {
  try {
    const buses = await Bus.find({
      routeId: req.params.routeId,
      isActive: true,
      isOnRoute: true,
    }).populate("conductorId", "name phone");

    res.json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bus location history
router.get("/bus/:busId/history", async (req, res) => {
  try {
    const { hours = 1 } = req.query;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const trackingData = await TrackingData.find({
      busId: req.params.busId,
      timestamp: { $gte: startTime },
    }).sort({ timestamp: 1 });

    res.json(trackingData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Predict arrival time
router.post("/predict-arrival", async (req, res) => {
  try {
    const { busId, passengerLat, passengerLon, destinationStopId } = req.body;

    const bus = await Bus.findById(busId).populate("routeId");
    if (!bus || !bus.routeId) {
      return res.status(404).json({ message: "Bus or route not found" });
    }

    const route = bus.routeId;
    const currentLocation = bus.currentLocation;

    if (!currentLocation) {
      return res.status(400).json({ message: "Bus location not available" });
    }

    // Find destination stop
    const destinationStop = route.stops.find(
      (stop) => stop._id.toString() === destinationStopId
    );

    if (!destinationStop) {
      return res.status(404).json({ message: "Destination stop not found" });
    }

    // Calculate distances and times
    const distanceToDestination = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      destinationStop.location.latitude,
      destinationStop.location.longitude
    );

    const distanceToPassenger = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      passengerLat,
      passengerLon
    );

    // Estimate time based on current speed or average speed
    const averageSpeed = bus.speed > 0 ? bus.speed : 25; // km/h
    const timeToDestination = (distanceToDestination / averageSpeed) * 60; // minutes
    const timeToPassenger = (distanceToPassenger / averageSpeed) * 60; // minutes

    const estimatedArrival = new Date(Date.now() + timeToDestination * 60000);
    const estimatedPassengerPickup = new Date(
      Date.now() + timeToPassenger * 60000
    );

    res.json({
      estimatedArrival,
      estimatedPassengerPickup,
      distanceToDestination: Math.round(distanceToDestination * 1000), // meters
      distanceToPassenger: Math.round(distanceToPassenger * 1000), // meters
      timeToDestination: Math.round(timeToDestination),
      timeToPassenger: Math.round(timeToPassenger),
      currentSpeed: bus.speed,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get nearby buses
router.get("/nearby", async (req, res) => {
  try {
    const { latitude, longitude, radius = 2 } = req.query;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required" });
    }

    const buses = await Bus.find({
      isActive: true,
      isOnRoute: true,
      currentLocation: { $exists: true },
    }).populate("routeId", "routeName routeNumber stops");

    const nearbyBuses = buses.filter((bus) => {
      if (!bus.currentLocation) return false;

      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        bus.currentLocation.latitude,
        bus.currentLocation.longitude
      );

      return distance <= parseFloat(radius);
    });

    res.json(nearbyBuses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get route with live bus positions
router.get("/route/:routeId/with-buses", async (req, res) => {
  try {
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }

    const buses = await Bus.find({
      routeId: req.params.routeId,
      isActive: true,
      isOnRoute: true,
    }).populate("conductorId", "name phone");

    res.json({
      route,
      buses,
    });
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
