import "server-only";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY env var must be set");
    _stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  }
  return _stripe;
}
