import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "DemandLeaf - AI Content Intelligence",
  description: "Create SEO-optimized, human-quality blog content in minutes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">
          <ConvexClientProvider>
            <PostHogProvider>{children}</PostHogProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
