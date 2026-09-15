const Notification = require('../models/Notification');
const User = require('../models/User');
const Activity = require('../models/Activity');
const emailService = require('../services/emailService');

async function createNotification({ userId, type = 'system', title, message = '', link = '' }) {
  if (!userId) return null;
  try {
    return await Notification.create({ userId, type, title, message, link });
  } catch (error) {
    console.error('[notify] createNotification failed:', error.message);
    return null;
  }
}

async function notifySubmissionStatus({ submission, action, actorName = '' }) {
  try {
    const student = await User.findById(submission.studentId).select('name email');
    if (!student) return;
    const activity = await Activity.findById(submission.activityId).select('activityName');
    const activityName = activity?.activityName || 'Activity';

    let title = '';
    let message = '';
    switch (action) {
      case 'faculty-approved':
        title = 'Submission approved by faculty';
        message = `Your submission for "${activityName}" was approved by ${actorName || 'your faculty'} and is now awaiting HOD verification.`;
        break;
      case 'rejected':
        title = 'Submission rejected';
        message = `Your submission for "${activityName}" was rejected by ${actorName || 'your faculty'}. ${submission.teacherRemarks ? `Reason: ${submission.teacherRemarks}` : 'Please review the feedback and resubmit.'}`;
        break;
      case 'hod-approved':
        title = 'Submission fully approved';
        message = `Your submission for "${activityName}" was approved by the HOD. ${submission.pointsAwarded ? `${submission.pointsAwarded} points have been awarded.` : ''}`;
        break;
      case 'hod-rejected':
        title = 'Submission rejected by HOD';
        message = `Your submission for "${activityName}" was rejected by the HOD. ${submission.hodRemarks ? `Reason: ${submission.hodRemarks}` : 'Please review the feedback and resubmit.'}`;
        break;
      case 'appealed':
        title = 'Appeal submitted';
        message = `Your appeal for "${activityName}" has been submitted and is back with your faculty for review.`;
        break;
      default:
        return;
    }

    await Notification.create({
      userId: student._id,
      type: 'submission',
      title,
      message,
      link: '/student/submissions',
    });

    emailService.sendStatusEmail({
      userId: student._id,
      subject: title,
      message,
      link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/student/submissions`,
    }).catch(() => {});
  } catch (error) {
    console.error('[notifySubmissionStatus] failed:', error.message);
  }
}

module.exports = { createNotification, notifySubmissionStatus };