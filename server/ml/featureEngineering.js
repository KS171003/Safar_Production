const { calculateDistance, calculateRouteDistance } = require('../utils/haversine');

const FEATURE_COUNT = 14;

/**
 * Extract features from bus state, route, and tracking history for ETA prediction.
 * @param {Object} bus - Bus object with { location: { latitude, longitude }, speed, lastUpdated }
 * @param {Object} route - Route object with { stops: [...], scheduledDuration }
 * @param {number} destinationStopIndex - Index of the destination stop in route.stops
 * @param {Array} trackingHistory - Array of past bus state objects
 * @returns {Array} Array of numeric features
 */
function extractFeatures(bus, route, destinationStopIndex, trackingHistory = []) {
  if (!bus || !route || destinationStopIndex === undefined) {
    throw new Error('Missing required arguments for feature extraction');
  }
  
  const destStop = route.stops[destinationStopIndex];
  const busLoc = bus.currentLocation || bus.location || {};
  const busLat = busLoc.latitude !== undefined ? busLoc.latitude : 0;
  const busLon = busLoc.longitude !== undefined ? busLoc.longitude : 0;
  
  // 1. distanceToDestination
  const distanceToDestination = calculateDistance(
    busLat, busLon,
    destStop.location.latitude, destStop.location.longitude
  );

  // Determine next stop
  let nextStopIndex = 0;
  let minDistance = Infinity;
  for (let i = 0; i <= destinationStopIndex; i++) {
    const d = calculateDistance(busLat, busLon, route.stops[i].location.latitude, route.stops[i].location.longitude);
    if (d < minDistance) {
      minDistance = d;
      nextStopIndex = i;
    }
  }
  // Assume next stop is the one after closest, capped at destination
  if (minDistance < 0.1 && nextStopIndex < destinationStopIndex) {
      nextStopIndex++;
  }
  
  // 2. distanceToNextStop
  const distanceToNextStop = calculateDistance(
    busLat, busLon,
    route.stops[nextStopIndex].location.latitude, route.stops[nextStopIndex].location.longitude
  );

  // 11. totalRouteDistance
  const totalRouteDistance = calculateRouteDistance(route.stops);

  // 3. routeProgress
  // Estimate distance covered as totalRouteDistance - distanceToDestination (roughly)
  let routeProgress = 0;
  if (totalRouteDistance > 0) {
      // rough heuristic if we don't have exact route path covered
      routeProgress = Math.max(0, Math.min(1, 1 - (distanceToDestination / totalRouteDistance)));
  }

  // 4. currentSpeed
  const currentSpeed = bus.speed || 0;

  // 5. avgSpeedRecent & 6. speedVariance
  let avgSpeedRecent = currentSpeed;
  let speedVariance = 0;
  if (trackingHistory && trackingHistory.length > 0) {
    let sum = currentSpeed;
    trackingHistory.forEach(h => sum += (h.speed || 0));
    avgSpeedRecent = sum / (trackingHistory.length + 1);

    let varSum = Math.pow(currentSpeed - avgSpeedRecent, 2);
    trackingHistory.forEach(h => {
      varSum += Math.pow((h.speed || 0) - avgSpeedRecent, 2);
    });
    speedVariance = varSum / (trackingHistory.length + 1);
  }

  // 7, 8, 9, 10. Time features
  const date = bus.lastUpdated ? new Date(bus.lastUpdated) : new Date();
  const hour = date.getHours() + (date.getMinutes() / 60);
  const day = date.getDay(); // 0-6

  // 7. hourOfDay (sin)
  const hourSin = Math.sin((2 * Math.PI * hour) / 24);
  // 8. hourOfDay (cos)
  const hourCos = Math.cos((2 * Math.PI * hour) / 24);
  // 9. dayOfWeek (sin)
  const daySin = Math.sin((2 * Math.PI * day) / 7);
  // 10. dayOfWeek (cos)
  const dayCos = Math.cos((2 * Math.PI * day) / 7);

  // 11. isRushHour
  const isRushHour = ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 20)) ? 1 : 0;

  // 12. remainingStops
  const remainingStops = Math.max(0, destinationStopIndex - nextStopIndex + 1);

  // 13. totalRouteDistance (already calc)
  
  // 14. scheduledDuration
  const scheduledDuration = route.scheduledDuration || 30; // default 30 mins

  return [
    distanceToDestination,
    distanceToNextStop,
    routeProgress,
    currentSpeed,
    avgSpeedRecent,
    speedVariance,
    hourSin,
    hourCos,
    daySin,
    dayCos,
    isRushHour,
    remainingStops,
    totalRouteDistance,
    scheduledDuration
  ];
}

module.exports = {
  extractFeatures,
  FEATURE_COUNT
};
