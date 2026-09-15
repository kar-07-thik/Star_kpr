const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getProfile, updateProfile, submitActivity, resubmitActivity, getMySubmissions, getEarnedPoints, getActivities, appealSubmission, getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteNotifications, getLeaderboard, getProgressCard, getDeadlineAlerts, getPointsHistory, studentValidators } = require('../controllers/studentController');
const { getSubmissionFile } = require('../controllers/submissionController');

const router = express.Router();

router.use(authMiddleware, allowRoles('student'));

router.get('/profile', getProfile);
router.put('/profile', studentValidators.updateProfile, updateProfile);
router.get('/activities', getActivities);
router.post('/submission', upload.single('certificateFile'), studentValidators.submitActivity, submitActivity);
router.put('/submission/:id/resubmit', upload.single('certificateFile'), resubmitActivity);
router.post('/submission/:id/appeal', appealSubmission);
router.get('/submission/:id/file', getSubmissionFile);
router.get('/submissions', getMySubmissions);
router.get('/points', getEarnedPoints);
router.get('/leaderboard', getLeaderboard);
router.get('/progress-card', getProgressCard);
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);
router.put('/notifications/read-all', markAllNotificationsRead);
router.delete('/notifications/:id', deleteNotification);
router.delete('/notifications', deleteNotifications);
router.get('/deadline-alerts', getDeadlineAlerts);
router.get('/points-history', getPointsHistory);

module.exports = router;
