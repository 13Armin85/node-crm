const User = require('../model/schema/user');
const { isAdmin, isDeveloper } = require('../services/userRoles');
const ADMIN_ONLY_MODULES = new Set(['Users', 'Roles', 'Custom Fields', 'Active Deactive Module']);
const can = (user, title, action) => (title === 'Users' && action === 'create'
  ? isDeveloper(user)
  : isAdmin(user) || (user?.role === 'user' && (action === 'view' || (!ADMIN_ONLY_MODULES.has(title) && require('../services/moduleVisibility').canonicalModule(title) !== 'Tasks'))));
const loadUser = async (req, res, next) => {
  try {
    if (req.actor) return next();
    req.actor = await User.findOne({ _id: req.user.userId, deleted: false }).select('-password');
    if (!req.actor) return res.status(401).json({ code: 'unauthorized' });
    next();
  } catch (error) { next(error); }
};
const permit = (title, action) => (req, res, next) => (action === 'view' ? require('../services/moduleVisibility').canRead(req.actor, title) : can(req.actor, title, action)) ? next() : res.status(403).json({ code: 'forbidden' });
const adminOnly = (req, res, next) => isAdmin(req.actor) ? next() : res.status(403).json({ code: 'forbidden' });
const developerOnly = (req, res, next) => isDeveloper(req.actor) ? next() : res.status(403).json({ code: 'forbidden' });
const scope = (req, moduleName) => {
  if (req.method === 'GET' && req.params?.id && isAdmin(req.actor)) return {};
  const { readScope, requestModule } = require('../services/recordAccess');
  if (req.method === 'GET') return readScope(req, req.actor, moduleName || requestModule(req));
  if (moduleName === 'Tasks') return require('../services/taskAccess').taskScope(req.actor);
  return isAdmin(req.actor) ? {} : { createBy: req.actor._id };
};
module.exports = { loadUser, permit, adminOnly, developerOnly, scope, can, isAdmin, isDeveloper };
