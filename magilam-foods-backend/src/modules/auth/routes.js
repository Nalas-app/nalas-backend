const express = require('express');
const authController = require('./controller');
const { validate } = require('../../middlewares/validate.middleware');
const { registerSchema, loginSchema } = require('./validators');

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

module.exports = router;