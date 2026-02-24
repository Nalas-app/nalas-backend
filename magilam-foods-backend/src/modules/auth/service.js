const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authRepository = require('./repository');
const AppError = require('../../shared/errors/AppError');

class AuthService {
  async register({ email, password, phone, fullName }) {
    const existingUser = await authRepository.findUserByEmail(email);
    if (existingUser) {
      throw AppError.conflict('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await authRepository.createUser({
      email,
      passwordHash,
      phone,
      role: 'customer'
    });

    await authRepository.createProfile(user.id, fullName);

    const token = this.generateToken(user);

    return { 
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }, 
      token 
    };
  }

  async login({ email, password }) {
    const user = await authRepository.findUserByEmail(email);
    
    if (!user) {
      throw AppError.unauthorized('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid credentials');
    }

    if (!user.is_active) {
      throw AppError.forbidden('Account is deactivated');
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token
    };
  }

  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

module.exports = new AuthService();