const mongoose = require("mongoose");

const trackingDataSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bus",
    required: true,
  },
  location: {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
  },
  speed: {
    type: Number,
    default: 0,
  },
  direction: {
    type: Number,
    default: 0,
  },
  accuracy: {
    type: Number,
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  stopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Route.stops",
  },
  isAtStop: {
    type: Boolean,
    default: false,
  },
});

// Index for efficient queries
trackingDataSchema.index({ busId: 1, timestamp: -1 });
trackingDataSchema.index({ timestamp: -1 });

module.exports = mongoose.model("TrackingData", trackingDataSchema);
