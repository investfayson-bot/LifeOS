import axios from 'axios';

const client = axios.create({
  baseURL: process.env['EVOLUTION_API_URL'] ?? 'http://localhost:8080',
  headers: {
    apikey: process.env['EVOLUTION_API_KEY'] ?? '',
    'Content-Type': 'application/json',
  },
});

const INSTANCE = process.env['EVOLUTION_INSTANCE'] ?? 'lifeos';

export async function sendText(to: string, message: string): Promise<void> {
  await client.post(`/message/sendText/${INSTANCE}`, {
    number: to,
    text: message,
  });
}

export async function sendTyping(to: string): Promise<void> {
  await client.post(`/message/sendPresence/${INSTANCE}`, {
    number: to,
    presence: 'composing',
    delay: 1000,
  });
}
