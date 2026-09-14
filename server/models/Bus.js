const mongoose = require("mongoose");

/**
 * Bus Schema for Safar application
 */
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
    },
    capacity: {
      type: Number,
      default: 50,
    },
    passengerCount: {
      type: Number,
      default: 0,
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
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

busSchema.index({ routeId: 1, isActive: 1 });
busSchema.index({ conductorId: 1 });

module.exports = mongoose.model("Bus", busSchema);
