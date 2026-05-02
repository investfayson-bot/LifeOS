import { type Request, type Response, Router } from 'express';
import { messageQueue } from '../queue/message.queue';
import { prisma } from '../lib/prisma';

export const evolutionRouter = Router();

interface EvolutionWebhookBody {
  event: string;
  instance: string;
  data: {
    key: { remoteJid: string; fromMe: boolean };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: { caption?: string; url?: string };
      documentMessage?: { url?: string };
      audioMessage?: { url?: string };
    };
  };
}

evolutionRouter.post('/webhook/evolution', async (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });

  const body = req.body as EvolutionWebhookBody;

  if (body.event !== 'messages.upsert') return;
  if (body.data.key.fromMe) return;

  const rawPhone = body.data.key.remoteJid.replace('@s.whatsapp.net', '');
  const msg = body.data.message;

  if (!msg) return;

  const text =
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    '';

  const mediaUrl = msg.imageMessage?.url ?? msg.documentMessage?.url ?? msg.audioMessage?.url;
  const mediaType = msg.imageMessage ? 'image' : msg.documentMessage ? 'document' : msg.audioMessage ? 'audio' : undefined;

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
