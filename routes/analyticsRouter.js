const express = require('express');
const router = express.Router();
const { authRequired } = require('../controller/hospitalAuthController');
const analyticsController = require('../controller/analyticsController');

router.get('/daily', authRequired, analyticsController.daily);
router.get('/visits', authRequired, analyticsController.visits);
router.post('/visit', authRequired, analyticsController.recordVisit);

module.exports = router;
