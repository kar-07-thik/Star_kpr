const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const deanScopedMiddleware = require('../middleware/deanScopedMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getUsers, exportUsers, getUserById, createDepartment, updateDepartment, deleteDepartment, resetPassword, getAnalytics, getLookups, createBulkUsers, bulkUpdateUsers, createUser, updateUser, deleteUser, bulkDeleteUsers, listActivities, createActivity, updateActivity, deleteActivity, exportAnalytics, downloadBulkTemplate, getAuditLogs, deleteAuditLog, clearAuditLogs, getAcademicSettings, updateAcademicSettings, rolloverAcademicYear, getDeanStats, getDeanDepartmentsPerformance, getDeanDepartmentYearPerformance, getDeanTopPerformers, getDeanDepartmentStudentPerformance, exportAdminReport, getDepartmentStats, bulkAssignFaculty, getDepartmentAiSummary } = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware, allowRoles('admin'));
router.use(deanScopedMiddleware);

router.get('/analytics', getAnalytics);
router.get('/analytics/export', exportAnalytics);
router.get('/lookups', getLookups);
router.get('/bulk-upload/template', downloadBulkTemplate);
router.get('/audit-logs', getAuditLogs);
router.delete('/audit-logs/:id', deleteAuditLog);
router.delete('/audit-logs', clearAuditLogs);
router.get('/academic-year', getAcademicSettings);
router.put('/academic-year', updateAcademicSettings);
router.post('/academic-year/rollover', rolloverAcademicYear);
router.get('/report', exportAdminReport);
router.get('/department-stats', getDepartmentStats);
router.get('/ai/department-summary', getDepartmentAiSummary);

// Dean-specific routes
router.get('/dean/stats', getDeanStats);
router.get('/dean/departments-performance', getDeanDepartmentsPerformance);
router.get('/dean/departments/:departmentId/year-performance', getDeanDepartmentYearPerformance);
router.get('/dean/departments/:departmentId/student-performance', getDeanDepartmentStudentPerformance);
router.get('/dean/departments/:departmentId/top-performers', getDeanTopPerformers);

router.get('/activities', listActivities);
router.post('/activities', createActivity);
router.put('/activities/:id', updateActivity);
router.delete('/activities/:id', deleteActivity);
router.get('/users', getUsers);
router.get('/users/export', exportUsers);
router.get('/users/:id', getUserById);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);
router.delete('/departments/:id', deleteDepartment);
router.post('/users', createUser);
router.post('/users/bulk-upload', upload.single('file'), createBulkUsers);
router.put('/users/bulk-update', upload.single('file'), bulkUpdateUsers);
router.post('/users/bulk-assign-faculty', upload.single('file'), bulkAssignFaculty);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/bulk-delete', bulkDeleteUsers);
router.put('/users/:id/reset-password', resetPassword);

module.exports = router;
