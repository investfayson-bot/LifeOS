import { prisma } from '../lib/prisma';
import { sendText } from '../lib/evolution';
import crypto from 'crypto';

function generateCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export async function handleFamily(
  userId: string,
  action: string,
  entities: Record<string, unknown>,
  rawText: string
): Promise<string> {
  switch (action) {
    case 'create_invite': return createInvite(userId);
    case 'join_family': return joinFamily(userId, entities);
    case 'list_members': return listMembers(userId);
    case 'leave_family': return leaveFamily(userId);
    default: return createInvite(userId);
  }
}

async function createInvite(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return 'Usuário não encontrado.';

  let code = user.inviteCode;
  if (!code) {
    code = generateCode();
    await prisma.user.update({ where: { id: userId }, data: { inviteCode: code, familyId: user.id } });
  }

  return `👨‍👩‍👧 *Gestão Compartilhada*\n\nSeu código de convite:\n\n*${code}*\n\nCompartilhe com os membros da família. Eles devem enviar:\n"entrar família ${code}"`;
}

async function joinFamily(userId: string, entities: Record<string, unknown>): Promise<string> {
  const code = String(entities['code'] ?? '').toUpperCase().trim();
  if (!code) return 'Qual o código do convite? Ex: "entrar família ABC123"';

  const owner = await prisma.user.findUnique({ where: { inviteCode: code } });
  if (!owner) return '❌ Código inválido. Peça um novo convite ao dono da conta.';

  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (currentUser?.familyId === owner.id) return 'Você já faz parte desta família!';

  await prisma.user.update({
    where: { id: userId },
    data: { familyId: owner.id, familyRole: 'MEMBER' },
  });

  const ownerName = owner.name ?? owner.phone;
  await sendText(owner.phone, `👨‍👩‍👧 *${currentUser?.name ?? currentUser?.phone}* entrou na sua conta familiar!`);

  return `✅ *Você entrou na família de ${ownerName}!*\n\nAgora você compartilha agendamentos, lembretes e pode ver o resumo financeiro da conta.`;
}

async function listMembers(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const familyId = user?.familyId ?? user?.id;

  const members = await prisma.user.findMany({
    where: { familyId },
    select: { id: true, name: true, phone: true, familyRole: true, createdAt: true },
  });

  if (members.length <= 1) {
    return '👨‍👩‍👧 Nenhum membro na família ainda.\n\nDigite *meu código de família* para convidar alguém.';
  }

  const lines = members.map((m) => {
    const role = m.familyRole === 'OWNER' ? '👑 Titular' : '👤 Membro';
    return `• ${m.name ?? m.phone} — ${role}`;
  });

  return `👨‍👩‍👧 *Membros da família:*\n\n${lines.join('\n')}`;
}

async function leaveFamily(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.familyId || user.familyRole === 'OWNER') {
    return 'Você é o titular da conta. Para encerrar a família, remova os membros primeiro.';
  }

  await prisma.user.update({ where: { id: userId }, data: { familyId: null, familyRole: 'OWNER' } });
  return '✅ Você saiu da conta familiar.';
}
