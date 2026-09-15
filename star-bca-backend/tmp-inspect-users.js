const mongoose = require('mongoose');
const User = require('./src/models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/star-bca-backend', { serverSelectionTimeoutMS: 5000 });
  const users = await User.find({ role: { $in: ['student', 'faculty', 'admin'] } })
    .select('name role email registerNumber registerNo regNo password')
    .lean();
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
