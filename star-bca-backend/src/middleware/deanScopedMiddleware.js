const { sendError } = require('../utils/response');

const deanReadOnlyRoutes = new Set([
  '/analytics',
  '/analytics/export',
  '/lookups',
  '/activities',
  '/audit-logs',
  '/academic-year',
  '/bulk-upload/template',
  '/users',
  '/department-stats',
  '/report',
  '/ai/department-summary',
  '/dean/stats',
  '/dean/departments-performance',
]);

const deanWriteRoutes = new Set([
  '/departments',
  '/users',
  '/users/bulk-upload',
  '/academic-year',
]);

const normalizeDeanRoute = (req) => {
  const rawPath = (req.path || req.originalUrl || '').split('?')[0];

  const candidates = new Set([rawPath]);
  if (rawPath) {
    candidates.add(rawPath.replace(/^\/api\/admin/, ''));
    candidates.add(rawPath.replace(/^\/api\/[a-z]+/, ''));
    candidates.add(rawPath.replace(/^\/admin/, ''));
  }

  const normalized = [...candidates]
    .filter(Boolean)
    .map((pathname) => pathname.replace(/\/+$/, '') || '/');

  return normalized;
};

const deanScopedMiddleware = (req, res, next) => {
  if (!req.user) return sendError(res, 401, 'Authentication required');
  if (req.user.accountType !== 'dean') return next();

  const method = req.method.toUpperCase();
  const routeCandidates = normalizeDeanRoute(req);

  const isReadOnlyDeanRoute = routeCandidates.some((pathname) => {
    if (deanReadOnlyRoutes.has(pathname)) return true;
    if (pathname.startsWith('/users/') && method === 'GET') return true;
    if (pathname.startsWith('/dean/departments/') && method === 'GET' && (
      pathname.endsWith('/year-performance') ||
      pathname.endsWith('/top-performers') ||
      pathname.endsWith('/student-performance')
    )) return true;
    return false;
  });

  const isAllowedWriteRoute = routeCandidates.some((pathname) => {
    if (pathname === '/departments' || pathname === '/users' || pathname === '/users/bulk-upload') return true;
    if (pathname === '/activities' || pathname.startsWith('/activities/')) return true;
    if (pathname === '/academic-year' || pathname.startsWith('/academic-year/')) return true;
    if (pathname === '/audit-logs' || pathname.startsWith('/audit-logs/')) return true;
    if (pathname === '/users/bulk-assign-faculty') return true;
    if (pathname.startsWith('/departments/') && (method === 'PUT' || method === 'DELETE')) return true;
    if (pathname.startsWith('/users/') && (method === 'PUT' || method === 'DELETE' || method === 'POST')) return true;
    if (pathname.startsWith('/dean/departments/') && method === 'GET') return true;
    return false;
  });

  const allowed =
    (method === 'GET' && isReadOnlyDeanRoute) ||
    (method === 'POST' && isAllowedWriteRoute) ||
    (method === 'PUT' && isAllowedWriteRoute) ||
    (method === 'DELETE' && isAllowedWriteRoute);

  if (!allowed) {
    return sendError(res, 403, 'Dean accounts can only manage departments and HODs');
  }

  next();
};

module.exports = deanScopedMiddleware;
