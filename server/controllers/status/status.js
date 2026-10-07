const mongoose = require('mongoose');
const Task = require('../../model/schema/task')
const { Lead } = require('../../model/schema/lead');
const User = require('../../model/schema/user');
const { readActor } = require('../../services/recordAccess');
const { isAdmin } = require('../../services/userRoles');
const { taskScope } = require('../../services/taskAccess');

const index = async (req, res) => {
    try {
        const actor = await User.findOne({ _id: req.user.userId, deleted: false });
        if (!actor) return res.status(401).json({ code: 'unauthorized' });
        const subject = readActor(req, actor);
        const query = { ...req.query, deleted: false };

        const [taskData, leadData] = await Promise.all([
            Task.find(taskScope(subject, query)),
            Lead.find({ ...query, ...(isAdmin(subject) ? {} : { createBy: subject._id }) })
        ]);
        res.json({ data: { taskData, leadData } });
    } catch (error) {
        console.error('Error in index function:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { index }
