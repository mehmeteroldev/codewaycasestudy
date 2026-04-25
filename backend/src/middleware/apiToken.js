const crypto = require('crypto');
const env = require('../config/env');
const { unauthorized } = require('../utils/httpError');

// Constant-time compare to prevent timing attacks.
const safeEqual = (a, b) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

// Used by mobile clients hitting the public config endpoint.
// Token can be sent either as `x-api-key: <token>` or `Authorization: Bearer <token>`.
module.exports = (req, _res, next) => {
  const headerToken =
    req.headers['x-api-key'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!headerToken || !safeEqual(String(headerToken), env.mobileApiToken)) {
    return next(unauthorized('Invalid API token'));
  }
  next();
};
