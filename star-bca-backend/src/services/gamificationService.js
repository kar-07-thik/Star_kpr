const User = require('../models/User');
const Submission = require('../models/Submission');

const EARNED_STATUSES = ['FacultyApproved', 'Approved'];
const MAX_TOTAL_POINTS = 200;

const studentLocks = new Map();

// Serialize syncs per student so concurrent approvals for the same student
// cannot read-modify-write User.totalPoints/pointsLedger out of order.
function withStudentLock(studentId, task) {
  const key = String(studentId);
  const previous = studentLocks.get(key) || Promise.resolve();
  const next = previous.then(task, task);
  studentLocks.set(
    key,
    next.catch((error) => {
      console.error(`[syncStudentPoints] ${key} failed in queue:`, error);
    })
  );
  return next;
}

// Rebuild the student's totalPoints and pointsLedger from their earned submissions.
// Keeps User.totalPoints / pointsLedger in sync with the Submission aggregates used
// by the dashboard, leaderboard and points ledger page.
async function syncStudentPoints(studentId) {
  return withStudentLock(studentId, async () => {
    try {
      const student = await User.findById(studentId);
      if (!student || student.role !== 'student') return null;

      const submissions = await Submission.find({ studentId, status: { $in: EARNED_STATUSES } })
        .populate('activityId', 'activityName vertical')
        .sort({ verifiedAt: -1 });

      const earnedPoints = submissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0);
      const totalPoints = Math.min(earnedPoints, MAX_TOTAL_POINTS);
      const surplusPoints = Math.max(0, earnedPoints - MAX_TOTAL_POINTS);

      const ledgerMap = new Map((student.pointsLedger || []).map((e) => [String(e.submissionId || ''), e]));

      const ledger = submissions.map((s) => {
        const prior = ledgerMap.get(String(s._id));
        return {
          submissionId: s._id,
          activityName: s.activityId?.activityName || prior?.activityName || 'Activity',
          vertical: s.activityId?.vertical || prior?.vertical || '',
          points: s.pointsAwarded || 0,
          type: 'earned',
          note: s.teacherRemarks || prior?.note || '',
          date: s.verifiedAt || s.createdAt || new Date(),
        };
      });

      student.totalPoints = totalPoints;
      student.surplusPoints = surplusPoints;
      student.approvedSubmissions = submissions.length;
      student.totalSubmissions = await Submission.countDocuments({ studentId });
      student.pointsLedger = ledger;
      await student.save();

      return student;
    } catch (error) {
      console.error('Error syncing student points:', error);
      return null;
    }
  });
}

module.exports = {
  EARNED_STATUSES,
  MAX_TOTAL_POINTS,
  syncStudentPoints,
};
