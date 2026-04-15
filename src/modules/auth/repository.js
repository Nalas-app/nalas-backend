const db = require('../../config/database');

class AuthRepository {
  async createUser({ email, passwordHash, phone, role = 'customer' }) {
    const query = `
      INSERT INTO users (email, password_hash, phone, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, role, created_at
    `;
    const result = await db.query(query, [email, passwordHash, phone, role]);
    return result.rows[0];
  }

  async findUserByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  async createProfile(userId, fullName) {
    const query = `
      INSERT INTO user_profiles (user_id, full_name)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await db.query(query, [userId, fullName]);
    return result.rows[0];
  }

  async findUserById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  // ===== TOKEN MANAGEMENT =====

  async saveRefreshToken(userId, token, expiresAt) {
    const query = `
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(query, [userId, token, expiresAt]);
    return result.rows[0];
  }

  async findRefreshToken(token) {
    const query = 'SELECT * FROM refresh_tokens WHERE token = $1 AND is_revoked = FALSE';
    const result = await db.query(query, [token]);
    return result.rows[0] || null;
  }

  async revokeRefreshToken(token) {
    const query = 'UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = $1';
    await db.query(query, [token]);
  }

  async blacklistToken(token, expiresAt) {
    const query = 'INSERT INTO blacklisted_tokens (token, expires_at) VALUES ($1, $2)';
    await db.query(query, [token, expiresAt]);
  }

  async isTokenBlacklisted(token) {
    const query = 'SELECT 1 FROM blacklisted_tokens WHERE token = $1';
    const result = await db.query(query, [token]);
    return result.rowCount > 0;
  }

  // ===== PASSWORD RESET =====

  async setUserResetToken(userId, token, expires) {
    const query = `
      UPDATE users 
      SET reset_password_token = $1, reset_password_expires = $2
      WHERE id = $3
    `;
    await db.query(query, [token, expires, userId]);
  }

  async findUserByResetToken(token) {
    const query = `
      SELECT * FROM users 
      WHERE reset_password_token = $1 
      AND reset_password_expires > NOW()
    `;
    const result = await db.query(query, [token]);
    return result.rows[0] || null;
  }

  async updatePassword(userId, passwordHash) {
    const query = `
      UPDATE users 
      SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL
      WHERE id = $2
    `;
    await db.query(query, [passwordHash, userId]);
  }
}

module.exports = new AuthRepository();