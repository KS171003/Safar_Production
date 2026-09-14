const mongoose = require("mongoose");

const emergencyAlertSchema = new mongoose.Schema(
  {
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    conductorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    alertType: {
      type: String,
      enum: ["medical", "accident", "breakdown", "security", "other"],
      required: true,
    },
    description: String,
    location: {
      latitude: Number,
      longitude: Number,
    },
    status: {
      type: String,
      enum: ["active", "acknowledged", "resolved"],
      default: "active",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "high",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: Date,
    notes: String,
  },
  {
    timestamps: true,
  }
);

emergencyAlertSchema.index({ busId: 1, status: 1 });
emergencyAlertSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("EmergencyAlert", emergencyAlertSchema);
