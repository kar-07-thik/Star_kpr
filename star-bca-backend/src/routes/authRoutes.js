const express = require('express');
const rateLimit = require('express-rate-limit');
const { loginStudent, loginTeacher, loginAdmin, registerTeacher, registerStudent, authValidators } = require('../controllers/authController');

const router = express.Router();

// Campus-ready strategy: shared college Wi-Fi/NAT means hundreds of students
// share one public IP — so brute-force limits key on the ACCOUNT being tried.
// Custom tracker: counts only FAILED attempts (successes refunded immediately),
// which avoids the burst-race where instant spikes exhaust a shared counter.
const failedLoginTracker = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failedLoginTracker) {
    if (entry.resetAt <= now) failedLoginTracker.delete(key);
  }
}, 60 * 1000).unref();

const MAX_FAILED_PER_ACCOUNT = 10;
const FAILED_WINDOW_MS = 15 * 60 * 1000;

const loginAccountLimiter = (req, res, next) => {
  const id = String(req.body?.email || '').trim().toLowerCase();
  if (!id) return next();
  const key = `${req.ip}:${id}`;
  const now = Date.now();
  let entry = failedLoginTracker.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + FAILED_WINDOW_MS };
    failedLoginTracker.set(key, entry);
  }
  if (entry.count >= MAX_FAILED_PER_ACCOUNT) {
    return res.status(429).json({ success: false, message: 'Too many failed attempts for this account. Please try again in 15 minutes.' });
  }
  entry.count += 1;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && body?.success !== false && entry.count > 0) {
      entry.count -= 1;
    }
    return originalJson(body);
  };
  next();
};

const loginIpCeiling = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this network. Please try again shortly.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registrations. Please try again later.' },
});

router.post('/student/login', loginIpCeiling, loginAccountLimiter, authValidators.loginStudent, loginStudent);
router.post('/teacher/login', loginIpCeiling, loginAccountLimiter, authValidators.loginTeacher, loginTeacher);
router.post('/admin/login', loginIpCeiling, loginAccountLimiter, authValidators.loginAdmin, loginAdmin);

router.post('/teacher/register', registerLimiter, registerTeacher);
router.post('/student/register', registerLimiter, registerStudent);

module.exports = router;
