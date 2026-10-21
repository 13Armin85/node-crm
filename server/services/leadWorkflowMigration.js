const { Lead } = require('../model/schema/lead');
const Task = require('../model/schema/task');
const Share = require('../model/schema/recordShare');
const User = require('../model/schema/user');
const { syncLeadWorkflow } = require('./leadWorkflow');
const id = value => String(value?._id || value || '');
async function reconcileExistingLeads(apply = false) {
  const leads = await Lead.find({ deleted: false }).lean();
  const users = new Set((await User.find({ deleted: false }).select('_id').lean()).map(user => id(user._id)));
  const shares = await Share.find({ module: 'Leads' }).sort({ updatedAt: -1, createdAt: -1, _id: -1 }).lean();
  const tasks = await Task.find({ leadCallFor: { $exists: true }, deleted: false }).select('leadCallFor assignedToUser').lean();
  const report = { activeLeads: leads.length, legacyTransfers: 0, callTasksToCreate: 0, skippedInactiveOwners: 0, applied: apply };
  if (apply) await Task.createIndexes();
  for (const lead of leads) {
    const grant = shares.find(share => id(share.recordId) === id(lead._id) && users.has(id(share.recipient)));
    const target = id(lead.assignUser) || id(grant?.recipient) || id(lead.createBy);
    if (!users.has(target)) { report.skippedInactiveOwners++; continue; }
    const migrated = !lead.assignUser && target !== id(lead.createBy);
    if (migrated) report.legacyTransfers++;
    if (!tasks.some(task => id(task.leadCallFor) === id(lead._id) && id(task.assignedToUser) === target)) report.callTasksToCreate++;
    if (!apply) continue;
    if (!lead.assignUser) await Lead.findByIdAndUpdate(lead._id, { $set: {
      assignUser: target, assignedBy: grant?.sharedBy || lead.createBy, updatedDate: new Date(),
    } });
    else await syncLeadWorkflow(lead._id);
  }
  return report;
}
module.exports = { reconcileExistingLeads };
