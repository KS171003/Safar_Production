const mongoose = require("mongoose");

const stopSchema = new mongoose.Schema({
  name: {
    type: String,
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
  estimatedTime: {
    type: Number, // in minutes from start
    required: true,
  },
  actualArrivalTime: Date,
  actualDepartureTime: Date,
});

const routeSchema = new mongoose.Schema(
  {
    routeName: {
      type: String,
      required: true,
    },
    routeNumber: {
      type: String,
      required: true,
      unique: true,
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
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Route", routeSchema);
