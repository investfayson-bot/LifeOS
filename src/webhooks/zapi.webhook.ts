import { type Request, type Response, Router } from 'express';
import { messageQueue } from '../queue/message.queue';
import { prisma } from '../lib/prisma';

export const zapiRouter = Router();

interface ZApiMessage {
  phone: string;
  fromMe: boolean;
  isGroupMsg: boolean;
  type: string;
  text?: { message: string };
  image?: { caption?: string; imageUrl?: string };
  document?: { pageCount?: number; fileName?: string };
  audio?: { audioUrl?: string };
}

const ALLOWED_PHONES = (process.env['ALLOWED_PHONES'] ?? '')
  .split(',')
  .map((p) => p.trim().replace(/\D/g, ''))
  .filter(Boolean);

let lastWebhook: { phone: string; type: string; time: string } | null = null;

zapiRouter.get('/webhook/zapi/test', (_req: Request, res: Response) => {
  res.json({ status: 'ok', lastWebhook, serverTime: new Date().toISOString() });
});

zapiRouter.post('/webhook/zapi', async (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });

  const body = req.body as ZApiMessage;
  console.log(`[Webhook] Received — phone:${body.phone} fromMe:${body.fromMe} type:${body.type}`);
  lastWebhook = { phone: body.phone ?? 'unknown', type: body.type ?? 'unknown', time: new Date().toISOString() };

  if (body.fromMe) return;
  if (body.isGroupMsg) return;
  if (!body.phone) return;

  const rawPhone = body.phone.replace(/\D/g, '');

  if (ALLOWED_PHONES.length > 0 && !ALLOWED_PHONES.includes(rawPhone)) {
    console.log(`[Webhook] Blocked unauthorized number: ${rawPhone}`);
    return;
  }

  const text =
    body.text?.message ??
    body.image?.caption ??
    '';

  const mediaUrl = body.image?.imageUrl ?? body.audio?.audioUrl;
  const mediaType = body.image ? 'image' : body.audio ? 'audio' : body.document ? 'document' : undefined;

  if (!text && !mediaUrl) return;

  let user = await prisma.user.findUnique({ where: { phone: rawPhone } });
  if (!user) {
    const tenant = await prisma.tenant.create({ data: { name: rawPhone } });
    user = await prisma.user.create({ data: { phone: rawPhone, tenantId: tenant.id } });
  }

  await messageQueue.add('process', {
    userId: user.id,
    phone: rawPhone,
    text,
    mediaUrl,
    mediaType,
    timestamp: Date.now(),
  });
});
