const request = require('supertest');
const app = require('../app');
const db = require('../config/database');

// Mock the database
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Mock: User doesn't exist
      db.query.mockResolvedValueOnce({ rows: [] });
      // Mock: User insertion
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com', role: 'customer' }] });
      // Mock: Profile insertion
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1 }] });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
          phone: '1234567890',
          fullName: 'Test User'
        });

      expect(res.statusCode).toBe(201 || 200); // Check what your controller returns
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should return 400 if validation fails', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: '123'
        });

      expect(res.statusCode).toBe(400);
    });
  });
});
