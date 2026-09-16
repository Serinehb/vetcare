import { PrismaClient } from "@prisma/client";

/* ─── Prisma client singleton ───
   En dev, Next.js recharge les modules à chaud (hot-reload) à chaque
   sauvegarde. Sans cette précaution, chaque reload créerait une nouvelle
   connexion MySQL et finirait par épuiser le pool de connexions.
   On garde donc une seule instance accrochée à `globalThis`. */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
