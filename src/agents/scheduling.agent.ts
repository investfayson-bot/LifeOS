import { prisma } from '../lib/prisma';
import { anthropic, MODEL } from '../lib/claude';

async function parseDateTime(input: string): Promise<Date> {
  const now = new Date();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 64,
    system: `Você converte expressões de data/hora em português para ISO 8601 com fuso horário de Brasília (UTC-3).
Data e hora atual: ${now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (America/Sao_Paulo, UTC-3)
Retorne APENAS o ISO 8601 com offset -03:00. Ex: 2025-05-15T14:00:00-03:00`,
    messages: [{ role: 'user', content: input }],
  });
  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) throw new Error(`Could not parse: ${input}`);
  return parsed;
}

export async function handleScheduling(
  userId: string,
  action: string,
  entities: Record<string, unknown>,
  rawText: string
): Promise<string> {
  switch (action) {
    case 'create_appointment':
      return createAppointment(userId, entities, rawText);
    case 'list_appointments':
      return listAppointments(userId, entities);
    case 'cancel_appointment':
      return cancelAppointment(userId, entities);
    default:
      return generalSchedulingChat(userId, rawText);
  }
}

async function createAppointment(userId: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const clientName = String(entities['clientName'] ?? '');
  const timeStr = String(entities['time'] ?? '');
  const service = entities['service'] ? String(entities['service']) : undefined;

  if (!clientName) return 'Qual o nome do cliente para o agendamento?';
  if (!timeStr) return `Qual data e horário para ${clientName}?`;

  let scheduledAt: Date;
  try {
    scheduledAt = await parseDateTime(timeStr);
  } catch {
    return `Não entendi a data/horário "${timeStr}". Tente: "amanhã às 14h", "15/05 às 10h30", "próxima terça às 9h"`;
  }

  const appointment = await prisma.appointment.create({
    data: { userId, clientName, scheduledAt, service },
  });

  const dateStr = appointment.scheduledAt.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return `✅ Agendamento criado!\n👤 ${clientName}\n📅 ${dateStr}${service ? `\n💼 ${service}` : ''}`;
}

async function listAppointments(userId: string, entities: Record<string, unknown>): Promise<string> {
  const days = Number(entities['days'] ?? 7);
  const until = new Date();
  until.setDate(until.getDate() + days);

  const appointments = await prisma.appointment.findMany({
    where: {
      userId,
      scheduledAt: { gte: new Date(), lte: until },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
  });

  if (appointments.length === 0) return `📭 Nenhum agendamento nos próximos ${days} dias.`;

  const lines = appointments.map((a) => {
    const date = a.scheduledAt.toLocaleString('pt-BR', {
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    return `• ${date} — ${a.clientName}${a.service ? ` (${a.service})` : ''}`;
  });

  return `📅 Próximos agendamentos:\n\n${lines.join('\n')}`;
}

async function cancelAppointment(userId: string, entities: Record<string, unknown>): Promise<string> {
  const name = String(entities['clientName'] ?? '');

  const appointment = await prisma.appointment.findFirst({
    where: {
      userId,
      clientName: { contains: name, mode: 'insensitive' },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  if (!appointment) return `Nenhum agendamento futuro encontrado para "${name}".`;

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELLED' } });

  const date = appointment.scheduledAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `✅ Agendamento de *${appointment.clientName}* (${date}) cancelado.`;
}


async function generalSchedulingChat(userId: string, text: string): Promise<string> {
  const appointments = await prisma.appointment.findMany({
    where: { userId, scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
    take: 5,
  });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `Você é o agente de agendamentos do LifeOS. Responda em português brasileiro.
Próximos agendamentos: ${JSON.stringify(appointments)}`,
    messages: [{ role: 'user', content: text }],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : 'Não entendi. Pode reformular?';
}
