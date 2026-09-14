const jwt = require('jsonwebtoken');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { AppError, errorHandler } = require('../middleware/errorHandler');
const { validate, schemas } = require('../middleware/validate');

describe('Authentication & Authorization Middleware', () => {
  const secret = 'test-secret-12345';
  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  test('authenticateToken rejects request without authorization header', () => {
    const req = { headers: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Access token required' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('authenticateToken accepts valid Bearer token and attaches decoded payload', () => {
    const token = jwt.sign({ userId: '12345', userType: 'conductor' }, secret);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('12345');
    expect(req.user.userType).toBe('conductor');
  });

  test('requireRole allows permitted roles and blocks forbidden roles', () => {
    const middleware = requireRole('conductor');
    const allowedReq = { user: { userId: '1', userType: 'conductor' } };
    const forbiddenReq = { user: { userId: '2', userType: 'passenger' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    middleware(allowedReq, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    middleware(forbiddenReq, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('Joi Validation Middleware', () => {
  test('validates valid user registration payload', () => {
    const req = {
      body: {
        email: 'test@safar.com',
        password: 'securePassword123',
        name: 'Test Conductor',
        phone: '+919876543210',
        userType: 'conductor',
        busNumber: 'BUS101',
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(schemas.register)(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects registration payload with missing fields or invalid email', () => {
    const req = {
      body: {
        email: 'invalid-email',
        password: '123', // too short
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(schemas.register)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Centralized Error Handling Middleware', () => {
  test('formats custom AppError correctly with status code', () => {
    const error = new AppError('Resource not accessible', 403, 'FORBIDDEN');
    const req = { path: '/test', method: 'GET' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    errorHandler(error, req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Resource not accessible',
    }));
  });
});
