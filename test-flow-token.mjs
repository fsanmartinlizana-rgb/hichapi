import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY;
const FLOW_BASE_URL = 'https://sandbox.flow.cl/api';
const token = '073EAD8005AA2552A0EBF729818893AF1965B53T';

function signFlowParams(params) {
  const sortedKeys = Object.keys(params).sort();
  let toSign = '';
  for (const key of sortedKeys) {
    toSign += String(key) + String(params[key]);
  }
  return crypto.createHmac('sha256', FLOW_SECRET_KEY).update(toSign).digest('hex');
}

async function main() {
  const payload = { token, apiKey: FLOW_API_KEY };
  const signature = signFlowParams(payload);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) {
    qs.append(k, String(v));
  }
  qs.append('s', signature);

  const res = await fetch(`${FLOW_BASE_URL}/payment/getStatus?${qs.toString()}`, {
    method: 'GET',
  });

  const text = await res.text();
  console.log('Response:', text);
}

main().catch(console.error);
