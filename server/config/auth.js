const secret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'secret_key' : '');

if (!secret) {
  throw new Error('JWT_SECRET is required when NODE_ENV=production');
}

module.exports = { jwtSecret: secret };
