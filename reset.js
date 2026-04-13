const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/database');

async function resetPassword() {
  try {
    const newPassword = 'Password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'mugilCheck@gmail.com']);
    console.log('Password reset successfully!');
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
resetPassword();
