const { isAdmin } = require('./userRoles');

// Assigned tasks and the creator's legacy unassigned tasks are private to that user.
const taskScope = (actor, extra = {}) => isAdmin(actor) ? { ...extra } : {
    ...extra,
    $or: [
        { assignedToUser: actor._id },
        { assignedToUser: { $exists: false }, createBy: actor._id },
        { assignedToUser: null, createBy: actor._id },
    ],
};

// Ordinary users may change only the personal tasks they created for themselves;
// tasks delegated by an administrator and generated lead-call tasks stay read-only.
const taskManageScope = (actor, extra = {}) => isAdmin(actor) ? { ...extra } : {
    $and: [
        ...(Object.keys(extra).length ? [extra] : []),
        { createBy: actor._id, assignedToUser: actor._id, leadCallFor: null },
    ],
};

module.exports = { taskScope, taskManageScope };
