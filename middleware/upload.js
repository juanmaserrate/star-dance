'use strict';
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = 'doc-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, safe);
  },
});

const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.webp'];
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Formato no permitido. Usá PDF, imagen o Word.'));
  },
});

module.exports = { upload, UPLOAD_DIR };
