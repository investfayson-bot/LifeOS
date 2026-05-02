import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

export interface IncomingMessage {
  userId: string;
  phone: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'document';
  timestamp: number;
}

export const messageQueue = new Queue<IncomingMessage>('messages', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
