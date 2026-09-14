const fs = require('fs');
const path = require('path');
const { calculateDistance } = require('../utils/haversine');
const { extractFeatures } = require('./featureEngineering');

const routes = [
  {
    id: 'D1',
    scheduledDuration: 20,
    stops: [
      { location: { latitude: 28.6139, longitude: 77.209 } },
      { location: { latitude: 28.614, longitude: 77.21 } },
      { location: { latitude: 28.615, longitude: 77.22 } }
    ]
  },
  {
    id: 'U2',
    scheduledDuration: 30,
    stops: [
      { location: { latitude: 28.62, longitude: 77.2 } },
      { location: { latitude: 28.625, longitude: 77.205 } },
      { location: { latitude: 28.63, longitude: 77.21 } },
      { location: { latitude: 28.635, longitude: 77.215 } }
    ]
  },
  {
    id: 'H3',
    scheduledDuration: 15,
    stops: [
      { location: { latitude: 28.6, longitude: 77.18 } },
      { location: { latitude: 28.605, longitude: 77.185 } },
      { location: { latitude: 28.61, longitude: 77.19 } }
    ]
  }
];

function generateSyntheticData() {
  const data = [];
  const numTripsPerRoute = 500;
  
  for (const route of routes) {
    for (let trip = 0; trip < numTripsPerRoute; trip++) {
      // Pick a random start time for the trip
      const startHour = Math.random() * 24;
      const date = new Date();
      date.setHours(startHour);
      date.setMinutes(Math.random() * 60);
      
      const isRushHour = ((startHour >= 7 && startHour < 10) || (startHour >= 17 && startHour < 20));
      const isNight = (startHour >= 22 || startHour < 5);
      
      let baseSpeed = 30;
      if (isRushHour) baseSpeed = 15;
      else if (isNight) baseSpeed = 40;
      
      // Simulate trajectory
      let currentTimeMs = date.getTime();
      const tripWaypoints = [];
      const destStopIndex = route.stops.length - 1;
      
      for (let i = 0; i < destStopIndex; i++) {
        const startStop = route.stops[i];
        const endStop = route.stops[i+1];
        const segmentDist = calculateDistance(
          startStop.location.latitude, startStop.location.longitude,
          endStop.location.latitude, endStop.location.longitude
        );
        
        // Waypoints in segment
        const numWaypoints = 5;
        for (let w = 0; w <= numWaypoints; w++) {
          const fraction = w / numWaypoints;
          const lat = startStop.location.latitude + fraction * (endStop.location.latitude - startStop.location.latitude);
          const lon = startStop.location.longitude + fraction * (endStop.location.longitude - startStop.location.longitude);
          
          // Current speed in km/h with some noise
          let speed = baseSpeed + (Math.random() * 10 - 5);
          if (speed < 5) speed = 5;
          
          const timeToAdvanceH = (segmentDist / numWaypoints) / speed;
          currentTimeMs += timeToAdvanceH * 3600 * 1000;
          
          // Stop delay
          if (w === numWaypoints && i < destStopIndex - 1) {
             const delayMinutes = Math.random() * 5;
             currentTimeMs += delayMinutes * 60 * 1000;
          }
          
          tripWaypoints.push({
            bus: {
              location: { latitude: lat, longitude: lon },
              speed,
              lastUpdated: new Date(currentTimeMs)
            },
            timeMs: currentTimeMs
          });
        }
      }
      
      const arrivalTimeMs = tripWaypoints[tripWaypoints.length - 1].timeMs;
      
      // Generate features for each waypoint
      for (let w = 0; w < tripWaypoints.length - 1; w++) {
        const wp = tripWaypoints[w];
        const actualMinutesRemaining = (arrivalTimeMs - wp.timeMs) / (1000 * 60);
        
        const history = tripWaypoints.slice(Math.max(0, w - 3), w).map(x => x.bus);
        
        try {
          const features = extractFeatures(wp.bus, route, destStopIndex, history);
          data.push({ features, label: actualMinutesRemaining });
        } catch (e) {
          // ignore
        }
      }
    }
  }
  
  const outputPath = path.join(__dirname, 'training_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Generated ${data.length} synthetic records and saved to ${outputPath}`);
  return data;
}

if (require.main === module) {
  generateSyntheticData();
}

module.exports = { generateSyntheticData };
