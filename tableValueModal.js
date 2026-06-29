/*
 * Queries a Microsoft Power Platform Dataverse table and displays a field value
 * in a large tooltip-style modal popup on mouseover.
 * The popup is sized to comfortably hold more than 500 characters and includes a
 * small person avatar in the top-right corner.
 */

const POWER_PLATFORM_FIELD_MODAL_ID = 'power-platform-field-modal';
const POWER_PLATFORM_FIELD_MODAL_STYLE_ID = 'power-platform-field-modal-styles';
let activeHoverRequestId = 0;

function ensurePowerPlatformFieldModalStyles() {
  if (document.getElementById(POWER_PLATFORM_FIELD_MODAL_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = POWER_PLATFORM_FIELD_MODAL_STYLE_ID;
  style.textContent = `
    .table-value-modal-backdrop {
      align-items: center;
      background: rgba(39, 55, 43, 0.68);
      bottom: 0;
      display: flex;
      justify-content: center;
      left: 0;
      padding: 24px;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 9999;
    }

    .table-value-modal-tooltip-layer {
      left: 0;
      pointer-events: none;
      position: fixed;
      top: 0;
      z-index: 9999;
    }

    .table-value-modal-tooltip-layer .table-value-modal-box {
      pointer-events: auto;
      width: min(760px, calc(100vw - 32px));
    }

    .table-value-modal-box {
      background: #fff8ed;
      border: 2px solid #d6a33f;
      border-radius: 8px;
      box-shadow: 0 24px 70px rgba(39, 55, 43, 0.32);
      color: #26362a;
      max-height: 80vh;
      max-width: 820px;
      min-height: 360px;
      padding: 32px 32px 28px;
      position: relative;
      width: min(820px, 100%);
    }

    .table-value-modal-title {
      color: #26362a;
      font: 700 22px/1.25 Arial, sans-serif;
      margin: 0 170px 18px 0;
    }

    .table-value-modal-content {
      background: #ffffff;
      border: 1px solid #e7d8bc;
      border-radius: 6px;
      color: #2f3d31;
      font: 400 16px/1.55 Arial, sans-serif;
      max-height: 460px;
      min-height: 260px;
      overflow: auto;
      padding: 18px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .table-value-modal-avatar-wrap {
      align-items: center;
      display: flex;
      gap: 10px;
      position: absolute;
      right: 24px;
      top: 22px;
    }

    .table-value-modal-avatar-label {
      color: #2f5d3a;
      font: 700 13px/1.2 Arial, sans-serif;
      max-width: 90px;
      text-align: right;
    }

    .table-value-modal-avatar {
      align-items: center;
      background: #b6412c;
      border: 3px solid #fff8ed;
      border-radius: 50%;
      box-shadow: 0 8px 20px rgba(182, 65, 44, 0.3);
      color: #ffffff;
      display: flex;
      height: 56px;
      justify-content: center;
      width: 56px;
    }

    .table-value-modal-avatar svg {
      height: 34px;
      width: 34px;
    }

    .table-value-modal-close {
      background: #2f5d3a;
      border: 0;
      border-radius: 6px;
      color: #ffffff;
      cursor: pointer;
      font: 700 15px/1 Arial, sans-serif;
      margin-top: 20px;
      padding: 12px 18px;
    }

    .table-value-modal-close:focus {
      outline: 3px solid #d6a33f;
      outline-offset: 2px;
    }

    .table-value-modal-close:hover {
      background: #24482d;
    }
  `;

  document.head.appendChild(style);
}

function getPowerPlatformFormContext(executionContextOrFormContext) {
  if (!executionContextOrFormContext) {
    if (typeof Xrm !== 'undefined' && Xrm.Page) {
      return Xrm.Page;
    }

    throw new Error('A Power Platform execution context or form context is required.');
  }

  if (typeof executionContextOrFormContext.getFormContext === 'function') {
    return executionContextOrFormContext.getFormContext();
  }

  if (typeof executionContextOrFormContext.getAttribute === 'function') {
    return executionContextOrFormContext;
  }

  throw new Error('Invalid Power Platform execution context or form context.');
}

function getPowerPlatformWebApi() {
  if (typeof Xrm === 'undefined' || !Xrm.WebApi) {
    throw new Error('Xrm.WebApi is unavailable. Run this script inside a Power Platform model-driven app.');
  }

  return Xrm.WebApi;
}

function cleanRecordId(recordId) {
  return String(recordId || '').replace(/[{}]/g, '');
}

function getCurrentPowerPlatformRecordReference(executionContextOrFormContext) {
  const formContext = getPowerPlatformFormContext(executionContextOrFormContext);

  if (!formContext.data || !formContext.data.entity) {
    throw new Error('The current Power Platform form record is unavailable.');
  }

  const tableName = formContext.data.entity.getEntityName();
  const recordId = cleanRecordId(formContext.data.entity.getId());

  if (!tableName || !recordId) {
    throw new Error('Save the current record before querying it.');
  }

  return {
    tableName,
    recordId
  };
}

function encodeODataValue(value) {
  return String(value).replace(/'/g, "''");
}

function buildRetrieveMultipleQuery(options = {}) {
  const queryParts = [];

  if (options.select && options.select.length) {
    queryParts.push(`$select=${options.select.map(encodeURIComponent).join(',')}`);
  }

  if (options.filter) {
    queryParts.push(`$filter=${options.filter}`);
  }

  if (options.orderBy) {
    queryParts.push(`$orderby=${options.orderBy}`);
  }

  queryParts.push(`$top=${options.top || 1}`);

  return queryParts.length ? `?${queryParts.join('&')}` : '';
}

function formatPowerPlatformFieldValue(attribute) {
  const value = attribute.getValue();

  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof attribute.getText === 'function') {
    const text = attribute.getText();

    if (text) {
      return Array.isArray(text) ? text.join(', ') : text;
    }
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => item.name || item.id || String(item))
      .join(', ');
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function getPowerPlatformFieldValue(executionContextOrFormContext, fieldName) {
  const formContext = getPowerPlatformFormContext(executionContextOrFormContext);
  const attribute = formContext.getAttribute(fieldName);

  if (!attribute) {
    throw new Error(`Power Platform field not found on this form: ${fieldName}`);
  }

  return formatPowerPlatformFieldValue(attribute);
}

function formatDataverseValue(record, fieldName) {
  if (!record || !fieldName) {
    return '';
  }

  const formattedValue = record[`${fieldName}@OData.Community.Display.V1.FormattedValue`];

  if (formattedValue !== undefined && formattedValue !== null && formattedValue !== '') {
    return String(formattedValue);
  }

  const lookupName = record[`_${fieldName}_value@OData.Community.Display.V1.FormattedValue`];

  if (lookupName !== undefined && lookupName !== null && lookupName !== '') {
    return String(lookupName);
  }

  const value = record[fieldName] !== undefined ? record[fieldName] : record[`_${fieldName}_value`];

  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

async function retrievePowerPlatformRecord(tableName, recordId, fieldName) {
  const webApi = getPowerPlatformWebApi();
  const cleanId = cleanRecordId(recordId);

  if (!tableName || !cleanId || !fieldName) {
    throw new Error('Table name, record ID, and field name are required.');
  }

  return webApi.retrieveRecord(tableName, cleanId, `?$select=${encodeURIComponent(fieldName)}`);
}

async function queryPowerPlatformTable(tableName, fieldName, options = {}) {
  const webApi = getPowerPlatformWebApi();

  if (!tableName || !fieldName) {
    throw new Error('Table name and field name are required.');
  }

  if (options.recordId) {
    return retrievePowerPlatformRecord(tableName, options.recordId, fieldName);
  }

  const select = options.select || [fieldName];
  const query = buildRetrieveMultipleQuery({
    select,
    filter: options.filter,
    orderBy: options.orderBy,
    top: options.top || 1
  });
  const result = await webApi.retrieveMultipleRecords(tableName, query);

  if (!result.entities || !result.entities.length) {
    return null;
  }

  return result.entities[0];
}

function createPersonAvatar() {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-value-modal-avatar-wrap';

  const label = document.createElement('div');
  label.className = 'table-value-modal-avatar-label';
  label.textContent = 'Helpful details';

  const avatar = document.createElement('div');
  avatar.className = 'table-value-modal-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" role="img" aria-label="Person avatar">
      <circle cx="12" cy="8" r="4" fill="currentColor"></circle>
      <path d="M4.75 20c.78-4.1 3.4-6.5 7.25-6.5s6.47 2.4 7.25 6.5" fill="currentColor"></path>
    </svg>
  `;

  wrapper.appendChild(label);
  wrapper.appendChild(avatar);

  return wrapper;
}

function closePowerPlatformFieldModal() {
  const existingModal = document.getElementById(POWER_PLATFORM_FIELD_MODAL_ID);

  if (existingModal) {
    existingModal.remove();
  }
}

function getTooltipPosition(event, tooltipWidth, tooltipHeight) {
  const offset = 18;
  const viewportPadding = 16;
  const clientX = event && typeof event.clientX === 'number' ? event.clientX : window.innerWidth / 2;
  const clientY = event && typeof event.clientY === 'number' ? event.clientY : window.innerHeight / 2;
  let left = clientX + offset;
  let top = clientY + offset;

  if (left + tooltipWidth > window.innerWidth - viewportPadding) {
    left = Math.max(viewportPadding, clientX - tooltipWidth - offset);
  }

  if (top + tooltipHeight > window.innerHeight - viewportPadding) {
    top = Math.max(viewportPadding, clientY - tooltipHeight - offset);
  }

  return {
    left,
    top
  };
}

function normalizeModalOptions(options) {
  if (typeof options === 'string') {
    return {
      title: options
    };
  }

  return options || {};
}

function showPowerPlatformValueModal(value, options = {}) {
  const { title = 'Field Value', tooltipEvent } = normalizeModalOptions(options);

  ensurePowerPlatformFieldModalStyles();
  closePowerPlatformFieldModal();

  const backdrop = document.createElement('div');
  backdrop.id = POWER_PLATFORM_FIELD_MODAL_ID;
  backdrop.className = tooltipEvent ? 'table-value-modal-tooltip-layer' : 'table-value-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', tooltipEvent ? 'false' : 'true');
  backdrop.setAttribute('aria-labelledby', 'table-value-modal-title');

  const modal = document.createElement('div');
  modal.className = 'table-value-modal-box';

  const heading = document.createElement('h2');
  heading.id = 'table-value-modal-title';
  heading.className = 'table-value-modal-title';
  heading.textContent = title;

  const content = document.createElement('div');
  content.className = 'table-value-modal-content';
  content.textContent = String(value || '');

  const closeButton = document.createElement('button');
  closeButton.className = 'table-value-modal-close';
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', closePowerPlatformFieldModal);

  backdrop.addEventListener('click', (event) => {
    if (!tooltipEvent && event.target === backdrop) {
      closePowerPlatformFieldModal();
    }
  });

  document.addEventListener('keydown', function handleEscape(event) {
    if (event.key === 'Escape') {
      closePowerPlatformFieldModal();
      document.removeEventListener('keydown', handleEscape);
    }
  });

  modal.appendChild(createPersonAvatar());
  modal.appendChild(heading);
  modal.appendChild(content);
  modal.appendChild(closeButton);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  if (tooltipEvent) {
    const modalRectangle = modal.getBoundingClientRect();
    const position = getTooltipPosition(tooltipEvent, modalRectangle.width, modalRectangle.height);
    backdrop.style.left = `${position.left}px`;
    backdrop.style.top = `${position.top}px`;
  }

  if (!tooltipEvent) {
    closeButton.focus();
  }
}

function showPowerPlatformFieldModal(executionContextOrFormContext, fieldName, options = {}) {
  const value = getPowerPlatformFieldValue(executionContextOrFormContext, fieldName);
  showPowerPlatformValueModal(value, options);
}

async function showPowerPlatformTableValueModal(tableName, fieldName, options = {}) {
  const modalOptions = normalizeModalOptions(options);
  const queryOptions = { ...modalOptions };

  if (!queryOptions.recordId && !queryOptions.filter) {
    const currentRecord = getCurrentPowerPlatformRecordReference();

    if (currentRecord.tableName !== tableName) {
      throw new Error(`Current form entity is ${currentRecord.tableName}, but ${tableName} was requested. Pass a recordId or filter to query a different table.`);
    }

    queryOptions.recordId = currentRecord.recordId;
  }

  const record = await queryPowerPlatformTable(tableName, fieldName, queryOptions);
  const value = record ? formatDataverseValue(record, fieldName) : 'No matching record was found.';

  showPowerPlatformValueModal(value, modalOptions);

  return {
    record,
    value
  };
}

async function showCurrentRecordFieldModal(fieldName, options = {}, executionContextOrFormContext) {
  const currentRecord = getCurrentPowerPlatformRecordReference(executionContextOrFormContext);

  return showPowerPlatformTableValueModal(currentRecord.tableName, fieldName, {
    ...normalizeModalOptions(options),
    recordId: currentRecord.recordId
  });
}

function showEntityFieldModal(entityName, fieldName, options = {}) {
  return showPowerPlatformTableValueModal(entityName, fieldName, options);
}

async function showEntityFieldTooltip(event, entityName, fieldName, options = {}) {
  const requestId = activeHoverRequestId + 1;
  activeHoverRequestId = requestId;

  const modalOptions = {
    ...normalizeModalOptions(options),
    tooltipEvent: event
  };

  showPowerPlatformValueModal('Loading...', modalOptions);

  try {
    const queryOptions = { ...modalOptions };

    if (!queryOptions.recordId && !queryOptions.filter) {
      const currentRecord = getCurrentPowerPlatformRecordReference();

      if (currentRecord.tableName !== entityName) {
        throw new Error(`Current form entity is ${currentRecord.tableName}, but ${entityName} was requested. Pass a recordId or filter to query a different table.`);
      }

      queryOptions.recordId = currentRecord.recordId;
    }

    const record = await queryPowerPlatformTable(entityName, fieldName, queryOptions);
    const value = record ? formatDataverseValue(record, fieldName) : 'No matching record was found.';

    if (requestId !== activeHoverRequestId) {
      return {
        record,
        value
      };
    }

    showPowerPlatformValueModal(value, modalOptions);

    return {
      record,
      value
    };
  } catch (error) {
    if (requestId === activeHoverRequestId) {
      showPowerPlatformValueModal(error.message || 'Unable to retrieve the requested value.', modalOptions);
    }

    throw error;
  }
}

function attachEntityFieldTooltip(elementSelector, entityName, fieldName, options = {}) {
  const target = document.querySelector(elementSelector);

  if (!target) {
    throw new Error(`Tooltip target not found: ${elementSelector}`);
  }

  target.addEventListener('mouseover', (event) => {
    showEntityFieldTooltip(event, entityName, fieldName, options).catch(() => {});
  });

  target.addEventListener('mouseleave', () => {
    activeHoverRequestId += 1;
    closePowerPlatformFieldModal();
  });

  return target;
}

if (typeof window !== 'undefined') {
  window.showPowerPlatformFieldModal = showPowerPlatformFieldModal;
  window.showCurrentRecordFieldModal = showCurrentRecordFieldModal;
  window.showEntityFieldModal = showEntityFieldModal;
  window.showEntityFieldTooltip = showEntityFieldTooltip;
  window.attachEntityFieldTooltip = attachEntityFieldTooltip;
  window.showPowerPlatformTableValueModal = showPowerPlatformTableValueModal;
  window.showPowerPlatformValueModal = showPowerPlatformValueModal;
  window.closePowerPlatformFieldModal = closePowerPlatformFieldModal;
  window.PowerPlatformFieldModal = {
    buildQuery: buildRetrieveMultipleQuery,
    formatDataverseValue,
    getCurrentRecordReference: getCurrentPowerPlatformRecordReference,
    getFieldValue: getPowerPlatformFieldValue,
    queryTable: queryPowerPlatformTable,
    attachEntityFieldTooltip,
    showCurrentRecordFieldModal,
    showEntityFieldModal,
    showEntityFieldTooltip,
    showFieldModal: showPowerPlatformFieldModal,
    showTableValueModal: showPowerPlatformTableValueModal,
    showModal: showPowerPlatformValueModal,
    closeModal: closePowerPlatformFieldModal
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    getPowerPlatformFormContext,
    getPowerPlatformWebApi,
    cleanRecordId,
    getCurrentPowerPlatformRecordReference,
    buildRetrieveMultipleQuery,
    formatPowerPlatformFieldValue,
    getPowerPlatformFieldValue,
    formatDataverseValue,
    retrievePowerPlatformRecord,
    queryPowerPlatformTable,
    normalizeModalOptions,
    showPowerPlatformValueModal,
    showPowerPlatformFieldModal,
    showCurrentRecordFieldModal,
    showEntityFieldModal,
    showEntityFieldTooltip,
    attachEntityFieldTooltip,
    showPowerPlatformTableValueModal,
    closePowerPlatformFieldModal
  };
}
