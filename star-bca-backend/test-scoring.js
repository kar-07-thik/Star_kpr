const { calculateSubmissionScore } = require('./src/utils/scoringEngine');
const activity = { activityName: 'LeetCode', maximumPoints: 20, description: 'Coding practice' };
const submission = { description: 'Solved 50 easy and 10 medium problems', proofUrl: 'https://leetcode.com' };
const result = calculateSubmissionScore(activity, submission);
console.log(JSON.stringify(result, null, 2));
