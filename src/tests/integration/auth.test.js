const request = require('supertest');
const db = require('../../config/database');

// Mock database config
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { on: jest.fn(), end: jest.fn() }
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const app = require('../../app');

describe('Auth Integration Tests (Mocked DB)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      // 1. Mock findUserByEmail (check if user exists)
      db.query.mockResolvedValueOnce({ rows: [] });
      
      // 2. Mock createUser
      db.query.mockResolvedValueOnce({ 
        rows: [{ id: 'user-123', email: 'test@example.com', role: 'customer' }] 
      });

      // 3. Mock createProfile
      db.query.mockResolvedValueOnce({ 
        rows: [{ user_id: 'user-123' }] 
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
          fullName: 'Test User',
          phone: '1234567890'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.token).toBeDefined();
    });

    it('should return 400 if user already exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123!',
          fullName: 'Existing User',
          phone: '1234567890'
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.message).toContain('already registered');
    });
  });
});
