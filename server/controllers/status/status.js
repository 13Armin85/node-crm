const mongoose = require('mongoose');
const Task = require('../../model/schema/task')
const { Lead } = require('../../model/schema/lead');
const User = require('../../model/schema/user');
const { readScope } = require('../../services/recordAccess');

const index = async (req, res) => {
    try {
        const actor = req.actor || await User.findOne({ _id: req.user.userId, deleted: false });
        if (!actor) return res.status(401).json({ code: 'unauthorized' });
        const query = { ...req.query, deleted: false };

        const [taskData, leadData] = await Promise.all([
            Task.find(readScope(req, actor, 'Tasks', query)),
            Lead.find(readScope(req, actor, 'Leads', query))
        ]);
        res.json({ data: { taskData, leadData } });
    } catch (error) {
        console.error('Error in index function:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { index }
