const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const Activity = require('../models/Activity');
const Submission = require('../models/Submission');

dotenv.config();

const loadSeedActivityCatalog = () => {
  const seedSource = fs.readFileSync(path.join(__dirname, 'seedData.js'), 'utf8');
  const match = seedSource.match(/const activityCatalog = (\[[\s\S]*?\]);\s*await Activity\.insertMany/);
  if (!match) throw new Error('Could not locate activity catalog in seedData.js');
  return Function(`return ${match[1]}`)();
};

const applyActivityOverrides = (activity) => {
  const overrides = {
    'LeetCode / HackerRank / HackerEarth': { evidenceType: 'both' },
    'CodeChef / GeeksforGeeks': { evidenceType: 'both' },
    Scholarship: {
      maximumPoints: 10,
      levels: [
        { label: 'Applied for scholarship', points: 3 },
        { label: 'Scholarship received', points: 6 },
        { label: 'Merit Scholarship', points: 16 },
      ],
    },
  };
  return { ...activity, ...(overrides[activity.activityName] || {}) };
};

async function migrateActivities() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/star-kpr';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: true });

  let updatedCount = 0;
  let insertedCount = 0;
  const activityCatalog = loadSeedActivityCatalog().map(applyActivityOverrides);

  try {
    const submissionIndexes = await Submission.collection.indexes();
    if (submissionIndexes.some((index) => index.name === 'studentId_1_activityId_1')) {
      await Submission.collection.dropIndex('studentId_1_activityId_1');
      console.log('Dropped obsolete submission index: studentId_1_activityId_1');
    }

    const indexes = await Activity.collection.indexes();
    if (indexes.some((index) => index.name === 'activityCode_1')) {
      await Activity.collection.dropIndex('activityCode_1');
      console.log('Dropped obsolete unique index: activityCode_1');
    }

    for (const activity of activityCatalog) {
      const { activityName, ...fields } = activity;
      const result = await Activity.updateOne(
        { activityName },
        { $set: fields, $setOnInsert: { activityName } },
        { upsert: true },
      );

      updatedCount += 1;
      if (result.upsertedCount > 0) insertedCount += 1;
    }

    console.log(`Activity migration completed: ${updatedCount} processed, ${insertedCount} inserted`);
  } finally {
    await mongoose.disconnect();
  }
}

migrateActivities().catch((error) => {
  console.error('Activity migration failed', error);
  process.exitCode = 1;
});
