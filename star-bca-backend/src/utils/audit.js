const AuditLog = require('../models/AuditLog');

async function logAudit(req, { action, entityType = '', entityId = null, details = {} }) {
  try {
    const user = req?.user || {};
    await AuditLog.create({
      actorId: user.id || user._id || null,
      actorName: user.name || '',
      actorRole: user.role || user.accountType || '',
      action,
      entityType,
      entityId,
      details,
    });
  } catch (error) {
    console.error('[audit] logAudit failed:', error.message);
  }
}

module.exports = { logAudit };