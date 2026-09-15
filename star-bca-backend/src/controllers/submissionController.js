const Submission = require('../models/Submission');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/response');

const getAllSubmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search || '';

    const facultyStudents = await User.find({ role: 'student', assignedFacultyId: req.user.id }).select('_id');
    const allowedStudentIds = facultyStudents.map((student) => student._id);
    const query = { studentId: { $in: allowedStudentIds } };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { teacherRemarks: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const submissions = await Submission.find(query)
      .populate('studentId', 'name regNo department semesterBatch section')
      .populate('activityId', 'activityName maximumPoints')
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const sanitizedSubmissions = submissions.map((submission) => {
      const plainObject = submission?.toObject ? submission.toObject() : { ...submission };
      if (plainObject.certificateFile && typeof plainObject.certificateFile === 'object' && plainObject.certificateFile.data) {
        plainObject.certificateFile = {
          fileName: plainObject.certificateFile.fileName || '',
          contentType: plainObject.certificateFile.contentType || '',
          size: plainObject.certificateFile.size || plainObject.certificateFile.data.length || 0,
        };
      }
      return plainObject;
    });

    const total = await Submission.countDocuments(query);

    return sendSuccess(res, 200, 'Submissions fetched successfully', { submissions: sanitizedSubmissions, total, page, limit });
  } catch (error) {
    next(error);
  }
};

const getSubmissionFile = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return sendError(res, 404, 'Submission not found');
    }

    if (req.user.role === 'student' && submission.studentId.toString() !== req.user.id.toString()) {
      return sendError(res, 403, 'Access denied');
    }

    if (req.user.role === 'faculty' || req.user.role === 'teacher') {
      const student = await User.findById(submission.studentId).select('assignedFacultyId');
      if (!student || student.assignedFacultyId?.toString() !== req.user.id.toString()) {
        return sendError(res, 403, 'Only the recommended faculty can access this file');
      }
    }

    const fileRecord = submission.certificateFile;
    if (!fileRecord || !fileRecord.url) {
      return sendError(res, 404, 'No submission file found in Cloudinary');
    }

    return res.redirect(fileRecord.url);
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllSubmissions, getSubmissionFile };
