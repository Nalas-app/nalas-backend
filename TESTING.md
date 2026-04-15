# Nalas Rest Backend - Testing Documentation

This document outlines the testing infrastructure, results, and instructions for the Nalas Rest Backend application.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- Dependencies installed via `npm install`

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Health checks only
npx jest src/tests/integration/health.test.js

# Auth module only
npx jest src/tests/integration/auth.test.js
```

## 🛠 Testing Infrastructure

- **Framework**: [Jest](https://jestjs.io/)
- **API Testing**: [Supertest](https://github.com/ladjs/supertest)
- **Environment**: Configured via `jest.config.js` and `.eslintrc.json`.
- **Database Strategy**: Currently using **Module Mocking** for integration tests to ensure tests are fast and environment-independent.
  - The `pg` pool is mocked at the configuration level (`src/config/database.js`).
  - To test with a real database, ensure your `.env` is configured and remove the `jest.mock` blocks from the test files.

## ✅ Latest Test Results (2026-04-09)

| Module | Test Suite | Result | Details |
|--------|------------|--------|---------|
| General | Health Check | [PASS] | Verified `/health` endpoint and 404 handling. |
| Auth | Registration | [PASS] | Verified successful user creation and duplicate email handling. |

**Total Pass Rate**: 100% (4/4 tests)

## 🔧 Resolved Issues

During the testing setup, several critical issues were identified and resolved in the codebase:

1.  **Duplicate Variable Declarations**: Multiple `const result` and `const sortBy` redeclarations fixed in the `Stock` and `Order` modules.
2.  **Duplicate Method Definitions**: Multiple `async` methods with the same name fixed in `StockService` and `OrderService`.
3.  **Malformed SQL Queries**: Fixed scenarios where multiple `WHERE` clauses or incorrect parameter indices were present in `StockRepository`.
4.  **Parsing Errors in JSON/Objects**: Fixed missing commas and duplicate keys in `stock` routes and validators.
5.  **Environment Configuration**: Standardized environment variable injection (`NODE_ENV`, `JWT_SECRET`) within the test environment.

## 📝 Guidelines for Adding Tests

1.  Place new integration tests in `src/tests/integration/`.
2.  Follow the naming convention: `[module_name].test.js`.
3.  Mock the database config at the top of the file:
    ```javascript
    jest.mock('../../config/database', () => ({
      query: jest.fn(),
      getClient: jest.fn(),
      pool: { on: jest.fn(), end: jest.fn() }
    }));
    ```
4.  Ensure `process.env.NODE_ENV = 'test'` is set.
