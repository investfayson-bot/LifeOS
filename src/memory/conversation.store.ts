import { redis } from '../lib/redis';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  timestamp: number;
}

const MAX_MESSAGES = 20;
const TTL_SECONDS = 60 * 60 * 24; // 24h

function key(userId: string): string {
  return `conversation:${userId}`;
}

export async function getHistory(userId: string): Promise<Message[]> {
  const raw = await redis.get(key(userId));
  if (!raw) return [];
  return JSON.parse(raw) as Message[];
}

export async function addMessage(userId: string, message: Message): Promise<void> {
  const history = await getHistory(userId);
  history.push(message);
  const trimmed = history.slice(-MAX_MESSAGES);
  await redis.setex(key(userId), TTL_SECONDS, JSON.stringify(trimmed));
}

export async function clearHistory(userId: string): Promise<void> {
  await redis.del(key(userId));
}
