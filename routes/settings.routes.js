const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth  = require('../middleware/authMiddleware');
const roles = require('../middleware/roleMiddleware');
const ctrl  = require('../controllers/settings.controller');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/')),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.get('/',   auth, ctrl.getSettings);
router.put('/',   auth, roles('admin', 'superadmin'), ctrl.updateSettings);
router.post('/upload', auth, roles('admin', 'superadmin'), upload.single('logo'), ctrl.uploadLogo);

module.exports = router;
