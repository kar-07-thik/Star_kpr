const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  action: { type: String, required: true },
  entityType: { type: String, default: '' },
  entityId: { type: mongoose.Schema.Types.Mixed, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);