const FLOW_BASE_URL = 'https://sandbox.flow.cl/api';
const FLOW_SECRET_KEY = 'test';
const FLOW_API_KEY = '';

const params = { subject: 'Test' };
const payload = { ...params, apiKey: FLOW_API_KEY };
const sortedKeys = Object.keys(payload).sort();
let toSign = '';
for (const key of sortedKeys) {
  toSign += String(key) + String(payload[key]);
}
const crypto = require('crypto');
const signature = crypto.createHmac('sha256', FLOW_SECRET_KEY).update(toSign).digest('hex');

const form = new URLSearchParams();
for (const [k, v] of Object.entries(payload)) {
  form.append(k, String(v));
}
form.append('s', signature);

fetch(`${FLOW_BASE_URL}/payment/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: form.toString(),
}).then(res => res.text()).then(console.log).catch(console.error);
