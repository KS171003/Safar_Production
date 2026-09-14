const mongoose = require("mongoose");

/**
 * Stop Schema with standard GeoJSON Point representation
 * and transparent backward-compatible latitude/longitude mapping.
 */
const stopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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
    estimatedTime: {
      type: Number, // in minutes from route departure
      required: true,
    },
    actualArrivalTime: Date,
    actualDepartureTime: Date,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-validate hook: normalize { latitude, longitude } to GeoJSON Point coordinates
stopSchema.pre("validate", function (next) {
  if (this.location && typeof this.location === "object") {
    if (this.location.latitude !== undefined && this.location.longitude !== undefined) {
      this.location = {
        type: "Point",
        coordinates: [Number(this.location.longitude), Number(this.location.latitude)],
      };
    }
  }
  next();
});

// Virtual getters for backward compatibility
stopSchema.virtual("latitude").get(function () {
  return this.location && this.location.coordinates ? this.location.coordinates[1] : undefined;
});

stopSchema.virtual("longitude").get(function () {
  return this.location && this.location.coordinates ? this.location.coordinates[0] : undefined;
});

const routeSchema = new mongoose.Schema(
  {
    routeName: {
      type: String,
      required: true,
      trim: true,
    },
    routeNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    description: String,
    stops: [stopSchema],
    totalDistance: {
      type: Number, // in kilometers
      default: 0,
    },
    estimatedDuration: {
      type: Number, // in minutes
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

routeSchema.virtual("stopCount").get(function () {
  return this.stops ? this.stops.length : 0;
});

routeSchema.index({ "stops.location": "2dsphere" });

module.exports = mongoose.model("Route", routeSchema);
