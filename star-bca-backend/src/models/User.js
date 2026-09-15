const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const studentEmailPattern = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*@kprcas\.ac\.in$/;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    unique: true,
    validate: {
      validator(value) {
        return this.role !== 'student' || studentEmailPattern.test(value);
      },
      message: 'Student email must use a valid @kprcas.ac.in address',
    },
  },
  password: {
    type: String,
    required: true,
    default: function defaultPassword() {
      return this.role === 'student' ? this.registerNumber : undefined;
    },
  },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  accountType: { type: String, enum: ['dean', 'hod'], default: null },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  school: { type: String, trim: true, default: '' },
  department: { type: String, trim: true, default: '' },
  registerNumber: { type: String, trim: true, sparse: true, unique: true },
  year: { type: String, trim: true, default: '' },
  batch: { type: String, trim: true, default: '' },
  section: { type: String, trim: true, default: '' },
  phoneNumber: { type: String, trim: true, default: '' },
  dob: { type: String, trim: true, default: '' },
  assignedFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recommendedSchool: { type: String, trim: true, default: '' },
  recommendedDepartment: { type: String, trim: true, default: '' },
  recommendedFaculty: { type: String, trim: true, default: '' },
  academicYear: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  semesterLocked: { type: Boolean, default: false },
  semesterPercentage: { type: Number, default: 0, min: 0, max: 100 },
  attendancePercentage: { type: Number, default: 0, min: 0, max: 100 },
  libraryUsage: { type: Number, default: 0, min: 0 },
  totalPoints: { type: Number, default: 0, min: 0, max: 200 },
  surplusPoints: { type: Number, default: 0, min: 0 },
  approvedSubmissions: { type: Number, default: 0 },
  totalSubmissions: { type: Number, default: 0 },
  // Points ledger ??? individual transaction history
  pointsLedger: [{
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
    activityName: { type: String, default: '' },
    vertical: { type: String, default: '' },
    points: { type: Number, default: 0 },
    type: { type: String, enum: ['earned', 'adjusted', 'removed'], default: 'earned' },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  }],
  // Deadline alert activity ids the student removed ??? keeps them deleted from the DB
  dismissedDeadlines: [{ type: String, default: '' }],
}, { timestamps: true });

userSchema.index({ role: 1, accountType: 1, schoolId: 1, departmentId: 1 });
userSchema.index({ assignedFacultyId: 1 });

userSchema.pre('save', async function normalizeAndHashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

