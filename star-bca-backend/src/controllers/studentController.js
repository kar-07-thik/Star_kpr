const mongoose = require('mongoose');
const User = require('../models/User');
const Submission = require('../models/Submission');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/response');
const { calculateSubmissionScore } = require('../utils/scoringEngine');
const { body, validationResult } = require('express-validator');
const { reviewSubmission } = require('../services/aiReviewService');
const { syncStudentPoints } = require('../services/gamificationService');
const { logAudit } = require('../utils/audit');
const { createNotification, notifySubmissionStatus } = require('../utils/notify');
const { uploadSubmissionFile } = require('../services/cloudinaryService');

const EVIDENCE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml',
];

const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

const validateEvidenceFile = (file) => {
  if (!file) return null;
  const extOk = /\.(pdf|png|jpe?g|webp|docx?)$/i.test(file.originalname || '');
  const mimeOk = EVIDENCE_TYPES.includes(String(file.mimetype || '').toLowerCase());
  if (!extOk && !mimeOk) return 'Only PDF, PNG, JPG, WEBP, or Word documents are allowed for evidence';
  if (file.size > EVIDENCE_MAX_BYTES) return 'File size must be less than 5MB';
  return null;
};

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

const getProfile = async (req, res, next) => {
  try {
    const student = await User.findOne({ _id: req.user.id, role: 'student' }).select('-password');
    if (!student) {
      return sendError(res, 404, 'Student profile not found');
    }

    return sendSuccess(res, 200, 'Profile fetched successfully', student);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array()[0].msg);

    const { name, department, school, section, semesterBatch, phoneNumber, dob } = req.body;
    const updateData = {};

    if (typeof name !== 'undefined') updateData.name = name;
    if (typeof department !== 'undefined') updateData.department = department;
    if (typeof school !== 'undefined') updateData.school = school;
    if (typeof section !== 'undefined') updateData.section = section;
    if (typeof semesterBatch !== 'undefined') updateData.semesterBatch = semesterBatch;
    if (typeof phoneNumber !== 'undefined') updateData.phoneNumber = phoneNumber;
    if (typeof dob !== 'undefined') updateData.dob = dob;

    const updatedStudent = await User.findOneAndUpdate(
      { _id: req.user.id, role: 'student' },
      updateData,
      { new: true }
    ).select('-password');

    if (!updatedStudent) {
      return sendError(res, 404, 'Student profile not found');
    }

    return sendSuccess(res, 200, 'Profile updated successfully', updatedStudent);
  } catch (error) {
    next(error);
  }
};

const submitActivity = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array()[0].msg);

    const { activityId, description, proofUrl, activityType, visitType, durationWeeks, projectUrl, selectedLevel } = req.body;
    const fileValidationError = validateEvidenceFile(req.file);
    if (fileValidationError) return sendError(res, 400, fileValidationError);
    const uploadedFile = req.file ? await uploadSubmissionFile(req.file) : null;
    const certificateFile = req.file
      ? {
          fileName: req.file.originalname,
          contentType: req.file.mimetype,
          url: uploadedFile.secure_url,
          publicId: uploadedFile.public_id,
          size: req.file.size || req.file.buffer.length,
        }
      : null;

    const normalizedActivityType = String(activityType || '').trim().toLowerCase();
    const normalizedVisitType = String(visitType || '').trim().toLowerCase();
    const normalizedDuration = String(durationWeeks || '').trim();
    const normalizedProjectUrl = String(projectUrl || proofUrl || '').trim();

    let activityObjectId = null;
    let activity = null;

    if (activityId) {
      if (mongoose.Types.ObjectId.isValid(activityId)) {
        activityObjectId = new mongoose.Types.ObjectId(activityId);
        activity = await Activity.findById(activityObjectId);
      } else {
        activity = await Activity.findOne({ $or: [{ _id: activityId }, { activityName: activityId }] });
        if (activity) {
          activityObjectId = activity._id;
        }
      }
    }

    if (!activity || !activityObjectId) {
      return sendError(res, 400, 'Invalid activity ID');
    }

    const normalizedActivityName = String(activity.activityName || '').trim().toLowerCase();
    const resolvedActivityType = normalizedActivityType || (
      normalizedActivityName.includes('case study') ? 'case-study' :
      normalizedActivityName.includes('mini project') ? 'mini-project' :
      normalizedActivityName.includes('internship') ? 'internship' :
      normalizedActivityName.includes('industrial visit') ? 'industrial-visit' :
      normalizedActivityName.includes('institutional visit') ? 'institutional-visit' :
      normalizedActivityName.includes('international visit') ? 'international-visit' :
      ''
    );

    const resolvedVisitType = normalizedVisitType || (
      normalizedActivityName.includes('industrial visit') ? 'industrial visit' :
      normalizedActivityName.includes('institutional visit') ? 'institutional visit' :
      normalizedActivityName.includes('international visit') ? 'international visit' :
      ''
    );

    const hasDocumentUpload = Boolean(certificateFile);
    const hasLiveUrl = Boolean(normalizedProjectUrl);
    const isValidUrl = (() => {
      if (!hasLiveUrl) return false;
      try {
        const parsed = new URL(normalizedProjectUrl);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    })();
    const verticalStr = String(activity?.vertical || '').trim().toLowerCase();
    const isVertical1 = /\b(?:v|vertical)\s*1\b/.test(verticalStr);
    const isVertical2 = /\b(?:v|vertical)\s*2\b/.test(verticalStr);

    if (activity.evidenceType === 'both') {
      const evidenceErrors = [];
      if (!isValidUrl) evidenceErrors.push('Please enter your profile/submission URL');
      if (!hasDocumentUpload) evidenceErrors.push('Please upload a supporting document (screenshot/certificate)');
      if (evidenceErrors.length) return sendError(res, 400, evidenceErrors.join(' '));
    } else if (activity.evidenceType === 'url' && !isValidUrl) {
      return sendError(res, 400, 'Please enter your profile/submission URL');
    } else if (activity.evidenceType === 'file' && !hasDocumentUpload) {
      return sendError(res, 400, 'Please upload a supporting document (screenshot/certificate)');
    } else if (activity.evidenceType === 'either' && !hasDocumentUpload && !isValidUrl) {
      return sendError(res, 400, 'Either certificate file or proof URL is required');
    }

    if (isVertical2 && !selectedLevel) {
      return sendError(res, 400, 'Please select a certification level');
    }

    if (isVertical2 && !hasDocumentUpload) {
      return sendError(res, 400, 'A certificate upload is required for this activity');
    }

    if (isVertical1) {
      if (resolvedActivityType === 'internship' && !hasDocumentUpload) {
        return sendError(res, 400, 'An internship certificate/document upload is required');
      }
      if (resolvedActivityType === 'case-study' && !hasDocumentUpload) {
        return sendError(res, 400, 'A case study document upload is required');
      }
      if (resolvedActivityType === 'internship' && !normalizedDuration) {
        return sendError(res, 400, 'Please choose the internship duration');
      }
      if (resolvedActivityType === 'mini-project' && !hasLiveUrl) {
        return sendError(res, 400, 'Please provide the live project URL');
      }
      if (resolvedVisitType && !hasDocumentUpload) {
        return sendError(res, 400, 'A visit document upload is required');
      }
      if (!hasDocumentUpload && !hasLiveUrl) {
        return sendError(res, 400, 'Either certificate file or proof URL is required');
      }
    }

    const activityLevels = Array.isArray(activity.levels) ? activity.levels : [];
    const normalizedSelectedLevel = String(selectedLevel || '').trim();
    const tierIndex = activityLevels.findIndex((level) => String(level.label).trim() === normalizedSelectedLevel);
    if (activityLevels.length > 0 && tierIndex < 0) {
      return sendError(res, 400, 'Please select a valid activity level');
    }

    const duplicateQuery = {
      studentId: req.user.id,
      activityId: activityObjectId,
      status: { $in: ['Pending', 'FacultyApproved', 'HODApproved', 'Approved'] },
    };
    if (activityLevels.length > 0) duplicateQuery.tierIndex = tierIndex;
    const duplicate = await Submission.findOne(duplicateQuery);
    const studentUser = await User.findById(req.user.id).select('semesterLocked');
    if (studentUser?.semesterLocked) return sendError(res, 403, 'Semester is locked — you cannot submit new activities');

    if (duplicate) return sendError(res, 400, 'A submission for this activity level already exists');

    const studentInputData = {
      activityType: resolvedActivityType,
      visitType: resolvedVisitType,
      durationWeeks: normalizedDuration,
      projectUrl: normalizedProjectUrl,
    };

    const submissionPayload = {
      studentId: req.user.id,
      activityId: activityObjectId,
      activityType: resolvedActivityType,
      visitType: resolvedVisitType,
      durationWeeks: normalizedDuration,
      projectUrl: normalizedProjectUrl,
      certificateFile,
      proofUrl: normalizedProjectUrl,
      description,
      studentInputData,
      selectedLevel: normalizedSelectedLevel,
      tierIndex: activityLevels.length > 0 ? tierIndex : null,
      tierLabel: activityLevels.length > 0 ? normalizedSelectedLevel : '',
    };

    const calculated = calculateSubmissionScore(activity, submissionPayload);

    let submission;
    try {
      submission = await Submission.create({
        ...submissionPayload,
        suggestedPoints: calculated.suggestedPoints,
        pointsAwarded: 0,
      });
    } catch (error) {
      if (error.code === 11000) {
        return sendError(res, 400, 'A submission for this activity already exists');
      }
      throw error;
    }

    try {
      await reviewSubmission(submission._id);
    } catch (error) {
      console.error('[AI] auto review failed:', error.message);
    }

    const studentInfo = await User.findById(req.user.id).select('name assignedFacultyId').lean();
    if (studentInfo?.assignedFacultyId) {
      await createNotification({
        userId: studentInfo.assignedFacultyId,
        type: 'submission',
        title: 'New submission to review',
        message: `${studentInfo.name} submitted "${activity.activityName}" and is waiting for your review.`,
        link: '/faculty/reviews',
      });
    }

    const responsePayload = sanitizeSubmission(submission);
    return sendSuccess(res, 201, 'Submission uploaded successfully', responsePayload);
  } catch (error) {
    next(error);
  }
};

const getMySubmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search || '';

    const query = { studentId: req.user.id };
    if (status) query.status = status;

    const submissions = await Submission.find(query)
      .populate('activityId', 'activityName maximumPoints vertical')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const sanitizedSubmissions = submissions.map((submission) => sanitizeSubmission(submission));
    const total = await Submission.countDocuments(query);

    return sendSuccess(res, 200, 'Submissions fetched successfully', { submissions: sanitizedSubmissions, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const getEarnedPoints = async (req, res, next) => {
  try {
    const student = await User.findById(req.user.id).select('totalPoints surplusPoints pointsLedger');
    if (student && Number.isFinite(Number(student.totalPoints)) && Number(student.totalPoints) > 0) {
      return sendSuccess(res, 200, 'Points fetched successfully', {
        totalPoints: Math.min(Number(student.totalPoints) || 0, 200),
        surplusPoints: Number(student.surplusPoints) || 0,
      });
    }
    const result = await Submission.aggregate([
      { $match: { studentId: req.user.id, status: 'Approved' } },
      { $group: { _id: null, totalPoints: { $sum: '$pointsAwarded' } } }
    ]);

    const earnedPoints = result[0]?.totalPoints || 0;
    return sendSuccess(res, 200, 'Points fetched successfully', {
      totalPoints: Math.min(earnedPoints, 200),
      surplusPoints: Math.max(0, earnedPoints - 200),
    });
  } catch (error) {
    next(error);
  }
};

const getActivities = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const safeLimit = Math.max(1, Math.min(limit, 50));

    const [activities, total] = await Promise.all([
      Activity.find({}).sort({ activityName: 1 }).skip((page - 1) * safeLimit).limit(safeLimit),
      Activity.countDocuments({})
    ]);

    return sendSuccess(res, 200, 'Activities fetched successfully', { activities, total, page, limit: safeLimit });
  } catch (error) {
    next(error);
  }
};

const resubmitActivity = async (req, res, next) => {
  try {
    const studentUser = await User.findById(req.user.id).select('semesterLocked');
    if (studentUser?.semesterLocked) return sendError(res, 403, 'Semester is locked — you cannot resubmit');

    const submission = await Submission.findOne({ _id: req.params.id, studentId: req.user.id, status: { $in: ['Rejected', 'HODRejected'] } });
    if (!submission) return sendError(res, 404, 'Rejected submission not found');

    const { description, proofUrl, selectedLevel } = req.body;
    const fileValidationError = validateEvidenceFile(req.file);
    if (fileValidationError) return sendError(res, 400, fileValidationError);
    const uploadedFile = req.file ? await uploadSubmissionFile(req.file) : null;
    const certificateFile = req.file
      ? {
          fileName: req.file.originalname,
          contentType: req.file.mimetype,
          url: uploadedFile.secure_url,
          publicId: uploadedFile.public_id,
          size: req.file.size || req.file.buffer.length,
        }
      : submission.certificateFile;

    submission.status = 'Pending';
    submission.teacherRemarks = '';
    submission.pointsAwarded = 0;
    submission.verifiedBy = null;
    submission.verifiedAt = null;
    submission.submittedAt = new Date();
    if (description) submission.description = description;
    if (proofUrl) submission.proofUrl = proofUrl;
    if (selectedLevel) submission.selectedLevel = selectedLevel;
    if (req.file) submission.certificateFile = certificateFile;

    await submission.save();

    try {
      await reviewSubmission(submission._id);
    } catch (error) {
      console.error('[AI] auto review failed:', error.message);
    }

    return sendSuccess(res, 200, 'Resubmitted successfully', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const appealSubmission = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!String(reason || '').trim()) return sendError(res, 400, 'Please explain why you are appealing');

    const submission = await Submission.findOne({
      _id: req.params.id,
      studentId: req.user.id,
      status: { $in: ['Rejected', 'HODRejected'] },
    });
    if (!submission) return sendError(res, 404, 'Only rejected submissions can be appealed');

    submission.appeal = {
      reason: String(reason).trim(),
      status: 'Appealed',
      appealedAt: new Date(),
      resolution: '',
      resolvedBy: null,
      resolvedAt: null,
    };
    submission.status = 'Pending';
    submission.teacherRemarks = '';
    submission.hodRemarks = '';
    submission.pointsAwarded = 0;
    submission.verifiedBy = null;
    submission.verifiedAt = null;
    submission.hodVerifiedBy = null;
    submission.hodVerifiedAt = null;
    await submission.save();

    const student = await User.findById(req.user.id).select('name assignedFacultyId departmentId');
    const faculty = student?.assignedFacultyId
      ? await User.findById(student.assignedFacultyId).select('name email')
      : null;
    if (faculty) {
      const activity = await Activity.findById(submission.activityId).select('activityName');
      await createNotification({
        userId: faculty._id,
        type: 'appeal',
        title: 'Student appeal — review needed',
        message: `${student?.name || 'A student'} appealed a rejection for "${activity?.activityName || 'Activity'}". Please re-review the resubmitted evidence.`,
        link: '/faculty/reviews',
      });
    }

    await notifySubmissionStatus({ submission, action: 'appealed' });
    await logAudit(req, {
      action: 'Submission appealed by student',
      entityType: 'Submission',
      entityId: submission._id,
      details: { reason: String(reason).trim() },
    });

    return sendSuccess(res, 200, 'Appeal submitted — your submission is back with your faculty for review', sanitizeSubmission(submission));
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 20, 50));
    const [notifications, unread, total] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments({ userId: req.user.id, read: false }),
      Notification.countDocuments({ userId: req.user.id }),
    ]);
    return sendSuccess(res, 200, 'Notifications fetched', { notifications, unread, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } },
      { new: true }
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
    return sendSuccess(res, 200, 'All notifications marked as read', {});
  } catch (error) {
    next(error);
  }
};

const calculateStreak = async (studentId) => {
  const subs = await Submission.find({ studentId, status: 'Approved' }).select('verifiedAt createdAt').lean();
  const weekKeys = new Set();
  subs.forEach((sub) => {
    const date = sub.verifiedAt || sub.createdAt;
    if (!date) return;
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const weekNum = Math.floor((d - start) / (7 * 86400000));
    weekKeys.add(`${year}-${weekNum}`);
  });
  const now = new Date();
  const nowYear = now.getUTCFullYear();
  let cursor = Math.floor((now - new Date(Date.UTC(nowYear, 0, 1))) / (7 * 86400000));
  if (!weekKeys.has(`${nowYear}-${cursor}`)) cursor -= 1;
  let streak = 0;
  while (cursor >= 0 && weekKeys.has(`${nowYear}-${cursor}`)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
};

const getLeaderboard = async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id).select('name regNo registerNumber departmentId department schoolId semesterBatch batch status role').lean();
    if (!me) return sendError(res, 404, 'Student profile not found');

    const scopeFilter = { role: 'student', status: 'Active' };
    if (me.semesterBatch) scopeFilter.semesterBatch = me.semesterBatch;
    else if (me.batch) scopeFilter.batch = me.batch;
    else if (me.departmentId) scopeFilter.departmentId = me.departmentId;

    const students = await User.find(scopeFilter)
      .select('_id name regNo registerNumber departmentId department schoolId school semesterBatch batch section status totalPoints approvedSubmissions')
      .sort({ name: 1 })
      .lean();

    if (!students.length) {
      return sendSuccess(res, 200, 'Leaderboard fetched', {
        currentStudent: null,
        topThree: [],
        fullList: [],
      });
    }

    const studentIds = students.map((student) => student._id);
    const approvedStatuses = ['Approved', 'HODApproved', 'FacultyApproved'];
    const approvedRows = await Submission.aggregate([
      { $match: { status: { $in: approvedStatuses }, studentId: { $in: studentIds } } },
      { $group: { _id: '$studentId', totalApprovedPoints: { $sum: '$pointsAwarded' }, submissions: { $sum: 1 } } },
    ]);

    const pointsById = new Map(approvedRows.map((row) => [String(row._id), Number(row.totalApprovedPoints || 0)]));
    const submissionsById = new Map(approvedRows.map((row) => [String(row._id), Number(row.submissions || 0)]));

    const leaderboardEntries = students
      .map((student) => {
        // Prefer the gamification-synced totals (updated by gamificationService on every
        // faculty/HOD approval), falling back to live aggregation for unsynced records.
        const hasSynced = Number.isFinite(Number(student.totalPoints)) && Number(student.totalPoints) > 0;
        const totalApprovedPoints = hasSynced
          ? Number(student.totalPoints || 0)
          : pointsById.get(String(student._id)) || 0;
        const approvedCount = hasSynced
          ? Number(student.approvedSubmissions || 0)
          : submissionsById.get(String(student._id)) || 0;
        const regNo = student.registerNumber || student.regNo || 'N/A';
        const department = student.department || 'Unassigned';
        return {
          _id: student._id,
          name: student.name || 'Student',
          regNo,
          department,
          totalApprovedPoints,
          approvedSubmissions: approvedCount,
          isCurrentUser: String(student._id) === String(req.user.id),
        };
      })
      .sort((a, b) => b.totalApprovedPoints - a.totalApprovedPoints || a.name.localeCompare(b.name));

    let currentRank = 0;
    let previousPoints = null;
    leaderboardEntries.forEach((entry, index) => {
      if (previousPoints === null || entry.totalApprovedPoints !== previousPoints) {
        currentRank = index + 1;
        previousPoints = entry.totalApprovedPoints;
      }
      entry.rank = currentRank;
    });

    const currentStudentEntry = leaderboardEntries.find((entry) => entry.isCurrentUser) || null;
    const currentStudent = currentStudentEntry
      ? {
          rank: currentStudentEntry.rank,
          totalApprovedPoints: currentStudentEntry.totalApprovedPoints,
        }
      : null;

    const topThree = leaderboardEntries.slice(0, 3).map((entry) => ({
      rank: entry.rank,
      name: entry.name,
      regNo: entry.regNo,
      department: entry.department,
      totalApprovedPoints: entry.totalApprovedPoints,
      avatarInitial: (entry.name || 'S').trim().charAt(0).toUpperCase(),
      isCurrentUser: entry.isCurrentUser,
    }));

    const fullList = leaderboardEntries.map((entry) => ({
      rank: entry.rank,
      name: entry.name,
      regNo: entry.regNo,
      department: entry.department,
      totalApprovedPoints: entry.totalApprovedPoints,
      isCurrentUser: entry.isCurrentUser,
    }));

    const streak = await calculateStreak(req.user.id);

    return sendSuccess(res, 200, 'Leaderboard fetched', {
      currentStudent,
      topThree,
      fullList,
      streak,
      total: fullList.length,
    });
  } catch (error) {
    next(error);
  }
};

const getProgressCard = async (req, res, next) => {
  try {
    const student = await User.findById(req.user.id).select('-password');
    if (!student) return sendError(res, 404, 'Student profile not found');

    const submissions = await Submission.find({ studentId: req.user.id, status: 'Approved' })
      .populate('activityId', 'activityName vertical')
      .sort({ verifiedAt: -1 });

    const totalPoints = submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0);
    const byVertical = {};
    submissions.forEach((sub) => {
      const vertical = sub.activityId?.vertical || 'General';
      byVertical[vertical] = (byVertical[vertical] || 0) + (sub.pointsAwarded || 0);
    });
    const verticalRows = Object.entries(byVertical).sort((a, b) => b[1] - a[1]);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const filename = `progress-card-${student.registerNumber || student.regNo || 'student'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).fillColor('#111827').text('STARS-BCA Progress Card', { align: 'left' });
    doc.fontSize(9).fillColor('#6b7280').text('KPR College of Arts and Science · STAR Framework Management System', { align: 'left' });
    doc.moveDown(0.4);
    doc.moveTo(48, doc.y).lineTo(552, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.8);

    const details = [
      ['Name', student.name || '—'],
      ['Register Number', student.registerNumber || student.regNo || '—'],
      ['Department', student.department || '—'],
      ['School', student.school || '—'],
      ['Batch', student.semesterBatch || student.batch || '—'],
      ['Section', student.section || '—'],
      ['Academic Year', student.academicYear || '—'],
    ];
    details.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#6b7280').text(label.padEnd(18, ' '), { continued: true });
      doc.fillColor('#111827').text(value);
    });

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#6b7280').text(`Total Points: `, { continued: true }).fillColor('#111827').text(`${totalPoints}`);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#6b7280').text(`Approved Submissions: `, { continued: true }).fillColor('#111827').text(`${submissions.length}`);

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Points by Vertical');
    doc.moveDown(0.3);
    if (verticalRows.length) {
      verticalRows.forEach(([vertical, points]) => {
        doc.fontSize(10).fillColor('#6b7280').text(vertical.padEnd(52, ' '), { continued: true }).fillColor('#111827').text(`${points}`);
      });
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('No approved points yet.');
    }

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#111827').text('Approved Submissions');
    doc.moveDown(0.3);
    if (submissions.length) {
      submissions.slice(0, 30).forEach((sub, index) => {
        doc.fontSize(9).fillColor('#6b7280').text(`${index + 1}. `, { continued: true }).fillColor('#111827').text(
          `${sub.activityId?.activityName || 'Activity'} — ${sub.pointsAwarded || 0} pts`
        );
      });
    } else {
      doc.fontSize(10).fillColor('#6b7280').text('No approved submissions yet.');
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};

const studentValidators = {
  updateProfile: [
    body('name').optional().isString().withMessage('Name must be a string'),
    body('department').optional().isString().withMessage('Department must be a string'),
    body('school').optional().isString().withMessage('School must be a string'),
    body('section').optional().isString().withMessage('Section must be a string'),
    body('semesterBatch').optional().isString().withMessage('Semester batch must be a string'),
    body('phoneNumber').optional().isString().withMessage('Phone number must be a string'),
    body('dob').optional().isString().withMessage('Date of birth must be a string')
  ],
  submitActivity: [
    body('activityId')
      .notEmpty().withMessage('Activity ID is required')
      .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid activity ID'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('activityType').optional().isString().withMessage('Activity type must be a string'),
    body('visitType').optional().isString().withMessage('Visit type must be a string'),
    body('durationWeeks').optional().isString().withMessage('Duration must be a string'),
    body('projectUrl').optional().isString().withMessage('Project URL must be a string')
  ]
};

const getDeadlineAlerts = async (req, res, next) => {
  try {
    const alertWindowDays = Math.max(1, parseInt(process.env.DEADLINE_ALERT_WINDOW_DAYS || '7', 10) || 7);
    const now = Date.now();
    const dayMs = 86400000;

    const [activities, approved, studentUser] = await Promise.all([
      Activity.find({ deadline: { $ne: null } }).select('activityName vertical maximumPoints important deadline').lean(),
      Submission.find({ studentId: req.user.id, status: 'Approved' }).select('activityId').lean(),
      User.findById(req.user.id).select('dismissedDeadlines'),
    ]);
    const completedIds = new Set(approved.map((sub) => String(sub.activityId)));
    const dismissedIds = new Set((studentUser?.dismissedDeadlines || []).map((id) => String(id)));

    const alerts = [];
    for (const activity of activities) {
      if (completedIds.has(String(activity._id))) continue;
      if (dismissedIds.has(String(activity._id))) continue;
      const deadlineMs = new Date(activity.deadline).getTime();
      if (!Number.isFinite(deadlineMs)) continue;
      const daysLeft = Math.ceil((deadlineMs - now) / dayMs);
      if (daysLeft < 0 || daysLeft > alertWindowDays) continue;

      const tone = daysLeft < 0 ? 'overdue' : activity.important ? 'urgent' : 'warning';
      alerts.push({
        activityId: activity._id,
        activityName: activity.activityName,
        vertical: activity.vertical || '',
        maximumPoints: activity.maximumPoints || 0,
        deadline: activity.deadline,
        daysLeft,
        important: Boolean(activity.important),
        tone,
      });

      const existing = await Notification.findOne({ userId: req.user.id, type: 'deadline', link: String(activity._id) }).lean();
      if (!existing) {
        await Notification.create({
          userId: req.user.id,
          type: 'deadline',
          title: `${tone === 'overdue' ? 'Overdue' : 'Deadline approaching'}: ${activity.activityName}`,
          message: tone === 'overdue'
            ? `The deadline for this activity passed. Submit it as soon as possible to earn up to ${activity.maximumPoints || 0} points.`
            : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — submit evidence to earn up to ${activity.maximumPoints || 0} points.`,
          link: String(activity._id),
        });
      }
    }

    alerts.sort((a, b) => (a.tone === b.tone ? a.deadline - b.deadline : a.tone === 'overdue' ? -1 : b.tone === 'overdue' ? 1 : a.tone === 'urgent' ? -1 : 1));
    return sendSuccess(res, 200, 'Deadline alerts fetched', { alerts, windowDays: alertWindowDays });
  } catch (error) {
    next(error);
  }
};

const getPointsHistory = async (req, res, next) => {
  try {
    let student = await User.findById(req.user.id).select('pointsLedger totalPoints surplusPoints');
    if (!student) return sendError(res, 404, 'Student not found');

    if ((student.pointsLedger || []).length === 0) {
      student = await syncStudentPoints(req.user.id);
      if (!student) return sendError(res, 404, 'Student not found');
    }

    const ledger = (student.pointsLedger || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    return sendSuccess(res, 200, 'Points history fetched', {
      ledger,
      totalPoints: Math.min(student.totalPoints || 0, 200),
      surplusPoints: student.surplusPoints || 0,
    });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!notification) return sendError(res, 404, 'Notification not found');
    if (notification.type === 'deadline' && notification.link) {
      await User.updateOne(
        { _id: req.user.id },
        { $addToSet: { dismissedDeadlines: String(notification.link) } }
      );
    }
    return sendSuccess(res, 200, 'Notification removed', {});
  } catch (error) {
    next(error);
  }
};

const deleteNotifications = async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, 'No notifications selected');
    }
    const notifications = await Notification.find({ _id: { $in: ids }, userId: req.user.id }).select('type link').lean();
    const result = await Notification.deleteMany({ _id: { $in: ids }, userId: req.user.id });
    const dismissed = notifications
      .filter((n) => n.type === 'deadline' && n.link)
      .map((n) => String(n.link));
    if (dismissed.length > 0) {
      await User.updateOne({ _id: req.user.id }, { $addToSet: { dismissedDeadlines: { $each: dismissed } } });
    }
    return sendSuccess(res, 200, 'Notifications removed', { deletedCount: result.deletedCount || 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  submitActivity,
  resubmitActivity,
  getMySubmissions,
  getEarnedPoints,
  getActivities,
  appealSubmission,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteNotifications,
  getLeaderboard,
  getProgressCard,
  getDeadlineAlerts,
  getPointsHistory,
  studentValidators,
};
