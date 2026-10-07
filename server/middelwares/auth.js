const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

const auth = async (req, res, next) => {
    const authorization = req.headers.authorization;
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization;

    if (typeof token !== 'string' || !token || token.length > 8192) {
        return res.status(401).json({ code: 'unauthorized', message: "Authentication failed , Token missing" });
    }
    try {
        const decode = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
        if (!decode || typeof decode !== 'object' || !Number.isFinite(decode.exp) || !/^[a-f\d]{24}$/i.test(String(decode.userId || ''))) return res.status(401).json({ code: 'unauthorized' });
        const User = require('../model/schema/user');
        req.actor = await User.findOne({ _id: decode.userId, deleted: false }).select('-password +authVersion');
        if (!req.actor || Number(decode.sv || 0) !== Number(req.actor.authVersion || 0)) return res.status(401).json({ code: 'unauthorized' });
        req.user = decode;
        const subjectId = req.headers['x-crm-data-user'];
        const isRead = req.method === 'GET' || (req.method === 'POST' && req.baseUrl === '/api/reporting' && req.path === '/index');
        if (subjectId && isRead) {
            if (typeof subjectId !== 'string' || !/^[a-f\d]{24}$/i.test(subjectId)) return res.status(400).json({ code: 'invalid', field: 'dataUser' });
            const actor = req.actor;
            if (!actor) return res.status(401).json({ code: 'unauthorized' });
            if (!require('../services/userRoles').isAdmin(actor)) return res.status(403).json({ code: 'forbidden' });
            if (!await User.exists({ _id: subjectId, deleted: { $ne: true } })) return res.status(404).json({ code: 'notFound', field: 'dataUser' });
            req.dataSubject = new (require('mongoose').Types.ObjectId)(subjectId);
        }
        next();
    } catch (err) {
        return res.status(401).json({ code: 'unauthorized', message: 'Authentication failed. Invalid token.' })
    }
}

module.exports = auth
