const User = require('../models/User');

const assignFacultyToStudents = async (studentIds, facultyId) => {
  if (!studentIds?.length || !facultyId) return { modifiedCount: 0 };
  const result = await User.updateMany(
    { _id: { $in: studentIds }, role: 'student' },
    { $set: { assignedTeacher: facultyId, assignedFacultyId: facultyId } }
  );
  return { modifiedCount: result.modifiedCount };
};

const getStudentsForFaculty = async (facultyId) => {
  return User.find({ role: 'student', assignedFacultyId: facultyId }).select('-password').lean();
};

module.exports = { assignFacultyToStudents, getStudentsForFaculty };
