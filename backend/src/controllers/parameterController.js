const asyncHandler = require('../utils/asyncHandler');
const parameterService = require('../services/parameterService');
const suggestionService = require('../services/suggestionService');
const { badRequest } = require('../utils/httpError');

const list = asyncHandler(async (_req, res) => {
  const items = await parameterService.listAll();
  res.json({ items });
});

const create = asyncHandler(async (req, res) => {
  const { key, value, description, countryOverrides } = req.body || {};
  const created = await parameterService.create({ key, value, description, countryOverrides });
  res.status(201).json(created);
});

const update = asyncHandler(async (req, res) => {
  const { value, description, countryOverrides, expectedVersion } = req.body || {};
  const updated = await parameterService.update(req.params.id, {
    value,
    description,
    countryOverrides,
    expectedVersion,
  });
  res.json(updated);
});

const remove = asyncHandler(async (req, res) => {
  await parameterService.remove(req.params.id);
  res.status(204).end();
});

const suggest = asyncHandler(async (req, res) => {
  const { key, description, defaultValue, country } = req.body || {};
  if (!key) throw badRequest('key is required');
  const result = await suggestionService.suggestCountryValues({
    key,
    description,
    defaultValue,
    country,
  });
  // Shape: { lenses, reasoning, suggestions }
  res.json(result);
});

module.exports = { list, create, update, remove, suggest };
