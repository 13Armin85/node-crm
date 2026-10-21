const Task = require('../model/schema/task');
const User = require('../model/schema/user');
const Share = require('../model/schema/recordShare');
const { isAdmin } = require('./userRoles');
const { createNotification } = require('./notifications');
const id = value => String(value?._id || value || '');
const error = (code, status = 400) => Object.assign(new Error(code), { code, status, field: 'assignUser' });
const ownerOf = lead => id(lead.assignUser || lead.createBy);

async function normalizeLeadAssignment(body, previous, actor) {
  delete body.assignedBy;
  const before = ownerOf(previous) || id(actor);
  const target = body.assignUser === undefined ? before : id(body.assignUser) || id(previous.createBy || actor);
  if (!/^[a-f\d]{24}$/i.test(target)) throw error('invalid');
  if (!isAdmin(actor) && target !== before) throw error('forbidden', 403);
  if (target !== before && !await User.exists({ _id: target, deleted: false })) throw error('relationNotFound');
  body.assignUser = target;
  if (!previous._id || target !== before) body.assignedBy = actor._id;
  return body;
}

// Serialize reconciliation per lead, including simultaneous saves and transfers.
// The partial unique task index also guards against duplicate active call tasks.
const pending = new Map();
function syncLeadWorkflow(leadId) {
  const key = id(leadId);
  const work = (pending.get(key) || Promise.resolve()).catch(() => {}).then(() => reconcile(key));
  pending.set(key, work);
  return work.finally(() => { if (pending.get(key) === work) pending.delete(key); });
}
async function reconcile(leadId) {
  const { Lead } = require('../model/schema/lead');
  const lead = await Lead.findById(leadId).lean();
  if (!lead) return;
  await Task.init();
  if (lead.deleted) {
    await Task.updateMany({ leadCallFor: leadId, deleted: false }, { $set: { deleted: true, updatedDate: new Date() } });
    await Share.deleteMany({ module: 'Leads', recordId: leadId });
    return;
  }
  const owner = ownerOf(lead);
  if (!/^[a-f\d]{24}$/i.test(owner)) return;
  const previous = await Task.find({ leadCallFor: leadId, deleted: false, assignedToUser: { $ne: owner } }).lean();
  await Task.updateMany({ leadCallFor: leadId, deleted: false, assignedToUser: { $ne: owner } }, { $set: { deleted: true, updatedDate: new Date() } });
  await Share.deleteMany({ module: 'Leads', recordId: leadId, ...(owner !== id(lead.createBy) ? { recipient: { $ne: owner } } : {}) });
  if (owner !== id(lead.createBy) && await User.exists({ _id: owner, role: 'user', deleted: false })) {
    await Share.updateOne({ module: 'Leads', recordId: leadId, recipient: owner },
      { $setOnInsert: { sharedBy: lead.assignedBy || lead.createBy } }, { upsert: true });
  }
  const title = 'تماس با لید ' + (lead.leadName || lead.leadEmail || lead.leadMobile || 'بدون نام');
  let task = await Task.findOne({ leadCallFor: leadId, deleted: false });
  if (task) {
    if (task.title !== title) await Task.updateOne({ _id: task._id }, { $set: { title, updatedDate: new Date() } });
  } else {
    task = await Task.create({
      leadCallFor: leadId, title, category: 'Lead', assignToLead: leadId,
      assignedToUser: owner, createBy: lead.createBy, delegatedBy: lead.assignedBy || lead.createBy,
      start: new Date().toISOString(), createdDate: new Date(), priority: 'normal', status: 'todo',
      backgroundColor: '#E3F2FD', borderColor: '#42A5F5', textColor: '#0D47A1',
    });
    await createNotification({ recipientId: owner, actorId: lead.assignedBy || lead.createBy,
      type: 'task_assigned', module: 'Tasks', entityId: task._id, message: title, link: '/view/' + task._id });
  }
  for (const old of previous) await createNotification({
    recipientId: old.assignedToUser, actorId: lead.assignedBy || lead.createBy, type: 'task_unassigned',
    module: 'Tasks', entityId: old._id, message: old.title, link: '/task',
  });
  return task;
}

function leadWorkflow(schema) {
  schema.post('save', async function (doc) { await syncLeadWorkflow(doc._id); });
  schema.post('insertMany', async function (docs) { for (const doc of docs) await syncLeadWorkflow(doc._id); });
  const relevant = update => ['assignUser', 'leadName', 'deleted'].some(key =>
    Object.prototype.hasOwnProperty.call(update || {}, key)
      || Object.prototype.hasOwnProperty.call(update?.$set || {}, key)
      || Object.prototype.hasOwnProperty.call(update?.$unset || {}, key));
  for (const operation of ['findOneAndUpdate', 'updateOne', 'updateMany']) {
    schema.pre(operation, async function () {
      if (relevant(this.getUpdate())) this.leadWorkflowIds = await this.model.find(this.getFilter()).select('_id').lean();
    });
    schema.post(operation, async function () {
      for (const doc of this.leadWorkflowIds || []) await syncLeadWorkflow(doc._id);
    });
  }
}
async function assignLead(leadId, recipientId, actor) {
  if (!isAdmin(actor)) throw error('forbidden', 403);
  if (!await User.exists({ _id: recipientId, deleted: false })) throw error('relationNotFound', 404);
  const { Lead } = require('../model/schema/lead');
  const previous = await Lead.findOne({ _id: leadId, deleted: false }).lean();
  if (!previous) throw error('notFound', 404);
  const lead = await Lead.findOneAndUpdate({ _id: leadId, deleted: false },
    { $set: { assignUser: recipientId, assignedBy: actor._id, updatedDate: new Date() } }, { new: true });
  const task = await Task.findOne({ leadCallFor: leadId, deleted: false }).lean();
  return { lead, task, created: ownerOf(previous) !== id(recipientId) };
}
module.exports = { leadWorkflow, syncLeadWorkflow, normalizeLeadAssignment, assignLead };
