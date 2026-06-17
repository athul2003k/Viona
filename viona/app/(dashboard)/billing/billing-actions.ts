"use server";

import { prisma } from "@/lib/prisma";
import {
  stripe,
  PLANS,
  PlanId,
  getPlanConfig,
  getOrCreateStripeCustomer,
  getOrgSubscription,
  getUsageForOrg,
  checkLimit,
  getCurrentPeriod,
} from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";

// ============================================
// GET SUBSCRIPTION DETAILS
// ============================================

export async function getSubscriptionDetails(orgId: string) {
  try {
    const id = BigInt(orgId);
    const subscription = await getOrgSubscription(id);
    const usage = await getUsageForOrg(id);
    const plan = getPlanConfig(subscription.plan);

    const workflowCount = await prisma.workflow.count({ where: { org_id: id, status: "active" } });
    const memberCount = await prisma.organizationMember.count({ where: { org_id: id } });

    return {
      plan: subscription.plan,
      planName: plan.name,
      status: subscription.status,
      price: plan.price,
      currentPeriodEnd: subscription.current_period_end?.toISOString() || null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: subscription.stripe_customer_id,
      usage: {
        workflows: { current: workflowCount, limit: plan.limits.workflows },
        orders: { current: usage.orders, limit: plan.limits.orders },
        members: { current: memberCount, limit: plan.limits.members },
        aiRuns: { current: usage.ai_runs, limit: plan.limits.aiRuns },
      },
    };
  } catch (error) {
    console.error("Failed to get subscription details:", error);
    return null;
  }
}

// ============================================
// GET USAGE STATS (for sidebar meter)
// ============================================

export async function getUsageStats(orgId: string) {
  try {
    const id = BigInt(orgId);
    const subscription = await getOrgSubscription(id);
    const usage = await getUsageForOrg(id);
    const plan = getPlanConfig(subscription.plan);

    const workflowCount = await prisma.workflow.count({ where: { org_id: id, status: "active" } });
    const memberCount = await prisma.organizationMember.count({ where: { org_id: id } });

    const workflowLimit = plan.limits.workflows;
    const workflowCheck = checkLimit(workflowCount, workflowLimit);

    return {
      plan: subscription.plan as PlanId,
      planName: plan.name,
      workflows: {
        current: workflowCount,
        limit: workflowLimit,
        percentage: workflowCheck.percentage,
        allowed: workflowCheck.allowed,
      },
      orders: {
        current: usage.orders,
        limit: plan.limits.orders,
        ...checkLimit(usage.orders, plan.limits.orders),
      },
      members: {
        current: memberCount,
        limit: plan.limits.members,
        ...checkLimit(memberCount, plan.limits.members),
      },
      aiRuns: {
        current: usage.ai_runs,
        limit: plan.limits.aiRuns,
        ...checkLimit(usage.ai_runs, plan.limits.aiRuns),
      },
    };
  } catch (error) {
    console.error("Failed to get usage stats:", error);
    return null;
  }
}

// ============================================
// CREATE CHECKOUT SESSION
// ============================================

export async function createCheckoutSession(orgId: string, planId: PlanId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Authentication required");

    const plan = PLANS[planId];
    if (!plan || !plan.stripePriceId) {
      throw new Error("Invalid plan or plan has no Stripe price");
    }

    const id = BigInt(orgId);

    // Get org details for customer creation
    const org = await prisma.organization.findUnique({
      where: { org_id: id },
      select: { name: true, creator: { select: { email: true } } },
    });

    if (!org) throw new Error("Organization not found");

    const customerId = await getOrCreateStripeCustomer(
      id,
      org.name,
      org.creator.email
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      metadata: {
        org_id: orgId,
        plan_id: planId,
      },
    });

    return { url: session.url };
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return { error: "Failed to create checkout session" };
  }
}

// ============================================
// CREATE BILLING PORTAL SESSION
// ============================================

export async function createBillingPortalSession(orgId: string) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Authentication required");

    const id = BigInt(orgId);
    const subscription = await getOrgSubscription(id);

    if (!subscription.stripe_customer_id) {
      return { error: "No billing account found. Please upgrade first." };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    });

    return { url: session.url };
  } catch (error) {
    console.error("Failed to create billing portal session:", error);
    return { error: "Failed to open billing portal" };
  }
}

// ============================================
// GET ALL PLANS (for pricing display)
// ============================================

export async function getPlans() {
  return Object.values(PLANS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    features: plan.features,
    limits: plan.limits,
  }));
}

// ============================================
// INCREMENT USAGE (called from other modules)
// ============================================

export async function incrementUsage(
  orgId: bigint,
  field: "workflows" | "orders" | "ai_runs"
) {
  const period = getCurrentPeriod();

  await prisma.usageRecord.upsert({
    where: { org_id_period: { org_id: orgId, period } },
    create: {
      org_id: orgId,
      period,
      [field]: 1,
    },
    update: {
      [field]: { increment: 1 },
    },
  });
}
