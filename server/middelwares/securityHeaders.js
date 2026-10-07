const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { createHash } = require('crypto');
const securityHeaders = helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'same-site' },
  // TLS may terminate at IIS; do not enable HSTS on an HTTP-only deployment.
  strictTransportSecurity: false,
});
const mutationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false,
  skip: req => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: { code: 'rateLimited', message: 'Too many requests. Please try again later.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  // Colleagues sharing an IP must not consume one another's login attempts.
  // The separate mutation limiter still bounds total requests from that IP.
  keyGenerator: req => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const account = username.length <= 254 ? username : '';
    return ipKeyGenerator(req.ip) + ':' + createHash('sha256').update(account).digest('hex');
  },
  skipSuccessfulRequests: true,
  message: { code: 'rateLimited', message: 'Too many login attempts. Please try again later.' },
});
const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ code: 'tooLarge' });
  if (error.status === 400 || error.name === 'MulterError' || error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ code: 'invalid' });
  console.error('Request failed:', error.name || 'Error');
  res.status(500).json({ code: 'internalError', message: 'Request failed' });
};
const hideInternalErrors = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = value => {
    if (res.statusCode >= 400 && value && typeof value === 'object' && !Array.isArray(value)) {
      value = { ...value };
      for (const key of ['err', 'Error']) delete value[key];
      if (value.error) value.error = 'Request failed';
    }
    return json(value);
  };
  next();
};
module.exports = { securityHeaders, mutationLimiter, loginLimiter, hideInternalErrors, errorHandler };
