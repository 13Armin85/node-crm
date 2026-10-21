// Preview by default. Apply creates missing call tasks and makes the last
// existing lead recipient exclusive; the original creator is preserved.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
require('../model/schema/customField');
const apply = process.argv.includes('--apply');
(async () => {
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', {
    dbName: process.env.DB || 'Prolink', autoIndex: apply, autoCreate: apply,
  });
  try {
    const report = await require('../services/leadWorkflowMigration').reconcileExistingLeads(apply);
    console.log(JSON.stringify(report));
  } finally { await mongoose.disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
