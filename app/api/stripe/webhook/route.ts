import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import type Stripe from "stripe";

export const runtime = "nodejs";

type PlanStatus = "trial" | "active" | "past_due" | "canceled";

function mapStripeStatus(status: string): PlanStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "active";
  }
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const cronKey = process.env.INNGEST_CRON_KEY;
  if (!cronKey) {
    console.error("[stripe/webhook] INNGEST_CRON_KEY not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const convex = getConvexClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        if (!workspaceId) {
          console.warn("[stripe/webhook] checkout.session.completed missing workspaceId metadata");
          break;
        }

        const validId = parseConvexId(workspaceId, "workspaces");
        if (!validId) {
          console.warn("[stripe/webhook] checkout.session.completed invalid workspaceId:", workspaceId);
          break;
        }

        await convex.mutation(api.workspaces.updateBilling, {
          workspaceId: validId,
          stripeCustomerId:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id,
          stripeSubscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id,
          plan: "active",
          cronKey,
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) {
          console.warn("[stripe/webhook] subscription.updated missing customerId");
          break;
        }

        const workspace = await convex.query(
          api.workspaces.getByStripeCustomer,
          { stripeCustomerId: customerId, cronKey }
        );
        if (!workspace) {
          console.warn("[stripe/webhook] subscription.updated no workspace for customer:", customerId);
          break;
        }

        await convex.mutation(api.workspaces.updateBilling, {
          workspaceId: workspace._id,
          plan: mapStripeStatus(sub.status),
          cronKey,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) {
          console.warn("[stripe/webhook] subscription.deleted missing customerId");
          break;
        }

        const workspace = await convex.query(
          api.workspaces.getByStripeCustomer,
          { stripeCustomerId: customerId, cronKey }
        );
        if (!workspace) {
          console.warn("[stripe/webhook] subscription.deleted no workspace for customer:", customerId);
          break;
        }
        const planExpiresAtSec =
          sub.cancel_at ?? sub.ended_at ?? sub.canceled_at ?? Math.floor(Date.now() / 1000);

        await convex.mutation(api.workspaces.updateBilling, {
          workspaceId: workspace._id,
          plan: "canceled",
          planExpiresAt: planExpiresAtSec * 1000,
          cronKey,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) {
          console.warn("[stripe/webhook] invoice.payment_failed missing customerId");
          break;
        }

        const workspace = await convex.query(
          api.workspaces.getByStripeCustomer,
          { stripeCustomerId: customerId, cronKey }
        );
        if (!workspace) {
          console.warn("[stripe/webhook] invoice.payment_failed no workspace for customer:", customerId);
          break;
        }

        await convex.mutation(api.workspaces.updateBilling, {
          workspaceId: workspace._id,
          plan: "past_due",
          cronKey,
        });
        break;
      }
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
