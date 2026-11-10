const crypto = require('node:crypto');
// Account/access settings, form definitions, form dropdown catalogs and branding.
const preservedCollections = new Set(['User', 'Users', 'CustomField', 'formdefinitions', 'Validation',
  'ModuleActiveDeactive', 'Roles', 'AuthSessions', 'Districts', 'Images']);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
async function collectionDigest(db, name) {
  const { EJSON } = require('mongoose').mongo.BSON;
  return digest(EJSON.stringify(await db.collection(name).find({}).sort({ _id: 1 }).toArray(), { relaxed: false }));
}
async function inventory(db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return Promise.all(collections.filter(item => !item.name.startsWith('system.')).map(async item => ({
    name: item.name, count: await db.collection(item.name).countDocuments(), preserve: preservedCollections.has(item.name),
  })));
}
async function resetOperationalData(db, expectedDatabase, backedUpCollections) {
  if (db.databaseName !== expectedDatabase) throw new Error('Database name does not match the explicitly selected database');
  const before = await inventory(db);
  if (before.some(item => !backedUpCollections.includes(item.name))) throw new Error('A collection has not been backed up');
  const protectedHashes = new Map();
  for (const item of before.filter(item => item.preserve)) protectedHashes.set(item.name, await collectionDigest(db, item.name));
  for (const item of before.filter(item => !item.preserve)) await db.collection(item.name).deleteMany({});
  for (const [name, hash] of protectedHashes) if (await collectionDigest(db, name) !== hash) throw new Error('Preserved collection changed: ' + name);
  const after = await inventory(db);
  if (after.some(item => !item.preserve && item.count !== 0)) throw new Error('Operational records remain; stop writers and retry');
  return { database: db.databaseName, deletedRecords: before.filter(item => !item.preserve).reduce((sum, item) => sum + item.count, 0), collections: after };
}
module.exports = { preservedCollections, digest, collectionDigest, inventory, resetOperationalData };
