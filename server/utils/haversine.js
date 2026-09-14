/**
 * Calculate the Haversine distance between two geographic coordinates.
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bearing between two coordinates.
 * @param {number} lat1 - Latitude of start point (degrees)
 * @param {number} lon1 - Longitude of start point (degrees)
 * @param {number} lat2 - Latitude of end point (degrees)
 * @param {number} lon2 - Longitude of end point (degrees)
 * @returns {number} Bearing in degrees (0-360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const x = Math.sin(dLon) * Math.cos(lat2Rad);
  const y =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return ((bearing % 360) + 360) % 360;
}

/**
 * Calculate the total distance along an array of route stops.
 * @param {Array} stops - Array of stop objects with location.latitude and location.longitude
 * @returns {number} Total route distance in kilometers
 */
function calculateRouteDistance(stops) {
  let totalDistance = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    totalDistance += calculateDistance(
      stops[i].location.latitude,
      stops[i].location.longitude,
      stops[i + 1].location.latitude,
      stops[i + 1].location.longitude
    );
  }
  return totalDistance;
}

module.exports = {
  calculateDistance,
  calculateBearing,
  calculateRouteDistance,
};
