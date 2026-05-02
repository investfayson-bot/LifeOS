import { prisma } from '../lib/prisma';

export async function remember(userId: string, key: string, value: string): Promise<void> {
  await prisma.longTermMemory.upsert({
    where: { userId_key: { userId, key } },
    update: { value },
    create: { userId, key, value },
  });
}

export async function recall(userId: string, key: string): Promise<string | null> {
  const mem = await prisma.longTermMemory.findUnique({
    where: { userId_key: { userId, key } },
  });
  return mem?.value ?? null;
}

export async function recallAll(userId: string): Promise<Record<string, string>> {
  const mems = await prisma.longTermMemory.findMany({ where: { userId } });
  return Object.fromEntries(mems.map((m) => [m.key, m.value]));
}
