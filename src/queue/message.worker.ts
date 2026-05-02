import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { type IncomingMessage } from './message.queue';
import { orchestrate } from '../agents/orchestrator';
import { sendText, sendTyping } from '../lib/zapi';

export function startWorker(): void {
  const worker = new Worker<IncomingMessage>(
    'messages',
    async (job) => {
      const { userId, phone, text, mediaUrl, mediaType } = job.data;

      await sendTyping(phone);

      const response = await orchestrate({
        userId,
        phone,
        text,
        mediaUrl,
        mediaType,
      });

      await sendText(phone, response);
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[Worker] Message worker started');
}
