const Submission = require('../models/Submission');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/response');
const { calculateSubmissionScore } = require('../utils/scoringEngine');
const { reviewSubmission, getProvider, ruleBasedReview } = require('../services/aiReviewService');
const { logAudit } = require('../utils/audit');
const { notifySubmissionStatus } = require('../utils/notify');
const { syncStudentPoints } = require('../services/gamificationService');
const XLSX = require('xlsx');
const { exportRowsAsXlsx } = require('../utils/exporter');

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

const getFacultyStudentIds = async (facultyId) => {
  const students = await User.find({ role: 'student', assignedFacultyId: facultyId }).select('_id');
  return students.map((student) => student._id);
};

const academicMetricPoints = ({ semesterPercentage, attendancePercentage, libraryUsage }) => ({
  semester: Number(semesterPercentage) < 60 ? 2 : Number(semesterPercentage) < 70 ? 3 : Number(semesterPercentage) < 80 ? 4 : 5,
  attendance: Number(attendancePercentage) < 75 ? 0 : Number(attendancePercentage) < 80 ? 2 : Number(attendancePercentage) < 90 ? 3 : Number(attendancePercentage) < 95 ? 4 : 5,
  library: Number(libraryUsage) >= 15 ? 4 : Number(libraryUsage) >= 10 ? 3 : Number(libraryUsage) >= 5 ? 2 : 0,
});

const syncAcademicMetricSubmissions = async (student, metrics, actorName = 'faculty') => {
  const activityDefinitions = [
    {
      activityName: 'Semester Exam Percentage',
      maximumPoints: 5,
      description: 'Upload marksheet showing semester exam percentage',
      levels: [{ label: '< 60%', points: 2 }, { label: '60–69%', points: 3 }, { label: '70–79%', points: 4 }, { label: '80% and above', points: 5 }],
    },
    {
      activityName: 'Attendance Percentage',
      maximumPoints: 5,
      description: 'Upload attendance record',
      levels: [{ label: '75–79%', points: 2 }, { label: '80–89%', points: 3 }, { label: '90–94%', points: 4 }, { label: '95% and above', points: 5 }],
    },
    {
      activityName: 'Library Usage',
      maximumPoints: 4,
      description: 'Library usage record per semester',
      levels: [{ label: '5 Hrs', points: 2 }, { label: '10 Hrs', points: 3 }, { label: '15 Hrs', points: 4 }],
    },
  ];
  const activities = await Promise.all(activityDefinitions.map((definition) => Activity.findOneAndUpdate(
    { activityName: definition.activityName },
    { $setOnInsert: { ...definition, vertical: 'V1 — Academic Performance', evidenceType: 'file' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()));
  const activityByName = new Map(activities.map((activity) => [activity.activityName, activity]));
  const points = academicMetricPoints(metrics);
  const definitions = [
    ['Semester Exam Percentage', points.semester, metrics.semesterPercentage],
    ['Attendance Percentage', points.attendance, metrics.attendancePercentage],
    ['Library Usage', points.library, metrics.libraryUsage],
  ];

  for (const [activityName, metricPoints, rawValue] of definitions) {
    const activity = activityByName.get(activityName);
    if (!activity) throw new Error(`Academic activity not found: ${activityName}`);

    const submission = await Submission.findOneAndUpdate(
      { studentId: student._id, activityId: activity._id, tierIndex: null },
      {
        $set: {
          activityType: 'academic-metrics',
          description: `Academic metric: ${activityName} (${rawValue})`,
          studentInputData: { metric: activityName, value: rawValue },
          selectedLevel: '',
          tierLabel: '',
          suggestedPoints: metricPoints,
          pointsAwarded: metricPoints,
          status: 'Approved',
          submittedAt: new Date(),
          verifiedAt: new Date(),
          teacherRemarks: `Academic metrics updated by ${actorName}`,
        },
        $setOnInsert: {
          studentId: student._id,
          activityId: activity._id,
          verifiedBy: null,
          certificateFile: null,
          proofUrl: '',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    await notifySubmissionStatus({ submission, action: 'hod-approved', actorName });
  }

  await syncStudentPoints(student._id);
};

const validateFacultyAccess = async (submission, facultyId) => {
  const student = await User.findById(submission.studentId).select('assignedFacultyId');
  if (!student) {
    return false;
  }

  return student.assignedFacultyId?.toString() === facultyId.toString();
};

const getPendingSubmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || 'Pending';
    const search = req.query.search || '';

    const facultyStudentIds = await getFacultyStudentIds(req.user.id);
    const statusQuery = status === 'FacultyApproved'
      ? { $in: ['FacultyApproved', 'Approved', 'HODApproved'] }
      : status;
    const query = { status: statusQuery, studentId: { $in: facultyStudentIds } };

    if (search) {
      const matchedStudents = await User.find({
        role: 'student',
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { regNo: { $regex: search, $options: 'i' } },
          { registerNumber: { $regex: search, $options: 'i' } }
        ],
        assignedFacultyId: req.user.id,
      }).select('_id');

      query.studentId = { $in: matchedStudents.map((student) => student._id) };
    }

    const submissions = await Submission.find(query)
      .populate('studentId', 'name regNo registerNumber department semesterBatch section semesterPercentage attendancePercentage libraryUsage')
      .populate('activityId', 'activityName maximumPoints')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const sanitizedSubmissions = submissions.map((submission) => sanitizeSubmission(submission));
    const total = await Submission.countDocuments(query);

    return sendSuccess(res, 200, 'Pending submissions fetched successfully', { submissions: sanitizedSubmissions, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const exportSubmissions = async (req, res, next) => {
  try {
    const status = req.query.status || 'Pending';
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);

    const submissions = await Submission.find({ status, studentId: { $in: facultyStudentIds } })
      .populate('studentId', 'name regNo registerNumber department section semesterPercentage attendancePercentage libraryUsage')
      .populate('activityId', 'activityName maximumPoints')
      .sort({ submittedAt: -1 });

    const rows = submissions.map((sub) => ({
      Student: sub.studentId?.name || '',
      'Register Number': sub.studentId?.registerNumber || sub.studentId?.regNo || '',
      Activity: sub.activityId?.activityName || '',
      'Activity Type': sub.activityType || sub.visitType || '',
      Level: sub.selectedLevel || '',
      'Duration (weeks)': sub.durationWeeks || '',
      'Project URL': sub.projectUrl || sub.proofUrl || '',
      Status: sub.status || '',
      'Points Awarded': sub.pointsAwarded ?? 0,
      'Suggested Points': sub.suggestedPoints ?? 0,
      'Submitted At': sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '',
      Remarks: sub.teacherRemarks || '',
    }));

    const { exportRowsAsXlsx } = require('../utils/exporter');
    return exportRowsAsXlsx(res, rows, 'Submissions', `submissions-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    next(error);
  }
};

const getSubmissionDetails = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('studentId', 'name regNo registerNumber department semesterBatch section semesterPercentage attendancePercentage libraryUsage')
      .populate('activityId', 'activityName maximumPoints');

    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    return sendSuccess(res, 200, 'Submission details fetched successfully', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const approveSubmission = async (req, res, next) => {
  try {
    const { pointsAwarded, teacherRemarks } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    const activity = await Activity.findById(submission.activityId);
    if (!activity) return sendError(res, 404, 'Activity not found');

    const calculated = calculateSubmissionScore(activity, submission);
    const safePoints = Number(pointsAwarded ?? calculated.suggestedPoints ?? calculated.pointsAwarded ?? 0);

    if (safePoints > activity.maximumPoints) {
      return sendError(res, 400, 'Points awarded cannot exceed maximum points for the activity');
    }

    const updated = await Submission.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending' },
      {
        $set: {
          status: 'FacultyApproved',
          suggestedPoints: calculated.suggestedPoints,
          pointsAwarded: safePoints,
          teacherRemarks: teacherRemarks || calculated.scoreSummary,
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return sendError(res, 409, 'Submission was already reviewed');
    }

    const studentTotals = await syncStudentPoints(updated.studentId);

    await logAudit(req, {
      action: 'Submission approved by faculty',
      entityType: 'Submission',
      entityId: updated._id,
      details: { activity: activity.activityName, pointsAwarded: safePoints },
    });
    await notifySubmissionStatus({ submission: updated, action: 'faculty-approved', actorName: req.user.name });

    return sendSuccess(res, 200, 'Submission approved — pending HOD verification', {
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
    const { teacherRemarks } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    const updated = await Submission.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending' },
      {
        $set: {
          status: 'Rejected',
          teacherRemarks: teacherRemarks || 'Please resubmit with clearer evidence.',
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
          pointsAwarded: 0,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return sendError(res, 409, 'Submission was already reviewed');
    }

    await syncStudentPoints(updated.studentId);

    await logAudit(req, {
      action: 'Submission rejected by faculty',
      entityType: 'Submission',
      entityId: updated._id,
      details: { teacherRemarks: updated.teacherRemarks },
    });
    await notifySubmissionStatus({ submission: updated, action: 'rejected', actorName: req.user.name });

    return sendSuccess(res, 200, 'Submission rejected successfully', sanitizeSubmission(updated));
  } catch (error) {
    next(error);
  }
};

const bulkApproveSubmissions = async (req, res, next) => {
  try {
    const { ids = [], pointsAwarded, teacherRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No submissions selected');

    const submissions = await Submission.find({ _id: { $in: ids } });
    if (submissions.length !== ids.length) return sendError(res, 404, 'Some selected submissions were not found');

    let approved = 0;
    const affectedStudentIds = new Set();
    for (const submission of submissions) {
      const allowed = await validateFacultyAccess(submission, req.user.id);
      if (!allowed) continue;

      const activity = await Activity.findById(submission.activityId);
      const calculated = calculateSubmissionScore(activity, submission);
      const safePoints = Number(pointsAwarded ?? calculated.suggestedPoints ?? calculated.pointsAwarded ?? 0);
      if (activity && safePoints > activity.maximumPoints) continue;

      const updated = await Submission.findOneAndUpdate(
        { _id: submission._id, status: 'Pending' },
        {
          $set: {
            status: 'FacultyApproved',
            suggestedPoints: calculated.suggestedPoints,
            pointsAwarded: safePoints,
            teacherRemarks: teacherRemarks || calculated.scoreSummary,
            verifiedBy: req.user.id,
            verifiedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );
      if (!updated) continue;

      await notifySubmissionStatus({ submission: updated, action: 'faculty-approved', actorName: req.user.name });
      affectedStudentIds.add(String(updated.studentId));
      approved += 1;
    }

    await Promise.all([...affectedStudentIds].map((id) => syncStudentPoints(id)));

    await logAudit(req, {
      action: 'Bulk approved submissions',
      entityType: 'Submission',
      entityId: ids,
      details: { approved },
    });

    return sendSuccess(res, 200, `${approved} submission${approved === 1 ? '' : 's'} approved — pending HOD verification`, { approved });
  } catch (error) {
    next(error);
  }
};

const bulkRejectSubmissions = async (req, res, next) => {
  try {
    const { ids = [], teacherRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No submissions selected');

    const submissions = await Submission.find({ _id: { $in: ids } });
    if (submissions.length !== ids.length) return sendError(res, 404, 'Some selected submissions were not found');

    let rejected = 0;
    const affectedStudentIds = new Set();
    for (const submission of submissions) {
      const allowed = await validateFacultyAccess(submission, req.user.id);
      if (!allowed) continue;

      const updated = await Submission.findOneAndUpdate(
        { _id: submission._id, status: 'Pending' },
        {
          $set: {
            status: 'Rejected',
            teacherRemarks: teacherRemarks || 'Please resubmit with clearer evidence.',
            verifiedBy: req.user.id,
            verifiedAt: new Date(),
            pointsAwarded: 0,
          },
        },
        { returnDocument: 'after' }
      );
      if (!updated) continue;

      await notifySubmissionStatus({ submission: updated, action: 'rejected', actorName: req.user.name });
      affectedStudentIds.add(String(updated.studentId));
      rejected += 1;
    }

    await Promise.all([...affectedStudentIds].map((id) => syncStudentPoints(id)));

    await logAudit(req, {
      action: 'Bulk rejected submissions',
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
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);

    const [pending, approved, rejected, totalStudents, totalPoints] = await Promise.all([
      Submission.countDocuments({ status: 'Pending', studentId: { $in: facultyStudentIds } }),
      Submission.countDocuments({ status: { $in: ['FacultyApproved', 'Approved'] }, studentId: { $in: facultyStudentIds } }),
      Submission.countDocuments({ status: 'Rejected', studentId: { $in: facultyStudentIds } }),
      User.countDocuments({ role: 'student', assignedFacultyId: req.user.id }),
      Submission.aggregate([
        { $match: { status: { $in: ['FacultyApproved', 'Approved'] }, studentId: { $in: facultyStudentIds } } },
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } }
      ])
    ]);

    return sendSuccess(res, 200, 'Dashboard stats fetched successfully', {
      pending,
      approved,
      rejected,
      totalStudents,
      totalPointsAwarded: totalPoints[0]?.total || 0
    });
  } catch (error) {
    next(error);
  }
};

const pearsonCorrelation = (xs, ys) => {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return Number((num / Math.sqrt(denX * denY)).toFixed(2));
};

const getAnalytics = async (req, res, next) => {
  try {
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 90, 7), 365);
    const period = req.query.period === 'month' ? 'month' : 'week';
    const since = new Date(Date.now() - days * 86400000);
    const studentMatch = { studentId: { $in: facultyStudentIds } };

    const unit = period === 'month' ? 'month' : 'week';
    const format = period === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const trendRows = await Submission.aggregate([
      { $match: { ...studentMatch, submittedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { date: { $dateTrunc: { date: '$submittedAt', unit, timezone: 'UTC' } }, format, timezone: 'UTC' } },
          submissions: { $sum: 1 },
          approved: { $sum: { $cond: [{ $in: ['$status', ['FacultyApproved', 'HODApproved', 'Approved']] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $in: ['$status', ['Rejected', 'HODRejected']] }, 1, 0] } },
          points: { $sum: { $cond: [{ $in: ['$status', ['FacultyApproved', 'HODApproved', 'Approved']] }, '$pointsAwarded', 0] } },
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const trendMap = new Map(trendRows.map((row) => [row._id, row]));
    const trends = [];
    let cursor;
    const now = new Date();
    if (period === 'month') {
      cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1));
    } else {
      const dayOffset = (since.getUTCDay() + 6) % 7;
      cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate() - dayOffset));
    }
    while (cursor <= now) {
      const key = cursor.toISOString().slice(0, period === 'month' ? 7 : 10);
      const row = trendMap.get(key);
      trends.push({
        label: key,
        submissions: row?.submissions || 0,
        approved: row?.approved || 0,
        rejected: row?.rejected || 0,
        points: row?.points || 0,
      });
      if (period === 'month') {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      } else {
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      }
    }

    const verticals = await Submission.aggregate([
      { $match: { ...studentMatch, status: { $in: ['FacultyApproved', 'HODApproved', 'Approved'] } } },
      { $lookup: { from: 'activities', localField: 'activityId', foreignField: '_id', as: 'activity' } },
      { $unwind: { path: '$activity', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$activity.vertical', 'Uncategorised'] },
          submissions: { $sum: 1 },
          points: { $sum: '$pointsAwarded' }
        }
      },
      { $project: { _id: 0, name: '$_id', submissions: 1, points: 1 } },
      { $sort: { points: -1 } }
    ]);

    const activityTypes = await Submission.aggregate([
      { $match: studentMatch },
      {
        $group: {
          _id: { $ifNull: ['$activityType', 'Other'] },
          count: { $sum: 1 }
        }
      },
      { $project: { _id: 0, name: '$_id', count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    const students = await User.find({ role: 'student', _id: { $in: facultyStudentIds } })
      .select('name registerNumber regNo semesterPercentage attendancePercentage libraryUsage totalPoints approvedSubmissions semesterBatch section')
      .lean();

    const withMetrics = students.filter((s) => s.semesterPercentage > 0 || s.attendancePercentage > 0 || s.libraryUsage > 0);
    const avg = (arr) => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0);
    const academic = {
      students: students.map((s) => ({
        name: s.name,
        registerNumber: s.registerNumber || s.regNo,
        semesterPercentage: s.semesterPercentage || 0,
        attendancePercentage: s.attendancePercentage || 0,
        libraryUsage: s.libraryUsage || 0,
        totalPoints: s.totalPoints || 0,
      })),
      avgSemesterPercentage: avg(withMetrics.map((s) => s.semesterPercentage)),
      avgAttendancePercentage: avg(withMetrics.map((s) => s.attendancePercentage)),
      avgLibraryUsage: avg(withMetrics.map((s) => s.libraryUsage)),
      correlations: {
        attendanceVsPoints: pearsonCorrelation(withMetrics.map((s) => s.attendancePercentage), withMetrics.map((s) => s.totalPoints)),
        semesterVsPoints: pearsonCorrelation(withMetrics.map((s) => s.semesterPercentage), withMetrics.map((s) => s.totalPoints)),
        libraryVsPoints: pearsonCorrelation(withMetrics.map((s) => s.libraryUsage), withMetrics.map((s) => s.totalPoints)),
      },
      atRisk: withMetrics.filter((s) => (s.attendancePercentage > 0 && s.attendancePercentage < 75) || (s.semesterPercentage > 0 && s.semesterPercentage < 60)).length,
    };

    const distributionBuckets = [
      { label: '0-50', min: 0, max: 50 },
      { label: '51-100', min: 51, max: 100 },
      { label: '101-200', min: 101, max: 200 },
      { label: '201+', min: 201, max: Infinity },
    ];
    const distribution = distributionBuckets.map((bucket) => ({
      label: bucket.label,
      count: students.filter((s) => s.totalPoints >= bucket.min && s.totalPoints <= bucket.max).length,
    }));

    const aiMatch = { ...studentMatch, 'aiReview.recommendation': { $exists: true, $ne: null } };
    const [aiByRecommendation, aiSummary, aiFlags, aiOutcome] = await Promise.all([
      Submission.aggregate([
        { $match: aiMatch },
        { $group: { _id: '$aiReview.recommendation', count: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', count: 1 } }
      ]),
      Submission.aggregate([
        { $match: aiMatch },
        { $group: { _id: null, avgConfidence: { $avg: '$aiReview.confidence' }, reviewed: { $sum: 1 } } }
      ]),
      Submission.aggregate([
        { $match: aiMatch },
        { $unwind: '$aiReview.flags' },
        { $group: { _id: '$aiReview.flags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]),
      Submission.aggregate([
        { $match: aiMatch },
        {
          $group: {
            _id: null,
            approveRecs: { $sum: { $cond: [{ $eq: ['$aiReview.recommendation', 'Approve'] }, 1, 0] } },
            facultyAgreedWithApprove: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$aiReview.recommendation', 'Approve'] },
                      { $in: ['$status', ['FacultyApproved', 'HODApproved', 'Approved']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          }
        }
      ]),
    ]);

    const aiReview = {
      byRecommendation: aiByRecommendation,
      reviewed: aiSummary[0]?.reviewed || 0,
      avgConfidence: Math.round(aiSummary[0]?.avgConfidence || 0),
      flags: aiFlags.map((f) => ({ name: f._id, count: f.count })),
      acceptanceRate: aiOutcome[0]?.approveRecs
        ? Number((((aiOutcome[0].facultyAgreedWithApprove / aiOutcome[0].approveRecs) * 100).toFixed(1)))
        : 0,
    };

    const [workloadSummary, pendingAge] = await Promise.all([
      Submission.aggregate([
        {
          $match: {
            ...studentMatch,
            verifiedAt: { $ne: null },
            status: { $in: ['FacultyApproved', 'HODApproved', 'Approved', 'Rejected', 'HODRejected'] },
          }
        },
        {
          $group: {
            _id: null,
            avgTurnaroundMs: { $avg: { $subtract: ['$verifiedAt', '$submittedAt'] } },
            approvedCount: { $sum: { $cond: [{ $in: ['$status', ['FacultyApproved', 'HODApproved', 'Approved']] }, 1, 0] } },
          }
        }
      ]),
      Submission.aggregate([
        { $match: { ...studentMatch, status: 'Pending' } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgAgeMs: { $avg: { $subtract: [new Date(), '$submittedAt'] } },
            oldestMs: { $max: { $subtract: [new Date(), '$submittedAt'] } },
          }
        }
      ]),
    ]);

    const workload = {
      pendingCount: pendingAge[0]?.count || 0,
      avgPendingAgeDays: Math.round((pendingAge[0]?.avgAgeMs || 0) / 86400000 * 10) / 10,
      oldestPendingDays: Math.round((pendingAge[0]?.oldestMs || 0) / 86400000 * 10) / 10,
      avgTurnaroundDays: Math.round((workloadSummary[0]?.avgTurnaroundMs || 0) / 86400000 * 10) / 10,
      reviewedCount: workloadSummary[0]?.approvedCount || 0,
    };

    const pointsAwardedRows = await Submission.aggregate([
      { $match: { ...studentMatch, status: { $in: ['FacultyApproved', 'HODApproved', 'Approved'] } } },
      { $group: { _id: null, total: { $sum: '$pointsAwarded' } } }
    ]);

    return sendSuccess(res, 200, 'Faculty analytics fetched successfully', {
      trends,
      verticals,
      activityTypes,
      academic,
      distribution,
      aiReview,
      workload,
      totalPointsAwarded: pointsAwardedRows[0]?.total || 0,
    });
  } catch (error) {
    next(error);
  }
};

const getStudentVerticalPerformance = async (req, res, next) => {
  try {
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);

    const requestStudentId = req.query.studentId || '';
    const targetStudentId = requestStudentId && facultyStudentIds.some((id) => id.toString() === requestStudentId.toString())
      ? requestStudentId
      : facultyStudentIds[0];

    if (!targetStudentId) {
      return sendSuccess(res, 200, 'Vertical performance fetched successfully', {
        students: [],
        student: null,
        verticals: [],
        summary: { totalEarned: 0, totalCompleted: 0, totalActivities: 0 },
      });
    }

    const [students, selectedStudent, activities, submissions] = await Promise.all([
      User.find({ _id: { $in: facultyStudentIds } }).select('name registerNumber regNo department').lean(),
      User.findById(targetStudentId).select('name registerNumber regNo department').lean(),
      Activity.find({}).select('activityName vertical maximumPoints').lean(),
      Submission.find({ studentId: targetStudentId }).select('activityId status pointsAwarded suggestedPoints').lean(),
    ]);

    const approvedStatuses = new Set(['FacultyApproved', 'HODApproved', 'Approved']);
    const subByActivity = new Map();
    submissions.forEach((sub) => {
      if (sub.activityId && !subByActivity.has(sub.activityId.toString())) {
        subByActivity.set(sub.activityId.toString(), sub);
      }
    });

    const verticalMap = new Map();
    activities.forEach((activity) => {
      const v = activity.vertical || 'Uncategorised';
      if (!verticalMap.has(v)) verticalMap.set(v, []);
      verticalMap.get(v).push(activity);
    });

    const verticals = [];
    let totalEarned = 0;
    let totalCompleted = 0;
    let totalActivities = 0;

    for (const [name, acts] of verticalMap.entries()) {
      const byActivity = acts.map((activity) => {
        const sub = subByActivity.get(activity._id.toString());
        const completed = !!sub && approvedStatuses.has(sub.status);
        return {
          name: activity.activityName,
          maximumPoints: activity.maximumPoints || 0,
          pointsEarned: completed ? (sub.pointsAwarded || 0) : 0,
          completed,
        };
      });

      const completedActivities = byActivity.filter((a) => a.completed).length;
      const pointsEarned = byActivity.reduce((sum, a) => sum + a.pointsEarned, 0);
      totalEarned += pointsEarned;
      totalCompleted += completedActivities;
      totalActivities += byActivity.length;

      verticals.push({ name, totalActivities: byActivity.length, completedActivities, pointsEarned, activities: byActivity });
    }

    verticals.sort((a, b) => a.name.localeCompare(b.name));

    return sendSuccess(res, 200, 'Vertical performance fetched successfully', {
      students,
      student: selectedStudent,
      verticals,
      summary: { totalEarned, totalCompleted, totalActivities },
    });
  } catch (error) {
    next(error);
  }
};

const runAiReview = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    const review = await reviewSubmission(submission._id, { imagePages: req.body?.pageImages });
    const provider = getProvider();
    return sendSuccess(res, 200, `AI review completed (${provider || 'rule engine'})`, {
      ...review,
      submissionId: submission._id,
    });
  } catch (error) {
    next(error);
  }
};

const applyAiReview = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return sendError(res, 404, 'Submission not found');

    const allowed = await validateFacultyAccess(submission, req.user.id);
    if (!allowed) {
      return sendError(res, 403, 'Only the recommended faculty can review this submission');
    }

    if (!submission.aiReview) return sendError(res, 400, 'No AI review is available for this submission');

    const activity = await Activity.findById(submission.activityId);
    const maxPoints = Number(activity?.maximumPoints || 0);
    const suggestedPoints = Math.min(Number(submission.aiReview.suggestedPoints || 0), maxPoints);

    submission.suggestedPoints = suggestedPoints;
    submission.teacherRemarks = submission.aiReview.reasoning || submission.teacherRemarks;
    await submission.save();

    return sendSuccess(res, 200, 'AI suggestion applied — review and confirm', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const getAcademicMetricsRegNos = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('registerNo registerNumber regNo')
      .lean();
    const regNos = students.map((s) => s.registerNo || s.registerNumber || s.regNo).filter(Boolean);
    return sendSuccess(res, 200, 'Register numbers fetched', regNos);
  } catch (error) {
    next(error);
  }
};

const downloadAcademicMetricsTemplate = async (req, res, next) => {
  try {
    const headers = ['Student Name', 'Reg No', 'Semester Percentage', 'Attendance Percentage', 'Library Usage'];
    const example = ['John Doe', '2021BCA001', '85.5', '92.0', '15'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Academic Metrics');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="academic-metrics-template.xlsx"');
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const downloadAcademicMetricsCsvTemplate = async (req, res, next) => {
  try {
    const headers = ['Student Name', 'Reg No', 'Semester Percentage', 'Attendance Percentage', 'Library Usage'];
    const example = ['John Doe', '2021BCA001', '85.5', '92.0', '15'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Academic Metrics');
    const csv = XLSX.write(workbook, { type: 'string', bookType: 'csv' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="academic-metrics-template.csv"');
    return res.send(csv);
  } catch (error) {
    next(error);
  }
};

const bulkUploadAcademicMetrics = async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return sendError(res, 400, 'No data rows provided');
    }

    const students = await User.find({ role: 'student' })
      .select('_id name registerNo registerNumber regNo semesterPercentage attendancePercentage libraryUsage')
      .lean();

    const studentMap = new Map();
    for (const student of students) {
      const key = (student.registerNo || student.registerNumber || student.regNo || '').trim();
      if (key) studentMap.set(key, student);
    }

    const summary = {
      totalRows: rows.length,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      results: []
    };

    for (const [index, row] of rows.entries()) {
      const rowIndex = index + 1;
      const { studentName, regNo, semesterPercentage, attendancePercentage, libraryUsage } = row;
      const regNoKey = String(regNo || '').trim();

      const errors = [];

      if (!regNoKey) {
        errors.push('Reg No is required');
      } else if (!studentMap.has(regNoKey)) {
        errors.push(`Reg No "${regNoKey}" not found in your assigned students`);
      }

      if (semesterPercentage === undefined || semesterPercentage === null || semesterPercentage === '') {
        errors.push('Semester Percentage is required');
      } else if (isNaN(Number(semesterPercentage)) || Number(semesterPercentage) < 0 || Number(semesterPercentage) > 100) {
        errors.push('Semester Percentage must be a number between 0 and 100');
      }

      if (attendancePercentage === undefined || attendancePercentage === null || attendancePercentage === '') {
        errors.push('Attendance Percentage is required');
      } else if (isNaN(Number(attendancePercentage)) || Number(attendancePercentage) < 0 || Number(attendancePercentage) > 100) {
        errors.push('Attendance Percentage must be a number between 0 and 100');
      }

      let libraryNum = 0;
      if (libraryUsage !== undefined && libraryUsage !== null && libraryUsage !== '') {
        libraryNum = Number(libraryUsage);
        if (isNaN(libraryNum) || libraryNum < 0) {
          libraryNum = 0;
        }
      }

      if (errors.length > 0) {
        summary.failureCount += 1;
        summary.results.push({
          rowIndex,
          success: false,
          regNo: regNoKey,
          studentName: studentName || '',
          errors
        });
        continue;
      }

      const student = studentMap.get(regNoKey);
      if (!student) {
        summary.failureCount += 1;
        summary.results.push({
          rowIndex,
          success: false,
          regNo: regNoKey,
          studentName: studentName || '',
          errors: ['Student not found']
        });
        continue;
      }

      try {
        const metrics = {
          semesterPercentage: Number(semesterPercentage),
          attendancePercentage: Number(attendancePercentage),
          libraryUsage: libraryNum,
        };
        await User.findByIdAndUpdate(student._id, { $set: metrics });
        await syncAcademicMetricSubmissions(student, metrics, req.user.name || 'faculty');

        summary.successCount += 1;
        summary.results.push({
          rowIndex,
          success: true,
          regNo: regNoKey,
          studentName: student.name || studentName
        });
      } catch (error) {
        summary.failureCount += 1;
        summary.results.push({
          rowIndex,
          success: false,
          regNo: regNoKey,
          studentName: student.name || studentName,
          errors: [error.message || 'Failed to update student']
        });
      }
    }

    await logAudit(req, {
      action: 'Bulk academic metrics upload',
      entityType: 'User',
      details: {
        totalRows: summary.totalRows,
        successCount: summary.successCount,
        failureCount: summary.failureCount,
        skippedCount: summary.skippedCount
      }
    });

    return sendSuccess(res, 200, 'Bulk academic metrics upload completed', summary);
  } catch (error) {
    next(error);
  }
};

const getScoreboard = async (req, res, next) => {
  try {
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);

    const students = await User.find({ role: 'student', _id: { $in: facultyStudentIds } })
      .select('_id name registerNumber totalPoints approvedSubmissions')
      .lean();

    if (!students.length) {
      return sendSuccess(res, 200, 'Scoreboard fetched successfully', { students: [], topStudents: [] });
    }

    const studentIds = students.map((s) => s._id);

    const submissions = await Submission.find({
      studentId: { $in: studentIds },
      status: { $in: ['FacultyApproved', 'Approved'] }
    })
      .populate('activityId', 'activityName vertical')
      .select('studentId activityId pointsAwarded submittedAt')
      .lean();

    const submissionsByStudent = submissions.reduce((acc, sub) => {
      const studentId = sub.studentId.toString();
      if (!acc[studentId]) acc[studentId] = [];
      acc[studentId].push({
        _id: sub._id,
        activityName: sub.activityId?.activityName || 'Activity',
        vertical: sub.activityId?.vertical || '',
        pointsAwarded: sub.pointsAwarded || 0,
        submittedAt: sub.submittedAt,
        status: 'Approved'
      });
      return acc;
    }, {});

    const studentsWithPoints = students.map((student) => {
      const studentSubmissions = submissionsByStudent[student._id.toString()] || [];
      const computedTotal = studentSubmissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0);
      return {
        _id: student._id,
        name: student.name,
        registerNumber: student.registerNumber,
        totalPoints: Number.isFinite(Number(student.totalPoints)) && Number(student.totalPoints) > 0
          ? Number(student.totalPoints)
          : computedTotal,
        approvedSubmissions: student.approvedSubmissions || studentSubmissions.length,
        submissions: studentSubmissions
      };
    });

    studentsWithPoints.sort((a, b) => b.totalPoints - a.totalPoints);

    const rankedStudents = studentsWithPoints.map((student, index) => ({
      ...student,
      rank: index + 1
    }));

    const topStudents = rankedStudents.slice(0, 5);

    return sendSuccess(res, 200, 'Scoreboard fetched successfully', {
      students: rankedStudents,
      topStudents
    });
  } catch (error) {
    next(error);
  }
};

const PDFDocument = require('pdfkit');

const generatePdfReport = async (req, res, next) => {
  try {
    const { type = 'submissions', studentId, status = 'FacultyApproved' } = req.query;
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);

    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${type}-${new Date().toISOString().slice(0, 10)}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('STAR Framework Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()} | Faculty: ${req.user.name || 'N/A'}`, { align: 'center' });
    doc.moveDown(2);

    if (type === 'submissions') {
      const query = { studentId: { $in: facultyStudentIds } };
      if (status) query.status = status;
      if (studentId) query.studentId = studentId;

      const submissions = await Submission.find(query)
        .populate('studentId', 'name registerNumber regNo department semesterBatch')
        .populate('activityId', 'activityName vertical maximumPoints')
        .sort({ submittedAt: -1 });

      doc.fontSize(14).font('Helvetica-Bold').text(`Submissions Report — ${status || 'All'}`, { underline: true });
      doc.moveDown();

      const tableTop = doc.y;
      const colWidths = [40, 140, 120, 180, 80, 80, 80];
      const headers = ['#', 'Student', 'Register No', 'Activity', 'Status', 'Points', 'Date'];

      doc.fontSize(9).font('Helvetica-Bold');
      headers.forEach((header, i) => {
        const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(header, x, tableTop, { width: colWidths[i], align: i === 0 ? 'center' : 'left' });
      });

      doc.moveTo(50, tableTop + 15).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), tableTop + 15).stroke();

      let y = tableTop + 25;
      doc.font('Helvetica').fontSize(8);

      submissions.slice(0, 50).forEach((sub, index) => {
        if (y > 550) {
          doc.addPage();
          y = 50;
        }

        const rowData = [
          String(index + 1),
          sub.studentId?.name || 'N/A',
          sub.studentId?.registerNumber || sub.studentId?.regNo || 'N/A',
          sub.activityId?.activityName || 'N/A',
          sub.status || 'N/A',
          String(sub.pointsAwarded || 0),
          sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A'
        ];

        rowData.forEach((text, i) => {
          const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.text(text, x, y, { width: colWidths[i], align: i === 0 ? 'center' : 'left', ellipsis: true });
        });
        y += 18;
      });

      doc.moveDown(2);
      doc.fontSize(10).font('Helvetica-Bold').text(`Total Submissions: ${submissions.length}`, 50, y + 10);
    } else if (type === 'academic-metrics') {
      const students = await User.find({ role: 'student', _id: { $in: facultyStudentIds } })
        .select('name registerNumber regNo semesterPercentage attendancePercentage libraryUsage department semesterBatch')
        .lean();

      doc.fontSize(14).font('Helvetica-Bold').text('Student Academic Records Report', { underline: true });
      doc.moveDown();

      const tableTop = doc.y;
      const colWidths = [40, 140, 120, 80, 80, 80, 80];
      const headers = ['#', 'Student', 'Register No', 'Semester %', 'Attendance %', 'Library Usage', 'Batch'];

      doc.fontSize(9).font('Helvetica-Bold');
      headers.forEach((header, i) => {
        const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(header, x, tableTop, { width: colWidths[i], align: i === 0 ? 'center' : 'left' });
      });

      doc.moveTo(50, tableTop + 15).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), tableTop + 15).stroke();

      let y = tableTop + 25;
      doc.font('Helvetica').fontSize(8);

      students.forEach((student, index) => {
        if (y > 550) {
          doc.addPage();
          y = 50;
        }

        const rowData = [
          String(index + 1),
          student.name || 'N/A',
          student.registerNumber || student.regNo || 'N/A',
          `${student.semesterPercentage || 0}%`,
          `${student.attendancePercentage || 0}%`,
          String(student.libraryUsage || 0),
          student.semesterBatch || student.batch || 'N/A'
        ];

        rowData.forEach((text, i) => {
          const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.text(text, x, y, { width: colWidths[i], align: i === 0 ? 'center' : 'left', ellipsis: true });
        });
        y += 18;
      });

      doc.moveDown(2);
      doc.fontSize(10).font('Helvetica-Bold').text(`Total Students: ${students.length}`, 50, y + 10);
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};

const autoApproveByAi = async (req, res, next) => {
  try {
    const { ids = [] } = req.body;
    let targetIds = ids;

    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      const facultyStudentIds = await getFacultyStudentIds(req.user.id);
      const pendingSubmissions = await Submission.find({ status: 'Pending', studentId: { $in: facultyStudentIds } }).select('_id');
      targetIds = pendingSubmissions.map((s) => s._id);
    }

    if (targetIds.length === 0) return sendSuccess(res, 200, 'No pending submissions to auto-approve', { approved: 0, skipped: 0, failed: 0, results: [] });

    let approved = 0;
    let skipped = 0;
    let failed = 0;
    const affectedStudentIds = new Set();
    const results = [];

    for (const submissionId of targetIds) {
      try {
        const submission = await Submission.findById(submissionId);
        if (!submission || submission.status !== 'Pending') { skipped += 1; continue; }

        const allowed = await validateFacultyAccess(submission, req.user.id);
        if (!allowed) { skipped += 1; continue; }

        const activity = await Activity.findById(submission.activityId);
        if (!activity) { skipped += 1; continue; }

        let review = submission.aiReview;
        if (!review || !review.recommendation) {
          try {
            const reviewResult = await reviewSubmission(submission._id);
            review = reviewResult;
          } catch (e) {
            review = ruleBasedReview(activity, submission);
          }
        }

        if (review.recommendation === 'Approve' && review.confidence >= 50) {
          const calculated = calculateSubmissionScore(activity, submission);
          const safePoints = Math.min(Number(review.suggestedPoints || calculated.suggestedPoints || 0), Number(activity.maximumPoints || 0));

          const updated = await Submission.findOneAndUpdate(
            { _id: submission._id, status: 'Pending' },
            {
              $set: {
                status: 'FacultyApproved',
                suggestedPoints: calculated.suggestedPoints,
                pointsAwarded: safePoints,
                teacherRemarks: `Auto-approved by AI (${review.provider || 'rule-engine'}) — ${review.reasoning || 'Confidence: ' + review.confidence + '%'}`,
                verifiedBy: req.user.id,
                verifiedAt: new Date(),
              },
            },
            { returnDocument: 'after' }
          );
          if (!updated) { skipped += 1; continue; }

          await notifySubmissionStatus({ submission: updated, action: 'faculty-approved', actorName: 'AI Auto-Approve' });
          affectedStudentIds.add(String(updated.studentId));
          approved += 1;
          results.push({ id: submissionId, status: 'approved', points: safePoints });
        } else {
          skipped += 1;
          results.push({ id: submissionId, status: 'skipped', reason: `AI recommendation: ${review.recommendation} (confidence: ${review.confidence}%)` });
        }
      } catch (error) {
        failed += 1;
        results.push({ id: submissionId, status: 'failed', error: error.message });
      }
    }

    await Promise.all([...affectedStudentIds].map((id) => syncStudentPoints(id)));

    await logAudit(req, {
      action: 'AI auto-approve bulk',
      entityType: 'Submission',
      entityId: targetIds,
      details: { approved, skipped, failed },
    });

    return sendSuccess(res, 200, `AI auto-approve completed: ${approved} approved, ${skipped} skipped, ${failed} failed`, { approved, skipped, failed, results });
  } catch (error) {
    next(error);
  }
};

const getStudentAcademicRecords = async (req, res, next) => {
  try {
    const facultyStudentIds = await getFacultyStudentIds(req.user.id);
    const { search = '', batch = '' } = req.query;

    const query = { role: 'student', _id: { $in: facultyStudentIds } };
    if (batch) query.semesterBatch = batch;

    if (search) {
      const matchedStudents = await User.find({
        role: 'student',
        assignedFacultyId: req.user.id,
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { registerNumber: { $regex: search, $options: 'i' } },
          { regNo: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query._id = { $in: matchedStudents.map((s) => s._id) };
    }

    const students = await User.find(query)
      .select('name registerNumber regNo department semesterBatch batch section semesterPercentage attendancePercentage libraryUsage totalPoints approvedSubmissions status')
      .sort({ name: 1 })
      .lean();

    const batches = await User.distinct('semesterBatch', { role: 'student', _id: { $in: facultyStudentIds } });

    return sendSuccess(res, 200, 'Student academic records fetched', { students, batches: batches.filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

const updateAcademicRecord = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return sendError(res, 404, 'Student not found');
    if (student.role !== 'student') return sendError(res, 400, 'Only student records can be updated');

    const facultyStudentIds = await getFacultyStudentIds(req.user.id);
    if (!facultyStudentIds.some((id) => id.toString() === student._id.toString())) {
      return sendError(res, 403, 'This student is not assigned to you');
    }

    const { semesterPercentage, attendancePercentage, libraryUsage } = req.body;

    const updates = {};
    if (semesterPercentage !== undefined && semesterPercentage !== null && semesterPercentage !== '') {
      const value = Number(semesterPercentage);
      if (isNaN(value) || value < 0 || value > 100) {
        return sendError(res, 400, 'Semester Percentage must be a number between 0 and 100');
      }
      updates.semesterPercentage = value;
    }
    if (attendancePercentage !== undefined && attendancePercentage !== null && attendancePercentage !== '') {
      const value = Number(attendancePercentage);
      if (isNaN(value) || value < 0 || value > 100) {
        return sendError(res, 400, 'Attendance Percentage must be a number between 0 and 100');
      }
      updates.attendancePercentage = value;
    }
    if (libraryUsage !== undefined && libraryUsage !== null && libraryUsage !== '') {
      const value = Number(libraryUsage);
      if (isNaN(value) || value < 0) {
        return sendError(res, 400, 'Library usage must be a non-negative number');
      }
      updates.libraryUsage = value;
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, 'No valid fields to update');
    }

    await User.findByIdAndUpdate(student._id, { $set: updates });
    const metrics = {
      semesterPercentage: updates.semesterPercentage ?? student.semesterPercentage,
      attendancePercentage: updates.attendancePercentage ?? student.attendancePercentage,
      libraryUsage: updates.libraryUsage ?? student.libraryUsage,
    };
    await syncAcademicMetricSubmissions(student, metrics, req.user.name || 'faculty');

    await logAudit(req, {
      action: 'Academic record updated',
      entityType: 'User',
      entityId: student._id,
      details: { name: student.name, registerNumber: student.registerNumber || student.regNo, updates }
    });

    return sendSuccess(res, 200, 'Academic record updated successfully', { id: student._id, ...updates });
  } catch (error) {
    next(error);
  }
};

const deleteAcademicRecord = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return sendError(res, 404, 'Student not found');
    if (student.role !== 'student') return sendError(res, 400, 'Only student records can be deleted');

    const facultyStudentIds = await getFacultyStudentIds(req.user.id);
    if (!facultyStudentIds.some((id) => id.toString() === student._id.toString())) {
      return sendError(res, 403, 'This student is not assigned to you');
    }

    await User.findOneAndDelete({ _id: student._id });
    await logAudit(req, {
      action: 'Student record deleted',
      entityType: 'User',
      entityId: student._id,
      details: { name: student.name, role: student.role }
    });

    return sendSuccess(res, 200, 'Student record deleted successfully', { id: student._id });
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const [notifications, unread, total] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments({ userId: req.user.id, read: false }),
      Notification.countDocuments({ userId: req.user.id }),
    ]);
    return sendSuccess(res, 200, 'Notifications fetched successfully', { notifications, unread, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } },
      { returnDocument: 'after' }
    );
    if (!notification) return sendError(res, 404, 'Notification not found');
    return sendSuccess(res, 200, 'Notification marked as read', notification);
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
    return sendSuccess(res, 200, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!notification) return sendError(res, 404, 'Notification not found');
    return sendSuccess(res, 200, 'Notification deleted', notification);
  } catch (error) {
    next(error);
  }
};

const deleteNotifications = async (req, res, next) => {
  try {
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, 'No notifications selected');
    const result = await Notification.deleteMany({ _id: { $in: ids }, userId: req.user.id });
    return sendSuccess(res, 200, `${result.deletedCount || 0} notification(s) deleted`, { deleted: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPendingSubmissions, exportSubmissions, 
getSubmissionDetails, approveSubmission, rejectSubmission, bulkApproveSubmissions, bulkRejectSubmissions, 
getDashboardStats, getAnalytics, runAiReview, applyAiReview, getAcademicMetricsRegNos, downloadAcademicMetricsTemplate, downloadAcademicMetricsCsvTemplate, 
bulkUploadAcademicMetrics, getScoreboard, generatePdfReport, autoApproveByAi, getStudentAcademicRecords, 
updateAcademicRecord, deleteAcademicRecord, getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteNotifications, getStudentVerticalPerformance };
