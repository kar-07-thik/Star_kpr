const normalizeHeader = (header) => String(header || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const compactHeader = (header) => normalizeHeader(header).replace(/\s+/g, '');

const HEADER_ALIASES = {
  name: ['name', 'studentname', 'fullname'],
  registerNumber: ['regno', 'regnumber', 'registernumber', 'studentid'],
  email: ['email', 'emailid', 'emailaddress'],
  password: ['password', 'pwd'],
  section: ['section'],
  year: ['year', 'yearlevel', 'studyyear', 'studyear'],
  batch: ['batch', 'sectionbatch'],
};

const HEADER_TO_FIELD = Object.entries(HEADER_ALIASES).reduce((map, [field, aliases]) => {
  aliases.forEach((alias) => { map[compactHeader(alias)] = field; });
  return map;
}, {});

const canonicalField = (header) => HEADER_TO_FIELD[compactHeader(header)] || normalizeHeader(header);

const normalizeBulkRow = (row = {}) => Object.entries(row || {}).reduce((accumulator, [key, value]) => {
  accumulator[canonicalField(key)] = value;
  return accumulator;
}, {});

const parseBulkStudentRows = (worksheet, XLSX) => {
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false }) || [];
  const headerIndex = matrix.findIndex((row) => {
    const fields = row.map((header) => canonicalField(header));
    return fields.includes('name') && fields.includes('registerNumber') && fields.includes('email');
  });

  if (headerIndex < 0) {
    return { rows: [], headerIndex: -1, headers: matrix[0] || [] };
  }

  const headers = matrix[headerIndex];
  const rows = matrix.slice(headerIndex + 1).map((values, index) => ({
    row: headers.reduce((record, header, columnIndex) => {
      record[header] = values[columnIndex] ?? '';
      return record;
    }, {}),
    rowNumber: headerIndex + index + 2,
  }));

  return { rows, headerIndex, headers };
};

const parseBulkUpdateRows = (worksheet, XLSX) => {
  const parsed = parseBulkStudentRows(worksheet, XLSX);
  const requiredFields = ['name', 'registerNumber', 'email', 'password', 'section', 'year', 'batch'];
  const headers = [...(parsed.headers || [])];
  while (headers.length && String(headers[headers.length - 1] || '').trim() === '') headers.pop();
  const fields = headers.map((header) => canonicalField(header));
  const hasExactFormat = parsed.headerIndex >= 0
    && fields.length === requiredFields.length
    && requiredFields.every((field, index) => fields[index] === field);
  return hasExactFormat ? parsed : { ...parsed, headerIndex: -1 };
};

const getValue = (row, candidates = []) => {
  for (const candidate of candidates) {
    const value = row?.[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const isEmptyRow = (row = {}) => {
  return Object.values(row || {}).every((value) => {
    if (value === undefined || value === null) return true;
    return String(value).trim() === '';
  });
};

const getRequiredValidationErrors = (row = {}) => {
  const normalizedRow = normalizeBulkRow(row);
  const name = getValue(normalizedRow, ['name']);
  const registerNumber = getValue(normalizedRow, ['registerNumber']);
  const email = getValue(normalizedRow, ['email']);
  const errors = [];

  if (!String(name).trim()) errors.push('Name is required (accepted headers: name, student name)');
  if (!String(registerNumber).trim()) errors.push('Register number is required (accepted headers: reg no, register number)');
  if (!String(email).trim()) errors.push('Email is required (accepted header: email)');

  return errors;
};

module.exports = {
  normalizeBulkRow,
  parseBulkStudentRows,
  parseBulkUpdateRows,
  getValue,
  isEmptyRow,
  getRequiredValidationErrors,
};
