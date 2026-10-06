require('dotenv').config();
const mongoose = require('mongoose');
const { provisionDeveloper } = require('../services/provisionDeveloper');

async function run() {
  try {
    await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName: process.env.DB || 'Prolink' });
    const user = await provisionDeveloper();
    console.log(`Developer account provisioned: ${user.username}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(error => { console.error(error.message); process.exitCode = 1; });
