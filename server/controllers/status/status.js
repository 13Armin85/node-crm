const mongoose = require('mongoose');
const Task = require('../../model/schema/task')
const { Lead } = require('../../model/schema/lead');
const User = require('../../model/schema/user');
const { readScope } = require('../../services/recordAccess');

const index = async (req, res) => {
    try {
        const actor = req.actor || await User.findOne({ _id: req.user.userId, deleted: false });
        if (!actor) return res.status(401).json({ code: 'unauthorized' });
        const { summary, ...filters } = req.query;
        const query = { ...filters, deleted: false };

        if (summary === '1') {
            const groupedCounts = (model, moduleName, field) => model.aggregate([
                { $match: readScope(req, actor, moduleName, query) },
                { $group: { _id: '$' + field, count: { $sum: 1 } } },
            ]).option({ maxTimeMS: require('../../config/runtime').reportTimeoutMS });
            const [tasks, leads] = await Promise.all([
                groupedCounts(Task, 'Tasks', 'status'), groupedCounts(Lead, 'Leads', 'leadStatus'),
            ]);
            const counts = rows => Object.fromEntries(rows.filter(row => typeof row._id === 'string').map(row => [row._id, row.count]));
            return res.json({ data: { taskCounts: counts(tasks), leadCounts: counts(leads) } });
        }

        const [taskData, leadData] = await Promise.all([
            Task.find(readScope(req, actor, 'Tasks', query)).lean(),
            Lead.find(readScope(req, actor, 'Leads', query)).lean()
        ]);
        res.json({ data: { taskData, leadData } });
    } catch (error) {
        console.error('Error in index function:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { index }
