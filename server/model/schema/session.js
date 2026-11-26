const mongoose = require('mongoose');

// Server-side login session: a signed token is only accepted while its session
// exists, belongs to the same account, has not expired and was not revoked.
const session = new mongoose.Schema({
    _id: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rememberMe: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, maxlength: 512 },
    ip: { type: String, maxlength: 64 },
}, { versionKey: false });

// MongoDB removes expired sessions; validity never depends on this cleanup.
session.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Session || mongoose.model('Session', session, 'Session');
