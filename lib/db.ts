import { PrismaClient } from "@/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPool: Pool | undefined;
  prismaAdapter: PrismaPg | undefined;
};

const prismaPool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

const prismaAdapter = globalForPrisma.prismaAdapter ?? new PrismaPg(prismaPool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: prismaAdapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = prismaPool;
  globalForPrisma.prismaAdapter = prismaAdapter;
}
