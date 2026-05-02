import { prisma } from '../lib/prisma';
import { anthropic, MODEL } from '../lib/claude';
import { type LeadStatus } from '@prisma/client';

export async function handleCRM(
  userId: string,
  action: string,
  entities: Record<string, unknown>,
  rawText: string
): Promise<string> {
  switch (action) {
    case 'list_leads':
    case 'pipeline_summary':
      return pipelineSummary(userId);
    case 'create_lead':
      return createLead(userId, entities, rawText);
    case 'update_lead':
      return updateLead(userId, entities, rawText);
    case 'add_followup':
      return addFollowUp(userId, entities, rawText);
    default:
      return generalCRMChat(userId, rawText);
  }
}

async function pipelineSummary(userId: string): Promise<string> {
  const leads = await prisma.lead.findMany({
    where: { userId },
    include: { followUps: { where: { done: false }, orderBy: { scheduledAt: 'asc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
  });

  if (leads.length === 0) return '📭 Nenhum lead cadastrado ainda.\n\nPara adicionar: "novo lead João Silva, tel 11999999999"';

  const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusEmoji: Record<LeadStatus, string> = {
    NEW: '🆕', CONTACTED: '📞', QUALIFIED: '⭐', PROPOSAL: '📄',
    NEGOTIATION: '🤝', WON: '✅', LOST: '❌',
  };

  const statusLines = Object.entries(byStatus)
    .map(([s, count]) => `  ${statusEmoji[s as LeadStatus] ?? '•'} ${s}: ${count}`)
    .join('\n');

  const pendingFollowUps = leads.filter((l) => l.followUps.length > 0);
  const followUpLines = pendingFollowUps.slice(0, 3)
    .map((l) => {
      const fu = l.followUps[0];
      const date = fu?.scheduledAt ? fu.scheduledAt.toLocaleDateString('pt-BR') : 'sem data';
      return `  • ${l.name} — ${date}`;
    }).join('\n');

  return `📊 Pipeline CRM\n\n${statusLines}\n\nTotal: ${leads.length} lead${leads.length !== 1 ? 's' : ''}` +
    (followUpLines ? `\n\n📅 Follow-ups pendentes:\n${followUpLines}` : '');
}

async function createLead(userId: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const name = String(entities['name'] ?? '');
  const phone = entities['phone'] ? String(entities['phone']) : undefined;

  if (!name) {
    return 'Qual o nome do lead? Ex: "novo lead João Silva, tel 11999999999"';
  }

  const lead = await prisma.lead.create({
    data: { userId, name, phone, status: 'NEW' },
  });

  return `✅ Lead criado!\n👤 ${lead.name}${phone ? `\n📱 ${phone}` : ''}\n🆕 Status: Novo`;
}

async function updateLead(userId: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const name = String(entities['name'] ?? '');
  const status = entities['status'] as LeadStatus | undefined;

  const lead = await prisma.lead.findFirst({
    where: { userId, name: { contains: name, mode: 'insensitive' } },
  });

  if (!lead) return `Lead "${name}" não encontrado.`;
  if (!status) return `Qual o novo status de ${lead.name}? (Novo, Contatado, Qualificado, Proposta, Negociação, Ganho, Perdido)`;

  await prisma.lead.update({ where: { id: lead.id }, data: { status } });

  return `✅ ${lead.name} atualizado para *${status}*`;
}

async function addFollowUp(userId: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const name = String(entities['name'] ?? '');

  const lead = await prisma.lead.findFirst({
    where: { userId, name: { contains: name, mode: 'insensitive' } },
  });

  if (!lead) return `Lead "${name}" não encontrado.`;

  const notes = String(entities['notes'] ?? rawText);
  const scheduledAt = entities['date'] ? new Date(String(entities['date'])) : undefined;

  await prisma.followUp.create({ data: { leadId: lead.id, notes, scheduledAt } });
  await prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } });

  return `✅ Follow-up registrado para *${lead.name}*\n📝 ${notes}${scheduledAt ? `\n📅 ${scheduledAt.toLocaleDateString('pt-BR')}` : ''}`;
}

async function generalCRMChat(userId: string, text: string): Promise<string> {
  const leads = await prisma.lead.findMany({
    where: { userId },
    include: { followUps: { where: { done: false } } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `Você é o agente de CRM do LifeOS. Responda em português brasileiro.
Leads do usuário: ${JSON.stringify(leads.slice(0, 5))}`,
    messages: [{ role: 'user', content: text }],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : 'Não entendi. Pode reformular?';
}
