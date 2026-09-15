const mongoose = require('mongoose');
const dns = require('dns');
const models = require('../models');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb+srv://karthi533110_db_user:i0X6bdzOAjtufSz3@cluster0.hi8jlzu.mongodb.net/star-kpr?appName=Cluster0';
    if (uri.startsWith('mongodb+srv://')) {
      const dnsServers = String(process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1')
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean);
      if (dnsServers.length) dns.setServers(dnsServers);
    }
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
      maxPoolSize: 50,
      minPoolSize: 5,
    });

    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = Object.assign(connectDB, models);
module.exports.connectDB = connectDB;