const USER_ROLES = ['developer', 'admin', 'user'];
const isDeveloper = user => user?.role === 'developer';
const isAdmin = user => isDeveloper(user) || user?.role === 'admin';
const sameUser = (actor, target) => Boolean(actor?._id && target?._id)
  && String(actor._id) === String(target._id);
const canEditUser = (actor, target) => Boolean(actor && target) && (
  isDeveloper(actor) || (isAdmin(actor) && !isDeveloper(target)) || sameUser(actor, target)
);
const canAssignRole = (actor, target, role) => USER_ROLES.includes(role) && (
  isDeveloper(actor) || (actor?.role === 'admin' && !isDeveloper(target) && role !== 'developer')
);
const canDeleteUser = (actor, target) => Boolean(actor && target) && !sameUser(actor, target)
  && (isDeveloper(actor) || (actor.role === 'admin' && target.role === 'user'));

module.exports = { USER_ROLES, isDeveloper, isAdmin, sameUser, canEditUser, canAssignRole, canDeleteUser };
