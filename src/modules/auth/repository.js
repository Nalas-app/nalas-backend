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

  async blacklistToken(userId, token, expiresAt) {
    const query = 'INSERT INTO blacklisted_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)';
    await db.query(query, [userId, token, expiresAt]);
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
  async getUserWithProfile(userId) {
    const query = `
      SELECT u.id, u.email, u.phone, u.role, u.is_active, u.created_at, p.full_name, p.avatar_url, p.bio
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  async updateProfile(userId, { fullName, avatarUrl, bio }) {
    const query = `
      UPDATE user_profiles
      SET full_name = COALESCE($1, full_name),
          avatar_url = COALESCE($2, avatar_url),
          bio = COALESCE($3, bio),
          updated_at = NOW()
      WHERE user_id = $4
      RETURNING *
    `;
    const result = await db.query(query, [fullName, avatarUrl, bio, userId]);
    return result.rows[0];
  }

  async updateUser(userId, { phone }) {
    const query = `
      UPDATE users
      SET phone = COALESCE($1, phone),
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, phone, role
    `;
    const result = await db.query(query, [phone, userId]);
    return result.rows[0];
  }
}

module.exports = new AuthRepository();