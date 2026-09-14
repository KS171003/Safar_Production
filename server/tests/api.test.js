const request = require('supertest');
const { app } = require('../index');

describe('System Health & Observability Endpoints', () => {
  test('GET /health returns 200 with uptime and service metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('safar-backend');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeDefined();
  });

  test('GET /ready returns database readiness check status', async () => {
    const res = await request(app).get('/ready');
    // Without active DB connected in mock unit test, it returns 503 or 200 depending on state
    expect([200, 503]).toContain(res.statusCode);
    expect(res.body.status).toBeDefined();
  });

  test('GET undefined route triggers 404 AppError with JSON format', async () => {
    const res = await request(app).get('/api/undefined-endpoint-xyz');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Route not found');
  });

  test('Applies Helmet security headers on responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('ML Status & Real-Time Metrics Endpoints', () => {
  test('GET /api/ml/status returns model status and metrics metadata', async () => {
    const res = await request(app).get('/api/ml/status');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ready');
    expect(res.body.modelInfo).toBeDefined();
    expect(res.body.modelInfo.metrics).toBeDefined();
  });

  test('GET /api/ml/metrics returns evaluation ring buffer metrics', async () => {
    const res = await request(app).get('/api/ml/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.metrics).toBeDefined();
  });
});

describe('Security Middleware Protection', () => {
  test('Prevents unauthorized mutation on bus endpoints without JWT', async () => {
    const res = await request(app)
      .post('/api/bus/123456789012345678901234/start-route')
      .send({ routeId: '123456789012345678901234' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Prevents unauthorized emergency creation without JWT', async () => {
    const res = await request(app)
      .post('/api/emergency')
      .send({
        busId: '123456789012345678901234',
        conductorId: '123456789012345678901234',
        alertType: 'medical',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
