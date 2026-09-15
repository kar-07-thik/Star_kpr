const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const School = require('../models/School');
const Department = require('../models/Department');

dotenv.config();

async function runMigration() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/star-kpr';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: true });

  const collectionsToDrop = ['students', 'faculty', 'hod', 'dean'];
  const db = mongoose.connection.db;
  const existingCollections = await db.listCollections().toArray();
  const collectionNames = existingCollections.map((item) => item.name);

  for (const name of collectionsToDrop) {
    if (collectionNames.includes(name)) {
      await db.collection(name).drop().catch(() => {});
      console.log(`Dropped collection: ${name}`);
    }
  }

  const legacyUsers = await User.find({}).lean();
  const schoolMap = new Map();
  const departmentMap = new Map();

  const schools = await School.find({}).lean();
  const departments = await Department.find({}).lean();
  schools.forEach((school) => schoolMap.set(String(school._id), school));
  departments.forEach((department) => departmentMap.set(String(department._id), department));

  for (const legacyUser of legacyUsers) {
    const normalizedRole = legacyUser.role === 'faculty' ? 'faculty' : legacyUser.role === 'student' ? 'student' : 'admin';
    const normalizedAccountType = legacyUser.accountType === 'hod' ? 'hod' : legacyUser.accountType === 'dean' ? 'dean' : null;

    const schoolId = legacyUser.schoolId || (legacyUser.school ? schools.find((school) => school.name === legacyUser.school)?._id : null) || null;
    const departmentId = legacyUser.departmentId || (legacyUser.department ? departments.find((department) => department.name === legacyUser.department)?._id : null) || null;

    const mappedUser = {
      _id: legacyUser._id,
      name: legacyUser.name,
      email: legacyUser.email || undefined,
      password: legacyUser.password,
      role: normalizedRole,
      accountType: normalizedRole === 'admin' ? normalizedAccountType : null,
      schoolId: schoolId || null,
      departmentId: departmentId || null,
      school: schoolMap.get(String(schoolId))?.name || legacyUser.school || '',
      department: departmentMap.get(String(departmentId))?.name || legacyUser.department || '',
      registerNo: legacyUser.registerNo || legacyUser.registerNumber || legacyUser.regNo || undefined,
      registerNumber: legacyUser.registerNumber || legacyUser.registerNo || legacyUser.regNo || undefined,
      regNo: legacyUser.regNo || legacyUser.registerNo || legacyUser.registerNumber || undefined,
      year: legacyUser.year || legacyUser.semesterBatch || legacyUser.batch || '',
      batch: legacyUser.batch || legacyUser.semesterBatch || '',
      section: legacyUser.section || '',
      assignedTeacher: legacyUser.assignedTeacher || legacyUser.assignedFacultyId || null,
      assignedFacultyId: legacyUser.assignedFacultyId || legacyUser.assignedTeacher || null,
      assignedYear: legacyUser.assignedYear || legacyUser.yearAssigned || '',
      semesterBatch: legacyUser.semesterBatch || legacyUser.batch || '',
      status: legacyUser.status || 'Active',
      createdAt: legacyUser.createdAt,
      updatedAt: legacyUser.updatedAt,
    };

    await User.updateOne({ _id: legacyUser._id }, { $set: mappedUser }, { upsert: true });
  }

  console.log('Migration completed');
  await mongoose.disconnect();
}

runMigration().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
