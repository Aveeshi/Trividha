const express = require('express');
const router = express.Router();
const authController = require('../controller/hospitalAuthController');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.authRequired, authController.me);
router.post('/forgot', authController.forgotPassword);
router.post('/reset', authController.resetPassword);

module.exports = router;
