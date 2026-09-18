const mongoose = require('mongoose');
const Task = require('../../model/schema/task')
const { Lead } = require('../../model/schema/lead');

const index = async (req, res) => {
    try {
        const { query } = req;
        query.deleted = false;

        const [taskData, leadData] = await Promise.all([
            Task.find(query),
            Lead.find(query)
        ]);
        res.json({ data: { taskData, leadData } });
    } catch (error) {
        console.error('Error in index function:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { index }
