// Preview by default. Applying requires an explicit database and a complete,
// verified BSON-safe backup. Stop the backend service before applying.
const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const { inventory, digest, resetOperationalData } = require('../services/crmReset');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const workspace = path.resolve(__dirname, '../..');
const uploadRoot = path.join(workspace, 'server/uploads');
const backupRoot = path.join(workspace, 'layout-artifacts/data-backups');
const assertChild = (parent, target) => {
  const relative = path.relative(parent, path.resolve(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe filesystem target');
};
async function verifyUploads(source, destination, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Upload backup contains a symbolic link; inspect it before resetting');
    if (entry.isDirectory()) files.push(...await verifyUploads(from, to, relative));
    else {
      const bytes = await fs.readFile(from), copied = await fs.readFile(to);
      if (digest(bytes) !== digest(copied)) throw new Error('Upload backup verification failed');
      files.push({ path: relative, size: bytes.length, sha256: digest(bytes) });
    }
  }
  return files;
}
async function prepareForms(db) {
  const definitions = db.collection('formdefinitions');
  const shared = require('../services/requestTypeField');
  for (const moduleName of ['Contacts', 'Leads', 'Opportunities']) {
    const definition = await require('../services/formDefinitions').getDefinition(moduleName);
    const existing = await definitions.findOne({ moduleName });
    const fields = definition.fields.filter(field => field.name !== 'listedFor');
    fields.push({ ...shared, order: fields.length });
    await definitions.updateOne({ moduleName }, { $set: { fields,
      removedFields: (existing?.removedFields || []).filter(name => name !== 'listedFor'),
      revision: (existing?.revision || 0) + 1 } }, { upsert: true });
  }
  const property = await definitions.findOne({ moduleName: 'Properties' });
  if (property) {
    const standard = require('../services/formDefinitions').defaults.Properties.find(field => field.name === 'suitableFor');
    const fields = property.fields.map(field => {
      if (!require('../services/propertySuitability').isSuitabilityField(field)) return field;
      const options = [...(field.options || [])];
      for (const option of standard.options) {
        if (!options.some(existing => existing.value === option.value || existing.label?.fa === option.label.fa)) options.push(option);
      }
      return { ...field, enabled: true, label: standard.label, options };
    });
    await definitions.updateOne({ _id: property._id }, { $set: { fields }, $inc: { revision: 1 } });
  }
}
async function main() {
  const args = process.argv.slice(2), apply = args.includes('--apply');
  const database = process.env.DB || 'Prolink';
  const expected = args[args.indexOf('--database') + 1];
  if (apply && (!args.includes('--database') || expected !== database)) throw new Error('Use --database with the exact configured database name');
  await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017', { dbName: database, autoCreate: false, autoIndex: false });
  try {
    const db = mongoose.connection.db;
    const before = await inventory(db);
    if (!apply) { console.log(JSON.stringify({ preview: true, database, collections: before }, null, 2)); return; }
    const backup = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-') + '-' + require('node:crypto').randomUUID());
    assertChild(workspace, backup); assertChild(workspace, uploadRoot);
    await fs.mkdir(backup, { recursive: true });
    const { EJSON } = mongoose.mongo.BSON;
    const manifest = { database, createdAt: new Date().toISOString(), collections: [] };
    for (const [index, item] of before.entries()) {
      const filename = 'collection-' + index + '.ejson';
      const records = await db.collection(item.name).find({}).sort({ _id: 1 }).toArray();
      const bytes = EJSON.stringify(records, { relaxed: false });
      const target = path.join(backup, filename); assertChild(backup, target);
      await fs.writeFile(target, bytes, { flag: 'wx' });
      const verified = await fs.readFile(target, 'utf8');
      if (digest(verified) !== digest(bytes) || EJSON.parse(verified).length !== item.count) throw new Error('Backup verification failed: ' + item.name);
      manifest.collections.push({ ...item, filename, sha256: digest(bytes) });
    }
    await fs.cp(uploadRoot, path.join(backup, 'uploads'), { recursive: true, errorOnExist: true });
    manifest.uploads = await verifyUploads(uploadRoot, path.join(backup, 'uploads'));
    await fs.writeFile(path.join(backup, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
    await prepareForms(db);
    const report = await resetOperationalData(db, expected, manifest.collections.map(item => item.name));
    // Account avatars remain in profile/. Remove only backed-up operational files.
    for (const entry of await fs.readdir(uploadRoot, { withFileTypes: true })) {
      if (entry.name === 'profile') continue;
      const target = path.resolve(uploadRoot, entry.name); assertChild(uploadRoot, target);
      await fs.rm(target, { recursive: true, force: true });
    }
    await fs.writeFile(path.join(backup, 'reset-report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ ...report, backup }, null, 2));
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { prepareForms };
