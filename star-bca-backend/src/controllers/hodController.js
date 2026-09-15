const Submission = require('../models/Submission');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { sendSuccess, sendError } = require('../utils/response');
const { logAudit } = require('../utils/audit');
const { notifySubmissionStatus } = require('../utils/notify');
const { syncStudentPoints } = require('../services/gamificationService');

const sanitizeSubmission = (submission) => {
  const plainObject = submission?.toObject ? submission.toObject() : { ...submission };
  if (plainObject.certificateFile && typeof plainObject.certificateFile === 'object' && plainObject.certificateFile.data) {
    plainObject.certificateFile = {
      fileName: plainObject.certificateFile.fileName || '',
      contentType: plainObject.certificateFile.contentType || '',
      size: plainObject.certificateFile.size || plainObject.certificateFile.data.length || 0,
    };
  }
  return plainObject;
};

const getFacultyApprovedSubmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const flagged = req.query.flagged === 'true';

    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id);
    const query = { status: 'FacultyApproved', studentId: { $in: studentIds } };

    if (flagged) {
      query.$or = [
        { 'aiReview.recommendation': { $in: ['Reject', 'Review'] } },
        { 'aiReview.confidence': { $lt: 70 } },
        { aiReview: null },
      ];
    }

    if (search) {
      const matched = await User.find({
        role: 'student', departmentId: req.user.departmentId,
        $or: [{ name: { $regex: search, $options: 'i' } }, { regNo: { $regex: search, $options: 'i' } }],
      }).select('_id');
      query.studentId = { $in: matched.map((s) => s._id) };
    }

    const submissions = await Submission.find(query)
      .populate('studentId', 'name regNo department section')
      .populate('activityId', 'activityName maximumPoints')
      .populate('verifiedBy', 'name')
      .sort({ verifiedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Submission.countDocuments(query);
    return sendSuccess(res, 200, 'Faculty-approved submissions fetched', {
      submissions: submissions.map(sanitizeSubmission), total, page, limit,
    });
  } catch (error) {
    next(error);
  }
};

const getSubmissionDetails = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('studentId', 'name regNo department section')
      .populate('activityId', 'activityName maximumPoints')
      .populate('verifiedBy', 'name');
    if (!submission) return sendError(res, 404, 'Submission not found');
    return sendSuccess(res, 200, 'Details fetched', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const approveSubmission = async (req, res, next) => {
  try {
    const { pointsAwarded, hodRemarks } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const activity = await Activity.findById(submission.activityId);
    const safePoints = Number(pointsAwarded ?? submission.suggestedPoints ?? submission.pointsAwarded ?? 0);
    if (activity && safePoints > activity.maximumPoints) {
      return sendError(res, 400, 'Points cannot exceed maximum for this activity');
    }

    const updated = await Submission.findOneAndUpdate(
      { _id: req.params.id, status: 'FacultyApproved' },
      {
        $set: {
          status: 'Approved',
          pointsAwarded: safePoints,
          hodRemarks: hodRemarks || '',
          hodVerifiedBy: req.user.id,
          hodVerifiedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) return sendError(res, 400, 'Only faculty-approved submissions can be HOD-approved');

    const studentTotals = await syncStudentPoints(updated.studentId);

    await logAudit(req, {
      action: 'Submission approved by HOD',
      entityType: 'Submission',
      entityId: updated._id,
      details: { activity: activity?.activityName || '', pointsAwarded: safePoints },
    });
    await notifySubmissionStatus({ submission: updated, action: 'hod-approved', actorName: req.user.name });

    return sendSuccess(res, 200, 'Submission approved by HOD', {
      ...sanitizeSubmission(updated),
      totalPoints: studentTotals?.totalPoints || 0,
      surplusPoints: studentTotals?.surplusPoints || 0,
    });
  } catch (error) {
    next(error);
  }
};

const rejectSubmission = async (req, res, next) => {
  try {
    const { hodRemarks } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const updated = await Submission.findOneAndUpdate(
      { _id: req.params.id, status: 'FacultyApproved' },
      {
        $set: {
          status: 'HODRejected',
          hodRemarks: hodRemarks || 'Rejected by HOD — please resubmit with proper evidence',
          pointsAwarded: 0,
          hodVerifiedBy: req.user.id,
          hodVerifiedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) return sendError(res, 400, 'Only faculty-approved submissions can be rejected by HOD');

    await syncStudentPoints(updated.studentId);

    await logAudit(req, {
      action: 'Submission rejected by HOD',
      entityType: 'Submission',
      entityId: updated._id,
      details: { hodRemarks: updated.hodRemarks },
    });
    await notifySubmissionStatus({ submission: updated, action: 'hod-rejected', actorName: req.user.name });

    return sendSuccess(res, 200, 'Submission rejected by HOD', sanitizeSubmission(updated));
  } catch (error) {
    next(error);
  }
};

const bulkApproveSubmissions = async (req, res, next) => {
  try {
    const { ids = [], pointsAwarded, hodRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No submissions selected');

    const submissions = await Submission.find({ _id: { $in: ids } });
    if (submissions.length !== ids.length) return sendError(res, 404, 'Some selected submissions were not found');

    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id.toString());

    let approved = 0;
    const affectedStudentIds = new Set();
    for (const submission of submissions) {
      if (!studentIds.includes(submission.studentId?.toString?.())) continue;

      const activity = await Activity.findById(submission.activityId);
      const safePoints = Number(pointsAwarded ?? submission.suggestedPoints ?? submission.pointsAwarded ?? 0);
      if (activity && safePoints > activity.maximumPoints) continue;

      const updated = await Submission.findOneAndUpdate(
        { _id: submission._id, status: 'FacultyApproved' },
        {
          $set: {
            status: 'Approved',
            pointsAwarded: safePoints,
            hodRemarks: hodRemarks || '',
            hodVerifiedBy: req.user.id,
            hodVerifiedAt: new Date(),
          },
        },
        { new: true }
      );
      if (!updated) continue;

      await notifySubmissionStatus({ submission: updated, action: 'hod-approved', actorName: req.user.name });
      affectedStudentIds.add(String(updated.studentId));
      approved += 1;
    }

    await Promise.all([...affectedStudentIds].map((id) => syncStudentPoints(id)));

    await logAudit(req, {
      action: 'Bulk approved by HOD',
      entityType: 'Submission',
      entityId: ids,
      details: { approved },
    });

    return sendSuccess(res, 200, `${approved} submission${approved === 1 ? '' : 's'} approved`, { approved });
  } catch (error) {
    next(error);
  }
};

const bulkRejectSubmissions = async (req, res, next) => {
  try {
    const { ids = [], hodRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No submissions selected');

    const submissions = await Submission.find({ _id: { $in: ids } });
    if (submissions.length !== ids.length) return sendError(res, 404, 'Some selected submissions were not found');

    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id.toString());

    let rejected = 0;
    const affectedStudentIds = new Set();
    for (const submission of submissions) {
      if (!studentIds.includes(submission.studentId?.toString?.())) continue;

      const updated = await Submission.findOneAndUpdate(
        { _id: submission._id, status: 'FacultyApproved' },
        {
          $set: {
            status: 'HODRejected',
            hodRemarks: hodRemarks || 'Rejected by HOD — please resubmit with proper evidence',
            pointsAwarded: 0,
            hodVerifiedBy: req.user.id,
            hodVerifiedAt: new Date(),
          },
        },
        { new: true }
      );
      if (!updated) continue;

      await notifySubmissionStatus({ submission: updated, action: 'hod-rejected', actorName: req.user.name });
      affectedStudentIds.add(String(updated.studentId));
      rejected += 1;
    }

    await Promise.all([...affectedStudentIds].map((id) => syncStudentPoints(id)));

    await logAudit(req, {
      action: 'Bulk rejected by HOD',
      entityType: 'Submission',
      entityId: ids,
      details: { rejected },
    });

    return sendSuccess(res, 200, `${rejected} submission${rejected === 1 ? '' : 's'} rejected`, { rejected });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id);

    const [pendingHOD, approved, rejected, totalStudents, totalPoints] = await Promise.all([
      Submission.countDocuments({ status: 'FacultyApproved', studentId: { $in: studentIds } }),
      Submission.countDocuments({ status: 'Approved', studentId: { $in: studentIds } }),
      Submission.countDocuments({ status: { $in: ['Rejected', 'HODRejected'] }, studentId: { $in: studentIds } }),
      User.countDocuments({ role: 'student', departmentId: req.user.departmentId }),
      Submission.aggregate([
        { $match: { status: 'Approved', studentId: { $in: studentIds } } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
      ]),
    ]);

    return sendSuccess(res, 200, 'Dashboard stats', {
      pendingHOD, approved, rejected, totalStudents, totalPointsAwarded: totalPoints[0]?.total || 0,
    });
  } catch (error) {
    next(error);
  }
};

const exportSubmissions = async (req, res, next) => {
  try {
    const status = req.query.status || 'FacultyApproved';
    const deptStudents = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('_id');
    const studentIds = deptStudents.map((s) => s._id);

    const submissions = await Submission.find({ status, studentId: { $in: studentIds } })
      .populate('studentId', 'name regNo registerNumber department section')
      .populate('activityId', 'activityName maximumPoints')
      .populate('verifiedBy', 'name')
      .sort({ verifiedAt: -1 });

    const rows = submissions.map((sub) => ({
      Student: sub.studentId?.name || '',
      'Register Number': sub.studentId?.registerNumber || sub.studentId?.regNo || '',
      Department: sub.studentId?.department || '',
      Section: sub.studentId?.section || '',
      Activity: sub.activityId?.activityName || '',
      'Activity Type': sub.activityType || sub.visitType || '',
      Level: sub.selectedLevel || '',
      'Duration (weeks)': sub.durationWeeks || '',
      'Project URL': sub.projectUrl || sub.proofUrl || '',
      Status: sub.status || '',
      'Points Awarded': sub.pointsAwarded ?? 0,
      'Suggested Points': sub.suggestedPoints ?? 0,
      'Verified By': sub.verifiedBy?.name || '',
      'Verified At': sub.verifiedAt ? new Date(sub.verifiedAt).toLocaleString() : '',
      Remarks: sub.teacherRemarks || '',
    }));

    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Submissions', `hod-submissions-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const lockSemester = async (req, res, next) => {
  try {
    const { batch } = req.body;
    const query = { role: 'student', departmentId: req.user.departmentId };
    if (batch) query.semesterBatch = batch;

    await User.updateMany(query, { $set: { semesterLocked: true } });
    await logAudit(req, { action: 'Semester locked', entityType: 'User', details: { batch: batch || 'all' } });
    return sendSuccess(res, 200, `Semester locked for${batch ? ` batch ${batch}` : ''} all students in your department`);
  } catch (error) {
    next(error);
  }
};

const getSemesterStatus = async (req, res, next) => {
  try {
    const query = { role: 'student', departmentId: req.user.departmentId };
    const students = await User.find(query).select('semesterLocked semesterBatch batch').lean();
    const locked = students.filter((s) => s.semesterLocked).length;
    const total = students.length;

    const batches = {};
    students.forEach((s) => {
      const batch = s.semesterBatch || s.batch || 'all';
      if (!batches[batch]) batches[batch] = { locked: 0, total: 0 };
      batches[batch].total += 1;
      if (s.semesterLocked) batches[batch].locked += 1;
    });

    return sendSuccess(res, 200, 'Semester status fetched', {
      locked,
      unlocked: total - locked,
      total,
      batches: Object.entries(batches).map(([name, value]) => ({ name, ...value })),
    });
  } catch (error) {
    next(error);
  }
};

const unlockSemester = async (req, res, next) => {
  try {
    const { batch } = req.body;
    const query = { role: 'student', departmentId: req.user.departmentId };
    if (batch) query.semesterBatch = batch;

    await User.updateMany(query, { $set: { semesterLocked: false } });
    await logAudit(req, { action: 'Semester unlocked', entityType: 'User', details: { batch: batch || 'all' } });
    return sendSuccess(res, 200, `Semester unlocked for${batch ? ` batch ${batch}` : ''} all students in your department`);
  } catch (error) {
    next(error);
  }
};

const runAiReview = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const student = await User.findById(submission.studentId).select('departmentId');
    if (!student || String(student.departmentId || '') !== String(req.user.departmentId || '')) {
      return sendError(res, 403, 'Submission outside your department');
    }

    const { reviewSubmission: review, getProvider } = require('../services/aiReviewService');
    const result = await review(submission._id);
    const provider = getProvider();
    return sendSuccess(res, 200, `AI review completed (${provider || 'rule engine'})`, {
      ...result,
      submissionId: submission._id,
    });
  } catch (error) {
    next(error);
  }
};

const getDepartmentLeaderboard = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const students = await User.find({ role: 'student', departmentId: req.user.departmentId })
      .select('name registerNo registerNumber regNo totalPoints approvedSubmissions year semesterBatch')
      .sort({ totalPoints: -1 })
      .limit(limit)
      .lean();
    const leaderboard = students.map((student, index) => ({
      rank: index + 1,
      _id: student._id,
      name: student.name,
      registerNumber: student.registerNo || student.registerNumber || student.regNo || '',
      totalPoints: student.totalPoints || 0,
      approvedSubmissions: student.approvedSubmissions || 0,
    }));
    return sendSuccess(res, 200, 'Department leaderboard fetched', { leaderboard });
  } catch (error) {
    next(error);
  }
};

const exportLeaderboard = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const students = await User.find({ role: 'student', departmentId: req.user.departmentId })
      .select('name registerNo registerNumber regNo totalPoints approvedSubmissions year semesterBatch')
      .sort({ totalPoints: -1 })
      .limit(limit)
      .lean();
    const rows = students.map((student, index) => ({
      Rank: index + 1,
      Name: student.name,
      'Register No': student.registerNo || student.registerNumber || student.regNo || '',
      Batch: student.semesterBatch || student.year || '',
      'Approved Submissions': student.approvedSubmissions || 0,
      'STAR Points': student.totalPoints || 0,
    }));
    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Leaderboard', `leaderboard-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const exportFacultyOverview = async (req, res, next) => {
  try {
    const faculty = await User.find({ role: 'faculty', departmentId: req.user.departmentId })
      .select('name email status yearAssigned')
      .sort({ name: 1 })
      .lean();
    const facultyIds = faculty.map((f) => f._id);
    const assignedRows = await User.aggregate([
      { $match: { role: 'student', assignedFacultyId: { $in: facultyIds } } },
      { $group: { _id: '$assignedFacultyId', count: { $sum: 1 } } },
    ]);
    const assignedMap = new Map(assignedRows.map((row) => [String(row._id), row.count]));

    const submissions = await Submission.find({ verifiedBy: { $in: facultyIds } })
      .select('verifiedBy status pointsAwarded createdAt verifiedAt updatedAt')
      .lean();

    const statsMap = {};
    submissions.forEach((s) => {
      const key = String(s.verifiedBy || '');
      if (!key) return;
      const stat = statsMap[key] || (statsMap[key] = { reviewed: 0, approved: 0, rejected: 0, points: 0, tSum: 0, tCount: 0 });
      stat.reviewed += 1;
      if (['Approved', 'FacultyApproved'].includes(s.status)) {
        stat.approved += 1;
        stat.points += s.pointsAwarded || 0;
      } else if (s.status === 'Rejected') stat.rejected += 1;
      if (s.createdAt) {
        const end = s.verifiedAt || s.updatedAt || Date.now();
        const days = (new Date(end).getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) {
          stat.tSum += days;
          stat.tCount += 1;
        }
      }
    });

    const rows = faculty.map((f) => {
      const stat = statsMap[String(f._id)] || { reviewed: 0, approved: 0, rejected: 0, points: 0, tSum: 0, tCount: 0 };
      return {
        Name: f.name,
        Email: f.email || '',
        Status: f.status || 'Active',
        'Assigned Students': assignedMap.get(String(f._id)) || 0,
        'Pending Reviews': pendingMap.get(String(f._id)) || 0,
        Reviewed: stat.reviewed,
        Approved: stat.approved,
        Rejected: stat.rejected,
        'Approval Rate %': stat.reviewed ? Math.round((stat.approved / stat.reviewed) * 100) : 0,
        'SP Awarded': stat.points,
        'Avg Turnaround Days': stat.tCount ? Math.round((stat.tSum / stat.tCount) * 10) / 10 : 0,
      };
    });
    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Faculty Overview', `faculty-overview-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const getAtRiskStudents = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student', departmentId: req.user.departmentId, status: 'Active' })
      .select('name registerNo registerNumber regNo totalPoints approvedSubmissions semesterBatch year')
      .lean();
    const atRisk = students
      .filter((s) => !s.approvedSubmissions || (s.totalPoints || 0) === 0)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        registerNumber: s.registerNo || s.registerNumber || s.regNo || '',
        totalPoints: s.totalPoints || 0,
        approvedSubmissions: s.approvedSubmissions || 0,
        batch: s.semesterBatch || s.year || '',
      }));
    return sendSuccess(res, 200, 'At-risk students fetched', { atRisk, totalStudents: students.length });
  } catch (error) {
    next(error);
  }
};

const getFacultyOverview = async (req, res, next) => {
  try {
    const faculty = await User.find({ role: 'faculty', departmentId: req.user.departmentId })
      .select('name email status yearAssigned')
      .sort({ name: 1 })
      .lean();
    const facultyIds = faculty.map((f) => f._id);

    const assignedRows = await User.aggregate([
      { $match: { role: 'student', assignedFacultyId: { $in: facultyIds } } },
      { $group: { _id: '$assignedFacultyId', count: { $sum: 1 } } },
    ]);
    const assignedMap = new Map(assignedRows.map((row) => [String(row._id), row.count]));

    const pendingRows = await Submission.aggregate([
      { $match: { status: 'Pending' } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $match: { 'student.departmentId': req.user.departmentId, 'student.assignedFacultyId': { $in: facultyIds } } },
      { $group: { _id: '$student.assignedFacultyId', count: { $sum: 1 } } },
    ]);
    const pendingMap = new Map(pendingRows.map((row) => [String(row._id), row.count]));
    const pendingStudents = await User.find({ role: 'student', departmentId: req.user.departmentId, assignedFacultyId: { $in: facultyIds } }).distinct('_id');
    const pendingSubmissions = await Submission.find({ status: 'Pending', studentId: { $in: pendingStudents } })
      .populate('studentId', 'name registerNumber registerNo regNo assignedFacultyId')
      .populate('activityId', 'activityName')
      .select('studentId activityId submittedAt createdAt status')
      .sort({ submittedAt: 1, createdAt: 1 })
      .lean();
    const pendingDetailsMap = new Map();
    pendingSubmissions.forEach((submission) => {
      const facultyId = String(submission.studentId?.assignedFacultyId || '');
      if (!facultyId) return;
      const list = pendingDetailsMap.get(facultyId) || [];
      list.push({
        _id: submission._id,
        studentName: submission.studentId?.name || 'Student',
        registerNumber: submission.studentId?.registerNumber || submission.studentId?.registerNo || submission.studentId?.regNo || '',
        activity: submission.activityId?.activityName || 'Activity',
        submittedAt: submission.submittedAt || submission.createdAt,
        status: submission.status,
      });
      pendingDetailsMap.set(facultyId, list);
    });

    const submissions = await Submission.find({ verifiedBy: { $in: facultyIds } })
      .select('verifiedBy status pointsAwarded createdAt verifiedAt')
      .lean();

    const statsMap = {};
    submissions.forEach((s) => {
      const key = String(s.verifiedBy || '');
      if (!key) return;
      const stat = statsMap[key] || (statsMap[key] = { reviewed: 0, approved: 0, rejected: 0, totalPointsAwarded: 0, turnaroundSum: 0, turnaroundCount: 0 });
      stat.reviewed += 1;
      if (['Approved', 'FacultyApproved'].includes(s.status)) {
        stat.approved += 1;
        stat.totalPointsAwarded += s.pointsAwarded || 0;
      } else if (s.status === 'Rejected') {
        stat.rejected += 1;
      }
      if (s.createdAt) {
        const end = s.verifiedAt || s.updatedAt || Date.now();
        const days = (new Date(end).getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) {
          stat.turnaroundSum += days;
          stat.turnaroundCount += 1;
        }
      }
    });

    const overview = faculty.map((f) => {
      const stat = statsMap[String(f._id)] || { reviewed: 0, approved: 0, rejected: 0, totalPointsAwarded: 0, turnaroundSum: 0, turnaroundCount: 0 };
      return {
        _id: f._id,
        name: f.name,
        email: f.email || '',
        status: f.status || 'Active',
        yearAssigned: f.yearAssigned || '',
        assignedStudents: assignedMap.get(String(f._id)) || 0,
        pendingReviews: pendingMap.get(String(f._id)) || 0,
        pendingReviewItems: pendingDetailsMap.get(String(f._id)) || [],
        reviewed: stat.reviewed,
        approved: stat.approved,
        rejected: stat.rejected,
        approvalRate: stat.reviewed ? Math.round((stat.approved / stat.reviewed) * 100) : 0,
        totalPointsAwarded: stat.totalPointsAwarded,
        avgTurnaroundDays: stat.turnaroundCount ? Math.round((stat.turnaroundSum / stat.turnaroundCount) * 10) / 10 : 0,
      };
    });

    return sendSuccess(res, 200, 'Faculty overview fetched', { overview });
  } catch (error) {
    next(error);
  }
};

const getStudentOverview = async (req, res, next) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student', departmentId: req.user.departmentId })
      .select('-password')
      .lean();
    if (!student) return sendError(res, 404, 'Student not found in your department');

    const submissions = await Submission.find({ studentId: student._id })
      .populate('activityId', 'activityName vertical')
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    const earnedStatuses = ['Approved', 'FacultyApproved'];
    const verticalMap = {};
    let approvedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    submissions.forEach((s) => {
      const vertical = s.activityId?.vertical || s.vertical || 'General';
      const entry = verticalMap[vertical] || (verticalMap[vertical] = { vertical, points: 0, submissions: 0 });
      entry.submissions += 1;
      if (earnedStatuses.includes(s.status)) {
        approvedCount += 1;
        entry.points += s.pointsAwarded || 0;
      } else if (s.status === 'Rejected') rejectedCount += 1;
      else if (s.status === 'Pending' || s.status === 'FacultyApproved') pendingCount += 1;
    });

    return sendSuccess(res, 200, 'Student overview fetched', {
      student: {
        _id: student._id,
        name: student.name,
        registerNumber: student.registerNo || student.registerNumber || student.regNo || '',
        email: student.email || '',
        year: student.year || '',
        batch: student.semesterBatch || student.batch || '',
        section: student.section || '',
        status: student.status || 'Active',
        assignedFaculty: student.assignedTeacher || null,
        totalPoints: student.totalPoints || 0,
        approvedSubmissions: student.approvedSubmissions || 0,
      },
      totals: { approvedCount, pendingCount, rejectedCount, trackedSubmissions: submissions.length },
      verticalBreakdown: Object.values(verticalMap).sort((a, b) => b.points - a.points),
      recentSubmissions: submissions.slice(0, 10).map((s) => ({
        _id: s._id,
        activity: s.activityId?.activityName || 'Activity',
        vertical: s.activityId?.vertical || s.vertical || 'General',
        status: s.status,
        points: s.pointsAwarded || s.suggestedPoints || 0,
        submittedAt: s.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFacultyApprovedSubmissions,
  getSubmissionDetails,
  approveSubmission,
  rejectSubmission,
  bulkApproveSubmissions,
  bulkRejectSubmissions,
  getDashboardStats,
  exportSubmissions,
  lockSemester,
  unlockSemester,
  getSemesterStatus,
  getDepartmentLeaderboard,
  getAtRiskStudents,
  exportLeaderboard,
  exportFacultyOverview,
  getFacultyOverview,
  getStudentOverview,
  runAiReview,
};
