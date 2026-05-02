import { prisma } from '../lib/prisma';
import { anthropic, MODEL } from '../lib/claude';

const DEFAULT_CATEGORIES: Record<string, string> = {
  almoço: 'Alimentação', jantar: 'Alimentação', mercado: 'Alimentação', restaurante: 'Alimentação',
  lanche: 'Alimentação', ifood: 'Alimentação', delivery: 'Alimentação',
  uber: 'Transporte', gasolina: 'Transporte', onibus: 'Transporte', metrô: 'Transporte', combustível: 'Transporte',
  farmácia: 'Saúde', médico: 'Saúde', consulta: 'Saúde', academia: 'Saúde', dentista: 'Saúde',
  escola: 'Educação', curso: 'Educação', livro: 'Educação', faculdade: 'Educação',
  aluguel: 'Moradia', condomínio: 'Moradia', luz: 'Moradia', água: 'Moradia', internet: 'Moradia',
  cinema: 'Lazer', netflix: 'Lazer', show: 'Lazer', viagem: 'Lazer',
  fornecedor: 'Negócio', cliente: 'Negócio', escritório: 'Negócio',
  salário: 'Salário', freelance: 'Freelance', renda: 'Renda extra',
};

function guessCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const [keyword, cat] of Object.entries(DEFAULT_CATEGORIES)) {
    if (lower.includes(keyword)) return cat;
  }
  return 'Outros';
}

export async function handleFinance(
  userId: string,
  action: string,
  entities: Record<string, unknown>,
  rawText: string
): Promise<string> {
  switch (action) {
    case 'add_expense': return addTransaction(userId, entities, rawText, 'EXPENSE');
    case 'add_income':  return addTransaction(userId, entities, rawText, 'INCOME');
    case 'list_expenses': return listTransactions(userId, entities);
    case 'financial_summary': return financialSummary(userId);
    case 'add_bill': return addBill(userId, entities, rawText);
    case 'list_bills': return listBills(userId);
    case 'add_goal': return addGoal(userId, entities, rawText);
    case 'list_goals': return listGoals(userId);
    case 'update_goal': return updateGoal(userId, entities, rawText);
    default: return generalFinanceChat(userId, rawText);
  }
}

async function addTransaction(
  userId: string,
  entities: Record<string, unknown>,
  rawText: string,
  type: 'EXPENSE' | 'INCOME'
): Promise<string> {
  const amount = Number(entities['amount']);
  const description = String(entities['description'] ?? rawText);
  const category = String(entities['category'] ?? guessCategory(description));

  if (!amount || amount <= 0) {
    return type === 'EXPENSE'
      ? 'Qual foi o valor do gasto? Ex: "gastei R$50 no almoço"'
      : 'Qual foi o valor recebido? Ex: "recebi R$1500 de salário"';
  }

  await prisma.expense.create({
    data: { userId, amount, description, category, type, source: 'whatsapp' },
  });

  if (type === 'INCOME') {
    return `✅ *Receita registrada!*\n💵 R$ ${amount.toFixed(2)} — ${description}\n📂 ${category}`;
  }
  return `✅ *Gasto registrado!*\n💸 R$ ${amount.toFixed(2)} — ${description}\n📂 ${category}`;
}

async function listTransactions(userId: string, entities: Record<string, unknown>): Promise<string> {
  const days = Number(entities['days'] ?? 30);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const expenses = await prisma.expense.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: since } },
    orderBy: { date: 'desc' },
    take: 10,
  });
  const incomes = await prisma.expense.findMany({
    where: { userId, type: 'INCOME', date: { gte: since } },
    orderBy: { date: 'desc' },
    take: 5,
  });

  if (expenses.length === 0 && incomes.length === 0) {
    return `Nenhuma transação nos últimos ${days} dias.`;
  }

  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInc = incomes.reduce((s, e) => s + e.amount, 0);
  const balance = totalInc - totalExp;

  const expLines = expenses.map((e) => {
    const d = e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `  • ${d} ${e.description}: *R$ ${e.amount.toFixed(2)}*`;
  });

  const incLines = incomes.map((e) => {
    const d = e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `  • ${d} ${e.description}: *R$ ${e.amount.toFixed(2)}*`;
  });

  let msg = `📊 *Últimos ${days} dias*\n\n`;
  if (incLines.length) msg += `💵 *Receitas:*\n${incLines.join('\n')}\n  Total: R$ ${totalInc.toFixed(2)}\n\n`;
  if (expLines.length) msg += `💸 *Gastos:*\n${expLines.join('\n')}\n  Total: R$ ${totalExp.toFixed(2)}\n\n`;
  msg += `${balance >= 0 ? '✅' : '⚠️'} *Saldo: R$ ${balance.toFixed(2)}*`;

  return msg;
}

async function financialSummary(userId: string): Promise<string> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allTx, bills, goals] = await Promise.all([
    prisma.expense.findMany({ where: { userId, date: { gte: startOfMonth } } }),
    prisma.bill.findMany({ where: { userId, paid: false, dueDate: { gte: now } } }),
    prisma.financialGoal.findMany({ where: { userId, achieved: false } }),
  ]);

  const expenses = allTx.filter((t) => t.type === 'EXPENSE');
  const incomes = allTx.filter((t) => t.type === 'INCOME');
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInc = incomes.reduce((s, e) => s + e.amount, 0);
  const balance = totalInc - totalExp;

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  const topCats = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat, val]) => `  • ${cat}: R$ ${val.toFixed(2)}`)
    .join('\n');

  const pendingBills = bills.reduce((s, b) => s + b.amount, 0);
  const month = now.toLocaleString('pt-BR', { month: 'long' });

  let msg = `📈 *Resumo — ${month}*\n\n`;
  if (totalInc > 0) msg += `💵 Receitas: R$ ${totalInc.toFixed(2)}\n`;
  msg += `💸 Gastos: R$ ${totalExp.toFixed(2)}\n`;
  msg += `${balance >= 0 ? '✅' : '⚠️'} Saldo: *R$ ${balance.toFixed(2)}*\n\n`;
  if (topCats) msg += `📂 *Top categorias:*\n${topCats}\n\n`;
  if (bills.length) msg += `📋 Contas a pagar: R$ ${pendingBills.toFixed(2)} (${bills.length})\n`;
  if (goals.length) {
    const goalLines = goals.slice(0, 2).map((g) => {
      const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
      return `  • ${g.description}: ${pct}% (R$ ${g.savedAmount.toFixed(0)}/R$ ${g.targetAmount.toFixed(0)})`;
    });
    msg += `\n🎯 *Metas:*\n${goalLines.join('\n')}`;
  }

  return msg;
}

async function addBill(userId: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const amount = Number(entities['amount']);
  const description = String(entities['description'] ?? rawText);
  const day = Number(entities['day']);
  const recurring = Boolean(entities['recurring']);

  if (!amount || !day) {
    return 'Preciso do valor e do dia de vencimento. Ex: "conta de luz R$120 vence dia 15"';
  }

  const dueDate = new Date();
  dueDate.setDate(day);
  dueDate.setHours(9, 0, 0, 0);
  if (dueDate < new Date()) dueDate.setMonth(dueDate.getMonth() + 1);

  await prisma.bill.create({
    data: { userId, description, amount, dueDate, recurring, recurringDay: recurring ? day : null },
  });

  return `✅ *Conta registrada!*\n📋 ${description}\n💰 R$ ${amount.toFixed(2)} — vence dia ${day}${recurring ? '\n🔄 Recorrente (todo mês)' : ''}`;
}

async function listBills(userId: string): Promise<string> {
  const bills = await prisma.bill.findMany({
    where: { userId, paid: false },
    orderBy: { dueDate: 'asc' },
    take: 10,
  });

  if (bills.length === 0) return '✅ Nenhuma conta pendente!';

  const today = new Date();
  const lines = bills.map((b) => {
    const due = b.dueDate.toLocaleDateString('pt-BR');
    const daysLeft = Math.ceil((b.dueDate.getTime() - today.getTime()) / 86400000);
    const warn = daysLeft <= 3 ? ' ⚠️' : '';
    return `• ${b.description} — *R$ ${b.amount.toFixed(2)}* (${due}${warn})${b.recurring ? ' 🔄' : ''}`;
  });

  const total = bills.reduce((s, b) => s + b.amount, 0);
  return `📋 *Contas pendentes:*\n\n${lines.join('\n')}\n\n💰 Total: *R$ ${total.toFixed(2)}*`;
}

async function addGoal(userId: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const description = String(entities['description'] ?? rawText);
  const targetAmount = Number(entities['amount']);

  if (!targetAmount) return 'Qual o valor da meta? Ex: "meta: guardar R$1000 para viagem"';

  let deadline: Date | undefined;
  if (entities['deadline']) {
    deadline = new Date(String(entities['deadline']));
  }

  await prisma.financialGoal.create({ data: { userId, description, targetAmount, deadline } });

  const deadlineStr = deadline ? `\n📅 Prazo: ${deadline.toLocaleDateString('pt-BR')}` : '';
  return `🎯 *Meta criada!*\n${description}\n💰 R$ ${targetAmount.toFixed(2)}${deadlineStr}\n\nVou acompanhar seu progresso! Para atualizar: "guardei R$X para [meta]"`;
}

async function updateGoal(userId: string, entities: Record<string, unknown>, rawText: string): Promise<string> {
  const amount = Number(entities['amount']);
  const keyword = String(entities['description'] ?? '');

  const goal = await prisma.financialGoal.findFirst({
    where: { userId, achieved: false, description: { contains: keyword, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
  });

  if (!goal) return 'Qual meta você quer atualizar? Ex: "guardei R$200 para viagem"';

  const newSaved = goal.savedAmount + amount;
  const achieved = newSaved >= goal.targetAmount;

  await prisma.financialGoal.update({
    where: { id: goal.id },
    data: { savedAmount: newSaved, achieved },
  });

  const pct = Math.min(100, Math.round((newSaved / goal.targetAmount) * 100));
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  if (achieved) {
    return `🏆 *Meta atingida!*\n${goal.description}\n\nParabéns! Você guardou R$ ${newSaved.toFixed(2)} de R$ ${goal.targetAmount.toFixed(2)} 🎉`;
  }

  return `✅ *Meta atualizada!*\n${goal.description}\n\n${bar} ${pct}%\nR$ ${newSaved.toFixed(2)} de R$ ${goal.targetAmount.toFixed(2)}`;
}

async function listGoals(userId: string): Promise<string> {
  const goals = await prisma.financialGoal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (goals.length === 0) return '🎯 Nenhuma meta cadastrada.\n\nCrie uma: "meta: guardar R$500 para viagem"';

  const lines = goals.map((g) => {
    const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    const status = g.achieved ? '✅' : '🎯';
    return `${status} *${g.description}*\n   ${bar} ${pct}% — R$ ${g.savedAmount.toFixed(0)}/R$ ${g.targetAmount.toFixed(0)}`;
  });

  return `🎯 *Suas metas:*\n\n${lines.join('\n\n')}`;
}

async function generalFinanceChat(userId: string, text: string): Promise<string> {
  const [expenses, bills, goals] = await Promise.all([
    prisma.expense.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 10 }),
    prisma.bill.findMany({ where: { userId, paid: false }, orderBy: { dueDate: 'asc' } }),
    prisma.financialGoal.findMany({ where: { userId, achieved: false } }),
  ]);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `Você é o agente financeiro do LifeOS. Responda em português brasileiro de forma clara e direta.
Dados do usuário:
- Últimas transações: ${JSON.stringify(expenses.slice(0, 5))}
- Contas pendentes: ${JSON.stringify(bills.slice(0, 3))}
- Metas: ${JSON.stringify(goals)}`,
    messages: [{ role: 'user', content: text }],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : 'Não entendi. Pode reformular?';
}
