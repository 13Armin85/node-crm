const Task = require('../../model/schema/task');
const User = require('../../model/schema/user');
const mongoose = require('mongoose');
const { sendEmail } = require('../../middelwares/mail');

const TASK_STATUSES = ['todo', 'inProgress', 'pending', 'onHold', 'completed'];
const TASK_CATEGORIES = ['None', 'Contact', 'Lead'];
const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const PRIORITY_COLORS = {
    low: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A', textColor: '#1B5E20' },
    normal: { backgroundColor: '#E3F2FD', borderColor: '#42A5F5', textColor: '#0D47A1' },
    high: { backgroundColor: '#FFF3E0', borderColor: '#FFA726', textColor: '#8A3B00' },
    urgent: { backgroundColor: '#FFEBEE', borderColor: '#EF5350', textColor: '#8E1010' },
};
const currentUser = (req) => User.findOne({ _id: req.user.userId, deleted: false });
const isValidId = (value) => !value || mongoose.Types.ObjectId.isValid(value);
const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const sendTaskAssignmentEmail = async (task, actor) => {
    try {
        if (!task?.assignedToUser) return;
        const assignee = await User.findOne({ _id: task.assignedToUser, deleted: false }).select('username firstName lastName');
        if (!assignee?.username) return;
        const assigneeName = [assignee.firstName, assignee.lastName].filter(Boolean).join(' ') || 'User';
        const assignerName = [actor?.firstName, actor?.lastName].filter(Boolean).join(' ') || actor?.username || 'an administrator';
        const title = task.title || 'Untitled task';
        const subject = 'New task received';
        const text = `Hello ${assigneeName},\n\nYou have received a new task from ${assignerName}.\nTask: ${title}${task.end ? `\nDue date: ${task.end}` : ''}\n\nPlease sign in to the CRM to view the task details.`;
        const html = `<p>Hello ${escapeHtml(assigneeName)},</p><p>You have received a new task from <strong>${escapeHtml(assignerName)}</strong>.</p><p><strong>Task:</strong> ${escapeHtml(title)}${task.end ? `<br><strong>Due date:</strong> ${escapeHtml(task.end)}` : ''}</p><p>Please sign in to the CRM to view the task details.</p>`;
        await sendEmail(assignee.username, subject, text, html);
    } catch (error) {
        console.error('Task assignment email failed:', error.message);
    }
};

const accessFilter = (user, extra = {}) => {
    if (user.role === 'admin') return { ...extra };
    return {
        ...extra,
        $or: [
            { assignedToUser: user._id },
            { assignedToUser: { $exists: false }, createBy: user._id },
            { assignedToUser: null, createBy: user._id },
        ],
    };
};

const normalizeTask = (body, actor, existing) => {
    const allowed = [
        'title', 'category', 'description', 'notes', 'reminder', 'start', 'end',
        'backgroundColor', 'borderColor', 'textColor', 'display', 'url', 'allDay',
        'assignTo', 'assignToLead', 'assignedToUser', 'status', 'priority', 'customFields',
    ];
    const result = {};
    allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            result[key] = body[key] === '' ? null : body[key];
        }
    });
    result.updatedDate = new Date();
    if (!result.assignedToUser && !existing?.assignedToUser) result.assignedToUser = actor._id;
    if (result.assignedToUser && String(result.assignedToUser) !== String(existing?.assignedToUser || actor._id)) {
        result.delegatedBy = actor._id;
    }
    if (result.status && !TASK_STATUSES.includes(result.status)) delete result.status;
    if (Object.prototype.hasOwnProperty.call(result, 'priority')) {
        const priority = String(result.priority || '').toLowerCase();
        result.priority = TASK_PRIORITIES.includes(priority) ? priority : 'normal';
        Object.assign(result, PRIORITY_COLORS[result.priority]);
    }
    if (Object.prototype.hasOwnProperty.call(result, 'category')) {
        const category = TASK_CATEGORIES.find(item => item.toLowerCase() === String(result.category || '').toLowerCase());
        result.category = category || 'None';
        if (result.category !== 'Contact') result.assignTo = null;
        if (result.category !== 'Lead') result.assignToLead = null;
    }
    return result;
};

const validateReferences = async (data) => {
    for (const key of ['assignTo', 'assignToLead', 'assignedToUser']) {
        if (!isValidId(data[key])) return `Invalid ${key} value`;
    }
    if (data.assignedToUser) {
        const exists = await User.exists({ _id: data.assignedToUser, deleted: false });
        if (!exists) return 'Assigned user was not found';
    }
    return null;
};

const taskPipeline = (match) => [
    { $match: match },
    { $lookup: { from: 'Contacts', localField: 'assignTo', foreignField: '_id', as: 'contact' } },
    { $lookup: { from: 'Leads', localField: 'assignToLead', foreignField: '_id', as: 'lead' } },
    { $lookup: { from: 'User', localField: 'createBy', foreignField: '_id', as: 'creator' } },
    { $lookup: { from: 'User', localField: 'assignedToUser', foreignField: '_id', as: 'assignee' } },
    { $unwind: { path: '$contact', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$assignee', preserveNullAndEmptyArrays: true } },
    { $addFields: {
        assignToName: { $cond: [
            { $ne: ['$contact._id', null] },
            { $trim: { input: { $concat: [{ $ifNull: ['$contact.firstName', ''] }, ' ', { $ifNull: ['$contact.lastName', ''] }] } } },
            { $ifNull: ['$lead.leadName', ''] },
        ] },
        createByName: { $let: {
            vars: { fullName: { $trim: { input: { $concat: [{ $ifNull: ['$creator.firstName', ''] }, ' ', { $ifNull: ['$creator.lastName', ''] }] } } } },
            in: { $cond: [{ $ne: ['$$fullName', ''] }, '$$fullName', { $ifNull: ['$creator.username', ''] }] },
        } },
        assignedToUserName: { $let: {
            vars: { fullName: { $trim: { input: { $concat: [{ $ifNull: ['$assignee.firstName', ''] }, ' ', { $ifNull: ['$assignee.lastName', ''] }] } } } },
            in: { $cond: [{ $ne: ['$$fullName', ''] }, '$$fullName', { $ifNull: ['$assignee.username', ''] }] },
        } },
    } },
    { $project: { contact: 0, lead: 0, creator: 0, assignee: 0 } },
    { $sort: { createdDate: -1, _id: -1 } },
];

const index = async (req, res) => {
    try {
        const user = await currentUser(req);
        if (!user) return res.status(401).json({ message: 'Authentication failed' });
        const query = { deleted: false };
        if (req.query.status && TASK_STATUSES.includes(req.query.status)) query.status = req.query.status;
        if (req.query.assignedToUser && user.role === 'admin' && isValidId(req.query.assignedToUser)) {
            query.assignedToUser = new mongoose.Types.ObjectId(req.query.assignedToUser);
        }
        const result = await Task.aggregate(taskPipeline(accessFilter(user, query)));
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load tasks', error: error.message });
    }
};

const assignees = async (req, res) => {
    try {
        const users = await User.find({ deleted: false }).select('_id firstName lastName username role').sort({ firstName: 1, lastName: 1 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load users', error: error.message });
    }
};

const add = async (req, res) => {
    try {
        const user = await currentUser(req);
        if (!user) return res.status(401).json({ message: 'Authentication failed' });
        const taskData = normalizeTask(req.body, user);
        const validationError = await validateReferences(taskData);
        if (validationError) return res.status(400).json({ message: validationError });
        taskData.createBy = user._id;
        taskData.createdDate = new Date();
        const result = await Task.create(taskData);
        await sendTaskAssignmentEmail(result, user);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: 'Failed to create task', error: error.message });
    }
};

const findAccessible = async (req, id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const user = await currentUser(req);
    if (!user) return null;
    return { user, task: await Task.findOne(accessFilter(user, { _id: id, deleted: false })) };
};

const edit = async (req, res) => {
    try {
        const access = await findAccessible(req, req.params.id);
        if (!access?.task) return res.status(404).json({ message: 'Task not found or access denied' });
        const taskData = normalizeTask(req.body, access.user, access.task);
        const validationError = await validateReferences(taskData);
        if (validationError) return res.status(400).json({ message: validationError });
        const assigneeChanged = taskData.assignedToUser && String(taskData.assignedToUser) !== String(access.task.assignedToUser || '');
        const result = await Task.findByIdAndUpdate(req.params.id, { $set: taskData }, { new: true, runValidators: true });
        if (assigneeChanged) await sendTaskAssignmentEmail(result, access.user);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: 'Failed to update task', error: error.message });
    }
};

const changeStatus = async (req, res) => {
    try {
        if (!TASK_STATUSES.includes(req.body.status)) return res.status(400).json({ message: 'Invalid task status' });
        const access = await findAccessible(req, req.params.id);
        if (!access?.task) return res.status(404).json({ message: 'Task not found or access denied' });
        access.task.status = req.body.status;
        access.task.updatedDate = new Date();
        await access.task.save();
        res.status(200).json(access.task);
    } catch (error) {
        res.status(400).json({ message: 'Failed to change status', error: error.message });
    }
};

const view = async (req, res) => {
    try {
        const access = await findAccessible(req, req.params.id);
        if (!access?.task) return res.status(404).json({ message: 'Task not found or access denied' });
        const [result] = await Task.aggregate(taskPipeline({ _id: access.task._id }));
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: 'Failed to load task', error: error.message });
    }
};

const deleteData = async (req, res) => {
    try {
        const access = await findAccessible(req, req.params.id);
        if (!access?.task) return res.status(404).json({ message: 'Task not found or access denied' });
        access.task.deleted = true;
        await access.task.save();
        res.status(200).json({ message: 'Task removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to remove task', error: error.message });
    }
};

const deleteMany = async (req, res) => {
    try {
        const user = await currentUser(req);
        if (!user) return res.status(401).json({ message: 'Authentication failed' });
        const ids = Array.isArray(req.body) ? req.body.filter(mongoose.Types.ObjectId.isValid) : [];
        const result = await Task.updateMany(accessFilter(user, { _id: { $in: ids }, deleted: false }), { $set: { deleted: true, updatedDate: new Date() } });
        res.status(200).json({ message: 'Tasks removed successfully', result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to remove tasks', error: error.message });
    }
};

module.exports = { index, assignees, add, edit, view, deleteData, changeStatus, deleteMany, sendTaskAssignmentEmail };
