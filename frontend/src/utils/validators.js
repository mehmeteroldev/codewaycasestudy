export const COUNTRY_CODE = /^[A-Z]{2}$/;

export const normalizeCountryCode = (code) => String(code || '').trim().toUpperCase();

export const isCountryCode = (code) => COUNTRY_CODE.test(normalizeCountryCode(code));
