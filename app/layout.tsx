import type { Metadata } from "next";
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
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
