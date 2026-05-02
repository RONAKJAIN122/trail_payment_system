const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { createSession, joinSession, getSession, updatePayment } = require('../controllers/sessionController');

// ─── Multer Storage Config ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const unique = `qr_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const isValid = allowed.test(path.extname(file.originalname).toLowerCase()) &&
                  allowed.test(file.mimetype.split('/')[1]);
  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post('/create-session', upload.single('qrCode'), createSession);
router.post('/join-session', joinSession);
router.get('/session/:id', getSession);
router.post('/update-payment', updatePayment);

module.exports = router;
