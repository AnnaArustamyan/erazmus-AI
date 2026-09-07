#!/usr/bin/env node
/**
 * Manually set a user's plan — the only way to move someone onto a paid plan
 * until real billing exists (Stripe doesn't work for Armenia-based accounts;
 * see docs/REQUIREMENTS.md §4 and PRODUCT-SPEC.md OQ-1 for the payment
 * provider question). Mirrors what a webhook would do once one exists:
 * updates `plan` and resets `monthly_token_limit` to match, so the user
 * isn't left on the new plan's label but the old plan's quota.
 *
 * Usage:
 *   node scripts/set-plan.js <email> <free|basic|pro|enterprise>
 */
import { supabaseAdmin } from '../src/config/supabase.js';
import { PLANS } from '../src/lib/plans.js';

async function run() {
  const [email, planId] = process.argv.slice(2);

  if (!email || !planId) {
    console.error('Usage: node scripts/set-plan.js <email> <free|basic|pro|enterprise>');
    process.exit(1);
  }

  const plan = PLANS[planId];
  if (!plan) {
    console.error(`Unknown plan "${planId}". Valid plans: ${Object.keys(PLANS).join(', ')}`);
    process.exit(1);
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ plan: plan.id, monthly_token_limit: plan.monthlyTokenLimit })
    .eq('email', email)
    .select('id, email, plan, monthly_token_limit')
    .single();

  if (error || !data) {
    console.error(`Could not update ${email}:`, error?.message || 'user not found');
    process.exit(1);
  }

  console.log(`${data.email} → plan=${data.plan}, monthly_token_limit=${data.monthly_token_limit}`);
}

run();
