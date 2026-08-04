const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadMedia } = require('../controllers/mediaController');

// Multer memory storage configuration (50MB limit)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// POST /api/media/upload
router.post('/upload', upload.single('file'), uploadMedia);

module.exports = router;
