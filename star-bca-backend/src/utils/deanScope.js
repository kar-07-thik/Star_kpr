const normalizeDepartmentPayload = (payload = {}) => ({
  name: `${payload.name || ''}`.trim(),
  code: `${payload.code || ''}`.trim().toUpperCase(),
  schoolId: `${payload.schoolId || ''}`.trim(),
  status: payload.status || 'Active',
});

const validateDepartmentPayload = (payload, req) => {
  const normalized = normalizeDepartmentPayload(payload);
  const errors = [];

  if (!normalized.name) {
    errors.push('Department name is required');
  }

  if (!normalized.code) {
    errors.push('Department code is required');
  }

  if (!normalized.schoolId) {
    errors.push('School is required');
  }

  if (req?.user?.accountType === 'dean' && req?.user?.schoolId && normalized.schoolId && normalized.schoolId !== req.user.schoolId.toString()) {
    errors.push('Dean accounts can only manage departments in their own school');
  }

  return { ok: errors.length === 0, errors, normalized };
};

module.exports = {
  normalizeDepartmentPayload,
  validateDepartmentPayload,
};
