const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    type: {
        type: String,
        enum: ['task_assigned', 'task_status_changed', 'task_updated', 'task_unassigned', 'task_deleted', 'record_created', 'record_updated', 'record_deleted', 'record_status_changed', 'record_assigned', 'record_shared', 'property_sold', 'account_created', 'account_updated', 'role_changed', 'document_uploaded', 'document_linked'],
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    status: String,
    module: String,
    entityId: mongoose.Schema.Types.ObjectId,
    link: {
        type: String,
        default: '/task',
    },
    readAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, _id: -1 });

module.exports = mongoose.model('Notification', notificationSchema, 'Notifications');
