const assert = require('assert');
const test = require('node:test');
const deanScopedMiddleware = require('../src/middleware/deanScopedMiddleware');
const { validateDepartmentPayload } = require('../src/utils/deanScope');

test('dean department validation blocks cross-school assignment', () => {
  const req = { user: { accountType: 'dean', schoolId: 'school-1' } };
  const result = validateDepartmentPayload({ name: 'Computer Science', code: 'CS', schoolId: 'school-2' }, req);

  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('their own school')));
});

test('dean department validation accepts matching school assignment', () => {
  const req = { user: { accountType: 'dean', schoolId: 'school-1' } };
  const result = validateDepartmentPayload({ name: 'Computer Science', code: 'CS', schoolId: 'school-1' }, req);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.normalized.code, 'CS');
});

test('dean dashboard read-only routes remain allowed even when mounted under /api/admin', () => {
  let nextCalled = false;
  const req = {
    method: 'GET',
    path: '/api/admin/dean/stats',
    originalUrl: '/api/admin/dean/stats',
    user: { accountType: 'dean', schoolId: 'school-1' },
  };
  const res = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  deanScopedMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.notStrictEqual(res.statusCode, 403);
});

test('dean unsupported mutation routes remain blocked', () => {
  let nextCalled = false;
  const req = {
    method: 'PATCH',
    path: '/api/admin/analytics',
    originalUrl: '/api/admin/analytics',
    user: { accountType: 'dean', schoolId: 'school-1' },
  };
  const res = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  deanScopedMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
});

test('dean department student performance route remains allowed for read-only analytics', () => {
  let nextCalled = false;
  const req = {
    method: 'GET',
    path: '/api/admin/dean/departments/department-123/student-performance',
    originalUrl: '/api/admin/dean/departments/department-123/student-performance',
    user: { accountType: 'dean', schoolId: 'school-1' },
  };
  const res = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  deanScopedMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.notStrictEqual(res.statusCode, 403);
});
