import { prisma } from '../lib/prisma';
import { anthropic, MODEL } from '../lib/claude';

export async function handleNotification(
  userId: string,
  action: string,
  entities: Record<string, unknown>,
  rawText: string
): Promise<string> {
  switch (action) {
    case 'schedule_reminder':
      return scheduleReminder(userId, entities, rawText);
    case 'list_reminders':
      return listReminders(userId);
    case 'cancel_reminder':
      return cancelReminder(userId, entities);
    case 'activate_summary':
      return activateSummary(userId, entities);
    case 'deactivate_summary':
      return deactivateSummary(userId);
    default:
      return generalNotificationChat(userId, rawText);
  }
}

async function parseReminderDate(entities: Record<string, unknown>, rawText: string): Promise<Date> {
  const timeHint = entities['time'] ? String(entities['time']) : entities['day'] ? `dia ${entities['day']}` : rawText;
  const now = new Date();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 64,
    system: `Converta expressão de data/hora em português para ISO 8601 com fuso de Brasília (UTC-3).
Data e hora atual: ${now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (America/Sao_Paulo)
Se não houver horário específico, use 09:00. Retorne APENAS o ISO 8601 com offset -03:00. Ex: 2026-05-15T09:00:00-03:00`,
    messages: [{ role: 'user', content: timeHint }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(9, 0, 0, 0);
    return fallback;
  }
  return parsed;
}

async function scheduleReminder(userId: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const topic = String(entities['topic'] ?? rawText);
  const sendAt = await parseReminderDate(entities, rawText);
  const message = `⏰ Lembrete: ${topic}`;

  await prisma.notificationSchedule.create({
    data: { userId, message, sendAt },
  });

  const dateStr = sendAt.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `✅ *Lembrete agendado!*\n⏰ ${topic}\n📅 ${dateStr}`;
}

async function listReminders(userId: string): Promise<string> {
  const reminders = await prisma.notificationSchedule.findMany({
    where: { userId, sent: false, sendAt: { gte: new Date() } },
    orderBy: { sendAt: 'asc' },
    take: 10,
  });

  if (reminders.length === 0) return '📭 Nenhum lembrete agendado.';

  const lines = reminders.map((r) => {
    const date = r.sendAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `• ${date} — ${r.message.replace('⏰ Lembrete: ', '')}`;
  });

  return `⏰ Seus lembretes:\n\n${lines.join('\n')}`;
}

async function cancelReminder(userId: string, entities: Record<string, unknown>): Promise<string> {
  const topic = String(entities['topic'] ?? '');

  const reminder = await prisma.notificationSchedule.findFirst({
    where: {
      userId,
      sent: false,
      message: { contains: topic, mode: 'insensitive' },
    },
  });

  if (!reminder) return `Lembrete sobre "${topic}" não encontrado.`;

  await prisma.notificationSchedule.delete({ where: { id: reminder.id } });

  return `✅ Lembrete cancelado: ${reminder.message}`;
}

async function activateSummary(userId: string, entities: Record<string, unknown>): Promise<string> {
  const hour = entities['hour'] !== undefined ? Number(entities['hour']) : 8;
  const validHour = Math.max(0, Math.min(23, hour));

  await prisma.user.update({
    where: { id: userId },
    data: { dailySummary: true, summaryHour: validHour },
  });

  return `✅ *Resumo diário ativado!*\nVou te mandar um resumo todos os dias às ${String(validHour).padStart(2, '0')}h com agenda, gastos e lembretes do dia.\n\nPara desativar: "desativar resumo diário"`;
}

async function deactivateSummary(userId: string): Promise<string> {
  await prisma.user.update({
    where: { id: userId },
    data: { dailySummary: false },
  });
  return '✅ Resumo diário desativado.';
}

async function generalNotificationChat(userId: string, text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: `Você é o agente de lembretes do LifeOS. Responda em português brasileiro.
Ajude o usuário a gerenciar seus lembretes e notificações.`,
    messages: [{ role: 'user', content: text }],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : 'Não entendi. Pode reformular?';
}
