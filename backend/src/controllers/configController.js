const asyncHandler = require('../utils/asyncHandler');
const parameterService = require('../services/parameterService');

// Public config endpoint for mobile clients.
// Country comes from the `country` query param (ISO 3166-1 alpha-2).
const getConfig = asyncHandler(async (req, res) => {
  const country = req.query.country ? String(req.query.country) : null;
  const config = await parameterService.buildConfigForCountry(country);

  // Short client-side cache; can be tuned per deployment.
  res.set('Cache-Control', 'public, max-age=60');
  res.json(config);
});

module.exports = { getConfig };
