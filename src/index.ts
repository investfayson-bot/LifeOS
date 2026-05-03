import 'dotenv/config';
import express from 'express';
import path from 'path';
import { zapiRouter } from './webhooks/zapi.webhook';
import { evolutionRouter } from './webhooks/evolution.webhook';
import { dashboardRouter } from './api/dashboard.routes';
import { startWorker } from './queue/message.worker';
import { startCronJobs } from './scheduler/cron.jobs';

const app = express();
const PORT = Number(process.env['PORT'] ?? 3000);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(zapiRouter);
app.use(evolutionRouter);
app.use(dashboardRouter);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/db-test', async (_req, res) => {
  const { prisma } = await import('./lib/prisma');
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: 'ok', url: process.env['DATABASE_URL']?.replace(/:([^@]+)@/, ':***@') });
  } catch (e: unknown) {
    res.json({ db: 'error', error: e instanceof Error ? e.message : String(e), url: process.env['DATABASE_URL']?.replace(/:([^@]+)@/, ':***@') });
  }
});

app.listen(PORT, () => {
  console.log(`[LifeOS] Server running on port ${PORT}`);
  startWorker();
  startCronJobs();
});
