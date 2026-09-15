const mongoose = require('mongoose');
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/star-bca-backend', { serverSelectionTimeoutMS: 5000 });
  const student = await User.findOne({
    role: 'student',
    $or: [{ registerNo: '2023BCA001' }, { registerNumber: '2023BCA001' }, { regNo: '2023BCA001' }],
  }).lean();
  console.log('student found', Boolean(student));
  if (student) {
    console.log('stored hash', student.password);
    console.log('compare', await bcrypt.compare('123456', student.password));
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
