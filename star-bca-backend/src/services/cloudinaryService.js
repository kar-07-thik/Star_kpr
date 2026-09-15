const cloudinary = require('../config/cloudinary');

const uploadBuffer = (buffer, { contentType, folder, fileName } = {}) => new Promise((resolve, reject) => {
  if (!buffer || !buffer.length) return reject(new Error('Cannot upload an empty file'));

  const resourceType = contentType === 'application/pdf' ? 'raw' : 'image';
  const upload = cloudinary.uploader.upload_stream({
    resource_type: resourceType,
    folder: folder || (resourceType === 'raw' ? 'star-kpr/certificates' : 'star-kpr/proofs'),
    public_id: fileName ? fileName.replace(/\.[^.]+$/, '') : undefined,
    use_filename: Boolean(fileName),
    unique_filename: true,
    overwrite: false,
  }, (error, result) => {
    if (error) return reject(error);
    return resolve(result);
  });

  upload.end(buffer);
});

const uploadSubmissionFile = (file) => uploadBuffer(file.buffer, {
  contentType: file.mimetype,
  fileName: file.originalname,
  folder: file.mimetype === 'application/pdf' ? 'star-kpr/certificates' : 'star-kpr/proofs',
});

module.exports = { uploadBuffer, uploadSubmissionFile };