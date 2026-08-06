import { FREE_TIER_TOKENS } from "@/lib/tokens/plans";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Plan } from "@/generated/prisma/client";

export async function allocateInitialTokens(userId: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: FREE_TIER_TOKENS },
    }),
    prisma.tokenLedgerEntry.create({
      data: {
        userId,
        amount: FREE_TIER_TOKENS,
        type: "ALLOCATION",
        reference: "signup_bonus",
      },
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan: "FREE" },
      update: {},
    }),
  ]);
}

export async function getTokenBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenBalance: true },
  });
  return user?.tokenBalance ?? 0;
}

export async function hasSufficientTokens(
  userId: string,
  estimated: number,
): Promise<boolean> {
  const balance = await getTokenBalance(userId);
  return balance >= estimated;
}

export async function deductTokens(
  userId: string,
  amount: number,
  reference: string,
  metadata?: Record<string, unknown>,
) {
  if (amount <= 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenBalance: true },
  });

  if (!user || user.tokenBalance < amount) {
    throw new Error("Insufficient token balance");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: { decrement: amount } },
    }),
    prisma.tokenLedgerEntry.create({
      data: {
        userId,
        amount: -amount,
        type: "DEDUCTION",
        reference,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    }),
  ]);
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true },
  });
  return sub?.plan ?? "FREE";
}
