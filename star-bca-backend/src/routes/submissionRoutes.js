const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');
const { getAllSubmissions, getSubmissionFile } = require('../controllers/submissionController');

const router = express.Router();

router.get('/:id/file', authMiddleware, getSubmissionFile);
router.use(authMiddleware, allowRoles('faculty', 'teacher'));
router.get('/', getAllSubmissions);

module.exports = router;
