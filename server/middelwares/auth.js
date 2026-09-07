const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

const auth = (req, res, next) => {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : authorization;

    if (!token) {
        return res.status(401).json({ code: 'unauthorized', message: "Authentication failed , Token missing" });
    }
    try {
        const decode = jwt.verify(token, jwtSecret)
        req.user = decode
        next();
    } catch (err) {
        return res.status(401).json({ code: 'unauthorized', message: 'Authentication failed. Invalid token.' })
    }
}

module.exports = auth
