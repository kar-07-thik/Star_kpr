function normalize(text = '') {
  return String(text || '').toLowerCase().trim();
}

function resolveActivityType(activity, submission = {}) {
  const prompt = normalize(`${activity?.activityName || ''} ${submission?.activityType || ''} ${submission?.visitType || ''}`);
  if (prompt.includes('case study')) return 'case-study';
  if (prompt.includes('mini project')) return 'mini-project';
  if (prompt.includes('internship')) return 'internship';
  if (prompt.includes('industrial visit')) return 'industrial-visit';
  if (prompt.includes('institutional visit')) return 'institutional-visit';
  if (prompt.includes('international visit')) return 'international-visit';
  return normalize(submission?.activityType || '');
}

function scoreFromLevel(selectedLevel = '') {
  const key = normalize(selectedLevel).trim();
  if (LEVEL_SCORE_MAP[key] !== undefined) return LEVEL_SCORE_MAP[key];
  // fuzzy: find closest key that contains the input or vice versa
  for (const [mapKey, val] of Object.entries(LEVEL_SCORE_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return val;
  }
  return null;
}

function calculateSubmissionScore(activity, submission = {}) {
  const activityType = resolveActivityType(activity, submission);
  const maxPoints = Number(activity?.maximumPoints || 20);
  const selectedLevel = submission?.selectedLevel || '';
  const dbLevels = activity?.levels || [];

  let awardedPoints = 0;
  let levelLabel = '';

  // 1. Try DB levels array first
  if (selectedLevel && dbLevels.length) {
    const key = normalize(selectedLevel);
    const match = dbLevels.find((l) => normalize(l.label) === key);
    if (match) {
      awardedPoints = match.points;
      levelLabel = match.label;
      return {
        activityType,
        pointsAwarded: Math.min(awardedPoints, maxPoints),
        suggestedPoints: Math.min(awardedPoints, maxPoints),
        surplusPoints: Math.max(0, awardedPoints - maxPoints),
        bonusPoints: 0,
        scoreSummary: `"${levelLabel}" → ${Math.min(awardedPoints, maxPoints)} SP`,
      };
    }
  }

  // 2. Fallback: V1 activity-type based scoring (internship/visit)
  if (activityType === 'case-study' || activityType === 'mini-project') {
    awardedPoints = 3;
  } else if (activityType === 'internship') {
    awardedPoints = normalize(submission?.durationWeeks || '').includes('4') ? 6 : 4;
  } else if (activityType === 'industrial-visit' || activityType === 'institutional-visit') {
    awardedPoints = 5;
  } else if (activityType === 'international-visit') {
    awardedPoints = 10;
  } else {
    awardedPoints = Math.min(maxPoints, 5);
  }

  const bounded = Math.min(Math.max(awardedPoints, 0), maxPoints);
  return {
    activityType,
    pointsAwarded: bounded,
    suggestedPoints: bounded,
    surplusPoints: Math.max(0, awardedPoints - maxPoints),
    bonusPoints: 0,
    scoreSummary: `Auto-suggested ${bounded} SP`,
  };
}

module.exports = { calculateSubmissionScore };
