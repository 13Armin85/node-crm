require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../model/schema/user');

if (process.env.NODE_ENV === 'production') throw new Error('Local user seeding is disabled in production.');

const credentials = {
  admin: { email: process.env.LOCAL_ADMIN_EMAIL, password: process.env.LOCAL_ADMIN_PASSWORD },
  user: { email: process.env.LOCAL_USER_EMAIL, password: process.env.LOCAL_USER_PASSWORD },
};
for (const account of Object.values(credentials)) {
  if (!account.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) || !account.password || account.password.length < 12 || Buffer.byteLength(account.password, 'utf8') > 72) throw new Error('Set explicit LOCAL_ADMIN_EMAIL/PASSWORD and LOCAL_USER_EMAIL/PASSWORD; passwords must have at least 12 characters and at most 72 UTF-8 bytes.');
}
if (credentials.admin.email === credentials.user.email) throw new Error('Seed accounts must have different email addresses.');

async function run() {
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName: process.env.DB || 'Prolink' });
  if (await User.exists({ username: { $in: [credentials.admin.email, credentials.user.email] } })) throw new Error('Seed accounts already exist; use an explicit account-management operation to change them.');
  const adminPassword = await bcrypt.hash(credentials.admin.password, 10);
  const existingAdmin = await User.findOne({ username: credentials.admin.email });
  if (existingAdmin) throw new Error('Seed administrator already exists; use an explicit account-management operation to change it.');
  else await User.create({ username: credentials.admin.email, password: adminPassword, firstName: 'System', lastName: 'Administrator', role: 'admin' });

  const userPassword = await bcrypt.hash(credentials.user.password, 10);
  await User.create({ username: credentials.user.email, password: userPassword, deleted: false, role: 'user', firstName: 'Local', lastName: 'User', createdDate: new Date() });
  console.log(JSON.stringify({ admin: credentials.admin.email, user: credentials.user.email }));
  await mongoose.disconnect();
}

run().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
