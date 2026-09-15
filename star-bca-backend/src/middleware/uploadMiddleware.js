const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const name = (file.originalname || '').toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();
  const extname = /\.((pdf)|(png)|(jpe?g)|(webp)|(docx?)|(csv)|(json)|(txt)|(xlsx?))$/.test(path.extname(name));
  const isAllowedMime = [
    'application/pdf',
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/pjpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/csv',
    'application/json',
    'text/plain',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ].includes(mimetype) || /csv|json|txt|xlsx?|xls/.test(mimetype);
  if (extname && isAllowedMime) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, PNG, JPG, JPEG, CSV, JSON, TXT, or Excel files are allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
});

module.exports = upload;
