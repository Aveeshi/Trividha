const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authRequired } = require('../controller/hospitalAuthController');
const doctorController = require('../controller/hospitalDoctorController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', authRequired, doctorController.list);
router.post('/', authRequired, doctorController.create);
router.put('/:id', authRequired, doctorController.update);
router.delete('/:id', authRequired, doctorController.remove);
router.post('/import', authRequired, upload.single('file'), doctorController.import);
router.get('/template', authRequired, doctorController.template);

module.exports = router;
