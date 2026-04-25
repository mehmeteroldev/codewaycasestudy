require('dotenv').config();

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

const parseOrigins = (raw) =>
  (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT) || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),

  firebase: {
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || null,
    applicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
  },

  mobileApiToken: required('MOBILE_API_TOKEN'),

  // Provider-agnostic LLM config. The SDK is OpenAI's, but any OpenAI-compatible
  // endpoint works: Gemini, Groq, OpenRouter, Ollama, etc.
  llm: {
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || null,
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gemini-2.5-flash-lite',
    baseUrl:
      process.env.LLM_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta/openai/',
  },
};
