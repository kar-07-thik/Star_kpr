const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const User = require('../models/User');
const School = require('../models/School');
const Department = require('../models/Department');
const Activity = require('../models/Activity');
const Submission = require('../models/Submission');
const AuditLog = require('../models/AuditLog');
const SystemSetting = require('../models/SystemSetting');
const { normalizeBulkRow, parseBulkStudentRows, parseBulkUpdateRows, isEmptyRow, getRequiredValidationErrors, getValue } = require('../utils/bulkUploadUtils');
const { validateDepartmentPayload } = require('../utils/deanScope');
const { sendSuccess, sendError } = require('../utils/response');
const { logAudit } = require('../utils/audit');
const { generateDepartmentSummary } = require('../services/departmentInsightsService');

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildUserResponse = (user) => {
  const safeUser = user.toObject ? user.toObject() : { ...user };
  delete safeUser.password;
  return safeUser;
};

const buildScopeQuery = (req, baseQuery = {}) => {
  const query = { ...baseQuery };
  if (req?.user?.accountType === 'dean' && req.user.schoolId) query.schoolId = req.user.schoolId;
  if (req?.user?.accountType === 'hod' && req.user.departmentId) query.departmentId = req.user.departmentId;
  return query;
};

const validateRoleScope = (req, payload) => {
  if (req.user?.accountType === 'dean') {
    if (payload.role !== 'admin' || (payload.accountType || 'hod') !== 'hod') {
      return 'Dean accounts can only add HODs.';
    }
  }
  if (req.user?.accountType === 'hod') {
    if (payload.role === 'admin') {
      return 'HOD accounts can only add students or faculty.';
    }
  }
  return null;
};

const requireDean = (req, res) => {
  const isDean =
    req.user?.accountType === 'dean' ||
    (req.user?.role === 'admin' && req.user?.schoolId && req.user?.accountType !== 'hod');
  if (!isDean) {
    sendError(res, 403, 'Only dean or principal accounts can access this endpoint');
    return false;
  }
  if (req.user?.accountType === 'dean' && !req.user?.schoolId) {
    sendError(res, 403, 'Dean accounts must be assigned to a school');
    return false;
  }
  return true;
};

const getUsers = async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const role = req.query.role || '';
    const accountType = req.query.accountType || '';
    const query = buildScopeQuery(req, {});

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { registerNo: { $regex: escapedSearch, $options: 'i' } },
        { registerNumber: { $regex: escapedSearch, $options: 'i' } },
        { regNo: { $regex: escapedSearch, $options: 'i' } },
      ];
    }
    if (role) query.role = role;
    if (accountType) query.accountType = accountType;

    const users = await User.find(query)
      .populate('schoolId', 'name code')
      .populate('departmentId', 'name code')
      .select('-password')
      .sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Users fetched successfully', users);
  } catch (error) {
    next(error);
  }
};

const exportUsers = async (req, res, next) => {
  try {
    const role = req.query.role || '';
    const query = buildScopeQuery(req, {});
    if (role) query.role = role;

    const users = await User.find(query).sort({ createdAt: -1 });
    const rows = users.map((user) => ({
      Name: user.name || '',
      Email: user.email || '',
      Role: user.role || '',
      AccountType: user.accountType || '',
      'Register Number': user.registerNumber || user.registerNo || user.regNo || '',
      School: user.school || '',
      Department: user.department || '',
      Section: user.section || '',
      Status: user.status || 'Active',
    }));

    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Users', `users-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return sendError(res, 404, 'User not found');

    const canManageStudents = req.user?.role === 'admin' || req.user?.accountType === 'hod' || req.user?.accountType === 'dean';
    if (!canManageStudents) return sendError(res, 403, 'Access denied');

    if (req.user?.accountType === 'hod' && req.user.departmentId && user.departmentId?.toString() !== req.user.departmentId.toString()) {
      return sendError(res, 403, 'Access denied');
    }

    if (req.user?.accountType === 'dean' && req.user.schoolId && user.schoolId?.toString() !== req.user.schoolId.toString()) {
      return sendError(res, 403, 'Access denied');
    }

    return sendSuccess(res, 200, 'User fetched successfully', buildUserResponse(user));
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    if (req.user?.accountType !== 'dean') {
      return sendError(res, 403, 'Only dean accounts can create departments');
    }

    const validation = validateDepartmentPayload(req.body, req);
    if (!validation.ok) {
      return sendError(res, 400, validation.errors.join(', '));
    }

    const existingDepartment = await Department.findOne({
      schoolId: validation.normalized.schoolId,
      $or: [
        { name: new RegExp(`^${validation.normalized.name}$`, 'i') },
        { code: validation.normalized.code },
      ],
    });

    if (existingDepartment) {
      return sendError(res, 400, 'A department with that name or code already exists in the selected school');
    }

    const department = await Department.create({
      ...validation.normalized,
      schoolId: validation.normalized.schoolId,
      status: validation.normalized.status || 'Active',
    });

    await logAudit(req, {
      action: 'Department created',
      entityType: 'Department',
      entityId: department._id,
      details: { name: department.name, code: department.code },
    });

    return sendSuccess(res, 201, 'Department created successfully', department);
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    if (req.user?.accountType !== 'dean') {
      return sendError(res, 403, 'Only dean accounts can update departments');
    }

    const department = await Department.findById(req.params.id);
    if (!department) return sendError(res, 404, 'Department not found');
    if (department.schoolId?.toString() !== req.user.schoolId?.toString()) {
      return sendError(res, 403, 'Dean accounts can only update departments in their own school');
    }

    const validation = validateDepartmentPayload({ ...req.body, schoolId: department.schoolId.toString() }, req);
    if (!validation.ok) {
      return sendError(res, 400, validation.errors.join(', '));
    }

    const duplicateDepartment = await Department.findOne({
      _id: { $ne: department._id },
      schoolId: department.schoolId,
      $or: [
        { name: new RegExp(`^${validation.normalized.name}$`, 'i') },
        { code: validation.normalized.code },
      ],
    });

    if (duplicateDepartment) {
      return sendError(res, 400, 'Another department in this school already uses that name or code');
    }

    department.name = validation.normalized.name;
    department.code = validation.normalized.code;
    department.status = validation.normalized.status || department.status;
    await department.save();

    await logAudit(req, {
      action: 'Department updated',
      entityType: 'Department',
      entityId: department._id,
      details: { name: department.name, code: department.code, status: department.status },
    });

    return sendSuccess(res, 200, 'Department updated successfully', department);
  } catch (error) {
    next(error);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    if (req.user?.accountType !== 'dean') {
      return sendError(res, 403, 'Only dean accounts can delete departments');
    }

    const department = await Department.findById(req.params.id);
    if (!department) return sendError(res, 404, 'Department not found');
    if (department.schoolId?.toString() !== req.user.schoolId?.toString()) {
      return sendError(res, 403, 'Dean accounts can only delete departments in their own school');
    }

    const dependentHodCount = await User.countDocuments({ role: 'admin', accountType: 'hod', departmentId: department._id, status: 'Active' });
    const dependentStudentCount = await User.countDocuments({ role: 'student', departmentId: department._id, status: 'Active' });

    if (dependentHodCount || dependentStudentCount) {
      return sendError(res, 400, 'Department cannot be deleted while it still has active HODs or students assigned to it');
    }

    await Department.deleteOne({ _id: department._id });
    await logAudit(req, {
      action: 'Department deleted',
      entityType: 'Department',
      entityId: department._id,
      details: { name: department.name, code: department.code },
    });

    return sendSuccess(res, 200, 'Department deleted successfully', { id: department._id });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    const role = payload.role || 'student';
    const accountType = payload.accountType || null;
    const roleScopeError = validateRoleScope(req, { ...payload, role, accountType });
    if (roleScopeError) return sendError(res, 400, roleScopeError);

    const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  if (!payload.name || !payload.password) {
      return sendError(res, 400, 'Name and password are required');
    }
    if (String(payload.password).length < 8) {
      return sendError(res, 400, 'Password must be at least 8 characters long');
    }
    if (payload.email && !validateEmail(payload.email)) {
      return sendError(res, 400, 'Invalid email format');
    }

    if (role === 'student') {
      if (!payload.registerNo && !payload.registerNumber && !payload.regNo) {
        return sendError(res, 400, 'Register number is required for students');
      }
    }

    if (role === 'faculty') {
      if (!payload.email) return sendError(res, 400, 'Email is required for faculty');
    }

    if (role === 'admin') {
      if (!payload.email) return sendError(res, 400, 'Email is required for admin users');
      if (accountType === 'hod' && !payload.departmentId) return sendError(res, 400, 'Department is required for HOD users');
      if (accountType === 'dean' && !payload.schoolId) return sendError(res, 400, 'School is required for Dean users');
    }

    const existing = await User.findOne({
      $or: [
        ...(payload.email ? [{ email: payload.email.toLowerCase() }] : []),
        ...(payload.registerNo || payload.registerNumber || payload.regNo ? [{ registerNo: payload.registerNo || payload.registerNumber || payload.regNo }, { regNo: payload.registerNo || payload.registerNumber || payload.regNo }, { registerNumber: payload.registerNo || payload.registerNumber || payload.regNo }] : []),
      ],
    });
    if (existing) return sendError(res, 400, 'A user with that identifier already exists');

    const userPayload = {
      name: payload.name,
      password: payload.password,
      role,
      accountType: role === 'admin' ? accountType : null,
      email: payload.email ? payload.email.toLowerCase() : undefined,
      school: payload.school || req.user?.school || 'STAR',
      department: payload.department || req.user?.department || '',
      schoolId: payload.schoolId || req.user?.schoolId || null,
      departmentId: payload.departmentId || req.user?.departmentId || null,
      registerNo: payload.registerNo || payload.registerNumber || payload.regNo || undefined,
      registerNumber: payload.registerNumber || payload.registerNo || payload.regNo || undefined,
      regNo: payload.regNo || payload.registerNo || payload.registerNumber || undefined,
      assignedTeacher: payload.assignedTeacher || payload.assignedFacultyId || null,
      assignedFacultyId: payload.assignedFacultyId || payload.assignedTeacher || null,
      assignedYear: payload.assignedYear || '',
      year: payload.year || payload.batch || payload.semesterBatch || '',
      batch: payload.batch || payload.semesterBatch || '',
      section: payload.section || '',
      semesterBatch: payload.semesterBatch || payload.batch || '',
    };

    if (req.user?.accountType === 'dean' && req.user.schoolId) userPayload.schoolId = req.user.schoolId;
    if (req.user?.accountType === 'hod' && req.user.departmentId) {
      userPayload.departmentId = req.user.departmentId;
      userPayload.schoolId = req.user.schoolId || userPayload.schoolId;
    }

    const [schoolDoc, departmentDoc] = await Promise.all([
      userPayload.schoolId ? School.findById(userPayload.schoolId).select('name').lean() : null,
      userPayload.departmentId ? Department.findById(userPayload.departmentId).select('name').lean() : null,
    ]);

    if (schoolDoc && !userPayload.school) userPayload.school = schoolDoc.name;
    if (departmentDoc && !userPayload.department) userPayload.department = departmentDoc.name;
    if (userPayload.schoolId && schoolDoc) userPayload.school = schoolDoc.name;
    if (userPayload.departmentId && departmentDoc) userPayload.department = departmentDoc.name;

    const user = await User.create(userPayload);
    await logAudit(req, {
      action: 'User created',
      entityType: 'User',
      entityId: user._id,
      details: { name: user.name, role: user.role, accountType: user.accountType || null },
    });
    return sendSuccess(res, 201, 'User created successfully', buildUserResponse(user));
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) return sendError(res, 404, 'User not found');

    if (req.user?.accountType === 'hod' && existingUser.role === 'admin') {
      return sendError(res, 403, 'HOD accounts cannot modify admin accounts');
    }

    if (req.user?.accountType === 'dean' && req.user.schoolId) {
      if (!existingUser.schoolId || existingUser.schoolId.toString() !== req.user.schoolId.toString()) {
        return sendError(res, 403, 'Dean accounts can only manage users in their own school');
      }

      if (req.body?.schoolId && req.body.schoolId.toString() !== req.user.schoolId.toString()) {
        return sendError(res, 403, 'Dean accounts can only assign users to their own school');
      }

      const requestedDepartmentId = req.body?.departmentId || existingUser.departmentId;
      if (requestedDepartmentId) {
        const department = await Department.findById(requestedDepartmentId).select('_id schoolId').lean();
        if (!department || department.schoolId?.toString() !== req.user.schoolId.toString()) {
          return sendError(res, 403, 'Dean accounts can only assign users to departments in their own school');
        }
      }
    }

    const updates = Object.entries(req.body || {}).reduce((accumulator, [key, value]) => {
      if (value !== undefined) accumulator[key] = value;
      return accumulator;
    }, {});
    delete updates.password;

    if (updates.schoolId) {
      const school = await School.findById(updates.schoolId).select('name').lean().catch(() => null);
      if (school && !updates.school) updates.school = school.name;
    }
    if (updates.departmentId) {
      const department = await Department.findById(updates.departmentId).select('name').lean().catch(() => null);
      if (department && !updates.department) updates.department = department.name;
    }

    const requestedRole = (updates.role || existingUser.role || 'student').toLowerCase();
    const isStudentUpdate = requestedRole === 'student' || existingUser.role === 'student';

    if (isStudentUpdate) {
      const canManageStudents = req.user?.role === 'admin' || req.user?.accountType === 'hod' || req.user?.accountType === 'dean';
      if (!canManageStudents) return sendError(res, 403, 'Only Admin or HOD accounts can edit student details.');
      const effectiveName = updates.name !== undefined ? updates.name : existingUser.name;
      const effectiveEmail = updates.email !== undefined ? updates.email : existingUser.email;
      if (!effectiveName || !String(effectiveName).trim()) return sendError(res, 400, 'Name is required');
      if (!effectiveEmail || !String(effectiveEmail).trim()) return sendError(res, 400, 'Email is required');
      const registerValue = updates.registerNo || updates.registerNumber || updates.regNo || existingUser.registerNo || existingUser.registerNumber || existingUser.regNo;
      if (!registerValue) return sendError(res, 400, 'Register number is required');

      const duplicateUser = await User.findOne({
        _id: { $ne: req.params.id },
        $or: [
          ...(effectiveEmail ? [{ email: String(effectiveEmail).toLowerCase() }] : []),
          ...(registerValue ? [{ registerNo: String(registerValue).trim() }, { registerNumber: String(registerValue).trim() }, { regNo: String(registerValue).trim() }] : []),
        ],
      });

      if (duplicateUser) return sendError(res, 400, 'A user with that register number or email already exists');
    }

    const roleScopeError = isStudentUpdate
      ? null
      : validateRoleScope(req, { ...updates, role: requestedRole, accountType: updates.accountType || existingUser.accountType || null });
    if (roleScopeError) return sendError(res, 400, roleScopeError);

    if (updates.email) updates.email = String(updates.email).toLowerCase();
    if (updates.registerNo || updates.registerNumber || updates.regNo) {
      const registerValue = updates.registerNo || updates.registerNumber || updates.regNo;
      updates.registerNo = String(registerValue).trim();
      updates.registerNumber = String(registerValue).trim();
      updates.regNo = String(registerValue).trim();
    }

    if (updates.assignedTeacher || updates.assignedFacultyId) {
      const facultyId = updates.assignedTeacher || updates.assignedFacultyId;
      updates.assignedTeacher = facultyId;
      updates.assignedFacultyId = facultyId;
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return sendError(res, 404, 'User not found');
    await logAudit(req, {
      action: 'User updated',
      entityType: 'User',
      entityId: req.params.id,
      details: { name: user.name, role: user.role, updatedFields: Object.keys(updates) },
    });
    return sendSuccess(res, 200, 'User updated successfully', buildUserResponse(user));
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');

    if (req.user?.accountType === 'hod' && user.role === 'admin') {
      return sendError(res, 403, 'HOD accounts cannot delete admin accounts');
    }

    if (req.user?.accountType === 'dean' && req.user.schoolId) {
      if (!user.schoolId || user.schoolId.toString() !== req.user.schoolId.toString()) {
        return sendError(res, 403, 'Dean accounts can only manage users in their own school');
      }
    }

    const deletedUser = await User.findOneAndDelete({ _id: req.params.id });
    await logAudit(req, {
      action: 'User deleted',
      entityType: 'User',
      entityId: req.params.id,
      details: { name: deletedUser.name, role: deletedUser.role },
    });
    return sendSuccess(res, 200, 'User deleted successfully', { id: req.params.id });
  } catch (error) {
    next(error);
  }
};

const bulkDeleteUsers = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const year = String(req.body?.year || '').trim();
    if (!ids.length && !year) return sendError(res, 400, 'Select users or choose a year before deleting');

    const query = {};
    if (ids.length) {
      const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
      if (validIds.length !== ids.length) return sendError(res, 400, 'One or more selected users are invalid');
      query._id = { $in: validIds };
    }
    if (year) query.year = year;
    if (req.user?.accountType === 'hod' && req.user.departmentId) query.departmentId = req.user.departmentId;
    if (req.user?.accountType === 'dean' && req.user.schoolId) query.schoolId = req.user.schoolId;

    const users = await User.find(query).select('_id name role schoolId departmentId');
    if (!users.length) return sendError(res, 404, year ? `No users found for year ${year}` : 'No selected users found');
    if (req.user?.accountType === 'hod' && users.some((user) => user.role === 'admin')) {
      return sendError(res, 403, 'HOD accounts cannot delete admin accounts');
    }

    await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });
    await Promise.all(users.map((user) => logAudit(req, {
      action: 'User deleted',
      entityType: 'User',
      entityId: user._id,
      details: { name: user.name, role: user.role, bulk: true },
    })));
    return sendSuccess(res, 200, 'Users deleted successfully', { deletedCount: users.length, ids: users.map((user) => user._id) });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const newPassword = req.body.newPassword;
    if (!newPassword || String(newPassword).length < 8) {
      return sendError(res, 400, 'A new password of at least 8 characters is required');
    }
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');

    if (req.user?.accountType === 'hod' && user.role === 'admin') {
      return sendError(res, 403, 'HOD accounts cannot reset admin passwords');
    }

    if (req.user?.accountType === 'dean' && req.user.schoolId) {
      if (!user.schoolId || user.schoolId.toString() !== req.user.schoolId.toString()) {
        return sendError(res, 403, 'Dean accounts can only reset passwords for users in their own school');
      }
    }

    user.password = newPassword;
    await user.save();
    await logAudit(req, {
      action: 'Password reset',
      entityType: 'User',
      entityId: req.params.id,
      details: { name: user.name },
    });
    return sendSuccess(res, 200, 'Password reset successfully', buildUserResponse(user));
  } catch (error) {
    next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'dean') {
      const departments = await Department.find({ schoolId: req.user.schoolId, status: 'Active' }).select('_id name').sort({ name: 1 });
      const chartData = await Promise.all(departments.map(async (department) => {
        const students = await User.find({ role: 'student', departmentId: department._id }).select('_id name').lean();
        const studentIds = students.map((student) => student._id);
        const totalPoints = await Submission.aggregate([
          { $match: { status: 'Approved', studentId: { $in: studentIds } } },
          { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
        ]);
        const pointResults = await Submission.aggregate([
          { $match: { status: 'Approved', studentId: { $in: studentIds } } },
          { $group: { _id: '$studentId', totalPoints: { $sum: '$pointsAwarded' } } },
        ]);
        const pointMap = new Map(pointResults.map((entry) => [entry._id.toString(), entry.totalPoints || 0]));
        const topStudents = students
          .map((student) => ({
            _id: student._id,
            name: student.name,
            totalPoints: pointMap.get(student._id.toString()) || 0,
          }))
          .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
          .slice(0, 3);
        const averageScore = studentIds.length ? Math.round((totalPoints[0]?.total || 0) / studentIds.length) : 0;
        return {
          name: department.name,
          performance: averageScore,
          students: studentIds.length,
          departmentId: department._id,
          metric: 'Average approved points',
          topStudents,
        };
      }));
      return sendSuccess(res, 200, 'Analytics fetched successfully', { view: 'dean', chartData });
    }

    if (req.user?.accountType === 'hod') {
      const yearBuckets = [
        { key: '1st', label: '1st Year' },
        { key: '2nd', label: '2nd Year' },
        { key: '3rd', label: '3rd Year' },
      ];
      const chartData = await Promise.all(yearBuckets.map(async (bucket) => {
        const students = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id year').lean();
        const matching = students.filter((student) => {
          const yearValue = `${student.year || student.batch || student.semesterBatch || ''}`.toLowerCase();
          return yearValue.includes(bucket.key.toLowerCase()) || yearValue.includes(bucket.label.toLowerCase());
        });
        const studentIds = matching.map((student) => student._id);
        const totalPoints = await Submission.aggregate([
          { $match: { status: 'Approved', studentId: { $in: studentIds } } },
          { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
        ]);
        return { name: bucket.label, performance: studentIds.length ? Math.round((totalPoints[0]?.total || 0) / studentIds.length) : 0, students: studentIds.length };
      }));
      return sendSuccess(res, 200, 'Analytics fetched successfully', { view: 'hod', chartData });
    }

    // Institution-wide view for principals / super admins
    const departments = await Department.find({ status: 'Active' }).select('_id name').sort({ name: 1 });
    const institutionChartData = await Promise.all(departments.map(async (department) => {
      const students = await User.find({ role: 'student', departmentId: department._id }).select('_id name').lean();
      const studentIds = students.map((student) => student._id);
      const totalPoints = await Submission.aggregate([
        { $match: { status: 'Approved', studentId: { $in: studentIds } } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
      ]);
      return {
        name: department.name,
        performance: studentIds.length ? Math.round((totalPoints[0]?.total || 0) / studentIds.length) : 0,
        students: studentIds.length,
        departmentId: department._id,
        metric: 'Average approved points',
      };
    }));
    return sendSuccess(res, 200, 'Analytics fetched successfully', { view: 'admin', chartData: institutionChartData });
  } catch (error) {
    next(error);
  }
};

const getLookups = async (req, res, next) => {
  try {
    const schools = await School.find({ status: 'Active' }).select('_id name code').sort({ name: 1 }).lean();
    const departmentsQuery = { status: 'Active' };
    if (req.user?.accountType === 'dean' && req.user.schoolId) departmentsQuery.schoolId = req.user.schoolId;
    if (req.user?.accountType === 'hod') {
      if (req.user.schoolId) departmentsQuery.schoolId = req.user.schoolId;
      if (req.user.departmentId) departmentsQuery._id = req.user.departmentId;
    }
    const departments = await Department.find(departmentsQuery).populate('schoolId', 'name').sort({ name: 1 }).lean();
    const facultyQuery = { role: 'faculty', status: 'Active' };
    if (req.user?.accountType === 'dean' && req.user.schoolId) facultyQuery.schoolId = req.user.schoolId;
    if (req.user?.accountType === 'hod' && req.user.departmentId) facultyQuery.departmentId = req.user.departmentId;
    const faculty = await User.find(facultyQuery).select('_id name email departmentId schoolId department').sort({ name: 1 }).lean();
    return sendSuccess(res, 200, 'Lookups fetched successfully', { schools, departments, faculty });
  } catch (error) {
    next(error);
  }
};

const createBulkUsers = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'Please upload an Excel file');

    const fileName = (req.file.originalname || '').toLowerCase();
    const contentType = (req.file.mimetype || '').toLowerCase();
    const buffer = req.file.buffer;

    let rows = [];
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || contentType.includes('spreadsheetml') || contentType.includes('excel')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedSheet = parseBulkStudentRows(firstSheet, XLSX);
      if (parsedSheet.headerIndex < 0) {
        return sendError(res, 400, 'Could not find a header row containing student name, reg no, and email');
      }
      rows = parsedSheet.rows;
    } else {
      return sendError(res, 400, 'Please upload a valid Excel file (.xlsx/.xls)');
    }

    const normalizedRows = rows
      .filter((entry) => !isEmptyRow(entry.row))
      .map((entry) => ({
        ...normalizeBulkRow(entry.row),
        __rowNumber: entry.rowNumber,
        __rawRow: entry.row,
      }))
      ;
    if (!normalizedRows.length) return sendError(res, 400, 'No student rows were found in the uploaded file');

    const batchDefaultPassword = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

    const selectedSchoolId = req.body?.schoolId || req.body?.selectedSchoolId || req.body?.school || '';
    const selectedDepartmentId = req.body?.departmentId || req.body?.selectedDepartmentId || req.body?.department || '';
    const selectedFacultyId = req.body?.facultyId || req.body?.selectedFacultyId || req.body?.faculty || '';

    if (!selectedSchoolId || !selectedDepartmentId || !selectedFacultyId) {
      return sendError(res, 400, 'Please select a school, department, and faculty before uploading');
    }

    if (req.user?.accountType === 'hod') {
      if (req.user.schoolId && selectedSchoolId.toString() !== req.user.schoolId.toString()) {
        return sendError(res, 403, 'HOD accounts can only upload for their own school');
      }
      if (req.user.departmentId && selectedDepartmentId.toString() !== req.user.departmentId.toString()) {
        return sendError(res, 403, 'HOD accounts can only upload for their own department');
      }
      const facultyInScope = await User.findOne({
        _id: selectedFacultyId,
        role: 'faculty',
        departmentId: req.user.departmentId,
      }).lean();
      if (!facultyInScope) {
        return sendError(res, 403, 'Please choose a faculty from your department');
      }
    }

    const [selectedSchool, selectedDepartment, selectedFaculty] = await Promise.all([
      School.findById(selectedSchoolId).select('name').lean().catch(() => null),
      Department.findById(selectedDepartmentId).select('name').lean().catch(() => null),
      User.findById(selectedFacultyId).select('name').lean().catch(() => null),
    ]);

    const summary = {
      totalRows: normalizedRows.length,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      validationErrors: [],
    };

    const seenIdentifiers = new Set();

    for (const [index, row] of normalizedRows.entries()) {
      const rowNumber = row.__rowNumber || index + 2;
      const validationErrors = getRequiredValidationErrors(row);
      if (validationErrors.length) {
        console.warn('[bulk student upload] validation failed', {
          rowNumber,
          errors: validationErrors,
          rawRow: row.__rawRow,
          normalizedRow: row,
        });
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: validationErrors });
        continue;
      }

      const registerValue = getValue(row, ['registerNumber']);
      const emailValue = getValue(row, ['email']);
      const registerKey = String(registerValue);
      const emailKey = String(emailValue).toLowerCase();

      if (seenIdentifiers.has(registerKey) || seenIdentifiers.has(emailKey)) {
        summary.duplicateCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['Duplicate register number or email found in the uploaded file'] });
        continue;
      }

      const existingUser = await User.findOne({
        $or: [
          ...(emailKey ? [{ email: emailKey }] : []),
          ...(registerKey ? [{ registerNumber: registerKey }] : []),
        ],
      });

      if (existingUser) {
        summary.duplicateCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['A user with the same register number or email already exists'] });
        continue;
      }

      const payload = {
        name: String(getValue(row, ['name']) || '').trim(),
        password: String(getValue(row, ['password']) || batchDefaultPassword).trim(),
        role: 'student',
        accountType: null,
        email: String(emailValue || '').trim().toLowerCase(),
        registerNumber: String(registerKey || '').trim(),
        school: selectedSchool?.name || '',
        department: selectedDepartment?.name || '',
        schoolId: selectedSchoolId || null,
        departmentId: selectedDepartmentId || null,
        assignedFacultyId: selectedFacultyId || null,
        year: String(getValue(row, ['year']) || '').trim(),
        batch: String(getValue(row, ['batch']) || '').trim(),
        section: String(getValue(row, ['section']) || '').trim(),
        recommendedSchool: selectedSchool?.name || '',
        recommendedDepartment: selectedDepartment?.name || '',
        recommendedFaculty: selectedFaculty?.name || '',
      };

      try {
        await User.create(payload);
        summary.successCount += 1;
        seenIdentifiers.add(registerKey);
        seenIdentifiers.add(emailKey);
      } catch (error) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: [error.message || 'Unable to create student'] });
        console.warn('[bulk student upload] row insert failed', {
          rowNumber,
          error: error.message,
          rawRow: row.__rawRow,
          normalizedRow: row,
        });
      }
    }

    await logAudit(req, {
      action: 'Bulk student upload',
      entityType: 'User',
      details: {
        fileName: fileName || '',
        totalRows: summary.totalRows,
        successCount: summary.successCount,
        failureCount: summary.failureCount,
        duplicateCount: summary.duplicateCount,
      },
    });

    return sendSuccess(res, 200, 'Bulk student upload completed', summary);
  } catch (error) {
    next(error);
  }
};

const bulkUpdateUsers = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'Please upload an Excel file');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const parsedSheet = parseBulkUpdateRows(workbook.Sheets[workbook.SheetNames[0]], XLSX);
    if (parsedSheet.headerIndex < 0) return sendError(res, 400, 'Bulk Update requires the exact seven-column Excel format');

    const rows = parsedSheet.rows.filter((entry) => !isEmptyRow(entry.row)).map((entry) => ({
      ...normalizeBulkRow(entry.row),
      __rowNumber: entry.rowNumber,
    }));
    if (!rows.length) return sendError(res, 400, 'No user rows were found in the uploaded file');

    const summary = { totalRows: rows.length, successCount: 0, updatedCount: 0, noChangeCount: 0, failureCount: 0, validationErrors: [] };
    const editableFields = ['registerNumber', 'email', 'password', 'section', 'year', 'batch'];

    for (const row of rows) {
      const rowNumber = row.__rowNumber;
      const name = String(getValue(row, ['name']) || '').trim();
      if (!name) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['Name is required'] });
        continue;
      }

      const query = { name };
      if (req.user?.accountType === 'hod' && req.user.departmentId) query.departmentId = req.user.departmentId;
      const matches = await User.find(query);
      if (matches.length === 0) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['No user with this name was found'] });
        continue;
      }
      if (matches.length > 1) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['Multiple users have this name; update is ambiguous'] });
        continue;
      }

      const user = matches[0];
      if (req.user?.accountType === 'hod' && user.role === 'admin') {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['HOD accounts cannot update HOD or admin users'] });
        continue;
      }

      let changed = false;
      for (const field of editableFields) {
        const nextValue = String(row[field] ?? '').trim();
        if (field === 'password') {
          if (nextValue && !(await bcrypt.compare(nextValue, user.password))) {
            user.password = nextValue;
            changed = true;
          }
        } else if (String(user[field] ?? '') !== nextValue) {
          user[field] = nextValue;
          changed = true;
        }
      }

      if (!changed) {
        summary.noChangeCount += 1;
        continue;
      }

      try {
        await user.save();
        summary.successCount += 1;
        summary.updatedCount += 1;
      } catch (error) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: [error.message || 'Unable to update user'] });
      }
    }

    return sendSuccess(res, 200, 'Bulk update completed', summary);
  } catch (error) {
    next(error);
  }
};

const listActivities = async (req, res, next) => {
  try {
    const activities = await Activity.find({}).sort({ vertical: 1, activityName: 1 });
    return sendSuccess(res, 200, 'Activities fetched successfully', activities);
  } catch (error) {
    next(error);
  }
};

const createActivity = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'hod') {
      return sendError(res, 403, 'HOD accounts cannot manage the activity catalog');
    }
    const { activityName, vertical, maximumPoints, description, levels, evidenceType, deadline, important } = req.body;
    if (!activityName || !String(activityName).trim()) return sendError(res, 400, 'Activity name is required');
    if (!vertical || !String(vertical).trim()) return sendError(res, 400, 'Vertical is required');
    if (maximumPoints === undefined || maximumPoints === '') return sendError(res, 400, 'Maximum points is required');

    const existing = await Activity.findOne({ activityName: new RegExp(`^${String(activityName).trim()}$`, 'i') });
    if (existing) return sendError(res, 400, 'An activity with that name already exists');

    const normalizedLevels = Array.isArray(levels)
      ? levels
          .filter((level) => level && String(level.label || '').trim() && level.points !== undefined && level.points !== '')
          .map((level) => ({ label: String(level.label).trim(), points: Number(level.points) }))
      : [];

    const activity = await Activity.create({
      activityName: String(activityName).trim(),
      vertical: String(vertical).trim(),
      maximumPoints: Number(maximumPoints),
      evidenceType: ['url', 'file', 'either', 'both'].includes(evidenceType) ? evidenceType : 'either',
      description: String(description || '').trim(),
      levels: normalizedLevels,
      deadline: deadline ? new Date(deadline) : null,
      important: Boolean(important),
    });

    await logAudit(req, {
      action: 'Activity created',
      entityType: 'Activity',
      entityId: activity._id,
      details: {
        activityName: activity.activityName,
        vertical: activity.vertical,
        maximumPoints: activity.maximumPoints,
        deadline: activity.deadline ? activity.deadline.toISOString().slice(0, 10) : null,
        important: activity.important,
      },
    });

    return sendSuccess(res, 201, 'Activity created successfully', activity);
  } catch (error) {
    next(error);
  }
};

const updateActivity = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'hod') {
      return sendError(res, 403, 'HOD accounts cannot manage the activity catalog');
    }
    const activity = await Activity.findById(req.params.id);
    if (!activity) return sendError(res, 404, 'Activity not found');

    const updates = {};
    if (req.body.activityName !== undefined) updates.activityName = String(req.body.activityName).trim();
    if (req.body.vertical !== undefined) updates.vertical = String(req.body.vertical).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description || '').trim();
    if (req.body.maximumPoints !== undefined) updates.maximumPoints = Number(req.body.maximumPoints);
    if (req.body.evidenceType !== undefined && ['url', 'file', 'either', 'both'].includes(req.body.evidenceType)) updates.evidenceType = req.body.evidenceType;
    if (req.body.deadline !== undefined) updates.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
    if (req.body.important !== undefined) updates.important = Boolean(req.body.important);
    if (Array.isArray(req.body.levels)) {
      updates.levels = req.body.levels
        .filter((level) => level && String(level.label || '').trim() && level.points !== undefined && level.points !== '')
        .map((level) => ({ label: String(level.label).trim(), points: Number(level.points) }));
    }

    const updated = await Activity.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    await logAudit(req, {
      action: 'Activity updated',
      entityType: 'Activity',
      entityId: req.params.id,
      details: { activityName: updated?.activityName, updatedFields: Object.keys(updates) },
    });

    return sendSuccess(res, 200, 'Activity updated successfully', updated);
  } catch (error) {
    next(error);
  }
};

const deleteActivity = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'hod') {
      return sendError(res, 403, 'HOD accounts cannot manage the activity catalog');
    }
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) return sendError(res, 404, 'Activity not found');
    await Submission.deleteMany({ activityId: activity._id });
    await logAudit(req, {
      action: 'Activity deleted',
      entityType: 'Activity',
      entityId: req.params.id,
      details: { activityName: activity.activityName },
    });
    return sendSuccess(res, 200, 'Activity and its submissions deleted successfully', { id: req.params.id });
  } catch (error) {
    next(error);
  }
};

const exportAnalytics = async (req, res, next) => {
  try {
    const match = { status: 'Approved' };
    if (req.user?.accountType === 'dean' && req.user.schoolId) {
      const deptIds = await Department.find({ schoolId: req.user.schoolId, status: 'Active' }).select('_id');
      const studentIds = await User.find({ role: 'student', departmentId: { $in: deptIds } }).select('_id');
      match.studentId = { $in: studentIds };
    }
    if (req.user?.accountType === 'hod' && req.user.departmentId) {
      const studentIds = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
      match.studentId = { $in: studentIds };
    }

    const data = await Submission.aggregate([
      { $match: match },
      { $lookup: { from: 'activities', localField: 'activityId', foreignField: '_id', as: 'activity' } },
      { $unwind: { path: '$activity', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            vertical: '$activity.vertical',
            department: '$student.department',
            batch: '$student.semesterBatch',
          },
          points: { $sum: '$pointsAwarded' },
          submissions: { $sum: 1 },
        },
      },
      { $sort: { points: -1 } },
    ]);

    const rows = data.map((entry) => ({
      Vertical: entry._id.vertical || '',
      Department: entry._id.department || '',
      Batch: entry._id.batch || '',
      'Points Awarded': entry.points,
      'Submissions Approved': entry.submissions,
    }));

    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Analytics', `analytics-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const downloadBulkTemplate = async (req, res, next) => {
  try {
    const headers = ['student name', 'reg no', 'email', 'password', 'section', 'year', 'batch'];
    const example = ['A SIVINATH KRISHNA', '2522J0687', 'student@email.com', 'Welcome@123', 'A', '2', '2025-2028'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students-bulk-upload-template.xlsx"');
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 20, 100));
    const action = req.query.action || '';

    const query = {};
    if (action) query.action = { $regex: action, $options: 'i' };
    if (req.user?.accountType === 'hod' && req.user.departmentId) {
      const deptActors = await User.find({ departmentId: req.user.departmentId }).select('_id').lean();
      query.actorId = { $in: deptActors.map((actor) => actor._id) };
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query).populate('actorId', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(query),
    ]);
    return sendSuccess(res, 200, 'Audit logs fetched', { logs, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const getAcademicSettings = async (req, res, next) => {
  try {
    const [academicYear, semesterOpen] = await Promise.all([
      SystemSetting.findOne({ key: 'academicYear' }).lean(),
      SystemSetting.findOne({ key: 'semesterOpen' }).lean(),
    ]);
    return sendSuccess(res, 200, 'Academic settings fetched', {
      academicYear: academicYear?.value || '',
      semesterOpen: semesterOpen?.value !== false,
    });
  } catch (error) {
    next(error);
  }
};

const updateAcademicSettings = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'hod') {
      return sendError(res, 403, 'HOD accounts cannot modify academic settings');
    }
    const { academicYear, semesterOpen } = req.body;
    if (academicYear !== undefined) {
      await SystemSetting.findOneAndUpdate(
        { key: 'academicYear' },
        { $set: { value: String(academicYear).trim() } },
        { upsert: true, new: true }
      );
    }
    if (semesterOpen !== undefined) {
      await SystemSetting.findOneAndUpdate(
        { key: 'semesterOpen' },
        { $set: { value: Boolean(semesterOpen) } },
        { upsert: true, new: true }
      );
    }
    await logAudit(req, {
      action: 'Academic settings updated',
      entityType: 'SystemSetting',
      details: { academicYear, semesterOpen },
    });
    return sendSuccess(res, 200, 'Academic settings updated successfully', { academicYear, semesterOpen });
  } catch (error) {
    next(error);
  }
};

const rolloverAcademicYear = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'hod') {
      return sendError(res, 403, 'HOD accounts cannot run the academic year rollover');
    }
    const { newAcademicYear, targetBatch } = req.body;
    if (!newAcademicYear || !String(newAcademicYear).trim()) {
      return sendError(res, 400, 'A new academic year is required for rollover');
    }

    const query = { role: 'student' };
    if (targetBatch) query.semesterBatch = targetBatch;

    const students = await User.find(query).select('_id year batch semesterBatch');
    let promoted = 0;
    for (const student of students) {
      const numericYear = parseInt(String(student.year || ''), 10);
      const nextYear = Number.isFinite(numericYear) ? numericYear + 1 : numericYear;
      await User.updateOne(
        { _id: student._id },
        { $set: { year: Number.isFinite(nextYear) ? String(nextYear) : student.year, academicYear: String(newAcademicYear).trim() } }
      );
      promoted += 1;
    }

    await SystemSetting.findOneAndUpdate(
      { key: 'academicYear' },
      { $set: { value: String(newAcademicYear).trim() } },
      { upsert: true, new: true }
    );

    await logAudit(req, {
      action: 'Academic year rollover',
      entityType: 'User',
      details: { newAcademicYear, targetBatch: targetBatch || 'all', studentsPromoted: promoted },
    });

    return sendSuccess(res, 200, `Academic year rolled over to ${newAcademicYear} ??? ${promoted} student${promoted === 1 ? '' : 's'} promoted`, { promoted });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Dean-specific endpoints
// ---------------------------------------------------------------------------

const getDeanStats = async (req, res, next) => {
  try {
    if (!requireDean(req, res)) return;

    const schoolId = req.user.schoolId;

    const [departmentsCount, hodsCount, facultyCount] = await Promise.all([
      Department.countDocuments({ schoolId, status: 'Active' }),
      User.countDocuments({ role: 'admin', accountType: 'hod', schoolId, status: 'Active' }),
      User.countDocuments({ role: 'faculty', schoolId, status: 'Active' }),
    ]);

    return sendSuccess(res, 200, 'Dean stats fetched successfully', {
      departments: departmentsCount,
      hods: hodsCount,
      faculty: facultyCount,
    });
  } catch (error) {
    next(error);
  }
};

const getDeanDepartmentsPerformance = async (req, res, next) => {
  try {
    if (!requireDean(req, res)) return;

    const schoolId = req.user.schoolId;

    const departments = await Department.find({ schoolId, status: 'Active' }).select('_id name code').sort({ name: 1 }).lean();

    const departmentsWithStats = await Promise.all(departments.map(async (department) => {
      const students = await User.find({ role: 'student', departmentId: department._id }).select('_id name year batch semesterBatch').lean();
      const studentIds = students.map((s) => s._id);

      const totalPointsResult = await Submission.aggregate([
        { $match: { status: 'Approved', studentId: { $in: studentIds } } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
      ]);

      const totalPoints = totalPointsResult[0]?.total || 0;
      const averageScore = studentIds.length ? Math.round(totalPoints / studentIds.length) : 0;

      return {
        _id: department._id,
        name: department.name,
        code: department.code,
        students: studentIds.length,
        averagePerformance: averageScore,
        totalPoints,
      };
    }));

    return sendSuccess(res, 200, 'Departments performance fetched', { departments: departmentsWithStats });
  } catch (error) {
    next(error);
  }
};

const getDeanDepartmentYearPerformance = async (req, res, next) => {
  try {
    if (!requireDean(req, res)) return;

    const { departmentId } = req.params;
    const schoolId = req.user.schoolId;

    const department = await Department.findOne({ _id: departmentId, schoolId, status: 'Active' }).lean();
    if (!department) {
      return sendError(res, 404, 'Department not found');
    }

    const students = await User.find({ role: 'student', departmentId }).select('_id name year batch semesterBatch').lean();

    const yearBuckets = [
      { key: '1st', label: '1st Year' },
      { key: '2nd', label: '2nd Year' },
      { key: '3rd', label: '3rd Year' },
      { key: 'final', label: 'Final Year' },
      { key: '4th', label: '4th Year' },
    ];

    const yearPerformance = await Promise.all(yearBuckets.map(async (bucket) => {
      const matching = students.filter((student) => {
        const yearValue = `${student.year || student.batch || student.semesterBatch || ''}`.toLowerCase();
        return yearValue.includes(bucket.key.toLowerCase()) || yearValue.includes(bucket.label.toLowerCase());
      });
      const studentIds = matching.map((s) => s._id);

      const totalPointsResult = await Submission.aggregate([
        { $match: { status: 'Approved', studentId: { $in: studentIds } } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
      ]);

      const totalPoints = totalPointsResult[0]?.total || 0;
      const averageScore = studentIds.length ? Math.round(totalPoints / studentIds.length) : 0;

      return {
        year: bucket.label,
        students: studentIds.length,
        averagePerformance: averageScore,
        totalPoints,
      };
    }));

    return sendSuccess(res, 200, 'Department year performance fetched', { department: department.name, yearPerformance });
  } catch (error) {
    next(error);
  }
};

const getDeanDepartmentStudentPerformance = async (req, res, next) => {
  try {
    if (!requireDean(req, res)) return;

    const { departmentId } = req.params;
    const schoolId = req.user.schoolId;

    const department = await Department.findOne({ _id: departmentId, schoolId, status: 'Active' }).lean();
    if (!department) {
      return sendError(res, 404, 'Department not found');
    }

    const students = await User.find({ role: 'student', schoolId, departmentId, status: 'Active' }).select('_id name registerNo registerNumber regNo').lean();
    const studentIds = students.map((student) => student._id);

    if (!studentIds.length) {
      return sendSuccess(res, 200, 'Department student performance fetched', {
        department: department.name,
        totalStudents: 0,
        topStudents: [],
      });
    }

    const aggregateResult = await Submission.aggregate([
      {
        $match: {
          status: 'Approved',
          studentId: { $in: studentIds },
        },
      },
      {
        $group: {
          _id: '$studentId',
          totalSP: { $sum: '$pointsAwarded' },
          submissionsCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalSP: -1, submissionsCount: -1, _id: 1 },
      },
      {
        $limit: 3,
      },
    ]);

    const studentLookup = new Map(students.map((student) => [String(student._id), student]));

    const topStudents = aggregateResult.map((row) => {
      const student = studentLookup.get(String(row._id));
      const registerNumber = student?.registerNo || student?.registerNumber || student?.regNo || 'N/A';
      return {
        studentId: row._id,
        name: student?.name || 'Unnamed Student',
        registerNumber,
        totalSP: row.totalSP || 0,
        submissionsCount: row.submissionsCount || 0,
      };
    });

    return sendSuccess(res, 200, 'Department student performance fetched', {
      department: department.name,
      totalStudents: students.length,
      topStudents,
    });
  } catch (error) {
    next(error);
  }
};

const getDeanTopPerformers = async (req, res, next) => {
  try {
    if (!requireDean(req, res)) return;

    const { departmentId } = req.params;
    const schoolId = req.user.schoolId;

    const department = await Department.findOne({ _id: departmentId, schoolId, status: 'Active' }).lean();
    if (!department) {
      return sendError(res, 404, 'Department not found');
    }

    // Top HODs - ranked by approval turnaround and total approved SP in their dept
    const hods = await User.find({ role: 'admin', accountType: 'hod', departmentId, status: 'Active' }).select('_id name department').lean();

    // Get submissions approved by each HOD in this department
    const hodsWithMetrics = await Promise.all(hods.map(async (hod) => {
      const submissions = await Submission.find({ status: 'Approved', 'hodVerifiedBy': hod._id }).lean();
      const totalApprovedSP = submissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0);
      const avgTurnaround = submissions.length > 0
        ? submissions.reduce((sum, s) => {
            const created = new Date(s.createdAt).getTime();
            const verified = new Date(s.hodVerifiedAt || s.updatedAt).getTime();
            return sum + (verified - created);
          }, 0) / submissions.length / (1000 * 60 * 60 * 24) // days
        : 0;

      return {
        _id: hod._id,
        name: hod.name,
        department: department.name,
        totalApprovedSP,
        submissionsReviewed: submissions.length,
        avgTurnaroundDays: Math.round(avgTurnaround * 10) / 10,
      };
    }));

    hodsWithMetrics.sort((a, b) => b.totalApprovedSP - a.totalApprovedSP);

    // Top Faculty - ranked by submissions reviewed/approved and avg turnaround
    const faculty = await User.find({ role: 'faculty', departmentId, status: 'Active' }).select('_id name department').lean();

    const facultyWithMetrics = await Promise.all(faculty.map(async (fac) => {
      const submissions = await Submission.find({ status: 'Approved', 'verifiedBy': fac._id }).lean();
      const totalReviewed = submissions.length;
      const totalApprovedSP = submissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0);
      const avgTurnaround = submissions.length > 0
        ? submissions.reduce((sum, s) => {
            const created = new Date(s.createdAt).getTime();
            const verified = new Date(s.verifiedAt || s.updatedAt).getTime();
            return sum + (verified - created);
          }, 0) / submissions.length / (1000 * 60 * 60 * 24)
        : 0;

      return {
        _id: fac._id,
        name: fac.name,
        department: department.name,
        submissionsReviewed: totalReviewed,
        totalApprovedSP,
        avgTurnaroundDays: Math.round(avgTurnaround * 10) / 10,
      };
    }));

    facultyWithMetrics.sort((a, b) => b.submissionsReviewed - a.submissionsReviewed);

    return sendSuccess(res, 200, 'Top performers fetched', {
      topHODs: hodsWithMetrics.slice(0, 5),
      topFaculty: facultyWithMetrics.slice(0, 5),
    });
  } catch (error) {
    next(error);
  }
};

const deleteAuditLog = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'hod') {
      return sendError(res, 403, 'HOD accounts cannot delete audit logs');
    }
    const log = await AuditLog.findByIdAndDelete(req.params.id);
    if (!log) return sendError(res, 404, 'Audit log not found');

    await logAudit(req, {
      action: 'Audit log deleted',
      entityType: 'AuditLog',
      entityId: log._id,
      details: { action: log.action, actor: log.actorName || log.actorId?.toString() || 'System' },
    });
    return sendSuccess(res, 200, 'Audit log deleted', log);
  } catch (error) {
    next(error);
  }
};

const clearAuditLogs = async (req, res, next) => {
  try {
    if (req.user?.accountType === 'hod') {
      return sendError(res, 403, 'HOD accounts cannot clear audit logs');
    }
    const result = await AuditLog.deleteMany({});
    await logAudit(req, {
      action: 'Audit logs cleared',
      entityType: 'AuditLog',
      details: { deleted: result.deletedCount },
    });
    return sendSuccess(res, 200, `Deleted ${result.deletedCount} audit log${result.deletedCount === 1 ? '' : 's'}`, { deleted: result.deletedCount });
  } catch (error) {
    next(error);
  }
};

const buildDepartmentMetrics = async (departmentId) => {
  const students = await User.find({ role: 'student', departmentId }).select('_id name registerNo registerNumber regNo year batch semesterBatch').lean();
  const studentIds = students.map((student) => student._id);
  const totalPoints = await Submission.aggregate([
    { $match: { status: 'Approved', studentId: { $in: studentIds } } },
    { $group: { _id: null, total: { $sum: '$pointsAwarded' }, submissions: { $sum: 1 } } },
  ]);
  const pointResults = await Submission.aggregate([
    { $match: { status: 'Approved', studentId: { $in: studentIds } } },
    { $group: { _id: '$studentId', totalPoints: { $sum: '$pointsAwarded' } } },
  ]);
  const pointMap = new Map(pointResults.map((entry) => [entry._id.toString(), entry.totalPoints || 0]));
  const topStudents = students
    .map((student) => ({
      name: student.name,
      registerNumber: student.registerNumber || student.registerNo || student.regNo || '',
      totalPoints: pointMap.get(student._id.toString()) || 0,
    }))
    .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
    .slice(0, 5);
  return {
    studentCount: studentIds.length,
    totalPoints: totalPoints[0]?.total || 0,
    submissionCount: totalPoints[0]?.submissions || 0,
    averageScore: studentIds.length ? Math.round((totalPoints[0]?.total || 0) / studentIds.length) : 0,
    topStudents,
  };
};

const exportAdminReport = async (req, res, next) => {
  try {
    let sections = [];
    let subtitle = 'Institution-wide performance report';
    if (req.user?.accountType === 'dean' && req.user.schoolId) {
      const school = await School.findById(req.user.schoolId).select('name').lean().catch(() => null);
      const departments = await Department.find({ schoolId: req.user.schoolId, status: 'Active' }).select('name').sort({ name: 1 }).lean();
      sections = await Promise.all(departments.map(async (department) => {
        const metrics = await buildDepartmentMetrics(department._id);
        return { title: department.name, metrics };
      }));
      subtitle = `${school?.name || 'Dean'} ??? School-wide performance report`;
    } else if (req.user?.accountType === 'hod' && req.user.departmentId) {
      const department = await Department.findById(req.user.departmentId).select('name').lean().catch(() => null);
      sections = [{ title: department?.name || 'Department', metrics: await buildDepartmentMetrics(req.user.departmentId) }];
      subtitle = `${department?.name || 'HOD'} ??? Department performance report`;
    } else {
      const departments = await Department.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean();
      sections = await Promise.all(departments.map(async (department) => {
        const metrics = await buildDepartmentMetrics(department._id);
        return { title: department.name, metrics };
      }));
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="institution-report.pdf"');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#111827').text('STARS-BCA Performance Report');
    doc.fontSize(9).fillColor('#6b7280').text(`KPR College of Arts and Science ??? Generated ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#374151').text(subtitle);
    doc.moveDown(0.4);
    doc.moveTo(48, doc.y).lineTo(552, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.6);

    sections.forEach((section) => {
      doc.fontSize(13).fillColor('#111827').text(section.title);
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#6b7280').text('Students: ', { continued: true }).fillColor('#111827').text(`${section.metrics.studentCount}`);
      doc.fontSize(10).fillColor('#6b7280').text('Approved submissions: ', { continued: true }).fillColor('#111827').text(`${section.metrics.submissionCount}`);
      doc.fontSize(10).fillColor('#6b7280').text('Total points: ', { continued: true }).fillColor('#111827').text(`${section.metrics.totalPoints}`);
      doc.fontSize(10).fillColor('#6b7280').text('Average score per student: ', { continued: true }).fillColor('#111827').text(`${section.metrics.averageScore}`);

      if (section.metrics.topStudents.length) {
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#6b7280').text('Top students');
        section.metrics.topStudents.forEach((student, index) => {
          doc.fontSize(9).fillColor('#6b7280').text(`  ${index + 1}. `, { continued: true }).fillColor('#111827').text(`${student.name} (${student.registerNumber || '???'}) ??? ${student.totalPoints} pts`);
        });
      }
      doc.moveDown(0.7);
    });

    doc.end();
  } catch (error) {
    next(error);
  }
};

const getDepartmentStats = async (req, res, next) => {
  try {
    const scopeQuery = buildScopeQuery(req);

    const departments = await Department.find(scopeQuery.departmentId ? { _id: scopeQuery.departmentId } : {}).select('name schoolId').lean();

    const studentQuery = { role: 'student', status: 'Active' };
    if (scopeQuery.departmentId) studentQuery.departmentId = scopeQuery.departmentId;
    if (scopeQuery.schoolId) studentQuery.schoolId = scopeQuery.schoolId;

    const students = await User.find(studentQuery).select('departmentId department').lean();
    const deptStudentMap = {};
    students.forEach((s) => {
      const dept = s.department || 'Unknown';
      deptStudentMap[dept] = (deptStudentMap[dept] || 0) + 1;
    });

    const studentIds = students.map((s) => s._id);
    const pointRows = await Submission.aggregate([
      { $match: { status: 'Approved', studentId: { $in: studentIds } } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$student.department',
          totalPoints: { $sum: '$pointsAwarded' },
          submissions: { $sum: 1 },
          avgPoints: { $avg: '$pointsAwarded' },
        },
      },
    ]);

    const verticalRows = await Submission.aggregate([
      { $match: { status: 'Approved', studentId: { $in: studentIds } } },
      { $lookup: { from: 'activities', localField: 'activityId', foreignField: '_id', as: 'activity' } },
      { $unwind: { path: '$activity', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { department: '$student.department', vertical: '$activity.vertical' },
          points: { $sum: '$pointsAwarded' },
        },
      },
    ]);

    const deptMap = {};
    pointRows.forEach((row) => {
      const dept = row._id || 'Unknown';
      deptMap[dept] = {
        department: dept,
        students: deptStudentMap[dept] || 0,
        totalPoints: row.totalPoints || 0,
        submissions: row.submissions || 0,
        avgPoints: Math.round((row.avgPoints || 0) * 10) / 10,
      };
    });

    Object.keys(deptStudentMap).forEach((dept) => {
      if (!deptMap[dept]) {
        deptMap[dept] = { department: dept, students: deptStudentMap[dept], totalPoints: 0, submissions: 0, avgPoints: 0 };
      }
    });

    const verticalByDept = {};
    verticalRows.forEach((row) => {
      const dept = row._id?.department || 'Unknown';
      const vertical = row._id?.vertical || 'General';
      if (!verticalByDept[dept]) verticalByDept[dept] = {};
      verticalByDept[dept][vertical] = row.points || 0;
    });

    return sendSuccess(res, 200, 'Department stats fetched', {
      departments: Object.values(deptMap).sort((a, b) => b.totalPoints - a.totalPoints),
      verticalByDept,
    });
  } catch (error) {
    next(error);
  }
};

const bulkAssignFaculty = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'Please upload an Excel file');

    const fileName = (req.file.originalname || '').toLowerCase();
    const contentType = (req.file.mimetype || '').toLowerCase();
    const buffer = req.file.buffer;

    let rows = [];
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || contentType.includes('spreadsheetml') || contentType.includes('excel')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) || [];
    } else {
      return sendError(res, 400, 'Please upload a valid Excel file (.xlsx/.xls)');
    }

    const normalizedRows = rows.map((row) => normalizeBulkRow(row)).filter((row) => !isEmptyRow(row));
    if (!normalizedRows.length) return sendError(res, 400, 'No rows were found in the uploaded file');

    const summary = { totalRows: normalizedRows.length, successCount: 0, failureCount: 0, notFoundCount: 0, validationErrors: [] };

    for (const [index, row] of normalizedRows.entries()) {
      const rowNumber = index + 2;
      const emailValue = String(getValue(row, ['email', 'faculty email', 'email id', 'emailaddress']) || '').trim().toLowerCase();
      const nameValue = String(getValue(row, ['name', 'faculty name', 'full name', 'fullname']) || '').trim();
      const departmentValue = String(getValue(row, ['department', 'department code', 'dept', 'department name', 'departmentcode', 'dept code', 'deptcode']) || '').trim();

      if (!emailValue && !nameValue) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['Faculty email or name is required'] });
        continue;
      }
      if (!departmentValue) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['Department code or name is required'] });
        continue;
      }

      const faculty = await User.findOne({
        role: { $in: ['faculty', 'teacher'] },
        ...(emailValue ? { email: emailValue } : { name: nameValue }),
      }).lean();
      if (!faculty) {
        summary.failureCount += 1;
        summary.notFoundCount += 1;
        summary.validationErrors.push({ rowNumber, errors: [`No faculty found for ${emailValue || nameValue}`] });
        continue;
      }

      const department = await Department.findOne({
        $or: [{ code: departmentValue }, { name: new RegExp(`^${escapeRegExp(departmentValue)}$`, 'i') }],
      }).lean();
      if (!department) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: [`Department "${departmentValue}" not found`] });
        continue;
      }

      if (req.user?.accountType === 'hod' && req.user.departmentId && department._id.toString() !== req.user.departmentId.toString()) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: ['HOD accounts can only assign faculty to their own department'] });
        continue;
      }
      if (req.user?.accountType === 'dean' && req.user.schoolId && department.schoolId && department.schoolId.toString() !== req.user.schoolId.toString()) {
        summary.failureCount += 1;
        summary.validationErrors.push({ rowNumber, errors: [`Department "${departmentValue}" is outside your school`] });
        continue;
      }

      const school = department.schoolId ? await School.findById(department.schoolId).select('name').lean().catch(() => null) : null;

      await User.updateOne(
        { _id: faculty._id },
        {
          $set: {
            departmentId: department._id,
            department: department.name || departmentValue,
            schoolId: department.schoolId || null,
            school: school?.name || '',
          },
        }
      );
      summary.successCount += 1;
    }

    await logAudit(req, {
      action: 'Bulk faculty assignment',
      entityType: 'User',
      details: {
        fileName: fileName || '',
        totalRows: summary.totalRows,
        successCount: summary.successCount,
        failureCount: summary.failureCount,
      },
    });

    return sendSuccess(res, 200, 'Bulk faculty assignment completed', summary);
  } catch (error) {
    next(error);
  }
};

const getDepartmentAiSummary = async (req, res, next) => {
  try {
    const result = await generateDepartmentSummary({
      schoolId: req.user?.accountType === 'dean' ? req.user.schoolId : undefined,
      departmentId: req.user?.accountType === 'hod' ? req.user.departmentId : undefined,
    });

    return sendSuccess(res, 200, 'AI department summary generated', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  exportUsers,
  getUserById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  resetPassword,
  getAnalytics,
  getLookups,
  createBulkUsers,
  bulkUpdateUsers,
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  exportAnalytics,
  downloadBulkTemplate,
  getAuditLogs,
  deleteAuditLog,
  clearAuditLogs,
  getAcademicSettings,
  updateAcademicSettings,
  rolloverAcademicYear,
  getDeanStats,
  getDeanDepartmentsPerformance,
  getDeanDepartmentYearPerformance,
  getDeanDepartmentStudentPerformance,
  getDeanTopPerformers,
  exportAdminReport,
  getDepartmentStats,
  bulkAssignFaculty,
  getDepartmentAiSummary,
};

