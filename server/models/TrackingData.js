const mongoose = require("mongoose");

/**
 * TrackingData Schema for real-time operational GPS telemetry.
 * Equipped with 30-day TTL indexing, GeoJSON 2dsphere indexing,
 * and sequence-based telemetry event tracking.
 */
const trackingDataSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      index: true,
    },
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      index: true,
    },
    sequenceNumber: {
      type: Number,
      default: 0,
      index: true,
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
    gpsQuality: {
      type: String,
      enum: ["VALID", "SUSPICIOUS", "INVALID"],
      default: "VALID",
    },
    deviceTimestamp: {
      type: Date,
    },
    serverTimestamp: {
      type: Date,
      default: Date.now,
    },
    stopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
    },
    isAtStop: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-validate hook: normalize { latitude, longitude } to GeoJSON Point coordinates
trackingDataSchema.pre("validate", function (next) {
  if (this.location && typeof this.location === "object") {
    if (this.location.latitude !== undefined && this.location.longitude !== undefined) {
      this.location = {
        type: "Point",
        coordinates: [Number(this.location.longitude), Number(this.location.latitude)],
      };
    }
  }
  if (!this.serverTimestamp) {
    this.serverTimestamp = new Date();
  }
  next();
});

// Backward-compatible virtuals for legacy latitude & longitude getters
trackingDataSchema.virtual("latitude").get(function () {
  return this.location && this.location.coordinates ? this.location.coordinates[1] : undefined;
});

trackingDataSchema.virtual("longitude").get(function () {
  return this.location && this.location.coordinates ? this.location.coordinates[0] : undefined;
});

trackingDataSchema.virtual("timestamp").get(function () {
  return this.serverTimestamp || this.createdAt;
});

// Operational indexes
trackingDataSchema.index({ location: "2dsphere" });
trackingDataSchema.index({ busId: 1, sequenceNumber: -1 });
trackingDataSchema.index({ busId: 1, serverTimestamp: -1 });
// 30-day TTL retention for hot operational data
trackingDataSchema.index({ serverTimestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model("TrackingData", trackingDataSchema);
