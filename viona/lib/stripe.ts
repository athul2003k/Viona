import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

// ============================================
// STRIPE CLIENT (lazy to avoid build-time crash)
// ============================================

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

// Keep backward-compat export but lazy
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

// ============================================
// PLAN CONFIGURATION
// ============================================

export type PlanId = "free" | "starter" | "pro" | "enterprise";

export interface PlanConfig {
  id: PlanId;
  name: string;
  price: number; // monthly price in USD, 0 = free, -1 = custom
  stripePriceId: string | null;
  limits: {
    workflows: number; // -1 = unlimited
    orders: number;
    members: number;
    aiRuns: number;
  };
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    stripePriceId: null,
    limits: {
      workflows: 3,
      orders: 50,
      members: 2,
      aiRuns: 100,
    },
    features: [
      "3 Workflows",
      "50 Orders / month",
      "2 Team members",
      "100 AI Agent runs / month",
      "Community support",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 29,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || "price_starter_placeholder",
    limits: {
      workflows: 25,
      orders: 500,
      members: 10,
      aiRuns: 100,
    },
    features: [
      "25 Workflows",
      "500 Orders / month",
      "10 Team members",
      "100 AI Agent runs / month",
      "Email support",
      "Priority queue",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 99,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro_placeholder",
    limits: {
      workflows: -1,
      orders: 5000,
      members: 50,
      aiRuns: 1000,
    },
    features: [
      "Unlimited Workflows",
      "5,000 Orders / month",
      "50 Team members",
      "1,000 AI Agent runs / month",
      "Priority support",
      "Advanced analytics",
      "Custom integrations",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: -1,
    stripePriceId: null,
    limits: {
      workflows: -1,
      orders: -1,
      members: -1,
      aiRuns: -1,
    },
    features: [
      "Unlimited everything",
      "Dedicated account manager",
      "Custom SLA",
      "On-premise deployment",
      "SSO & SAML",
      "24/7 priority support",
    ],
  },
};

// ============================================
// HELPERS
// ============================================

export function getPlanConfig(planId: string): PlanConfig {
  return PLANS[planId as PlanId] || PLANS.free;
}

export async function getOrCreateStripeCustomer(
  orgId: bigint,
  orgName: string,
  email: string
): Promise<string> {
  const subscription = await prisma.subscription.findUnique({
    where: { org_id: orgId },
  });

  if (subscription?.stripe_customer_id) {
    return subscription.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    name: orgName,
    email,
    metadata: { org_id: orgId.toString() },
  });

  await prisma.subscription.upsert({
    where: { org_id: orgId },
    create: {
      org_id: orgId,
      stripe_customer_id: customer.id,
      plan: "free",
      status: "active",
    },
    update: {
      stripe_customer_id: customer.id,
    },
  });

  return customer.id;
}

export async function getOrgSubscription(orgId: bigint) {
  let subscription = await prisma.subscription.findUnique({
    where: { org_id: orgId },
  });

  // Auto-create free subscription if none exists
  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        org_id: orgId,
        plan: "free",
        status: "active",
      },
    });
  }

  return subscription;
}

export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getUsageForOrg(orgId: bigint) {
  const period = getCurrentPeriod();

  let usage = await prisma.usageRecord.findUnique({
    where: { org_id_period: { org_id: orgId, period } },
  });

  if (!usage) {
    // Count actual current usage from DB
    const [workflowCount, memberCount] = await Promise.all([
      prisma.workflow.count({ where: { org_id: orgId } }),
      prisma.organizationMember.count({ where: { org_id: orgId } }),
    ]);

    usage = await prisma.usageRecord.create({
      data: {
        org_id: orgId,
        period,
        workflows: workflowCount,
        members: memberCount,
        orders: 0,
        ai_runs: 0,
      },
    });
  }

  return usage;
}

export function checkLimit(
  current: number,
  limit: number
): { allowed: boolean; percentage: number } {
  if (limit === -1) return { allowed: true, percentage: 0 };
  const percentage = Math.min(Math.round((current / limit) * 100), 100);
  return { allowed: current < limit, percentage };
}
