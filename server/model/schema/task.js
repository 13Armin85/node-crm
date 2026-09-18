
const mongoose = require('mongoose');

const Task = new mongoose.Schema({
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    title: String,
    category: String,
    description: String,
    notes: String,
    assignTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contact",
    },
    assignToLead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
    },
    assignedToUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    delegatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    reminder: String,
    start: String,
    end: String,
    backgroundColor: String,
    borderColor: String,
    textColor: String,
    display: String,
    url: String,
    allDay: Boolean,
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['todo', 'inProgress', 'pending', 'onHold', 'completed'],
        default: "todo"
    },
    createdDate: {
        type: Date,
    },
    deleted: {
        type: Boolean,
        default: false,
    },
})

Task.index({ assignedToUser: 1, deleted: 1, status: 1 });
Task.index({ createBy: 1, deleted: 1 });

module.exports = mongoose.model('Tasks', Task, 'Tasks');
