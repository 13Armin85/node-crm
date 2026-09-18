require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../model/schema/user');

if (process.env.NODE_ENV === 'production') throw new Error('Local user seeding is disabled in production.');

const credentials = {
  admin: { email: process.env.LOCAL_ADMIN_EMAIL || 'admin@gmail.com', password: process.env.LOCAL_ADMIN_PASSWORD || 'admin123' },
  user: { email: process.env.LOCAL_USER_EMAIL || 'user@gmail.com', password: process.env.LOCAL_USER_PASSWORD || 'user123' },
};

async function run() {
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName: process.env.DB || 'Prolink' });
  const adminPassword = await bcrypt.hash(credentials.admin.password, 10);
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) await User.updateOne({ _id: existingAdmin._id }, { $set: { username: credentials.admin.email, password: adminPassword, deleted: false, role: 'admin' } });
  else await User.create({ username: credentials.admin.email, password: adminPassword, firstName: 'System', lastName: 'Administrator', role: 'admin' });

  const userPassword = await bcrypt.hash(credentials.user.password, 10);
  await User.findOneAndUpdate(
    { username: credentials.user.email },
    { $set: { password: userPassword, deleted: false, role: 'user', firstName: 'Local', lastName: 'User' }, $setOnInsert: { createdDate: new Date() } },
    { upsert: true, new: true, runValidators: true },
  );
  console.log(JSON.stringify({ admin: credentials.admin.email, user: credentials.user.email }));
  await mongoose.disconnect();
}

run().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
