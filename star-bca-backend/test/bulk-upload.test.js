const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBulkRow, isEmptyRow, getRequiredValidationErrors } = require('../src/utils/bulkUploadUtils');

test('normalizes sheet rows and detects missing required fields', () => {
  const row = { Name: 'Ava', 'Register Number': 'R001', Email: 'ava@example.com' };

  assert.deepEqual(normalizeBulkRow(row), {
    name: 'Ava',
    'register number': 'R001',
    email: 'ava@example.com',
  });
  assert.equal(isEmptyRow({ Name: '', Email: '   ' }), true);
  assert.deepEqual(getRequiredValidationErrors({ name: 'Ava' }), [
    'Register number is required',
    'Email is required',
  ]);
});
