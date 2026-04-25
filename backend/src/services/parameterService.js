const repo = require('../repositories/parameterRepository');
const { badRequest, notFound, conflict } = require('../utils/httpError');
const { KEY_PATTERN, COUNTRY_PATTERN } = require('../constants/patterns');

const validateKey = (key) => {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    throw badRequest(
      'Invalid key: must start with a letter and contain only letters, digits, or underscores (max 64 chars).'
    );
  }
};

const validateCountryOverrides = (overrides) => {
  if (overrides == null) return {};
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw badRequest('countryOverrides must be an object keyed by ISO 3166-1 alpha-2 country codes.');
  }
  const normalized = {};
  for (const [code, val] of Object.entries(overrides)) {
    const up = String(code).toUpperCase();
    if (!COUNTRY_PATTERN.test(up)) {
      throw badRequest(`Invalid country code: "${code}". Use ISO 3166-1 alpha-2 (e.g. "TR", "US").`);
    }
    normalized[up] = val;
  }
  return normalized;
};

const listAll = () => repo.listAll();

const create = async ({ key, value, description, countryOverrides }) => {
  validateKey(key);
  if (value === undefined) throw badRequest('value is required');
  const normalizedOverrides = validateCountryOverrides(countryOverrides);

  const existing = await repo.findByKey(key);
  if (existing) throw conflict(`A parameter with key "${key}" already exists.`);

  return repo.create({
    key,
    value,
    description,
    countryOverrides: normalizedOverrides,
  });
};

const update = async (id, { value, description, countryOverrides, expectedVersion }) => {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw badRequest('expectedVersion (positive integer) is required for concurrency control.');
  }

  const patch = {};
  if (value !== undefined) patch.value = value;
  if (description !== undefined) patch.description = String(description);
  if (countryOverrides !== undefined) {
    patch.countryOverrides = validateCountryOverrides(countryOverrides);
  }
  if (Object.keys(patch).length === 0) {
    throw badRequest('No updatable fields supplied.');
  }

  try {
    await repo.updateWithVersion(id, expectedVersion, patch);
  } catch (err) {
    if (err.code === 'NOT_FOUND') throw notFound('Parameter not found');
    if (err.code === 'VERSION_MISMATCH') {
      throw conflict(
        'Parameter was modified by someone else. Please reload and retry.',
        { current: err.current }
      );
    }
    throw err;
  }

  return repo.findById(id);
};

const remove = async (id) => {
  const existing = await repo.findById(id);
  if (!existing) throw notFound('Parameter not found');
  await repo.remove(id);
};

// Mobile-serving view: resolve per-country overrides into a flat { key: value } map.
const buildConfigForCountry = async (country) => {
  const all = await repo.listAll();
  const code = country ? String(country).toUpperCase() : null;
  const result = {};
  for (const p of all) {
    if (code && COUNTRY_PATTERN.test(code) && p.countryOverrides && code in p.countryOverrides) {
      result[p.key] = p.countryOverrides[code];
    } else {
      result[p.key] = p.value;
    }
  }
  return result;
};

module.exports = {
  listAll,
  create,
  update,
  remove,
  buildConfigForCountry,
};
