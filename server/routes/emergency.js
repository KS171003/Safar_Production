const express = require("express");
const EmergencyAlert = require("../models/EmergencyAlert");
const Bus = require("../models/Bus");
const router = express.Router();

// Create emergency alert
router.post("/", async (req, res) => {
  try {
    const {
      busId,
      conductorId,
      alertType,
      description,
      location,
      priority = "high",
    } = req.body;

    const emergencyAlert = new EmergencyAlert({
      busId,
      conductorId,
      alertType,
      description,
      location,
      priority,
    });

    await emergencyAlert.save();

    // Update bus emergency status
    await Bus.findByIdAndUpdate(busId, {
      emergencyStatus: "emergency",
    });

    // Emit emergency alert to all connected clients
    const io = req.app.get("io");
    io.emit("emergency-broadcast", {
      alertId: emergencyAlert._id,
      busId,
      alertType,
      description,
      location,
      priority,
      timestamp: new Date(),
    });

    res.status(201).json({
      message: "Emergency alert created successfully",
      alert: emergencyAlert,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all emergency alerts
router.get("/", async (req, res) => {
  try {
    const { status = "active" } = req.query;

    const alerts = await EmergencyAlert.find({ status })
      .populate("busId", "busNumber")
      .populate("conductorId", "name phone")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get emergency alerts by bus
router.get("/bus/:busId", async (req, res) => {
  try {
    const alerts = await EmergencyAlert.find({ busId: req.params.busId })
      .populate("conductorId", "name phone")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update emergency alert status
router.put("/:id/status", async (req, res) => {
  try {
    const { status, resolvedBy, notes } = req.body;

    const updateData = { status };
    if (status === "resolved") {
      updateData.resolvedBy = resolvedBy;
      updateData.resolvedAt = new Date();
      updateData.notes = notes;
    }

    const alert = await EmergencyAlert.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate("resolvedBy", "name");

    if (!alert) {
      return res.status(404).json({ message: "Emergency alert not found" });
    }

    // If resolved, update bus status back to normal
    if (status === "resolved") {
      await Bus.findByIdAndUpdate(alert.busId, {
        emergencyStatus: "normal",
      });
    }

    res.json({
      message: "Emergency alert status updated successfully",
      alert,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get emergency statistics
router.get("/stats", async (req, res) => {
  try {
    const totalAlerts = await EmergencyAlert.countDocuments();
    const activeAlerts = await EmergencyAlert.countDocuments({
      status: "active",
    });
    const resolvedAlerts = await EmergencyAlert.countDocuments({
      status: "resolved",
    });

    const alertsByType = await EmergencyAlert.aggregate([
      {
        $group: {
          _id: "$alertType",
          count: { $sum: 1 },
        },
      },
    ]);

    const alertsByPriority = await EmergencyAlert.aggregate([
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      alertsByType,
      alertsByPriority,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
