import axios from 'axios';

const BASE = process.env['ZAPI_BASE_URL'] ?? 'https://api.z-api.io';
const INSTANCE = process.env['ZAPI_INSTANCE'] ?? '';
const TOKEN = process.env['ZAPI_TOKEN'] ?? '';

const CLIENT_TOKEN = process.env['ZAPI_CLIENT_TOKEN'] ?? '';

const client = axios.create({
  baseURL: `${BASE}/instances/${INSTANCE}/token/${TOKEN}`,
  headers: {
    'Content-Type': 'application/json',
    ...(CLIENT_TOKEN && { 'Client-Token': CLIENT_TOKEN }),
  },
});

export async function sendText(to: string, message: string): Promise<void> {
  const phone = to.replace(/\D/g, '');
  await client.post('/send-text', { phone, message });
}

export async function sendTyping(to: string): Promise<void> {
  const phone = to.replace(/\D/g, '');
  await client.post('/send-chat-state', { phone, chatState: 'composing' });
}
