const mongoose = require('mongoose');

const aiReviewSchema = new mongoose.Schema({
  provider: { type: String, default: '' },
  model: { type: String, default: '' },
  recommendation: { type: String, enum: ['Approve', 'Reject', 'Review'], default: 'Review' },
  suggestedPoints: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
  reasoning: { type: String, default: '' },
  flags: { type: [String], default: [] },
  reviewedAt: { type: Date, default: null },
}, { _id: false });

const appealSchema = new mongoose.Schema({
  reason: { type: String, default: '' },
  status: { type: String, enum: ['None', 'Appealed', 'Resolved'], default: 'None' },
  appealedAt: { type: Date, default: null },
  resolution: { type: String, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
}, { _id: false });

const certificateFileSchema = new mongoose.Schema({
  fileName: { type: String, default: '' },
  contentType: { type: String, default: '' },
  url: { type: String, default: '' },
  publicId: { type: String, default: '' },
  size: { type: Number, default: 0 },
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  activityType: { type: String, trim: true, default: '' },
  visitType: { type: String, trim: true, default: '' },
  durationWeeks: { type: String, trim: true, default: '' },
  projectUrl: { type: String, trim: true, default: '' },
  certificateFile: { type: certificateFileSchema, default: null },
  proofUrl: { type: String, default: '' },
  selectedLevel: { type: String, trim: true, default: '' },
  tierIndex: { type: Number, min: 0, default: null },
  tierLabel: { type: String, trim: true, default: '' },
  description: { type: String, trim: true },
  studentInputData: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['Pending', 'FacultyApproved', 'HODApproved', 'Approved', 'Rejected', 'HODRejected'], default: 'Pending' },
  teacherRemarks: { type: String, default: '' },
  suggestedPoints: { type: Number, default: 0 },
  pointsAwarded: { type: Number, default: 0 },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date, default: null },
  aiReview: { type: aiReviewSchema, default: null },
  appeal: { type: appealSchema, default: () => ({ status: 'None' }) },
  academicYear: { type: String, trim: true, default: '' },
}, { timestamps: true });

submissionSchema.index({ studentId: 1, status: 1 });
submissionSchema.index(
  { studentId: 1, activityId: 1, tierIndex: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['Pending', 'FacultyApproved', 'HODApproved', 'Approved'] },
      tierIndex: { $type: 'number' },
    },
  }
);

module.exports = mongoose.model('Submission', submissionSchema);
