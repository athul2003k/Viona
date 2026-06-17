import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.metadata?.org_id;
        const planId = session.metadata?.plan_id;

        if (orgId && planId && session.subscription) {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const periodStart = (stripeSubscription as any).current_period_start;
          const periodEnd = (stripeSubscription as any).current_period_end;

          await prisma.subscription.upsert({
            where: { org_id: BigInt(orgId) },
            create: {
              org_id: BigInt(orgId),
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: stripeSubscription.id,
              stripe_price_id:
                stripeSubscription.items.data[0]?.price.id || null,
              plan: planId,
              status: "active",
              current_period_start: periodStart
                ? new Date(periodStart * 1000)
                : null,
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000)
                : null,
            },
            update: {
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: stripeSubscription.id,
              stripe_price_id:
                stripeSubscription.items.data[0]?.price.id || null,
              plan: planId,
              status: "active",
              current_period_start: periodStart
                ? new Date(periodStart * 1000)
                : null,
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000)
                : null,
              cancel_at_period_end: false,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const existingSub = await prisma.subscription.findUnique({
          where: { stripe_subscription_id: subscription.id },
        });

        if (existingSub) {
          const statusMap: Record<string, string> = {
            active: "active",
            past_due: "past_due",
            canceled: "canceled",
            trialing: "trialing",
            incomplete: "past_due",
            incomplete_expired: "canceled",
            unpaid: "past_due",
          };

          const periodStart = (subscription as any).current_period_start;
          const periodEnd = (subscription as any).current_period_end;

          await prisma.subscription.update({
            where: { stripe_subscription_id: subscription.id },
            data: {
              status: statusMap[subscription.status] || "active",
              stripe_price_id:
                subscription.items.data[0]?.price.id ||
                existingSub.stripe_price_id,
              current_period_start: periodStart
                ? new Date(periodStart * 1000)
                : undefined,
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000)
                : undefined,
              cancel_at_period_end: subscription.cancel_at_period_end,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        await prisma.subscription.updateMany({
          where: { stripe_subscription_id: subscription.id },
          data: {
            status: "canceled",
            plan: "free",
            stripe_subscription_id: null,
            stripe_price_id: null,
            cancel_at_period_end: false,
          },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as any)?.id;

        if (subscriptionId) {
          await prisma.subscription.updateMany({
            where: {
              stripe_subscription_id: subscriptionId,
            },
            data: { status: "past_due" },
          });
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
