const bcrypt = require('bcrypt');
const { rateLimit } = require('express-rate-limit');
const User = require('../../model/schema/user');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: req => String(req.actor._id), skipSuccessfulRequests: true,
  message: { code: 'rateLimited' },
});

const handle = async (req, res, next) => {
  try {
    const body = req.body;
    const names = ['currentPassword', 'newPassword', 'confirmPassword'];
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(name => !names.includes(name))) return res.status(400).json({ code: 'invalid' });
    for (const field of names) if (typeof body[field] !== 'string' || !body[field].trim()) return res.status(400).json({ code: 'required', field });
    // Match the normalization used by sign-in and account creation.
    const current = body.currentPassword.trim(), password = body.newPassword.trim();
    if (Buffer.byteLength(current, 'utf8') > 72) return res.status(400).json({ code: 'invalid', field: 'currentPassword' });
    if (password.length < 8) return res.status(400).json({ code: 'passwordTooShort', field: 'newPassword' });
    if (Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ code: 'passwordTooLong', field: 'newPassword' });
    if (password !== body.confirmPassword.trim()) return res.status(400).json({ code: 'passwordMismatch', field: 'confirmPassword' });
    const account = await User.findOne({ _id: req.actor._id, deleted: { $ne: true } }).select('+password +authVersion');
    const version = Number(account?.authVersion || 0);
    if (!account || version !== Number(req.user.sv || 0)) return res.status(401).json({ code: 'unauthorized' });
    if (!await bcrypt.compare(current, account.password)) return res.status(400).json({ code: 'incorrectPassword', field: 'currentPassword' });
    if (password === current) return res.status(400).json({ code: 'samePassword', field: 'newPassword' });
    const hash = await bcrypt.hash(password, 10);
    const result = await User.updateOne({
      _id: account._id, password: account.password, deleted: { $ne: true },
      ...(version === 0 ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] } : { authVersion: version }),
    }, { $set: { password: hash, updatedDate: new Date() }, $inc: { authVersion: 1 } }, { runValidators: true });
    if (result.modifiedCount !== 1) return res.status(409).json({ code: 'passwordChangeConflict' });
    res.status(200).json({ code: 'passwordChanged' });
  } catch (error) { next(error); }
};
module.exports = { handle, limiter };
