const express = require('express');
const router = express.Router();
const { authRequired } = require('../controller/hospitalAuthController');
const hospitalController = require('../controller/hospitalController');

router.put('/', authRequired, hospitalController.updateProfile);
router.post('/sync', authRequired, hospitalController.sync);

module.exports = router;
