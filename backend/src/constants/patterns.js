// Shared validation regexes — used by services that touch parameter shape.
module.exports = {
  KEY_PATTERN: /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/,
  COUNTRY_PATTERN: /^[A-Z]{2}$/,
};
