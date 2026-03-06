import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicApiRoute = createRouteMatcher([
  "/api/crawl",
  "/api/generate",
  "/api/anonymous-session(.*)",
  "/api/provision",
  "/api/stripe/webhook",
  "/api/inngest(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Page routes enforce auth inside the App Router so workspace-aware redirects
  // can preserve the exact destination. Only private API routes are blocked here.
  if (req.nextUrl.pathname.startsWith("/api") && !isPublicApiRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
