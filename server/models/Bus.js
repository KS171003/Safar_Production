const mongoose = require("mongoose");

/**
 * Bus Schema for Safar application
 * Upgraded with standard GeoJSON Point and 2dsphere index for native MongoDB proximity search,
 * sequence tracking for out-of-order event rejection, and staleness state management.
 */
const busSchema = new mongoose.Schema(
  {
    busNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    conductorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      index: true,
    },
    capacity: {
      type: Number,
      default: 50,
    },
    passengerCount: {
      type: Number,
      default: 0,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [77.209, 28.6139],
      },
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    isOnRoute: {
      type: Boolean,
      default: false,
      index: true,
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
    accuracy: {
      type: Number,
      default: 0,
    },
    emergencyStatus: {
      type: String,
      enum: ["normal", "emergency", "breakdown"],
      default: "normal",
      index: true,
    },
    lastSequenceNumber: {
      type: Number,
      default: 0,
    },
    lastEventId: {
      type: String,
    },
    deviceTimestamp: {
      type: Date,
    },
    serverTimestamp: {
      type: Date,
      default: Date.now,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    locationStatus: {
      type: String,
      enum: ["LIVE", "STALE"],
      default: "LIVE",
    },
    gpsQuality: {
      type: String,
      enum: ["VALID", "SUSPICIOUS", "INVALID"],
      default: "VALID",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Backward-compatible virtual getter for currentLocation
busSchema.virtual("currentLocation").get(function () {
  if (!this.location || !this.location.coordinates) return null;
  return {
    latitude: this.location.coordinates[1],
    longitude: this.location.coordinates[0],
    timestamp: this.lastUpdatedAt || this.updatedAt,
  };
});

// Virtual helper for lastUpdateTime (preserves compatibility)
busSchema.virtual("lastUpdateTime").get(function () {
  return this.lastUpdatedAt || this.updatedAt;
});

// 2dsphere index for MongoDB geospatial queries ($nearSphere, $geoNear)
busSchema.index({ location: "2dsphere" });
// Compound operational indexes
busSchema.index({ routeId: 1, isActive: 1, isOnRoute: 1 });
busSchema.index({ conductorId: 1, isActive: 1 });

module.exports = mongoose.model("Bus", busSchema);
