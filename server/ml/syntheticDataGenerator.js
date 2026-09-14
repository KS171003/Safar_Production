const fs = require('fs');
const path = require('path');
const { extractFeatures, calculateBaselineETA } = require('./featureEngineering');

// Delhi Metropolitan transit corridors
const ROUTES = [
  {
    routeId: 'D1-Downtown',
    routeName: 'Downtown Express',
    routeNumber: 'D1',
    estimatedDuration: 25,
    stops: [
      { name: 'Central Station', location: { latitude: 28.6139, longitude: 77.2090 }, estimatedTime: 0 },
      { name: 'Connaught Place', location: { latitude: 28.6315, longitude: 77.2167 }, estimatedTime: 8 },
      { name: 'Pragati Maidan', location: { latitude: 28.6180, longitude: 77.2430 }, estimatedTime: 16 },
      { name: 'Airport Terminal', location: { latitude: 28.5562, longitude: 77.1000 }, estimatedTime: 25 },
    ],
  },
  {
    routeId: 'U2-University',
    routeName: 'University Line',
    routeNumber: 'U2',
    estimatedDuration: 30,
    stops: [
      { name: 'North Campus', location: { latitude: 28.6890, longitude: 77.2100 }, estimatedTime: 0 },
      { name: 'Civil Lines', location: { latitude: 28.6750, longitude: 77.2250 }, estimatedTime: 7 },
      { name: 'Kashmere Gate', location: { latitude: 28.6675, longitude: 77.2280 }, estimatedTime: 14 },
      { name: 'Red Fort', location: { latitude: 28.6562, longitude: 77.2410 }, estimatedTime: 22 },
      { name: 'ITO Junction', location: { latitude: 28.6290, longitude: 77.2430 }, estimatedTime: 30 },
    ],
  },
  {
    routeId: 'H3-Hospital',
    routeName: 'Hospital Shuttle',
    routeNumber: 'H3',
    estimatedDuration: 20,
    stops: [
      { name: 'AIIMS Medical Center', location: { latitude: 28.5672, longitude: 77.2100 }, estimatedTime: 0 },
      { name: 'Safdarjung Enclave', location: { latitude: 28.5620, longitude: 77.1980 }, estimatedTime: 6 },
      { name: 'Green Park Metro', location: { latitude: 28.5580, longitude: 77.2060 }, estimatedTime: 12 },
      { name: 'Hauz Khas Terminal', location: { latitude: 28.5490, longitude: 77.2000 }, estimatedTime: 20 },
    ],
  },
];

/**
 * Simulates sequential bus trips across time, producing trip-grouped telemetry samples.
 * Labeled explicitly as synthetic data for research and benchmarking.
 */
function generateSyntheticData(totalTrips = 800) {
  const dataset = [];
  const baseDate = new Date('2026-09-01T06:00:00.000Z'); // 2 weeks of synthetic data

  let currentSimTime = baseDate.getTime();

  for (let tripIdx = 0; tripIdx < totalTrips; tripIdx++) {
    const tripId = `TRIP-${String(tripIdx + 1).padStart(5, '0')}`;
    const route = ROUTES[tripIdx % ROUTES.length];
    const destinationStopIndex = route.stops.length - 1;

    // Distribute departure across 14-day schedule
    currentSimTime += Math.floor(Math.random() * 25 + 15) * 60000;
    const departureDate = new Date(currentSimTime);
    const hour = departureDate.getUTCHours() + 5.5; // roughly IST
    const isRushHour = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20.5);

    // Speed regime based on traffic & congestion
    const baseSpeed = isRushHour
      ? (14 + Math.random() * 8) // 14-22 km/h during rush hour
      : (28 + Math.random() * 12); // 28-40 km/h during free flow

    // Interpolate waypoints along each segment
    const waypoints = [];
    let elapsedMinutes = 0;

    for (let s = 0; s < route.stops.length - 1; s++) {
      const fromStop = route.stops[s];
      const toStop = route.stops[s + 1];
      const numSteps = 5; // 5 telemetry pings per segment

      // Dwell delay at stop (passengers boarding)
      const dwellMinutes = 0.5 + Math.random() * (isRushHour ? 2.5 : 1.0);
      elapsedMinutes += dwellMinutes;

      for (let step = 0; step < numSteps; step++) {
        const fraction = step / numSteps;
        const lat = fromStop.location.latitude + (toStop.location.latitude - fromStop.location.latitude) * fraction;
        const lng = fromStop.location.longitude + (toStop.location.longitude - fromStop.location.longitude) * fraction;

        // Speed fluctuation with noise
        const speedNoise = (Math.random() - 0.5) * 6;
        const instantSpeed = Math.max(5, baseSpeed + speedNoise);

        const pingTime = new Date(departureDate.getTime() + elapsedMinutes * 60000);
        waypoints.push({
          lat,
          lng,
          speed: instantSpeed,
          timestamp: pingTime,
          stopIndex: s,
          elapsedMinutes,
        });

        const segmentDistanceKm = 1.5;
        elapsedMinutes += (segmentDistanceKm / instantSpeed) * 60;
      }
    }

    const totalTripDuration = elapsedMinutes;

    // For each waypoint in this trip, compute ground truth remaining travel time
    const trackingHistory = [];
    for (let w = 0; w < waypoints.length; w++) {
      const wp = waypoints[w];
      const actualRemainingMinutes = Math.max(0, totalTripDuration - wp.elapsedMinutes);

      const syntheticBus = {
        location: { latitude: wp.lat, longitude: wp.lng },
        speed: wp.speed,
        currentStopIndex: wp.stopIndex,
        deviceTimestamp: wp.timestamp,
        lastUpdatedAt: wp.timestamp,
      };

      const features = extractFeatures(syntheticBus, route, destinationStopIndex, trackingHistory);
      const baselineETA = features[15]; // index 15 is baselineKinematicETA
      const residual = actualRemainingMinutes - baselineETA; // Target for Hybrid ML

      dataset.push({
        tripId,
        timestamp: wp.timestamp.toISOString(),
        routeId: route.routeId,
        isRushHour: isRushHour ? 1 : 0,
        features,
        label: Number(actualRemainingMinutes.toFixed(2)),
        baselineETA: Number(baselineETA.toFixed(2)),
        residual: Number(residual.toFixed(2)),
        datasetType: 'synthetic',
      });

      trackingHistory.unshift({
        speed: wp.speed,
        serverTimestamp: wp.timestamp,
      });
      if (trackingHistory.length > 5) trackingHistory.pop();
    }
  }

  const outPath = path.join(__dirname, 'training_data.json');
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
  console.log(`Generated ${dataset.length} synthetic trip telemetry points across ${totalTrips} chronological trips (explicitly synthetic).`);
  return dataset;
}

if (require.main === module) {
  generateSyntheticData();
}

module.exports = {
  generateSyntheticData,
  ROUTES,
};
