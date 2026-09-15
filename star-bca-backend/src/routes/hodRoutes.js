const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const {
  getFacultyApprovedSubmissions,
  getSubmissionDetails,
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
} = require('../controllers/hodController');

const router = express.Router();

router.use(authMiddleware, allowRoles('admin'));
router.use((req, res, next) => {
  if (req.user.accountType !== 'hod') return res.status(403).json({ success: false, message: 'HOD access only' });
  next();
});

router.get('/dashboard', getDashboardStats);
router.get('/submissions/pending', getFacultyApprovedSubmissions);
router.get('/submissions/export', exportSubmissions);
router.put('/semester/lock', lockSemester);
router.put('/semester/unlock', unlockSemester);
router.get('/semester/status', getSemesterStatus);
router.get('/leaderboard', getDepartmentLeaderboard);
router.get('/at-risk', getAtRiskStudents);
router.get('/leaderboard/export', exportLeaderboard);
router.get('/faculty/export', exportFacultyOverview);
router.get('/faculty', getFacultyOverview);
router.get('/students/:id/overview', getStudentOverview);

module.exports = router;
