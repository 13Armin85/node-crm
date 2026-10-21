const { isAdmin } = require('./userRoles');
const leadScope = (actor, extra = {}) => {
  if (isAdmin(actor)) return { ...extra };
  const current = { $or: [{ assignUser: actor._id }, { assignUser: null, createBy: actor._id }] };
  return { $and: [...(Object.keys(extra).length ? [extra] : []), current] };
};
const generatedTaskScope = (actor, extra = {}) => ({
  $and: [...(Object.keys(extra).length ? [extra] : []), { $or: [
    { leadCallFor: null }, { assignedToUser: actor._id },
  ] }],
});
module.exports = { leadScope, generatedTaskScope };
