const User = require('../models/User');
const Submission = require('../models/Submission');
const { complete, getProvider } = require('./llmService');

const SUMMARY_SYSTEM_PROMPT = `You are an academic analytics assistant for a college. Summarize department performance data in 3-4 concise sentences for a dean or principal. Highlight the best performing department, any department with a high rejection rate, and overall trends.`;

// Build department performance rows (points, submissions, rejection rate) from
// approved/rejected submissions within the given scope.
async function computeDepartmentStats({ schoolId, departmentId } = {}) {
  const studentQuery = { role: 'student', status: 'Active' };
  if (departmentId) studentQuery.departmentId = departmentId;
  if (schoolId) studentQuery.schoolId = schoolId;

  const students = await User.find(studentQuery).select('departmentId department').lean();
  const studentIds = students.map((s) => s._id);

  const [pointRows, rejectedRows] = await Promise.all([
    Submission.aggregate([
      { $match: { status: 'Approved', studentId: { $in: studentIds } } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$student.department', totalPoints: { $sum: '$pointsAwarded' }, submissions: { $sum: 1 }, avgPoints: { $avg: '$pointsAwarded' } } },
    ]),
    Submission.aggregate([
      { $match: { status: 'Rejected', studentId: { $in: studentIds } } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$student.department', rejected: { $sum: 1 } } },
    ]),
  ]);

  const rejMap = new Map(rejectedRows.map((row) => [row._id, row.rejected]));
  return pointRows.map((row) => ({
    department: row._id || 'Unknown',
    totalPoints: row.totalPoints || 0,
    submissions: row.submissions || 0,
    avgPoints: Math.round((row.avgPoints || 0) * 10) / 10,
    rejected: rejMap.get(row._id) || 0,
    rejectionRate: row.submissions > 0 ? Math.round(((rejMap.get(row._id) || 0) / row.submissions) * 100) : 0,
  }));
}

function ruleBasedSummary(departments) {
  const top = [...departments].sort((a, b) => b.totalPoints - a.totalPoints)[0];
  const highRejection = departments.filter((d) => d.rejectionRate > 30);
  if (!top) return 'No submission data available yet to generate a summary.';
  return `${top.department} is the top performing department with ${top.totalPoints} total points and ${top.submissions} approved submissions.${highRejection.length ? ` ${highRejection.map((d) => d.department).join(', ')} ${highRejection.length === 1 ? 'has' : 'have'} a high rejection rate above 30% â€” evidence quality may need attention.` : ' Overall submission quality looks good.'}`;
}

// Single purpose: generate a natural-language summary of department performance,
// falling back to the rule engine when no AI provider is configured or fails.
async function generateDepartmentSummary({ schoolId, departmentId } = {}) {
  const departments = await computeDepartmentStats({ schoolId, departmentId });
  const provider = getProvider();

  if (!provider) {
    return { summary: ruleBasedSummary(departments), provider: 'rule-engine' };
  }

  const summaryData = JSON.stringify(departments.slice(0, 10));
  try {
    const result = await complete({
      system: SUMMARY_SYSTEM_PROMPT,
      user: `Summarize this department performance data:\n${summaryData}`,
      temperature: 0.3,
      maxTokens: 300,
      timeoutMs: 20000,
      retries: 0,
    });
    const summary = String(result.text || '').trim();
    if (!summary) {
      return { summary: ruleBasedSummary(departments), provider: 'rule-engine' };
    }
    return { summary, provider: result.provider };
  } catch (error) {
    console.error('[AI] department summary failed, using fallback:', error.message);
    return { summary: ruleBasedSummary(departments), provider: 'rule-engine' };
  }
}

module.exports = { computeDepartmentStats, generateDepartmentSummary, ruleBasedSummary };