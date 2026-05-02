import { anthropic, MODEL } from '../lib/claude';
import { prisma } from '../lib/prisma';

export async function handleMarketing(
  userId: string,
  action: string,
  entities: Record<string, unknown>,
  rawText: string
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const profession = user?.professionType ?? 'PERSONAL';

  switch (action) {
    case 'create_caption':
      return createCaption(profession, entities, rawText);
    case 'create_script':
      return createScript(profession, rawText);
    case 'create_post_idea':
      return createPostIdea(profession, rawText);
    default:
      return generalMarketingChat(profession, rawText);
  }
}

async function createCaption(profession: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const type = String(entities['type'] ?? 'general');

  const professionContext: Record<string, string> = {
    REALTOR: 'corretor de imóveis',
    DENTIST: 'dentista',
    AESTHETICIAN: 'esteticista',
    PHOTOGRAPHER: 'fotógrafo',
    PERSONAL: 'profissional',
  };

  const typeContext: Record<string, string> = {
    before_after: 'foto de antes e depois do serviço',
    testimonial: 'depoimento de cliente',
    promotion: 'promoção ou oferta especial',
    educational: 'conteúdo educativo',
    general: 'post geral',
  };

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `Você é um especialista em marketing digital para ${professionContext[profession] ?? 'profissional'} brasileiro.
Crie legendas engajantes para Instagram. Use linguagem natural, hashtags relevantes, e chamada para ação.
Máximo 3 opções de legenda, separadas por ---`,
    messages: [{ role: 'user', content: `Crie legenda para: ${typeContext[type] ?? rawText}. Contexto: ${rawText}` }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return `📱 *Legendas para Instagram:*\n\n${text}`;
}

async function createScript(profession: string, rawText: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 768,
    system: `Você é um especialista em marketing digital. Crie roteiros curtos para Reels/Stories (30-60 segundos).
Formato: Gancho → Desenvolvimento → CTA. Linguagem natural para o público brasileiro.`,
    messages: [{ role: 'user', content: `Roteiro para ${profession}: ${rawText}` }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return `🎬 *Roteiro para Reels/Stories:*\n\n${text}`;
}

async function createPostIdea(profession: string, rawText: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `Você é um estrategista de conteúdo digital. Sugira ideias de post para Instagram.
Responda em português. Dê 5 ideias com título e formato sugerido (carrossel, reels, foto, stories).`,
    messages: [{ role: 'user', content: `Ideias de post para ${profession}: ${rawText}` }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return `💡 *Ideias de conteúdo:*\n\n${text}`;
}

async function generalMarketingChat(profession: string, text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `Você é o agente de marketing do LifeOS para ${profession}. Responda em português brasileiro.
Ajude com estratégias de conteúdo, marketing digital, e posicionamento.`,
    messages: [{ role: 'user', content: text }],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : 'Não entendi. Pode reformular?';
}
