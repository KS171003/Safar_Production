const TelemetryService = require('../services/telemetryService');
const Bus = require('../models/Bus');
const TrackingData = require('../models/TrackingData');

describe('Canonical Telemetry Pipeline', () => {
  test('evaluates liveness status accurately (LIVE vs STALE)', () => {
    const liveBus = { lastUpdatedAt: new Date(Date.now() - 30 * 1000) }; // 30 seconds ago
    expect(TelemetryService.getLivenessStatus(liveBus)).toBe('LIVE');

    const staleBus = { lastUpdatedAt: new Date(Date.now() - 300 * 1000) }; // 5 minutes ago
    expect(TelemetryService.getLivenessStatus(staleBus)).toBe('STALE');

    const noTimeBus = {};
    expect(TelemetryService.getLivenessStatus(noTimeBus)).toBe('STALE');
  });

  test('rejects impossible GPS coordinates as INVALID', async () => {
    const mockBus = {
      _id: '507f1f77bcf86cd799439011',
      lastSequenceNumber: 10,
      location: { type: 'Point', coordinates: [77.209, 28.6139] },
      lastUpdatedAt: new Date(),
    };

    jest.spyOn(Bus, 'findById').mockResolvedValue(mockBus);

    const result = await TelemetryService.processLocationUpdate({
      busId: '507f1f77bcf86cd799439011',
      latitude: 195.0, // Impossible latitude > 90
      longitude: 77.21,
      speed: 30,
    });

    expect(result.status).toBe('REJECTED_INVALID_QUALITY');
    expect(result.reason).toContain('out of geographic range');

    Bus.findById.mockRestore();
  });

  test('detects duplicate telemetry and ignores idempotently', async () => {
    const mockBus = {
      _id: '507f1f77bcf86cd799439011',
      lastSequenceNumber: 100,
      lastEventId: 'evt-100',
      location: { type: 'Point', coordinates: [77.209, 28.6139] },
      lastUpdatedAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(Bus, 'findById').mockResolvedValue(mockBus);

    const result = await TelemetryService.processLocationUpdate({
      busId: '507f1f77bcf86cd799439011',
      latitude: 28.614,
      longitude: 77.21,
      sequenceNumber: 100, // Same sequence as lastSequenceNumber
      eventId: 'evt-100',
    });

    expect(result.status).toBe('DUPLICATE_IGNORED');
    expect(result.idempotent).toBe(true);

    Bus.findById.mockRestore();
  });

  test('detects out-of-order sequence and does not overwrite current vehicle state', async () => {
    const mockBus = {
      _id: '507f1f77bcf86cd799439011',
      lastSequenceNumber: 105,
      location: { type: 'Point', coordinates: [77.215, 28.62] },
      lastUpdatedAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(Bus, 'findById').mockResolvedValue(mockBus);
    jest.spyOn(TrackingData.prototype, 'save').mockResolvedValue(true);

    const result = await TelemetryService.processLocationUpdate({
      busId: '507f1f77bcf86cd799439011',
      latitude: 28.614,
      longitude: 77.21,
      sequenceNumber: 104, // Sequence 104 arriving AFTER 105
      eventId: 'evt-104',
    });

    expect(result.status).toBe('OUT_OF_ORDER_RECORDED');
    expect(result.stateUpdated).toBe(false);
    expect(mockBus.lastSequenceNumber).toBe(105); // Remains at 105

    Bus.findById.mockRestore();
    TrackingData.prototype.save.mockRestore();
  });
});
