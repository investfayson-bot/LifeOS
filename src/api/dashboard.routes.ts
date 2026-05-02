import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';

export const dashboardRouter = Router();

dashboardRouter.get('/api/stats', async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [users, expenses, incomes, bills, leads, appointments, goals] = await Promise.all([
    prisma.user.count(),
    prisma.expense.aggregate({
      where: { type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.bill.count({ where: { paid: false } }),
    prisma.lead.groupBy({ by: ['status'], _count: true }),
    prisma.appointment.count({
      where: { scheduledAt: { gte: now, lte: nextWeek }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
    }),
    prisma.financialGoal.findMany({ where: { achieved: false }, take: 3 }),
  ]);

  res.json({
    users,
    monthExpenses: expenses._sum.amount ?? 0,
    monthIncome: incomes._sum.amount ?? 0,
    expenseCount: expenses._count,
    pendingBills: bills,
    leads: leads.reduce<Record<string, number>>((acc, l) => { acc[l.status] = l._count; return acc; }, {}),
    upcomingAppointments: appointments,
    goals,
  });
});

dashboardRouter.get('/api/expenses', async (req: Request, res: Response) => {
  const limit = Number(req.query['limit'] ?? 20);
  const expenses = await prisma.expense.findMany({
    orderBy: { date: 'desc' },
    take: limit,
    include: { user: { select: { phone: true, name: true } } },
  });
  res.json(expenses);
});

dashboardRouter.get('/api/appointments', async (_req: Request, res: Response) => {
  const appointments = await prisma.appointment.findMany({
    where: { scheduledAt: { gte: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
    include: { user: { select: { phone: true, name: true } } },
  });
  res.json(appointments);
});

dashboardRouter.get('/api/leads', async (_req: Request, res: Response) => {
  const leads = await prisma.lead.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 30,
    include: {
      user: { select: { phone: true, name: true } },
      followUps: { where: { done: false }, orderBy: { scheduledAt: 'asc' }, take: 1 },
    },
  });
  res.json(leads);
});

dashboardRouter.get('/api/expenses/chart', async (_req: Request, res: Response) => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const data = await Promise.all(
    days.map(async (day) => {
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const agg = await prisma.expense.aggregate({
        where: { date: { gte: day, lt: next } },
        _sum: { amount: true },
      });
      return {
        date: day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
        total: agg._sum.amount ?? 0,
      };
    })
  );

  res.json(data);
});
