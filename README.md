# GriffithTest

## Mobile Number Validation

This repository includes `mobileNumberValidator.js`, a standalone JavaScript utility that checks whether a mobile number is valid for a supported country and displays carrier information when available.

Carrier lookup from a phone number alone is not always reliable because mobile numbers can be ported between carriers. For production use, pass a lookup function backed by a service such as Twilio Lookup, Numverify, or another telecom data provider. A prefix map can be used as a lightweight fallback.

```javascript
const { checkMobileNumber, displayMobileCheckResult } = require('./mobileNumberValidator');

async function run() {
	const result = await checkMobileNumber('202-555-0143', {
		country: 'US',
		carrierPrefixes: {
			'202555': 'Example Wireless'
		}
	});

	console.log(displayMobileCheckResult(result));
}

run();
```

You can also pass a carrier lookup callback:

```javascript
const result = await checkMobileNumber('+12025550143', {
	country: 'US',
	carrierLookup: async (e164Number) => {
		// Call your carrier lookup API here and return the carrier name and line type.
		return {
			carrier: 'Example Wireless',
			lineType: 'mobile'
		};
	}
});
```