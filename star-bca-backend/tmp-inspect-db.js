const mongoose = require('mongoose')
require('dotenv').config()

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI)
  const db = mongoose.connection.db
  const collections = await db.listCollections().toArray()
  console.log('\n=== COLLECTIONS ===')
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments()
    const sample = await db.collection(col.name).find().limit(2).toArray()
    console.log(`\n[${col.name}] — ${count} documents`)
    console.log(JSON.stringify(sample, null, 2))
  }
  await mongoose.disconnect()
}

inspect().catch(console.error)
