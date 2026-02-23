// Replace CLERK_ISSUER_URL with the domain from your Clerk dashboard:
// Clerk Dashboard → JWT Templates → Convex template → Issuer field
// It looks like: https://your-app-name.clerk.accounts.dev
export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL ?? "",
      applicationID: "convex",
    },
  ],
};
