const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const { getPendingSubmissions, exportSubmissions, getSubmissionDetails, approveSubmission, rejectSubmission, bulkApproveSubmissions, bulkRejectSubmissions, getDashboardStats, getAnalytics, runAiReview, applyAiReview, getAcademicMetricsRegNos, downloadAcademicMetricsTemplate, downloadAcademicMetricsCsvTemplate, bulkUploadAcademicMetrics, getScoreboard, generatePdfReport, autoApproveByAi, getStudentAcademicRecords, updateAcademicRecord, deleteAcademicRecord, getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteNotifications, getStudentVerticalPerformance } = require('../controllers/teacherController');

const router = express.Router();

router.use(authMiddleware, allowRoles('faculty', 'teacher'));

router.get('/submissions/pending', getPendingSubmissions);
router.get('/submissions/export', exportSubmissions);
router.post('/submissions/bulk-approve', bulkApproveSubmissions);
router.post('/submissions/bulk-reject', bulkRejectSubmissions);
router.post('/submissions/auto-approve-ai', autoApproveByAi);
router.get('/submission/:id', getSubmissionDetails);
router.put('/submission/:id/approve', approveSubmission);
router.put('/submission/:id/reject', rejectSubmission);
router.post('/submission/:id/ai-review', runAiReview);
router.post('/submission/:id/ai-apply', applyAiReview);
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);
router.get('/vertical-performance', getStudentVerticalPerformance);
router.get('/academic-metrics/reg-nos', getAcademicMetricsRegNos);
router.get('/academic-metrics/template', downloadAcademicMetricsTemplate);
router.get('/academic-metrics/template-csv', downloadAcademicMetricsCsvTemplate);
router.post('/academic-metrics/bulk-upload', bulkUploadAcademicMetrics);
router.get('/academic-records', getStudentAcademicRecords);
router.put('/academic-records/:id', updateAcademicRecord);
router.delete('/academic-records/:id', deleteAcademicRecord);
router.get('/scoreboard', getScoreboard);
router.get('/reports/pdf', generatePdfReport);
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);
router.put('/notifications/read-all', markAllNotificationsRead);
router.delete('/notifications/:id', deleteNotification);
router.delete('/notifications', deleteNotifications);

module.exports = router;
