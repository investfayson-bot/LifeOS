import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrisma(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://lifeos:lifeos123@172.22.201.52:5432/lifeos',
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env['NODE_ENV'] !== 'production') globalForPrisma.prisma = prisma;
