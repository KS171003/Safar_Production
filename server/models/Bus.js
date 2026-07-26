const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    busNumber: {
      type: String,
      required: true,
      unique: true,
    },
    conductorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    currentLocation: {
      latitude: Number,
      longitude: Number,
      timestamp: Date,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isOnRoute: {
      type: Boolean,
      default: false,
    },
    departureTime: Date,
    estimatedArrivalTime: Date,
    currentStopIndex: {
      type: Number,
      default: 0,
    },
    speed: {
      type: Number,
      default: 0,
    },
    direction: {
      type: Number,
      default: 0,
    },
    emergencyStatus: {
      type: String,
      enum: ["normal", "emergency", "breakdown"],
      default: "normal",
    },
    lastUpdateTime: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Bus", busSchema);
