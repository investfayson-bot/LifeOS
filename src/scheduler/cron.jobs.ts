import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { anthropic, MODEL } from '../lib/claude';
import { sendText } from '../lib/zapi';

export function startCronJobs(): void {

  // ─── Notificações agendadas (a cada 1 min) ───────────────
  cron.schedule('* * * * *', async () => {
    const due = await prisma.notificationSchedule.findMany({
      where: { sent: false, sendAt: { lte: new Date() } },
      include: { user: true },
      take: 50,
    });
    for (const n of due) {
      try {
        await sendText(n.user.phone, n.message);
        await prisma.notificationSchedule.update({ where: { id: n.id }, data: { sent: true } });
      } catch (err) {
        console.error(`[Cron] Notification ${n.id} failed:`, err);
      }
    }
  });

  // ─── Lembrete de agendamentos (diário às 8h) ─────────────
  cron.schedule('0 8 * * *', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const appointments = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: tomorrow, lt: dayAfter }, status: { in: ['SCHEDULED', 'CONFIRMED'] }, reminderSent: false },
      include: { user: true },
    });

    for (const appt of appointments) {
      const time = appt.scheduledAt.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      await sendText(appt.user.phone, `📅 Lembrete: amanhã você tem *${appt.clientName}* às ${time}${appt.service ? ` — ${appt.service}` : ''}`);
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent: true } });
    }
  });

  // ─── Resumo diário personalizado ─────────────────────────
  cron.schedule('0 * * * *', async () => {
    const hour = new Date().getHours();
    const users = await prisma.user.findMany({
      where: { dailySummary: true, summaryHour: hour },
    });

    for (const user of users) {
      try {
        await sendDailySummary(user.id, user.phone);
      } catch (err) {
        console.error(`[Cron] Daily summary failed for ${user.phone}:`, err);
      }
    }
  });

  // ─── Contas da semana (segunda às 9h) ────────────────────
  cron.schedule('0 9 * * 1', async () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const bills = await prisma.bill.findMany({
      where: { paid: false, dueDate: { lte: nextWeek } },
      include: { user: true },
    });

    const byUser = bills.reduce<Record<string, typeof bills>>((acc, b) => {
      if (!acc[b.userId]) acc[b.userId] = [];
      acc[b.userId]!.push(b);
      return acc;
    }, {});

    for (const userBills of Object.values(byUser)) {
      const first = userBills[0];
      if (!first) continue;
      const lines = userBills.map((b) => `• ${b.description} — R$ ${b.amount.toFixed(2)} (${b.dueDate.toLocaleDateString('pt-BR')})`);
      const total = userBills.reduce((s, b) => s + b.amount, 0);
      await sendText(first.user.phone, `⚠️ *Contas vencendo essa semana:*\n\n${lines.join('\n')}\n\nTotal: *R$ ${total.toFixed(2)}*`);
    }
  });

  // ─── Transações recorrentes (diário à meia-noite) ────────
  cron.schedule('0 0 * * *', async () => {
    const today = new Date().getDate();
    const bills = await prisma.bill.findMany({
      where: { recurring: true, recurringDay: today, paid: true },
      include: { user: true },
    });

    for (const bill of bills) {
      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + 1);
      nextDue.setDate(bill.recurringDay!);
      nextDue.setHours(9, 0, 0, 0);

      await prisma.bill.create({
        data: {
          userId: bill.userId,
          description: bill.description,
          amount: bill.amount,
          dueDate: nextDue,
          recurring: true,
          recurringDay: bill.recurringDay,
        },
      });
    }
  });

  // ─── Score financeiro + alertas preditivos (dia 15 e dia 1) ─
  cron.schedule('0 9 1,15 * *', async () => {
    const today = new Date().getDate();
    const users = await prisma.user.findMany();

    for (const user of users) {
      try {
        if (today === 15) await sendPredictiveAlert(user.id, user.phone);
        if (today === 1) await sendMonthlyScore(user.id, user.phone);
      } catch (err) {
        console.error(`[Cron] Score/alert failed for ${user.phone}:`, err);
      }
    }
  });

  console.log('[Cron] Jobs started: notifications(1min), appointments(8h), summary(hourly), bills(Mon 9h), recurring(midnight), score(1st/15th)');
}

// ─── Resumo diário ───────────────────────────────────────────

async function sendDailySummary(userId: string, phone: string): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  const [appointments, expenses, bills, goals] = await Promise.all([
    prisma.appointment.findMany({
      where: { userId, scheduledAt: { gte: today, lt: tomorrow }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.expense.findMany({ where: { userId, date: { gte: today } } }),
    prisma.bill.findMany({
      where: { userId, paid: false, dueDate: { gte: today, lt: new Date(today.getTime() + 3 * 86400000) } },
    }),
    prisma.financialGoal.findMany({ where: { userId, achieved: false }, take: 2 }),
  ]);

  let msg = `☀️ *Bom dia! Seu resumo de hoje:*\n\n`;

  if (appointments.length) {
    const apptLines = appointments.map((a) => {
      const t = a.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `  • ${t} — ${a.clientName}${a.service ? ` (${a.service})` : ''}`;
    });
    msg += `📅 *Hoje na agenda:*\n${apptLines.join('\n')}\n\n`;
  } else {
    msg += `📅 Agenda livre hoje\n\n`;
  }

  if (bills.length) {
    const billLines = bills.map((b) => `  • ${b.description}: R$ ${b.amount.toFixed(2)}`);
    msg += `⚠️ *Contas vencendo em breve:*\n${billLines.join('\n')}\n\n`;
  }

  if (expenses.length) {
    const total = expenses.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
    msg += `💸 Gastos hoje: R$ ${total.toFixed(2)}\n\n`;
  }

  if (goals.length) {
    const g = goals[0]!;
    const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
    msg += `🎯 Meta "${g.description}": ${pct}%`;
  }

  await sendText(phone, msg);
}

// ─── Alerta preditivo (dia 15) ───────────────────────────────

async function sendPredictiveAlert(userId: string, phone: string): Promise<void> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const expenses = await prisma.expense.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: startOfMonth } },
  });

  if (expenses.length < 3) return;

  const totalSoFar = expenses.reduce((s, e) => s + e.amount, 0);
  const projectedMonth = totalSoFar * 2;

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthExpenses = await prisma.expense.findMany({
    where: { userId, type: 'EXPENSE', date: { gte: lastMonth, lte: lastMonthEnd } },
  });
  const lastMonthTotal = lastMonthExpenses.reduce((s, e) => s + e.amount, 0);

  if (lastMonthTotal === 0) return;

  const diff = ((projectedMonth - lastMonthTotal) / lastMonthTotal) * 100;
  const emoji = diff > 20 ? '🔴' : diff > 5 ? '🟡' : '🟢';

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: 'Você é um coach financeiro. Dê um alerta preditivo curto (2-3 linhas) em português, baseado nos dados abaixo. Seja direto e útil.',
    messages: [{
      role: 'user',
      content: `Gasto até dia 15: R$${totalSoFar.toFixed(0)}. Projeção mensal: R$${projectedMonth.toFixed(0)}. Mês passado: R$${lastMonthTotal.toFixed(0)}. Variação: ${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`,
    }],
  });

  const insight = response.content[0]?.type === 'text' ? response.content[0].text : '';

  await sendText(phone,
    `${emoji} *Alerta Financeiro — Metade do mês*\n\n` +
    `💸 Gasto até agora: R$ ${totalSoFar.toFixed(2)}\n` +
    `📊 Projeção: R$ ${projectedMonth.toFixed(2)}\n` +
    `📅 Mês passado: R$ ${lastMonthTotal.toFixed(2)}\n\n` +
    insight
  );
}

// ─── Score financeiro mensal (dia 1) ─────────────────────────

async function sendMonthlyScore(userId: string, phone: string): Promise<void> {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [expenses, incomes, bills, goals] = await Promise.all([
    prisma.expense.findMany({ where: { userId, type: 'EXPENSE', date: { gte: lastMonth, lte: lastMonthEnd } } }),
    prisma.expense.findMany({ where: { userId, type: 'INCOME', date: { gte: lastMonth, lte: lastMonthEnd } } }),
    prisma.bill.findMany({ where: { userId, dueDate: { gte: lastMonth, lte: lastMonthEnd } } }),
    prisma.financialGoal.findMany({ where: { userId } }),
  ]);

  if (expenses.length < 3) return;

  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalInc = incomes.reduce((s, e) => s + e.amount, 0);
  const paidBills = bills.filter((b) => b.paid).length;
  const totalBills = bills.length;
  const achievedGoals = goals.filter((g) => g.achieved).length;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: 'Você é um coach financeiro. Calcule um score de 0-100 e dê 2-3 insights personalizados em português. Seja encorajador mas honesto. Formato: Score: XX/100 seguido de insights.',
    messages: [{
      role: 'user',
      content: `Gastos: R$${totalExp.toFixed(0)} | Receitas: R$${totalInc.toFixed(0)} | Contas pagas: ${paidBills}/${totalBills} | Metas atingidas: ${achievedGoals}/${goals.length}`,
    }],
  });

  const analysis = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const monthName = lastMonthEnd.toLocaleString('pt-BR', { month: 'long' });

  await sendText(phone,
    `🏆 *Score Financeiro — ${monthName}*\n\n${analysis}\n\n_Continue assim! Novo relatório dia 1° do próximo mês._`
  );
}
