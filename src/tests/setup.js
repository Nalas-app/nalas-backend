jest.mock('../config/database', () => {
  return {
    query: jest.fn(),
    pool: {
      connect: jest.fn()
    }
  };
});

// Suppress logger output during tests
jest.mock('../shared/utils/logger', () => {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
});

// Mock axios for external API calls
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn()
}));

afterEach(() => {
  jest.clearAllMocks();
});
