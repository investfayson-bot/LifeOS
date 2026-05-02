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

app.listen(PORT, () => {
  console.log(`[LifeOS] Server running on port ${PORT}`);
  startWorker();
  startCronJobs();
});
