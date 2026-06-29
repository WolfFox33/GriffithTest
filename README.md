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

## Power Platform Table Modal

`tableValueModal.js` queries a Microsoft Power Platform Dataverse table and displays a field value in a large tooltip-style modal popup box. The popup is sized to comfortably hold more than 500 characters, includes a friendly person avatar in the top-right corner, and uses a warm Griffith Foods-inspired color palette.

Add `tableValueModal.js` as a JavaScript web resource on the model-driven app form. Then call the function from a form event, command button, ribbon command, or another script.

Show a large tooltip-style popup on mouseover and query the current form record by entity name and field name:

```html
<button
	type="button"
	onmouseover="showEntityFieldTooltip(event, 'account', 'description', { title: 'Account Description' })"
	onmouseleave="closePowerPlatformFieldModal()">
	Show Description
</button>
```

You can also attach the mouseover behavior from JavaScript:

```javascript
attachEntityFieldTooltip('#descriptionHelp', 'account', 'description', {
	title: 'Account Description'
});
```

Retrieve a value from the current form record by passing only the entity logical name and field logical name:

```javascript
showEntityFieldModal('account', 'description');
```

This uses the current form record ID automatically. The entity logical name must match the table for the current form.

You can also include a title:

```javascript
showEntityFieldModal('account', 'description', {
	title: 'Account Description'
});
```

Retrieve a value by table name and record ID:

```javascript
PowerPlatformFieldModal.showTableValueModal('account', 'description', {
	recordId: '00000000-0000-0000-0000-000000000000',
	title: 'Account Description'
});
```

Retrieve the first matching row with an OData filter:

```javascript
PowerPlatformFieldModal.showTableValueModal('contact', 'mobilephone', {
	filter: "lastname eq 'Smith'",
	orderBy: 'createdon desc',
	title: 'Mobile Phone'
});
```

The first argument is the Dataverse entity/table logical name, such as `account`, `contact`, or `new_customtable`. The second argument is the field logical name, such as `description`, `mobilephone`, or `new_notes`.

The helper uses `Xrm.WebApi`, so it must run inside a Power Platform model-driven app. It formats common Dataverse values before display, including formatted option-set labels, lookup names, dates, booleans, and plain text fields.

You can still display a field from the current form without querying a table:

```javascript
PowerPlatformFieldModal.showFieldModal(executionContext, 'description', {
	title: 'Current Form Description'
});
```