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
const shareableModules = ['Leads', 'Opportunities', 'Documents'];
// Visibility and ownership scopes still cover all existing modules.
const limitedModules = new Set([...Object.keys(modelLoaders), 'Tasks']);
const modelFor = name => modelLoaders[name]?.() || (name === 'Tasks' ? require('../model/schema/task') : null);
const idsFor = (req, name) => (req.recordShares || []).filter(share => share.module === name).map(share => share.recordId);
const loadShares = async actor => {
  if (actor?.role !== 'user') return [];
  const shares = await RecordShare.find({ recipient: actor._id, module: { $in: shareableModules } }).select('module recordId').lean();
  const documentIds = new Set(shares.filter(share => share.module === 'Documents').map(share => String(share.recordId)));
  if (!documentIds.size || !await modelFor('Documents').exists({ _id: { $in: [...documentIds] }, isRoot: { $ne: true }, deleted: false })) return shares;
  const folders = await modelFor('Documents').find({ deleted: false }).select('_id parentFolder isRoot file._id file.deleted').lean();
  const children = new Map();
  for (const folder of folders) {
    const parent = String(folder.parentFolder || '');
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(folder);
  }
  const pending = folders.filter(folder => !folder.isRoot && documentIds.has(String(folder._id)));
  const visited = new Set();
  while (pending.length) {
    const folder = pending.pop(), id = String(folder._id);
    if (visited.has(id)) continue;
    visited.add(id);
    for (const recordId of [folder._id, ...(folder.file || []).filter(file => !file.deleted).map(file => file._id)]) {
      if (!documentIds.has(String(recordId))) {
        documentIds.add(String(recordId));
        shares.push({ module: 'Documents', recordId });
      }
    }
    pending.push(...(children.get(id) || []).filter(child => !child.isRoot));
  }
  return shares;
};
const isOwnDocument = (folder, actor) => String(folder.createBy?._id || folder.createBy) === String(actor._id);
const readableDocumentFiles = (req, folder) => {
  const { canView } = require('./moduleVisibility');
  const all = (folder.file || []).filter(file => !file.deleted);
  if (canView(req.actor, 'Documents') || isOwnDocument(folder, req.actor)) return all;
  const allowed = new Set(idsFor(req, 'Documents').map(String));
  return allowed.has(String(folder._id)) ? all : all.filter(file => allowed.has(String(file._id)));
};
const documentFileScope = req => require('./moduleVisibility').canView(req.actor, 'Documents') ? {} : {
  $or: [{ createBy: req.actor._id }, { _id: { $in: idsFor(req, 'Documents') } }, { 'file._id': { $in: idsFor(req, 'Documents') } }],
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
      ...(isOwnDocument(folder, req.actor) || idsFor(req, 'Documents').some(id => String(id) === String(folder._id)) ? [folder._id] : []),
      ...readableDocumentFiles(req, folder).map(file => file._id),
    ]) : rows.map(row => row._id);
    return ids.length ? { module: { $in: [name, ...hidden.filter(alias => canonicalModule(alias) === name)] }, entityId: { $in: ids } } : null;
  }));
  return { $or: [{ module: { $nin: hidden } }, ...exceptions.filter(Boolean)] };
};
module.exports = { documentFileScope, shareableModules, limitedModules, modelFor, idsFor, loadShares, accessibleModules, annotateReads, readableDocumentFiles, isOwnDocument, notificationScope };
