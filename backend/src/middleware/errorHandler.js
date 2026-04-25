const { HttpError } = require('../utils/httpError');

// 404 for unmatched routes
const notFoundHandler = (req, res) => {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
};

// Central error handler — keeps response shape consistent.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }
  // Log unexpected errors but never leak internals to the client
  console.error('[unhandled]', err);
  res.status(500).json({ error: { message: 'Internal server error' } });
};

module.exports = { errorHandler, notFoundHandler };
