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
}

module.exports = new AuthRepository();