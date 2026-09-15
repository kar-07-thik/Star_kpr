const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  if (err instanceof Error && err.message === 'Only PDF, PNG, JPG, and JPEG files are allowed') {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File size must be less than 5MB' });
  }

  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
};

module.exports = errorMiddleware;
