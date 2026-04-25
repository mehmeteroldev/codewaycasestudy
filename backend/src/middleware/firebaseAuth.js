const { auth } = require('../config/firebase');
const { unauthorized } = require('../utils/httpError');

// Verifies a Firebase ID token supplied in the `Authorization: Bearer <token>` header.
// On success, attaches the decoded token to req.user.
module.exports = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw unauthorized('Missing or malformed Authorization header');

    const decoded = await auth.verifyIdToken(match[1]);
    req.user = { uid: decoded.uid, email: decoded.email || null };
    next();
  } catch (err) {
    if (err.status) return next(err);
    next(unauthorized('Invalid Firebase ID token'));
  }
};
