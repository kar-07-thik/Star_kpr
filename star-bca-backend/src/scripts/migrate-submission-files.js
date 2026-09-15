require('dotenv').config();

const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const connectDB = require('../config/db');
const { uploadBuffer } = require('../services/cloudinaryService');

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (value?.buffer && Buffer.isBuffer(value.buffer)) return value.buffer;
  if (value?.value && typeof value.value === 'function') return value.value(true);
  if (typeof value === 'string') return Buffer.from(value, 'base64');
  if (value?.base64) return Buffer.from(value.base64, 'base64');
  return null;
};

const migrateFile = async (file, label) => {
  const buffer = toBuffer(file.data);
  if (!buffer?.length) throw new Error(`${label} has no decodable Binary data`);

  const result = await uploadBuffer(buffer, {
    contentType: file.contentType || 'application/octet-stream',
    fileName: file.fileName || `${label}.bin`,
  });

  return {
    fileName: file.fileName || '',
    contentType: file.contentType || 'application/octet-stream',
    url: result.secure_url,
    publicId: result.public_id,
    size: file.size || buffer.length,
  };
};

const run = async () => {
  await connectDB();
  const query = {
    $or: [
      { 'certificateFile.data': { $exists: true } },
      { proofUrl: { $type: 'object' } },
      { image: { $type: 'object' } },
    ],
  };
  const submissions = await Submission.collection.find(query).toArray();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const submission of submissions) {
    try {
      let changed = false;
      const update = { $set: {} };
      if (submission.certificateFile?.data) {
        update.$set.certificateFile = await migrateFile(submission.certificateFile, `submission ${submission._id} certificate`);
        changed = true;
      }

      for (const field of ['proofUrl', 'image']) {
        const value = submission[field];
        if (!value || typeof value !== 'object' || !value.data) continue;
        const migrated = await migrateFile(value, `submission ${submission._id} ${field}`);
        update.$set[field] = migrated.url;
        changed = true;
      }

      if (changed) {
        await Submission.collection.updateOne({ _id: submission._id }, update);
        migrated += 1;
        console.log(`[migration] migrated ${submission._id}`);
      } else {
        skipped += 1;
        console.log(`[migration] skipped ${submission._id}: no supported Binary field`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[migration] failed ${submission._id}: ${error.message}`);
    }
  }

  console.log(`[migration] complete: migrated=${migrated}, skipped=${skipped}, failed=${failed}, total=${submissions.length}`);
  await mongoose.connection.close();
  if (failed) process.exitCode = 1;
};

run().catch(async (error) => {
  console.error(`[migration] fatal: ${error.message}`);
  await mongoose.connection.close();
  process.exitCode = 1;
});