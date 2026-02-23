// Replace CLERK_ISSUER_URL with the domain from your Clerk dashboard:
// Clerk Dashboard → JWT Templates → Convex template → Issuer field
// It looks like: https://your-app-name.clerk.accounts.dev
const CLERK_ISSUER_URL = process.env.CLERK_ISSUER_URL;
if (!CLERK_ISSUER_URL) {
  throw new Error("Missing required environment variable: CLERK_ISSUER_URL");
}

const authConfig = {
  providers: [
    {
      domain: CLERK_ISSUER_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
