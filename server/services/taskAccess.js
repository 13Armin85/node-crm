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

module.exports = { taskScope };
