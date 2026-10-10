const mongoose = require('mongoose');
const Notification = require('../../model/schema/notification');
const { notificationScope } = require('../../services/recordSharing');

const index = async (req, res) => {
    try {
        const recipient = req.user.userId;
        const baseQuery = { recipient, ...await notificationScope(req) };
        const query = { ...baseQuery };
        const limit = Math.max(1, Math.min(100, parseInt(req.query?.limit, 10) || 30));
        if (req.query?.before) {
            if (!/^[a-f\d]{24}$/i.test(req.query.before)) return res.status(400).json({ message: 'Invalid notification cursor' });
            query._id = { $lt: new mongoose.Types.ObjectId(req.query.before) };
        }
        const [rows, unreadCount] = await Promise.all([
            Notification.find(query)
                .populate('actor', 'firstName lastName username')
                .sort({ _id: -1 })
                .limit(limit + 1)
                .lean(),
            Notification.countDocuments({ ...baseQuery, readAt: null }),
        ]);
        const notifications = rows.slice(0, limit);
        const hasMore = rows.length > limit;
        res.status(200).json({
            notifications, unreadCount, hasMore,
            nextCursor: hasMore ? String(notifications[notifications.length - 1]._id) : null,
        });
    } catch (error) {
        console.error('Failed to load notifications:', error.message);
        res.status(500).json({ message: 'Failed to load notifications' });
    }
};

const markRead = async (req, res) => {
    try {
        if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid notification ID' });
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.userId, ...await notificationScope(req) },
            [{ $set: { readAt: { $ifNull: ['$readAt', new Date()] } } }],
            { new: true },
        );
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        return res.status(200).json(notification);
    } catch (error) {
        console.error('Failed to mark notification as read:', error.message);
        return res.status(500).json({ message: 'Failed to update notification' });
    }
};

const markAllRead = async (req, res) => {
    try {
        const readAt = new Date();
        const recipient = req.user.userId;
        const access = await notificationScope(req);
        const result = await Notification.updateMany(
            { recipient, readAt: null, createdAt: { $lte: readAt }, ...access },
            { $set: { readAt } },
        );
        const unreadCount = await Notification.countDocuments({ recipient, readAt: null, ...access });
        return res.status(200).json({ updatedCount: result.modifiedCount, readAt, unreadCount });
    } catch (error) {
        console.error('Failed to mark notifications as read:', error.message);
        return res.status(500).json({ message: 'Failed to update notifications' });
    }
};

module.exports = { index, markRead, markAllRead };
