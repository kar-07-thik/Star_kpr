const assert = require('assert');

(async () => {
  const analyticsResponse = await fetch('http://127.0.0.1:3000/api/admin/analytics', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  const analyticsData = await analyticsResponse.json().catch(() => ({}));
  assert.strictEqual(analyticsResponse.status, 401, 'Analytics endpoint should reject invalid auth');
  assert.ok(analyticsData.message, 'Analytics response should include a message');
  console.log('Admin analytics endpoint guard check passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
                                                                