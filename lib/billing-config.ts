const billingEnabledFlag = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

export const isBillingEnabledClient = billingEnabledFlag;

export function isBillingEnabledServer() {
  return (
    billingEnabledFlag &&
    Boolean(process.env.STRIPE_SECRET_KEY) &&
    Boolean(process.env.STRIPE_PRICE_ID) &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET)
  );
}
