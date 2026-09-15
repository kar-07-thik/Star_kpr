const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  code: { type: String, trim: true, uppercase: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

departmentSchema.index({ schoolId: 1, name: 1 }, { unique: true });
departmentSchema.index({ schoolId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
