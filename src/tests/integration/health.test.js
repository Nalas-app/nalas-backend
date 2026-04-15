const request = require('supertest');

// Mock database to avoid connection issues during health check test
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { on: jest.fn(), end: jest.fn() }
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const app = require('../../app');

describe('Health Integration Tests', () => {
  it('should return 200 OK for /health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.statusCode).toBe(404);
  });
});
