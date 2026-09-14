const jwt = require('jsonwebtoken');
const { verifyBusOwnership } = require('../middleware/auth');
const Bus = require('../models/Bus');

describe('Resource Ownership & Security Authorization', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-security-secret-12345';
  });

  test('verifyBusOwnership rejects conductor attempting to mutate another bus', async () => {
    const conductorId1 = '6aa85833481f7feb261d5618';
    const conductorId2 = '6aa85833481f7feb261d5622';

    // Mock Bus.findById
    jest.spyOn(Bus, 'findById').mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      conductorId: conductorId2, // Owned by conductor 2
      busNumber: 'BUS002',
    });

    const req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { userId: conductorId1, userType: 'conductor' }, // Logged in as conductor 1
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await verifyBusOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('Access denied'),
    }));
    expect(next).not.toHaveBeenCalled();

    Bus.findById.mockRestore();
  });

  test('verifyBusOwnership allows conductor mutating their own assigned bus', async () => {
    const conductorId = '6aa85833481f7feb261d5618';

    const mockBus = {
      _id: '507f1f77bcf86cd799439011',
      conductorId: conductorId,
      busNumber: 'BUS001',
    };

    jest.spyOn(Bus, 'findById').mockResolvedValue(mockBus);

    const req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { userId: conductorId, userType: 'conductor' },
    };

    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await verifyBusOwnership(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.bus).toEqual(mockBus);

    Bus.findById.mockRestore();
  });

  test('verifyBusOwnership allows admin and dispatcher to manage any vehicle', async () => {
    const reqDispatcher = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { userId: 'any-id', userType: 'dispatcher' },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await verifyBusOwnership(reqDispatcher, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const reqAdmin = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { userId: 'any-id', userType: 'admin' },
    };
    await verifyBusOwnership(reqAdmin, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
