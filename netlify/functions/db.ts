// Database connection utility for Netlify Functions
import { PrismaClient } from '@prisma/client';

// Global instance to reuse connections
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}

export async function closePrismaClient(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}