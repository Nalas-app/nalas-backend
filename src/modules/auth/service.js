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

    const { accessToken, refreshToken } = await this.generateTokens(user);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    };
  }

  async logout(token) {
    // Decode token to get expiry and userId
    const decoded = jwt.decode(token);
    if (!decoded) return;

    const expiresAt = new Date(decoded.exp * 1000);
    const userId = decoded.userId;
    
    await authRepository.blacklistToken(userId, token, expiresAt);
  }

  async refreshToken(oldRefreshToken) {
    const refreshTokenData = await authRepository.findRefreshToken(oldRefreshToken);
    
    if (!refreshTokenData || new Date(refreshTokenData.expires_at) < new Date()) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const user = await authRepository.findUserById(refreshTokenData.user_id);
    if (!user || !user.is_active) {
      throw AppError.unauthorized('User not found or inactive');
    }

    // Revoke old token
    await authRepository.revokeRefreshToken(oldRefreshToken);

    // Generate new pair
    const { accessToken, refreshToken } = await this.generateTokens(user);
    
    return { accessToken, refreshToken };
  }

  async requestPasswordReset(email) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      // Don't leak user existence; return success even if email not found
      return;
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await authRepository.setUserResetToken(user.id, resetToken, expires);

    // 1. Load email client
    const emailClient = require('../../shared/utils/emailClient');
    
    // 2. Send real email
    try {
      await emailClient.sendPasswordReset(email, resetToken);
    } catch (err) {
      // We still return success to the user, but log the error
      logger.error('Background Email Job Failed:', err.message);
    }
  }

  async resetPassword(token, newPassword) {
    const user = await authRepository.findUserByResetToken(token);
    if (!user) {
      throw AppError.badRequest('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await authRepository.updatePassword(user.id, passwordHash);
  }

  async generateTokens(user) {
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = require('crypto').randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await authRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

    return { accessToken, refreshToken };
  }

  // Preserve legacy method for backward compatibility if needed, 
  // but internally uses new logic
  generateToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  async getProfile(userId) {
    const user = await authRepository.getUserWithProfile(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user;
  }

  async updateProfile(userId, data) {
    const { fullName, avatarUrl, bio, phone } = data;
    
    if (phone) {
      await authRepository.updateUser(userId, { phone });
    }
    
    const profile = await authRepository.updateProfile(userId, { fullName, avatarUrl, bio });
    const user = await authRepository.getUserWithProfile(userId);
    
    return user;
  }
}

module.exports = new AuthService();