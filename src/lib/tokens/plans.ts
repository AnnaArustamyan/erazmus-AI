import type { Plan } from "@/generated/prisma/client";

export const FREE_TIER_TOKENS = 100_000;

export const PLAN_TOKENS: Record<Plan, number> = {
  FREE: 100_000,
  BASIC: 1_000_000,
  PRO: 3_000_000,
};

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free",
  BASIC: "Basic",
  PRO: "Pro",
};

export const PLAN_PRICES: Record<Plan, number | null> = {
  FREE: null,
  BASIC: 19,
  PRO: 49,
};

export function canUseAgents(plan: Plan): boolean {
  return plan === "PRO";
}

export function canUseGrantWizard(plan: Plan): boolean {
  return plan === "PRO";
}
