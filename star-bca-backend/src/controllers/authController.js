const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { createToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');

const studentEmailPattern = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*@kprcas\.ac\.in$/;
const normalizeIdentifier = (value) => (value || '').toString().trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findUserByIdentifier = async (identifier, role) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) return null;

  const query = { role };
  if (role === 'admin') {
    const normalizedEmail = normalizedIdentifier.toLowerCase();
    query.$or = [
      { email: normalizedEmail },
      { email: normalizedIdentifier },
      { email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' } },
      { email: { $regex: `^${escapeRegExp(normalizedIdentifier)}$`, $options: 'i' } },
    ];
  } else {
    query.email = normalizedIdentifier.toLowerCase();
  }

  return User.findOne(query);
};

const buildUserResponse = (user, role) => ({
  id: user._id,
  name: user.name,
  role,
  email: user.email,
  accountType: user.accountType || null,
  schoolId: user.schoolId,
  departmentId: user.departmentId,
  school: user.school,
  department: user.department,
  registerNumber: user.registerNumber || null,
  year: user.year || null,
  section: user.section || null,
  batch: user.batch || null,
  assignedFacultyId: user.assignedFacultyId || null,
});

const loginStudent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const rawIdentifier = normalizeIdentifier(req.body.email || req.body.identifier).toLowerCase();
    if (!studentEmailPattern.test(rawIdentifier)) {
      return sendError(res, 400, 'Student email must use a valid @kprcas.ac.in address');
    }

    const password = req.body.password;
    const student = await findUserByIdentifier(rawIdentifier, 'student');

    if (!student) return sendError(res, 401, 'Invalid student credentials');

    const isMatch = await student.comparePassword(password);
    if (!isMatch) return sendError(res, 401, 'Invalid student credentials');

    const token = createToken({ id: student._id, role: 'student' });
    return sendSuccess(res, 200, 'Student logged in successfully', {
      token,
      user: buildUserResponse(student, 'student'),
    });
  } catch (error) {
    next(error);
  }
};

const loginAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const email = normalizeIdentifier(req.body.email || req.body.identifier).toLowerCase();
    const password = req.body.password;
    const adminUser = await findUserByIdentifier(email, 'admin');

    if (!adminUser) return sendError(res, 401, 'Invalid admin credentials');

    const isMatch = await adminUser.comparePassword(password);
    if (!isMatch) return sendError(res, 401, 'Invalid admin credentials');

    const token = createToken({ id: adminUser._id, role: 'admin', accountType: adminUser.accountType || null });
    return sendSuccess(res, 200, 'Admin logged in successfully', {
      token,
      user: buildUserResponse(adminUser, 'admin'),
    });
  } catch (error) {
    next(error);
  }
};

const loginTeacher = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const email = normalizeIdentifier(req.body.email || req.body.identifier).toLowerCase();
    const password = req.body.password;
    const faculty = await findUserByIdentifier(email, 'faculty');

    if (!faculty) return sendError(res, 401, 'Invalid teacher credentials');

    const isMatch = await faculty.comparePassword(password);
    if (!isMatch) return sendError(res, 401, 'Invalid teacher credentials');

    const token = createToken({ id: faculty._id, role: 'faculty' });
    return sendSuccess(res, 200, 'Teacher logged in successfully', {
      token,
      user: buildUserResponse(faculty, 'faculty'),
    });
  } catch (error) {
    next(error);
  }
};

const registerTeacher = async (req, res, next) => {
  try {
    const { name, email, password, department, school, departmentId, schoolId, assignedYear } = req.body;
    const existingFaculty = await User.findOne({ role: 'faculty', email: email.toLowerCase() });
    if (existingFaculty) return sendError(res, 400, 'Teacher already exists');

    const teacher = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'faculty',
      department: department || '',
      school: school || 'STAR',
      departmentId: departmentId || null,
      schoolId: schoolId || null,
      assignedYear: assignedYear || '',
    });

    return sendSuccess(res, 201, 'Teacher registered successfully', { id: teacher._id, name: teacher.name, email: teacher.email });
  } catch (error) {
    next(error);
  }
};

const registerStudent = async (req, res, next) => {
  try {
    const { name, email, registerNumber, password, department, school, section, batch, year, assignedFacultyId, departmentId, schoolId } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    if (!studentEmailPattern.test(normalizedEmail || '')) {
      return sendError(res, 400, 'Student email must use a valid @kprcas.ac.in address');
    }

    const existingStudent = await User.findOne({ role: 'student', email: normalizedEmail });
    if (existingStudent) return sendError(res, 400, 'Student already exists');

    const student = await User.create({
      name,
      email: normalizedEmail,
      registerNumber,
      password,
      role: 'student',
      department: department || '',
      school: school || 'STAR',
      departmentId: departmentId || null,
      schoolId: schoolId || null,
      section: section || '',
      batch: batch || '',
      year: year || '',
      assignedFacultyId: assignedFacultyId || null,
    });

    return sendSuccess(res, 201, 'Student registered successfully', { id: student._id, name: student.name, registerNumber: student.registerNumber });
  } catch (error) {
    next(error);
  }
};

const authValidators = {
  loginStudent: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  loginTeacher: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  loginAdmin: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ]
};

module.exports = { loginStudent, loginTeacher, loginAdmin, registerTeacher, registerStudent, authValidators };
