const express = require('express');
const router = express.Router();
const { authRequired } = require('../controller/hospitalAuthController');
const kioskController = require('../controller/kioskController');

router.get('/', authRequired, kioskController.list);
router.post('/', authRequired, kioskController.create);
router.delete('/:id', authRequired, kioskController.remove);

module.exports = router;
