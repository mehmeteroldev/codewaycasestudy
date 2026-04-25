const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
require('./config/firebase'); // initialize Firebase Admin on boot

const panelRoutes = require('./routes/panelRoutes');
const configRoutes = require('./routes/configRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// CORS: allow any origin in dev, explicit allowlist in prod.
const corsOptions =
  env.nodeEnv === 'production'
    ? { origin: env.corsOrigins.length ? env.corsOrigins : false, credentials: false }
    : { origin: true };
app.use(cors(corsOptions));

// Mobile-facing endpoint is the hot path — rate-limit it.
const configLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/api/config', configLimiter, configRoutes);
app.use('/api/panel', panelRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
