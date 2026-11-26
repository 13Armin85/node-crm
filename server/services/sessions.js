const crypto = require('crypto');
const Session = require('../model/schema/session');

const DAY = 24 * 60 * 60 * 1000;
const SESSION_ID = /^[a-f\d]{64}$/;

const createSession = async (req, user, rememberMe) => {
  const _id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 1) * DAY);
  await Session.create({
    _id, userId: user._id, rememberMe, expiresAt,
    userAgent: String(req.headers?.['user-agent'] || '').slice(0, 512) || undefined,
    ip: String(req.ip || '').slice(0, 64) || undefined,
  });
  return { sid: _id, expiresAt };
};

const isActiveSession = async (sid, userId) => {
  if (typeof sid !== 'string' || !SESSION_ID.test(sid)) return false;
  return Boolean(await Session.exists({ _id: sid, userId, revokedAt: null, expiresAt: { $gt: new Date() } }));
};

const revokeSession = (sid, userId) => SESSION_ID.test(String(sid || ''))
  ? Session.updateOne({ _id: sid, userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
  : Promise.resolve();

const revokeUserSessions = (userId) => Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

module.exports = { createSession, isActiveSession, revokeSession, revokeUserSessions, SESSION_ID };
