const { calculateDistance, calculateRouteDistance } = require('../utils/haversine');

const FEATURE_COUNT = 16;
const EMA_ALPHA = 0.3; // Weight for most recent observation in Exponential Moving Average

/**
 * Normalizes latitude and longitude from either GeoJSON Point [lng, lat] or { latitude, longitude }.
 */
function extractCoords(locObj) {
  if (!locObj) return { latitude: 0, longitude: 0 };
  if (locObj.coordinates && Array.isArray(locObj.coordinates) && locObj.coordinates.length >= 2) {
    return { latitude: locObj.coordinates[1], longitude: locObj.coordinates[0] };
  }
  if (locObj.latitude !== undefined && locObj.longitude !== undefined) {
    return { latitude: Number(locObj.latitude), longitude: Number(locObj.longitude) };
  }
  if (locObj.lat !== undefined && locObj.lng !== undefined) {
    return { latitude: Number(locObj.lat), longitude: Number(locObj.lng) };
  }
  return { latitude: 0, longitude: 0 };
}

/**
 * Calculates real Exponential Moving Average (EMA) of speed from tracking history.
 * Formula: EMA_t = alpha * v_t + (1 - alpha) * EMA_{t-1}
 */
function calculateSpeedEMA(currentSpeed, trackingHistory, alpha = EMA_ALPHA) {
  if (!trackingHistory || trackingHistory.length === 0) {
    return currentSpeed;
  }

  // Tracking history is sorted newest to oldest, reverse to chronological order
  const chronological = [...trackingHistory].reverse();
  let ema = chronological[0].speed || currentSpeed;

  for (let i = 1; i < chronological.length; i++) {
    const v = chronological[i].speed !== undefined ? chronological[i].speed : ema;
    ema = alpha * v + (1 - alpha) * ema;
  }

  // Incorporate current instantaneous speed
  return alpha * currentSpeed + (1 - alpha) * ema;
}

/**
 * Computes deterministic baseline kinematic travel time in minutes.
 * Uses road segment distance and speed with floor guard.
 */
function calculateBaselineETA(distanceKm, speedKmh) {
  const effectiveSpeed = speedKmh > 5 ? speedKmh : 25; // default 25 km/h urban speed
  return (distanceKm / effectiveSpeed) * 60; // in minutes
}

/**
 * Extract 16 deterministic features for Hybrid ML ETA prediction.
 * Shared between offline training and live production inference.
 */
function extractFeatures(bus, route, destinationStopIndex, trackingHistory = []) {
  if (!bus || !route || destinationStopIndex === undefined) {
    throw new Error('Missing required arguments for feature extraction');
  }

  const destStop = route.stops[destinationStopIndex];
  const busCoords = extractCoords(bus.location || bus.currentLocation);
  const destCoords = extractCoords(destStop.location);

  // 1. Distance to Destination (km)
  const distanceToDestination = calculateDistance(
    busCoords.latitude,
    busCoords.longitude,
    destCoords.latitude,
    destCoords.longitude
  );

  // 2. Find closest and next stop
  let nextStopIndex = 0;
  let minDistance = Infinity;
  for (let i = 0; i <= destinationStopIndex; i++) {
    const sCoords = extractCoords(route.stops[i].location);
    const d = calculateDistance(busCoords.latitude, busCoords.longitude, sCoords.latitude, sCoords.longitude);
    if (d < minDistance) {
      minDistance = d;
      nextStopIndex = i;
    }
  }
  if (minDistance < 0.1 && nextStopIndex < destinationStopIndex) {
    nextStopIndex++;
  }

  const nextStopCoords = extractCoords(route.stops[nextStopIndex].location);
  const distanceToNextStop = calculateDistance(
    busCoords.latitude,
    busCoords.longitude,
    nextStopCoords.latitude,
    nextStopCoords.longitude
  );

  // 3. Route progress [0, 1]
  const totalRouteDistance = calculateRouteDistance(
    route.stops.map((s) => ({ location: extractCoords(s.location) }))
  );
  const routeProgress = totalRouteDistance > 0
    ? Math.max(0, Math.min(1, 1 - (distanceToDestination / totalRouteDistance)))
    : 0;

  // 4. Speed & Dynamics
  const currentSpeed = Number(bus.speed) || 0;
  const avgSpeedEMA = calculateSpeedEMA(currentSpeed, trackingHistory, EMA_ALPHA);

  // Speed variance & acceleration
  let speedVariance = 0;
  let acceleration = 0;
  if (trackingHistory.length > 1) {
    const speeds = trackingHistory.slice(0, 5).map((h) => Number(h.speed) || 0);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    speedVariance = speeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speeds.length;

    const prevSpeed = trackingHistory[0].speed || currentSpeed;
    const timeDiffSeconds = Math.max(1, (Date.now() - new Date(trackingHistory[0].serverTimestamp || Date.now()).getTime()) / 1000);
    acceleration = ((currentSpeed - prevSpeed) * 1000 / 3600) / timeDiffSeconds; // m/s^2
  }

  // 5. Temporal Features strictly derived from event timestamp in IST (UTC+5:30)
  const eventTime = bus.deviceTimestamp
    ? new Date(bus.deviceTimestamp)
    : bus.lastUpdatedAt
      ? new Date(bus.lastUpdatedAt)
      : new Date();

  // Convert to IST
  const utc = eventTime.getTime() + eventTime.getTimezoneOffset() * 60000;
  const istTime = new Date(utc + 5.5 * 3600000);

  const hour = istTime.getHours() + istTime.getMinutes() / 60;
  const day = istTime.getDay(); // 0 = Sun, 6 = Sat

  const sinHour = Math.sin((2 * Math.PI * hour) / 24);
  const cosHour = Math.cos((2 * Math.PI * hour) / 24);
  const sinDay = Math.sin((2 * Math.PI * day) / 7);
  const cosDay = Math.cos((2 * Math.PI * day) / 7);

  // Rush hour in Delhi: 08:00 - 11:00 and 17:00 - 20:30
  const isRushHour = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20.5) ? 1 : 0;
  const isWeekend = day === 0 || day === 6 ? 1 : 0;

  // 6. Stop topology & Kinematic baseline
  const remainingStops = Math.max(0, destinationStopIndex - (bus.currentStopIndex || nextStopIndex));
  const scheduledDuration = Number(route.estimatedDuration) || 30;
  const baselineKinematicETA = calculateBaselineETA(distanceToDestination, currentSpeed);

  return [
    distanceToDestination,    // 0
    distanceToNextStop,       // 1
    routeProgress,            // 2
    currentSpeed,             // 3
    avgSpeedEMA,              // 4 (Real Exponential Moving Average)
    speedVariance,            // 5
    acceleration,             // 6
    sinHour,                  // 7
    cosHour,                  // 8
    sinDay,                   // 9
    cosDay,                   // 10
    isRushHour,               // 11
    isWeekend,                // 12
    remainingStops,           // 13
    totalRouteDistance,       // 14
    baselineKinematicETA,     // 15 (Kinematic baseline reference)
  ];
}

module.exports = {
  extractFeatures,
  calculateBaselineETA,
  calculateSpeedEMA,
  extractCoords,
  FEATURE_COUNT,
  EMA_ALPHA,
};
