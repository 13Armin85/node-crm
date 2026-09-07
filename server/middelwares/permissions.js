const User = require('../model/schema/user');
require('../model/schema/roleAccess');
const isAdmin = user => user?.role === 'superAdmin';
const can = (user, title, action) => isAdmin(user) || user?.roles?.some(role => role.access?.some(access =>
  (access.title === title || (title === 'Partner Customers' && access.title === 'Account')) && access[action] === true));
const loadUser = async (req, res, next) => {
  try {
    req.actor = await User.findOne({ _id: req.user.userId, deleted: false }).select('-password').populate('roles');
    if (!req.actor) return res.status(401).json({ code: 'unauthorized' });
    next();
  } catch (error) { next(error); }
};
const permit = (title, action) => (req, res, next) => can(req.actor, title, action) ? next() : res.status(403).json({ code: 'forbidden' });
const adminOnly = (req, res, next) => isAdmin(req.actor) ? next() : res.status(403).json({ code: 'forbidden' });
const scope = req => isAdmin(req.actor) ? {} : { createBy: req.actor._id };
module.exports = { loadUser, permit, adminOnly, scope, can, isAdmin };
