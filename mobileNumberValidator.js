/*
 * Validates a mobile number and resolves carrier information when available.
 *
 * Carrier detection is only reliable when backed by a carrier lookup provider
 * such as Twilio Lookup, Numverify, or another telecom data service. Prefix maps
 * are supported as a simple fallback, but they may be wrong for ported numbers.
 */

const DEFAULT_COUNTRY_RULES = {
  US: {
    countryCode: '1',
    nationalNumberLength: 10,
    mobilePattern: /^[2-9]\d{2}[2-9]\d{6}$/,
    formatNational: (digits) => `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  },
  CA: {
    countryCode: '1',
    nationalNumberLength: 10,
    mobilePattern: /^[2-9]\d{2}[2-9]\d{6}$/,
    formatNational: (digits) => `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  },
  GB: {
    countryCode: '44',
    nationalNumberLength: 10,
    mobilePattern: /^7\d{9}$/,
    formatNational: (digits) => `0${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
};

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeMobileNumber(value, country = 'US', countryRules = DEFAULT_COUNTRY_RULES) {
  const rule = countryRules[country];

  if (!rule) {
    return {
      isValid: false,
      reason: `Unsupported country: ${country}`,
      input: value,
      country
    };
  }

  let digits = onlyDigits(value);

  if (digits.startsWith(rule.countryCode) && digits.length === rule.countryCode.length + rule.nationalNumberLength) {
    digits = digits.slice(rule.countryCode.length);
  }

  if (country === 'GB' && digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (digits.length !== rule.nationalNumberLength) {
    return {
      isValid: false,
      reason: `Expected ${rule.nationalNumberLength} national digits for ${country}`,
      input: value,
      country
    };
  }

  if (!rule.mobilePattern.test(digits)) {
    return {
      isValid: false,
      reason: 'Number does not match the mobile number pattern',
      input: value,
      country,
      nationalNumber: digits
    };
  }

  return {
    isValid: true,
    reason: 'Valid mobile number format',
    input: value,
    country,
    countryCode: rule.countryCode,
    nationalNumber: digits,
    e164: `+${rule.countryCode}${digits}`,
    formatted: rule.formatNational(digits)
  };
}

function findCarrierFromPrefix(nationalNumber, carrierPrefixes = {}) {
  const matchingPrefix = Object.keys(carrierPrefixes)
    .filter((prefix) => nationalNumber.startsWith(prefix))
    .sort((first, second) => second.length - first.length)[0];

  return matchingPrefix ? carrierPrefixes[matchingPrefix] : null;
}

function normalizeCarrierLookupResult(lookupResult) {
  if (!lookupResult) {
    return {
      carrier: null,
      lineType: null
    };
  }

  if (typeof lookupResult === 'string') {
    return {
      carrier: lookupResult,
      lineType: null
    };
  }

  return {
    carrier: lookupResult.carrier || lookupResult.name || null,
    lineType: lookupResult.lineType || lookupResult.type || null
  };
}

async function checkMobileNumber(value, options = {}) {
  const {
    country = 'US',
    countryRules = DEFAULT_COUNTRY_RULES,
    carrierPrefixes = {},
    carrierLookup
  } = options;

  const validation = normalizeMobileNumber(value, country, countryRules);

  if (!validation.isValid) {
    return {
      ...validation,
      carrier: null,
      carrierDisplay: 'Carrier unavailable'
    };
  }

  let carrier = null;
  let lineType = null;

  if (typeof carrierLookup === 'function') {
    const lookupResult = normalizeCarrierLookupResult(await carrierLookup(validation.e164));
    carrier = lookupResult.carrier;
    lineType = lookupResult.lineType;
  }

  if (lineType && lineType.toLowerCase() !== 'mobile') {
    return {
      ...validation,
      isValid: false,
      reason: `Number is ${lineType}, not mobile`,
      carrier,
      lineType,
      carrierDisplay: carrier ? `Carrier: ${carrier}` : 'Carrier unavailable'
    };
  }

  if (!carrier) {
    carrier = findCarrierFromPrefix(validation.nationalNumber, carrierPrefixes);
  }

  return {
    ...validation,
    carrier,
    lineType,
    carrierDisplay: carrier ? `Carrier: ${carrier}` : 'Carrier unavailable'
  };
}

function displayMobileCheckResult(result, targetElement) {
  const message = result.isValid
    ? `${result.formatted} is valid. ${result.carrierDisplay}.`
    : `Invalid mobile number. ${result.reason}.`;

  if (targetElement) {
    targetElement.textContent = message;
  }

  return message;
}

// Browser usage:
// checkMobileNumber('555-123-4567', {
//   country: 'US',
//   carrierPrefixes: {
//     '555123': 'Example Wireless'
//   }
// }).then((result) => displayMobileCheckResult(result, document.getElementById('mobile-result')));

// Node/CommonJS usage:
if (typeof module !== 'undefined') {
  module.exports = {
    DEFAULT_COUNTRY_RULES,
    normalizeMobileNumber,
    checkMobileNumber,
    normalizeCarrierLookupResult,
    displayMobileCheckResult
  };
}
