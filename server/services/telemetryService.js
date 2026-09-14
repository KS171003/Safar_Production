const crypto = require("crypto");
const Bus = require("../models/Bus");
const TrackingData = require("../models/TrackingData");
const { calculateDistance } = require("../utils/haversine");
const logger = require("../utils/logger");

const STALE_THRESHOLD_MS = 120 * 1000; // 2 minutes without updates marks bus as STALE

/**
 * Validates the physical plausibility of an incoming GPS telemetry reading.
 * Classifies telemetry into: VALID, SUSPICIOUS, or INVALID.
 */
function validateGpsQuality(newCoords, prevCoords, timeDeltaSeconds, speed, accuracy) {
  const { latitude, longitude } = newCoords;

  // 1. Mathematical bounds
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { quality: "INVALID", reason: "Coordinates out of geographic range" };
  }

  // 2. Null island check
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) {
    return { quality: "INVALID", reason: "Coordinates centered on Null Island (0,0)" };
  }

  // 3. Excessive speed limits
  if (speed > 160) {
    return { quality: "INVALID", reason: `Impossible ground speed reported: ${speed} km/h` };
  }

  // 4. Large teleportation jump check (e.g. >2km jump in <5 seconds)
  if (prevCoords && prevCoords.latitude && prevCoords.longitude && timeDeltaSeconds > 0) {
    const jumpDistanceKm = calculateDistance(
      prevCoords.latitude,
      prevCoords.longitude,
      latitude,
      longitude
    );
    const impliedSpeedKmh = (jumpDistanceKm / (timeDeltaSeconds / 3600));

    if (jumpDistanceKm > 2.0 && timeDeltaSeconds < 5) {
      return { quality: "INVALID", reason: `Unrealistic teleportation: jumped ${jumpDistanceKm.toFixed(2)}km in ${timeDeltaSeconds}s` };
    }

    if (impliedSpeedKmh > 140) {
      return { quality: "SUSPICIOUS", reason: `High implied velocity between pings: ${impliedSpeedKmh.toFixed(1)} km/h` };
    }
  }

  // 5. GPS Accuracy degradation
  if (accuracy > 150) {
    return { quality: "SUSPICIOUS", reason: `High dilution of precision (accuracy: ${accuracy}m)` };
  }

  if (speed > 100) {
    return { quality: "SUSPICIOUS", reason: `High vehicle speed: ${speed} km/h` };
  }

  return { quality: "VALID", reason: "Telemetry passes physical plausibility checks" };
}

/**
 * Canonical Telemetry Service
 * Authoritative pipeline for GPS ingestion, deduplication, sequencing,
 * validation, persistence, and broadcasting.
 */
class TelemetryService {
  /**
   * Evaluates if a bus has gone stale based on its last update timestamp.
   * @param {Object} bus - Bus mongoose document or plain object
   * @returns {string} 'LIVE' or 'STALE'
   */
  static getLivenessStatus(bus) {
    if (!bus.lastUpdatedAt) return "STALE";
    const elapsed = Date.now() - new Date(bus.lastUpdatedAt).getTime();
    return elapsed > STALE_THRESHOLD_MS ? "STALE" : "LIVE";
  }

  /**
   * Process a telemetry event through the canonical pipeline.
   */
  static async processLocationUpdate({
    busId,
    latitude,
    longitude,
    speed = 0,
    direction = 0,
    accuracy = 0,
    sequenceNumber = null,
    eventId = null,
    deviceTimestamp = null,
    io = null,
  }) {
    const serverTimestamp = new Date();
    const effectiveEventId = eventId || crypto.randomUUID();
    const effectiveDeviceTimestamp = deviceTimestamp ? new Date(deviceTimestamp) : serverTimestamp;

    // Load target bus
    const bus = await Bus.findById(busId);
    if (!bus) {
      const error = new Error(`Bus ${busId} not found`);
      error.statusCode = 404;
      throw error;
    }

    const previousLocation = bus.location && bus.location.coordinates ? {
      latitude: bus.location.coordinates[1],
      longitude: bus.location.coordinates[0],
    } : null;

    const timeDeltaSeconds = bus.lastUpdatedAt
      ? (serverTimestamp.getTime() - new Date(bus.lastUpdatedAt).getTime()) / 1000
      : 0;

    // Phase 8: Quality Validation
    const qualityCheck = validateGpsQuality(
      { latitude, longitude },
      previousLocation,
      timeDeltaSeconds,
      speed,
      accuracy
    );

    if (qualityCheck.quality === "INVALID") {
      logger.warn("Discarding INVALID GPS telemetry", {
        busId,
        eventId: effectiveEventId,
        reason: qualityCheck.reason,
      });
      return {
        status: "REJECTED_INVALID_QUALITY",
        reason: qualityCheck.reason,
        bus,
      };
    }

    // Phase 6 & 7: Sequence Ordering & Idempotency Check
    let isOutOfOrder = false;
    let isDuplicate = false;

    if (sequenceNumber !== null && sequenceNumber !== undefined) {
      if (bus.lastSequenceNumber) {
        if (sequenceNumber === bus.lastSequenceNumber || effectiveEventId === bus.lastEventId) {
          isDuplicate = true;
          logger.info("Duplicate telemetry event ignored", { busId, sequenceNumber, eventId: effectiveEventId });
          return {
            status: "DUPLICATE_IGNORED",
            idempotent: true,
            bus,
          };
        }

        if (sequenceNumber < bus.lastSequenceNumber) {
          isOutOfOrder = true;
          logger.warn("Out-of-order telemetry event detected", {
            busId,
            receivedSeq: sequenceNumber,
            currentSeq: bus.lastSequenceNumber,
          });
        }
      }
    }

    // Phase 12: Append to TrackingData operational history
    const trackingRecord = new TrackingData({
      eventId: effectiveEventId,
      busId: bus._id,
      routeId: bus.routeId,
      sequenceNumber: sequenceNumber || (bus.lastSequenceNumber + 1),
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      speed,
      direction,
      accuracy,
      gpsQuality: qualityCheck.quality,
      deviceTimestamp: effectiveDeviceTimestamp,
      serverTimestamp,
    });
    await trackingRecord.save();

    // If out of order, we log the historic ping but DO NOT overwrite current live state
    if (isOutOfOrder) {
      return {
        status: "OUT_OF_ORDER_RECORDED",
        stateUpdated: false,
        trackingRecord,
        bus,
      };
    }

    // Phase 4 & 5: Persist Canonical Live Vehicle State
    bus.location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    bus.speed = speed;
    bus.direction = direction;
    bus.accuracy = accuracy;
    bus.gpsQuality = qualityCheck.quality;
    bus.lastSequenceNumber = sequenceNumber !== null ? sequenceNumber : (bus.lastSequenceNumber + 1);
    bus.lastEventId = effectiveEventId;
    bus.deviceTimestamp = effectiveDeviceTimestamp;
    bus.serverTimestamp = serverTimestamp;
    bus.lastUpdatedAt = serverTimestamp;
    bus.locationStatus = "LIVE";

    await bus.save();

    // Phase 4: Canonical Broadcast to WebSocket subscribers
    const broadcastPayload = {
      eventId: effectiveEventId,
      busId: bus._id,
      routeId: bus.routeId,
      sequenceNumber: bus.lastSequenceNumber,
      location: {
        latitude,
        longitude,
      },
      speed,
      direction,
      accuracy,
      status: bus.locationStatus,
      gpsQuality: qualityCheck.quality,
      lastUpdatedAt: bus.lastUpdatedAt,
    };

    if (io) {
      io.to(`bus-${bus._id}`).emit("bus-location-update", broadcastPayload);
      if (bus.routeId) {
        io.to(`route-${bus.routeId}`).emit("bus-location-update", broadcastPayload);
      }
    }

    return {
      status: "SUCCESS",
      stateUpdated: true,
      gpsQuality: qualityCheck.quality,
      bus,
      broadcastPayload,
    };
  }
}

module.exports = TelemetryService;
