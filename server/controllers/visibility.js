const express = require('express');
const auth = require('../middelwares/auth');
const { adminOnly } = require('../middelwares/permissions');
const User = require('../model/schema/user');
const { modules, canonicalModule, effectiveVisibility } = require('../services/moduleVisibility');
const CustomField = require('../model/schema/customField');
const router = express.Router();
router.use(auth);
const catalog = async () => {
  const custom = await CustomField.find({ deleted: { $ne: true } }).select('moduleName').lean();
  const reserved = new Set(['Account', 'Accounts', 'Payments', 'User', 'Notification', 'Notifications', 'Images', 'EstateFile', 'RecordShare', 'RecordShares', 'AuthSession', 'AuthSessions', 'CustomField', 'FormDefinition', 'Validation', 'Roles', 'Custom Fields', 'Active Deactive Module']);
  return [...new Set([...modules, ...custom.map(item => canonicalModule(item.moduleName)).filter(name => name && /^[a-z][a-z\d _-]*$/i.test(name) && !reserved.has(name))])];
};
router.get('/me', async (req, res) => res.json({ visibility: effectiveVisibility(req.actor), accessibleModules: await require('../services/recordSharing').accessibleModules(req) }));
router.get('/', adminOnly, async (req, res) => {
  const [users, names] = await Promise.all([
    User.find({ role: 'user', deleted: { $ne: true } }).select('_id username firstName lastName +moduleVisibility').sort({ firstName: 1, lastName: 1 }).lean(),
    catalog(),
  ]);
  res.json({ users: users.map(user => ({ ...user, moduleVisibility: effectiveVisibility(user) })), modules: names });
});
router.put('/:id', adminOnly, async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ code: 'invalid' });
  const values = req.body?.visibility;
  const names = await catalog();
  if (!values || Array.isArray(values) || typeof values !== 'object' || !Object.keys(values).length ||
      Object.entries(values).some(([name, value]) => (!names.includes(name) || !/^[a-z][a-z\d _-]*$/i.test(name)) || typeof value !== 'boolean')) return res.status(400).json({ code: 'invalid' });
  const updates = Object.fromEntries(Object.entries(values).map(([name, value]) => ['moduleVisibility.' + name, value]));
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'user', deleted: { $ne: true } }, { $set: updates }, { new: true, runValidators: true }).select('_id +moduleVisibility');
  if (!user) return res.status(404).json({ code: 'notFound' });
  res.json({ userId: user._id, visibility: effectiveVisibility(user) });
});
module.exports = router;
