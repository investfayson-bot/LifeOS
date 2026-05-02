import { anthropic, MODEL } from '../lib/claude';
import { getHistory, addMessage } from '../memory/conversation.store';
import { prisma } from '../lib/prisma';
import { transcribeAudio } from '../lib/transcribe';
import { parseReceipt } from '../lib/receipt';
import { handleFinance } from './finance.agent';
import { handleCRM } from './crm.agent';
import { handleScheduling } from './scheduling.agent';
import { handleMarketing } from './marketing.agent';
import { handleNotification } from './notification.agent';
import { handleFamily } from './family.agent';
import { handleInfo } from './info.agent';

export interface OrchestrateInput {
  userId: string;
  phone: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'document';
}

interface Intent {
  agent: 'FINANCE' | 'CRM' | 'SCHEDULING' | 'MARKETING' | 'NOTIFICATION' | 'FAMILY' | 'INFO' | 'GENERAL';
  action: string;
  entities: Record<string, unknown>;
  confidence: number;
}

const INTENT_SYSTEM = `You are LifeOS Orchestrator. Classify the user message intent.
Return ONLY valid JSON: { "agent": string, "action": string, "entities": object, "confidence": number }

Agents and actions:
- FINANCE: add_expense, add_income, list_expenses, add_bill, list_bills, financial_summary, add_goal, list_goals, update_goal
- CRM: list_leads, create_lead, update_lead, add_followup, pipeline_summary
- SCHEDULING: create_appointment, list_appointments, cancel_appointment
- MARKETING: create_caption, create_script, create_post_idea
- NOTIFICATION: schedule_reminder, list_reminders, cancel_reminder
- FAMILY: create_invite, join_family, list_members, leave_family
- INFO: transit_route, driving_route, nearby, weather, forecast, currency_rate, all_rates, cep_lookup, cnpj_lookup, fipe_lookup, holidays, bank_lookup
- GENERAL: greeting, help, unknown

INFO rules:
- "ônibus", "metrô", "como ir de", "rota de transporte" → INFO transit_route (extract origin, destination)
- "como chegar", "rota de carro" → INFO driving_route (extract origin, destination)
- "restaurante perto", "farmácia perto", "hospital perto" → INFO nearby (extract location, place_type)
- "tempo em", "clima em", "temperatura" → INFO weather (extract city)
- "previsão do tempo", "próximos dias" → INFO forecast (extract city)
- "cotação do dólar/euro/bitcoin" → INFO currency_rate (extract currency: USD/EUR/BTC/GBP/ARS)
- "todas as cotações", "câmbio hoje" → INFO all_rates
- "CEP", "cep " followed by numbers → INFO cep_lookup (extract cep)
- "CNPJ", "cnpj " followed by numbers → INFO cnpj_lookup (extract cnpj)
- "tabela FIPE", "preço do carro" → INFO fipe_lookup (extract query)
- "feriados", "próximos feriados" → INFO holidays
- "código do banco", "banco " followed by name/number → INFO bank_lookup

Rules:
- "gastei", "paguei", "comprei" → FINANCE add_expense
- "recebi", "entrada de", "ganhei" → FINANCE add_income
- "conta de", "vence dia", "boleto", "recorrente" → FINANCE add_bill (add recurring:true if "todo mês"/"recorrente")
- "meta", "guardar", "economizar", "juntar" → FINANCE add_goal
- "guardei X para" → FINANCE update_goal
- "minhas metas" → FINANCE list_goals
- "agende", "marque", "consulta", "reunião" → SCHEDULING create_appointment
- "me lembra", "lembrete", "avisa" → NOTIFICATION schedule_reminder
- "novo lead", "cliente novo" → CRM create_lead
- "legenda", "post", "caption", "reels" → MARKETING
- "meu código", "convidar família" → FAMILY create_invite
- "entrar família" → FAMILY join_family (extract code)
- "membros da família" → FAMILY list_members
- Always extract: amount as number, description as string, category as string (pt-BR), clientName, time as string, topic, day as number, code as string

Examples:
"gastei 80 no almoço" → {"agent":"FINANCE","action":"add_expense","entities":{"amount":80,"description":"almoço","category":"Alimentação"},"confidence":0.97}
"recebi 3000 de salário" → {"agent":"FINANCE","action":"add_income","entities":{"amount":3000,"description":"salário","category":"Salário"},"confidence":0.97}
"conta de luz 200 vence dia 15 todo mês" → {"agent":"FINANCE","action":"add_bill","entities":{"amount":200,"description":"conta de luz","day":15,"recurring":true},"confidence":0.95}
"meta: guardar R$1000 para viagem até dezembro" → {"agent":"FINANCE","action":"add_goal","entities":{"amount":1000,"description":"viagem","deadline":"2025-12-31"},"confidence":0.95}
"guardei 200 para viagem" → {"agent":"FINANCE","action":"update_goal","entities":{"amount":200,"description":"viagem"},"confidence":0.95}
"agende João próxima terça às 14h" → {"agent":"SCHEDULING","action":"create_appointment","entities":{"clientName":"João","time":"próxima terça às 14h"},"confidence":0.95}
"entrar família ABC123" → {"agent":"FAMILY","action":"join_family","entities":{"code":"ABC123"},"confidence":0.99}
"meu código de família" → {"agent":"FAMILY","action":"create_invite","entities":{},"confidence":0.99}
"oi" → {"agent":"GENERAL","action":"greeting","entities":{},"confidence":1.0}`;

async function classifyIntent(text: string, history: Array<{ role: string; content: string }>): Promise<Intent> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: INTENT_SYSTEM,
    messages: [
      ...history.slice(-6).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: text },
    ],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
  try {
    return JSON.parse(raw) as Intent;
  } catch {
    return { agent: 'GENERAL', action: 'unknown', entities: {}, confidence: 0 };
  }
}

export async function orchestrate(input: OrchestrateInput): Promise<string> {
  const { userId, phone, mediaUrl, mediaType } = input;
  let { text } = input;

  if (mediaType === 'audio' && mediaUrl && !text) {
    try {
      text = await transcribeAudio(mediaUrl);
      console.log(`[Orchestrator] Audio transcribed: "${text}"`);
    } catch (err) {
      console.error('[Orchestrator] Transcription failed:', err);
      return '🎤 Não consegui entender o áudio. Pode repetir em texto?';
    }
  }

  if (mediaType === 'image' && mediaUrl) {
    try {
      const receipt = await parseReceipt(mediaUrl);
      if (receipt.amount > 0) {
        const entities = {
          amount: receipt.amount,
          description: receipt.description,
          category: receipt.category,
          source: 'ocr',
        };
        let isNewUser2 = false;
        let user2 = await prisma.user.findUnique({ where: { phone } });
        if (!user2) {
          isNewUser2 = true;
          const tenant = await prisma.tenant.create({ data: { name: phone } });
          user2 = await prisma.user.create({ data: { phone, tenantId: tenant.id } });
        }
        const itemsList = receipt.items?.length ? `\n📦 Itens: ${receipt.items.join(', ')}` : '';
        const result = await handleFinance(user2.id, 'add_expense', entities, text ?? '');
        return `🧾 *Recibo lido com sucesso!*${itemsList}\n\n${result}`;
      }
    } catch (err) {
      console.error('[Orchestrator] Receipt OCR failed:', err);
      if (!text) return '📷 Não consegui ler o recibo. Tente uma foto mais nítida e bem iluminada.';
    }
  }

  if (!text) return '🤔 Não recebi nenhuma mensagem. Pode repetir?';

  let isNewUser = false;
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    isNewUser = true;
    const tenant = await prisma.tenant.create({ data: { name: phone } });
    user = await prisma.user.create({
      data: { phone, tenantId: tenant.id },
    });
  }

  const history = await getHistory(userId);
  await addMessage(userId, { role: 'user', content: text, timestamp: Date.now() });

  // Captura nome quando bot perguntou "Como posso te chamar?"
  const lastBotMsg = history.slice().reverse().find((m) => m.role === 'assistant');
  if (!user.name && lastBotMsg?.content.includes('Como posso te chamar') && text.length < 40 && !text.includes(' ') || (text.split(' ').length <= 3 && lastBotMsg?.content.includes('Como posso te chamar'))) {
    const name = text.trim().replace(/[^a-zA-ZÀ-ú\s]/g, '').trim();
    if (name.length >= 2) {
      user = await prisma.user.update({ where: { id: user.id }, data: { name } });
      await addMessage(userId, { role: 'assistant', content: `Prazer, ${name}! Em que posso ajudar?`, timestamp: Date.now() });
      return `Prazer, ${name}! Em que posso ajudar?`;
    }
  }

  const intent = await classifyIntent(text, history);

  let response: string;

  switch (intent.agent) {
    case 'FINANCE':
      response = await handleFinance(user.id, intent.action, intent.entities, text);
      break;
    case 'CRM':
      response = await handleCRM(user.id, intent.action, intent.entities, text);
      break;
    case 'SCHEDULING':
      response = await handleScheduling(user.id, intent.action, intent.entities, text);
      break;
    case 'MARKETING':
      response = await handleMarketing(user.id, intent.action, intent.entities, text);
      break;
    case 'NOTIFICATION':
      response = await handleNotification(user.id, intent.action, intent.entities, text);
      break;
    case 'FAMILY':
      response = await handleFamily(user.id, intent.action, intent.entities, text);
      break;
    case 'INFO':
      response = await handleInfo(intent.action, intent.entities, text);
      break;
    default:
      response = await handleGeneral(text, history, isNewUser, user.name);
  }

  await addMessage(userId, { role: 'assistant', content: response, agent: intent.agent, timestamp: Date.now() });

  return response;
}

async function handleGeneral(text: string, history: Array<{ role: string; content: string }>, isNewUser: boolean, userName?: string | null): Promise<string> {
  const lower = text.toLowerCase();

  if (isNewUser || lower === 'oi' || lower === 'olá' || lower === 'ola' || lower === 'fala' || lower === 'fala chat' || lower === 'ei' || lower === 'hey') {
    const greeting = userName ? `Olá, ${userName}!` : 'Olá!';
    return `${greeting} Sou o *LifeOS*, seu assistente pessoal.\n\nComo posso te chamar?`;
  }

  if (lower.includes('ajuda') || lower.includes('help') || lower.includes('o que você faz') || lower.includes('comandos')) {
    return `O que posso fazer por você:\n\nFinanças — gastos, receitas, contas, metas\nAgenda — marcar, ver, cancelar compromissos\nLembretes — qualquer assunto, qualquer horário\nLeads / CRM — clientes, pipeline, follow-ups\nMarketing — legendas, roteiros, ideias de post\nFamília — compartilhar conta com membros\n\nÉ só falar naturalmente.`;
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: `Você é o LifeOS, assistente pessoal via WhatsApp. Responda em português brasileiro.

Regras de formatação:
- Respostas curtas e diretas. Sem introduções longas.
- Use negrito (*texto*) apenas para títulos ou destaques essenciais.
- Emojis só quando realmente acrescentam — não no início de cada linha.
- Listas sem bordas ou separadores decorativos.
- Em roteiros, itinerários ou sugestões (hotéis, carros, restaurantes): liste diretamente sem comentários ou justificativas para cada item.
- Nunca use frases como "Claro!", "Com prazer!", "Ótima pergunta!".
- Se não souber algo, diga diretamente.`,
    messages: [
      ...history.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: text },
    ],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : 'Não entendi. Digite *ajuda* para ver os comandos disponíveis.';
}
