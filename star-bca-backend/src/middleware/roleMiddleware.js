const { sendError } = require('../utils/response');

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required');
  }

  const normalizedRole = req.user.role === 'teacher' ? 'faculty' : req.user.role;
  const canAccess = roles.includes(normalizedRole) || roles.includes(req.user.role) || (roles.includes('teacher') && normalizedRole === 'faculty');

  if (!canAccess) {
    return sendError(res, 403, 'Access denied');
  }

  next();
};

module.exports = allowRoles;
