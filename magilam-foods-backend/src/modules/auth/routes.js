const express = require('express');
const authController = require('./controller');
const { validate } = require('../../middlewares/validate.middleware');
const { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema 
} = require('./validators');

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;