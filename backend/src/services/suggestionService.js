const env = require('../config/env');
const { HttpError, serviceUnavailable, badRequest } = require('../utils/httpError');
const { COUNTRY_PATTERN } = require('../constants/patterns');

// ---------------------------------------------------------------------------
// No hardcoded country list. The model uses its own knowledge of world GDP
// rankings to pick which markets to propose overrides for. The server only
// validates that returned codes are well-formed ISO 3166-1 alpha-2.
// ---------------------------------------------------------------------------

const MAX_SUGGESTIONS = 10;

let _client = null;
const getClient = () => {
  if (_client) return _client;
  if (!env.llm.apiKey) return null;
  const OpenAI = require('openai');
  _client = new OpenAI({
    apiKey: env.llm.apiKey,
    baseURL: env.llm.baseUrl,
  });
  return _client;
};

const buildPrompt = ({ key, description, defaultValue }) => [
  {
    role: 'system',
    content:
`You propose locale-specific value overrides for mobile-app remote-config parameters.

Do the task in three steps, then return JSON.

STEP 1 — ANALYZE the parameter. Which localization lenses actually apply?
  - language   (copy, language-specific emails, localized doc URLs)
  - currency   (prices, product SKUs, payment methods)
  - regulation (GDPR in EU, CCPA in US-CA, KVKK in TR, PIPL in CN, DPDP in IN, etc.)
  - network    (slower-data markets may need lower quality/smaller assets)
  - content    (content ratings, feature availability by policy)
  - rollout    (staged version/feature releases by market)
  - time       (timezone/calendar-sensitive copy)
  - NONE       (pure technical constants, API keys, flags → no localization)

Many parameters do not need localization at all. When that's the case, return an empty suggestions list — do NOT invent reasons.

STEP 2 — SELECT at most ${MAX_SUGGESTIONS} countries. Use your own knowledge of current nominal-GDP rankings to draw candidates from the world's largest economies (think the top ~15 by GDP). From those, pick the countries MOST DISTINCT along the lens(es) you identified. Avoid duplicates along the chosen lens. For a language-sensitive value, do not propose both US and GB (same language). For a currency-sensitive value, avoid proposing several eurozone countries (same currency). Favor markets where the value will meaningfully differ.

STEP 3 — PROPOSE values that preserve the default's type exactly:
  - string stays string, number stays number, boolean stays boolean
  - a JSON-string default (e.g. "{\\"products\\":[...]}") stays a valid JSON string
  - do NOT invent URLs or emails unless the default makes the substitution obvious
    (e.g. "privacy_en.html" → "privacy_de.html" is fine; inventing "support@de.example.com" is not)

Country codes MUST be ISO 3166-1 alpha-2 (two uppercase letters: US, DE, JP, ...).

Return strict JSON:
{
  "lenses": ["..."],
  "reasoning": "one or two sentences explaining why these lenses and this country selection",
  "suggestions": [
    { "country": "XX", "value": <same-type-as-default>, "rationale": "short per-country reason" }
  ]
}

If the parameter does not warrant localization, return:
{ "lenses": ["none"], "reasoning": "...", "suggestions": [] }`,
  },
  {
    role: 'user',
    content:
      `Parameter key: ${key}\n` +
      `Description: ${description || '(none)'}\n` +
      `Default value (JSON-encoded): ${JSON.stringify(defaultValue)}`,
  },
];

// Single-country variant: ask for ONE specific country only.
const buildPromptForCountry = ({ key, description, defaultValue, country }) => [
  {
    role: 'system',
    content:
`You propose a locale-specific value override for a mobile-app remote-config parameter, for ONE specific country: ${country}.

STEP 1 — INFER THE VALUE'S DOMAIN.
The default value may be self-explanatory (a price, a URL, a boolean) OR it may be an opaque identifier from a discrete enumeration (e.g. "t6", "plan_b", "tier_3", "v2", "EU_LOW"). When the value looks like an opaque code:
  - Assume it belongs to an ordered or categorical family (tiers, plans, versions, regional buckets).
  - Use the parameter key, description, and the code's own pattern to guess the family. A key like "pricing_tier" with value "t6" implies tiers t1..tN where higher = higher price.
  - DO NOT just return the default unchanged. The whole point is to propose a plausible *different* member of the same family that fits the target market — e.g. a lower pricing tier for a lower-PPP country, an earlier rollout version for a slow-update market.
  - If you cannot infer a sensible alternative member of the family, return suggestions: [] with reasoning that explains why.

STEP 2 — IDENTIFY THE LENS.
Which localization lens applies for ${country}? language, currency, regulation, network, content, rollout, time, or none.
For pricing/tier-like values the lens is usually currency or content (purchasing power, market positioning).

STEP 3 — PROPOSE.
Propose a single value for ${country} that:
  - preserves the default's type exactly (string→string, number→number, boolean→boolean, JSON-string stays valid JSON)
  - if the default is an opaque code, stays in the SAME family/format (e.g. "t6" → "t3", not "t6" → "cheap")
  - does NOT invent URLs/emails unless the default makes the substitution obvious
    (e.g. "privacy_en.html" → "privacy_de.html" is fine; inventing "support@de.example.com" is not)

If the parameter genuinely does not need a country-specific override for ${country} (e.g. a pure technical constant, an API key, or the default already fits), return suggestions: [].

Return strict JSON:
{
  "lenses": ["..."],
  "reasoning": "one or two short sentences: (a) what family/domain you inferred for the value, (b) why ${country} should map to the proposed member (or why no override is needed)",
  "suggestions": [
    { "country": "${country}", "value": <same-type-as-default>, "rationale": "short reason for this specific value in ${country}" }
  ]
}`,
  },
  {
    role: 'user',
    content:
      `Parameter key: ${key}\n` +
      `Description: ${description || '(none)'}\n` +
      `Default value (JSON-encoded): ${JSON.stringify(defaultValue)}\n` +
      `Target country: ${country}`,
  },
];

const parseModelJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    // Some models wrap JSON in markdown fences — strip and retry once.
    const stripped = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return JSON.parse(stripped);
  }
};

const suggestCountryValues = async ({ key, description, defaultValue, country }) => {
  const client = getClient();
  if (!client) {
    throw serviceUnavailable('AI suggestions are not configured on this server.');
  }
  if (defaultValue === undefined || defaultValue === null || defaultValue === '') {
    throw badRequest('A default value is required to generate suggestions.');
  }

  // Optional single-country mode.
  let targetCountry = null;
  if (country !== undefined && country !== null && country !== '') {
    targetCountry = String(country).toUpperCase();
    if (!COUNTRY_PATTERN.test(targetCountry)) {
      throw badRequest(`Invalid country code: "${country}". Use ISO 3166-1 alpha-2 (e.g. "TR").`);
    }
  }

  const messages = targetCountry
    ? buildPromptForCountry({ key, description, defaultValue, country: targetCountry })
    : buildPrompt({ key, description, defaultValue });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: env.llm.model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages,
    });
  } catch (err) {
    throw mapLlmError(err);
  }

  const raw = completion.choices?.[0]?.message?.content || '{}';
  const parsed = parseModelJson(raw);

  // Defense-in-depth: require well-formed ISO alpha-2, dedupe, and cap length.
  // In single-country mode, also drop anything that isn't the requested country.
  const rawList = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const seen = new Set();
  const suggestions = [];
  for (const s of rawList) {
    if (!s || typeof s !== 'object') continue;
    const code = String(s.country || '').toUpperCase();
    if (!COUNTRY_PATTERN.test(code) || seen.has(code)) continue;
    if (targetCountry && code !== targetCountry) continue;
    seen.add(code);
    suggestions.push({
      country: code,
      value: s.value,
      rationale: typeof s.rationale === 'string' ? s.rationale : '',
    });
    if (suggestions.length >= (targetCountry ? 1 : MAX_SUGGESTIONS)) break;
  }

  const lenses = Array.isArray(parsed.lenses)
    ? parsed.lenses.map((x) => String(x)).slice(0, 4)
    : [];
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

  return { lenses, reasoning, suggestions };
};

// Maps LLM SDK errors to HttpErrors with actionable messages.
const mapLlmError = (err) => {
  const status = err?.status;
  const code = err?.error?.code || err?.code;
  if (status === 401 || status === 403) {
    return new HttpError(502, 'LLM rejected the API key. Check LLM_API_KEY on the server.');
  }
  if (status === 429) {
    if (code === 'insufficient_quota') {
      return new HttpError(
        502,
        'LLM quota exceeded. Check your provider dashboard for billing/limits.'
      );
    }
    return new HttpError(503, 'LLM is rate-limiting requests. Please try again in a few seconds.');
  }
  if (status >= 500) {
    return new HttpError(502, 'LLM service is currently unavailable.');
  }
  return new HttpError(502, `AI suggestion failed: ${err?.message || 'unknown error'}`);
};

module.exports = { suggestCountryValues };
