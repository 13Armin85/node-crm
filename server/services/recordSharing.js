const { isAdmin } = require('./userRoles');
const RecordShare = require('../model/schema/recordShare');
const modelLoaders = {
  Contacts: () => require('../model/schema/contact').Contact,
  Leads: () => require('../model/schema/lead').Lead,
  Opportunities: () => require('../model/schema/opprtunity'),
  Invoices: () => require('../model/schema/invoices'),
  Meetings: () => require('../model/schema/meeting'),
  Calls: () => require('../model/schema/phoneCall'),
  Emails: () => require('../model/schema/email'),
  Documents: () => require('../model/schema/document'),
  'Partner Customers': () => require('../model/schema/partnerCustomer'),
};
const shareableModules = Object.keys(modelLoaders);
const limitedModules = new Set([...shareableModules, 'Tasks']);
const modelFor = name => modelLoaders[name]?.() || (name === 'Tasks' ? require('../model/schema/task') : null);
const idsFor = (req, name) => (req.recordShares || []).filter(share => share.module === name).map(share => share.recordId);
const loadShares = actor => actor?.role === 'user' ? RecordShare.find({ recipient: actor._id }).select('module recordId').lean() : Promise.resolve([]);
const isOwnDocument = (folder, actor) => String(folder.createBy?._id || folder.createBy) === String(actor._id);
const readableDocumentFiles = (req, folder) => {
  const { canView } = require('./moduleVisibility');
  const all = (folder.file || []).filter(file => !file.deleted);
  if (canView(req.actor, 'Documents') || isOwnDocument(folder, req.actor)) return all;
  const allowed = new Set(idsFor(req, 'Documents').map(String));
  return all.filter(file => allowed.has(String(file._id)));
};
const documentFileScope = req => require('./moduleVisibility').canView(req.actor, 'Documents') ? {} : {
  $or: [{ createBy: req.actor._id }, { 'file._id': { $in: idsFor(req, 'Documents') } }],
};
const accessibleModules = async req => {
  if (isAdmin(req.actor)) return [];
  const { canView } = require('./moduleVisibility');
  const { readScope } = require('./recordAccess');
  const names = [...limitedModules].filter(name => !canView(req.actor, name));
  const results = await Promise.all(names.map(async name =>
    await modelFor(name).exists(readScope(req, req.actor, name, { deleted: { $ne: true } })) ? name : null));
  return results.filter(Boolean);
};
const annotateReads = (req, res) => {
  if (req.actor?.role !== 'user' || req.method !== 'GET') return;
  const original = res.json.bind(res);
  res.json = body => {
    const name = req.readModuleName || require('./moduleVisibility').requestViewModule(req);
    if (res.statusCode >= 300 || !limitedModules.has(name) || !body || typeof body !== 'object') return original(body);
    const allowed = new Set(idsFor(req, name).map(String));
    const visit = value => {
      if (Array.isArray(value)) return value.map(visit);
      if (!value || typeof value !== 'object') return value;
      const next = { ...value };
      if (next._id) next._receivedFromAdmin = allowed.has(String(next._id));
      for (const [key, item] of Object.entries(next)) {
        if (item && typeof item === 'object') next[key] = visit(item);
      }
      return next;
    };
    return original(visit(JSON.parse(JSON.stringify(body))));
  };
};
// Only notifications for visible modules or readable individual records are delivered.
const notificationScope = async req => {
  if (!req.actor || isAdmin(req.actor)) return {};
  const { hiddenModules, canonicalModule } = require('./moduleVisibility');
  const hidden = hiddenModules(req.actor);
  if (!hidden.length) return {};
  const { readScope } = require('./recordAccess');
  const restricted = [...limitedModules].filter(name => hidden.includes(name));
  const exceptions = await Promise.all(restricted.map(async name => {
    const rows = await modelFor(name).find(readScope(req, req.actor, name, { deleted: { $ne: true } })).select(name === 'Documents' ? '_id createBy file' : '_id').lean();
    const ids = name === 'Documents' ? rows.flatMap(folder => [
      ...(isOwnDocument(folder, req.actor) ? [folder._id] : []),
      ...readableDocumentFiles(req, folder).map(file => file._id),
    ]) : rows.map(row => row._id);
    return ids.length ? { module: { $in: [name, ...hidden.filter(alias => canonicalModule(alias) === name)] }, entityId: { $in: ids } } : null;
  }));
  return { $or: [{ module: { $nin: hidden } }, ...exceptions.filter(Boolean)] };
};
module.exports = { documentFileScope, shareableModules, limitedModules, modelFor, idsFor, loadShares, accessibleModules, annotateReads, readableDocumentFiles, isOwnDocument, notificationScope };
