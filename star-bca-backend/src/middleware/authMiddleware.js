const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { sendError } = require('../utils/response');

const normalizeRole = (role) => (role === 'teacher' ? 'faculty' : role);

// Short-TTL cache: absorbs post-login request stampedes (1000 students hitting
// dashboards at once would otherwise re-query users on EVERY request).
const AUTH_CACHE_TTL_MS = 30 * 1000;
const authCache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of authCache) {
    if (entry.expiresAt <= now) authCache.delete(key);
  }
}, 30 * 1000).unref();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    const cached = authCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      req.user = cached.user;
      return next();
    }

    const decoded = verifyToken(token);
    const role = normalizeRole(decoded.role);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) return sendError(res, 401, 'User not found');
    if (user.role !== role && !(decoded.role === 'teacher' && user.role === 'faculty')) {
      return sendError(res, 401, 'User not found');
    }

    req.user = { ...user.toObject(), id: user._id, role: user.role };
    authCache.set(token, { user: req.user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    next();
  } catch (error) {
    return sendError(res, 401, 'Invalid or expired token');
  }
};

module.exports = authMiddleware;
