const { extractFeatures, FEATURE_COUNT } = require('../ml/featureEngineering');
const { predictETA, isModelReady, getModelInfo } = require('../ml/etaPredictor');
const { recordPrediction, getAccuracyMetrics, getPredictionHistory } = require('../ml/modelEvaluation');
const { calculateDistance, calculateBearing, calculateRouteDistance } = require('../utils/haversine');

describe('Geospatial & Haversine Utilities', () => {
  test('calculates accurate distance between Delhi coordinates', () => {
    // Connaught Place to India Gate ~ 2.3 km
    const d = calculateDistance(28.6315, 77.2167, 28.6129, 77.2295);
    expect(d).toBeGreaterThan(1.8);
    expect(d).toBeLessThan(2.8);
  });

  test('calculates route distance across multi-stop sequence', () => {
    const stops = [
      { location: { latitude: 28.6139, longitude: 77.209 } },
      { location: { latitude: 28.614, longitude: 77.21 } },
      { location: { latitude: 28.615, longitude: 77.22 } },
    ];
    const total = calculateRouteDistance(stops);
    expect(total).toBeGreaterThan(0.5);
  });

  test('calculates bearing angle between 0 and 360', () => {
    const bearing = calculateBearing(28.6139, 77.209, 28.62, 77.21);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThanOrEqual(360);
  });
});

describe('ML Feature Engineering', () => {
  const sampleBus = {
    currentLocation: { latitude: 28.614, longitude: 77.21, timestamp: new Date() },
    speed: 30,
    currentStopIndex: 0,
    departureTime: new Date(Date.now() - 10 * 60 * 1000),
  };

  const sampleRoute = {
    stops: [
      { location: { latitude: 28.6139, longitude: 77.209 } },
      { location: { latitude: 28.614, longitude: 77.21 } },
      { location: { latitude: 28.615, longitude: 77.22 } },
    ],
    totalDistance: 10.5,
    estimatedDuration: 20,
  };

  test('extracts exactly 14 numerical features', () => {
    const features = extractFeatures(sampleBus, sampleRoute, 2, []);
    expect(features).toHaveLength(FEATURE_COUNT);
    expect(features).toHaveLength(14);
    features.forEach((f) => {
      expect(typeof f).toBe('number');
      expect(isNaN(f)).toBe(false);
    });
  });
});

describe('ML Production ETA Inference', () => {
  const sampleBus = {
    currentLocation: { latitude: 28.614, longitude: 77.21, timestamp: new Date() },
    speed: 35,
    currentStopIndex: 0,
  };

  const sampleRoute = {
    stops: [
      { location: { latitude: 28.6139, longitude: 77.209 } },
      { location: { latitude: 28.614, longitude: 77.21 } },
      { location: { latitude: 28.615, longitude: 77.22 } },
    ],
    totalDistance: 10.5,
    estimatedDuration: 20,
  };

  test('loads trained TensorFlow model and provides valid ETA prediction', async () => {
    const result = await predictETA(sampleBus, sampleRoute, 2, []);
    expect(result).not.toBeNull();
    expect(result.method).toBe('ml');
    expect(result.etaMinutes).toBeGreaterThan(0);
    expect(result.confidenceInterval).toBeDefined();
    expect(result.confidenceInterval.lower).toBeLessThanOrEqual(result.etaMinutes);
    expect(result.confidenceInterval.upper).toBeGreaterThanOrEqual(result.etaMinutes);
  });

  test('reports model ready status and training metadata', async () => {
    const ready = await isModelReady();
    expect(ready).toBe(true);

    const info = getModelInfo();
    expect(info.status).toBe('loaded');
    expect(info.metrics).toBeDefined();
    expect(info.metrics.mae).toBeDefined();
    expect(info.metrics.r2).toBeGreaterThan(0.5);
  });
});

describe('Continuous Model Evaluation Metrics', () => {
  test('tracks real-time predictions and computes running metrics', () => {
    recordPrediction(10.5, 10.0);
    recordPrediction(15.2, 16.0);
    recordPrediction(8.0, 7.5);

    const metrics = getAccuracyMetrics();
    expect(metrics.sampleCount).toBeGreaterThanOrEqual(3);
    expect(metrics.mae).toBeGreaterThan(0);
    expect(metrics.rmse).toBeGreaterThan(0);

    const history = getPredictionHistory(5);
    expect(history.length).toBeGreaterThanOrEqual(3);
  });
});
