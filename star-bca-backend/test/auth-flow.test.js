const assert = require('assert');

async function request(path, payload) {
  const response = await fetch(`http://127.0.0.1:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return { status: response.status, data };
}

(async () => {
  const health = await fetch('http://127.0.0.1:3000/health');
  assert.strictEqual(health.status, 200, 'Backend health check should succeed');

  const studentLogin = await request('/api/auth/student/login', {
    registerNumber: '2023BCA001',
    password: '123456',
  });
  assert.strictEqual(studentLogin.status, 200, 'Student login should succeed');
  assert.ok(studentLogin.data?.data?.token, 'Student login should return a token');

  const teacherLogin = await request('/api/auth/teacher/login', {
    email: 'priya@star.com',
    password: '123456',
  });
  assert.strictEqual(teacherLogin.status, 200, 'Faculty login should succeed');

  const adminLogin = await request('/api/auth/admin/login', {
    email: 'rajesh@star.com',
    password: '123456',
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');

  console.log('Auth smoke test passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
