require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../model/schema/user');
const RoleAccess = require('../model/schema/roleAccess');

if (process.env.NODE_ENV === 'production') throw new Error('Local user seeding is disabled in production.');

const modules = ['Emails', 'Calls', 'Meetings', 'Tasks', 'Properties', 'Contacts', 'Leads', 'Documents', 'Email Template', 'Opportunities', 'Partner Customers', 'Residences', 'Quotes', 'Invoices'];
const credentials = {
  admin: { email: process.env.LOCAL_ADMIN_EMAIL || 'admin@gmail.com', password: process.env.LOCAL_ADMIN_PASSWORD || 'admin123' },
  user: { email: process.env.LOCAL_USER_EMAIL || 'user@gmail.com', password: process.env.LOCAL_USER_PASSWORD || 'user123' },
};

async function run() {
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName: process.env.DB || 'Prolink' });
  const access = modules.map(title => ({ title, create: true, update: true, delete: false, view: true }));
  const role = await RoleAccess.findOneAndUpdate(
    { roleName: 'Local Sales' },
    { $set: { description: 'Local development user', access, modifyDate: new Date() }, $setOnInsert: { createdDate: new Date() } },
    { upsert: true, new: true, runValidators: true },
  );

  const adminPassword = await bcrypt.hash(credentials.admin.password, 10);
  const existingAdmin = await User.findOne({ role: 'superAdmin' });
  if (existingAdmin) await User.updateOne({ _id: existingAdmin._id }, { $set: { username: credentials.admin.email, password: adminPassword, deleted: false, role: 'superAdmin' } });
  else await User.create({ username: credentials.admin.email, password: adminPassword, firstName: 'System', lastName: 'Administrator', role: 'superAdmin' });

  const userPassword = await bcrypt.hash(credentials.user.password, 10);
  await User.findOneAndUpdate(
    { username: credentials.user.email },
    { $set: { password: userPassword, deleted: false, role: 'user', roles: [role._id], firstName: 'Local', lastName: 'User' }, $setOnInsert: { createdDate: new Date() } },
    { upsert: true, new: true, runValidators: true },
  );
  console.log(JSON.stringify({ admin: credentials.admin.email, user: credentials.user.email, role: role.roleName }));
  await mongoose.disconnect();
}

run().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
