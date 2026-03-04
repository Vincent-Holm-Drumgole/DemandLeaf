import "server-only";
import { getStripe } from "./client";

export async function createCheckoutSession(opts: {
  workspaceId: string;
  userId: string;
  email: string;
  stripeCustomerId?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: opts.priceId, quantity: 1 }],
    ...(opts.stripeCustomerId
      ? { customer: opts.stripeCustomerId }
      : { customer_email: opts.email }),
    metadata: {
      workspaceId: opts.workspaceId,
      userId: opts.userId,
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}

export async function createPortalSession(opts: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: opts.stripeCustomerId,
    return_url: opts.returnUrl,
  });

  return session.url;
}
