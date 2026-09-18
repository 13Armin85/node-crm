const User = require('../model/schema/user');
const isAdmin = user => user?.role === 'admin';
const ADMIN_ONLY_MODULES = new Set(['Users', 'Roles', 'Custom Fields', 'Active Deactive Module']);
const can = (user, title) => isAdmin(user) || (user?.role === 'user' && !ADMIN_ONLY_MODULES.has(title));
const loadUser = async (req, res, next) => {
  try {
    req.actor = await User.findOne({ _id: req.user.userId, deleted: false }).select('-password');
    if (!req.actor) return res.status(401).json({ code: 'unauthorized' });
    next();
  } catch (error) { next(error); }
};
const permit = (title, action) => (req, res, next) => can(req.actor, title, action) ? next() : res.status(403).json({ code: 'forbidden' });
const adminOnly = (req, res, next) => isAdmin(req.actor) ? next() : res.status(403).json({ code: 'forbidden' });
const scope = req => isAdmin(req.actor) ? {} : { createBy: req.actor._id };
module.exports = { loadUser, permit, adminOnly, scope, can, isAdmin };
