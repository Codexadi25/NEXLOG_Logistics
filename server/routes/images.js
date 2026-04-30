const express = require('express');
const multer = require('multer');
const { imageToSvg, signatureToSvg, createPlaceholderSvg } = require('../utils/imageConverter');
const { auth } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// Convert image to SVG
router.post('/convert', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' });

    const { svg, width, height } = await imageToSvg(req.file.buffer, req.file.mimetype);
    res.json({ svg, width, height, mimeType: 'image/svg+xml' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Convert signature (base64) to SVG
router.post('/signature', auth, async (req, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) return res.status(400).json({ message: 'No signature data provided' });

    const svg = await signatureToSvg(base64Image);
    res.json({ svg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get placeholder SVG
router.get('/placeholder', (req, res) => {
  const label = req.query.label || 'Package';
  const svg = createPlaceholderSvg(label);
  res.set('Content-Type', 'image/svg+xml');
  res.send(svg);
});

module.exports = router;
