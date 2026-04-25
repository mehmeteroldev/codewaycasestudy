const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`[config-api] listening on :${env.port} (${env.nodeEnv})`);
});

const shutdown = (signal) => {
  console.log(`[config-api] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  // Force exit if close hangs
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
