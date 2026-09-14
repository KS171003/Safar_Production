const express = require("express");
const EmergencyAlert = require("../models/EmergencyAlert");
const Bus = require("../models/Bus");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { validate, schemas } = require("../middleware/validate");

const router = express.Router();

// Create emergency alert (Conductor assigned to vehicle, Dispatcher, or Admin)
router.post(
  "/",
  authenticateToken,
  requireRole("conductor", "dispatcher", "admin"),
  validate(schemas.createEmergency),
  asyncHandler(async (req, res) => {
    const { busId, alertType, description, location, priority = "high" } = req.body;

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ success: false, message: "Bus not found" });
    }

    // Strict ownership verification: conductors can only trigger alerts for their assigned vehicle
    if (req.user.userType === "conductor" && bus.conductorId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized. You can only dispatch emergency alerts for your assigned bus.",
      });
    }

    // Derive identity securely from authenticated session
    const emergencyAlert = new EmergencyAlert({
      busId: bus._id,
      conductorId: req.user.userId,
      alertType,
      description: description || "",
      location,
      priority,
      status: "active",
    });

    await emergencyAlert.save();

    // Update bus emergency status
    bus.emergencyStatus = "emergency";
    await bus.save();

    // Emit real-time alert to all connected operators and passengers
    const io = req.app.get("io");
    if (io) {
      io.emit("emergency-broadcast", {
        alertId: emergencyAlert._id,
        busId: bus._id,
        busNumber: bus.busNumber,
        alertType,
        description: emergencyAlert.description,
        location,
        priority,
        status: "active",
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      message: "Emergency alert broadcast successfully",
      alert: emergencyAlert,
    });
  })
);

// Get all emergency alerts with status filter
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status = "active", limit = 50 } = req.query;

    const alerts = await EmergencyAlert.find({ status })
      .populate("busId", "busNumber")
      .populate("conductorId", "name phone")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit) || 50, 200));

    res.json(alerts);
  })
);

// Get emergency alerts by bus
router.get(
  "/bus/:busId",
  asyncHandler(async (req, res) => {
    const alerts = await EmergencyAlert.find({ busId: req.params.busId })
      .populate("conductorId", "name phone")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 });

    res.json(alerts);
  })
);

// Update emergency alert status (Acknowledge / Resolve)
router.put(
  "/:id/status",
  authenticateToken,
  requireRole("dispatcher", "admin", "conductor"),
  validate(schemas.updateEmergencyStatus),
  asyncHandler(async (req, res) => {
    const { status, notes } = req.body;

    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: "Emergency alert not found" });
    }

    // Mass-assignment protection with explicit field updates
    alert.status = status;
    if (notes !== undefined) {
      alert.notes = notes;
    }

    if (status === "resolved") {
      alert.resolvedBy = req.user.userId;
      alert.resolvedAt = new Date();

      // Reset bus emergency status back to normal
      await Bus.findByIdAndUpdate(alert.busId, { emergencyStatus: "normal" });

      const io = req.app.get("io");
      if (io) {
        io.emit("emergency-resolved", {
          alertId: alert._id,
          busId: alert.busId,
          timestamp: new Date(),
        });
      }
    }

    await alert.save();
    await alert.populate("resolvedBy", "name");

    res.json({
      success: true,
      message: `Emergency alert status updated to ${status}`,
      alert,
    });
  })
);

// Get emergency statistics
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const totalAlerts = await EmergencyAlert.countDocuments();
    const activeAlerts = await EmergencyAlert.countDocuments({ status: "active" });
    const resolvedAlerts = await EmergencyAlert.countDocuments({ status: "resolved" });

    const alertsByType = await EmergencyAlert.aggregate([
      { $group: { _id: "$alertType", count: { $sum: 1 } } },
    ]);

    const alertsByPriority = await EmergencyAlert.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    res.json({
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      alertsByType,
      alertsByPriority,
    });
  })
);

module.exports = router;
