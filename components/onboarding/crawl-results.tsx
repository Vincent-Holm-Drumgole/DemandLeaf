"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SOURCE_QUALITY_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  strong: { label: "Strong voice data", variant: "default" },
  mixed: { label: "Good voice data", variant: "secondary" },
  limited: { label: "Limited voice data", variant: "outline" },
  none: { label: "Minimal voice data", variant: "destructive" },
};

export function CrawlResults() {
  const router = useRouter();
  const { crawlResult, updateCrawlResult } = useOnboardingStore();

  if (!crawlResult) return null;

  const qualityInfo =
    SOURCE_QUALITY_LABELS[crawlResult.voiceProfile.sourceQuality] ??
    SOURCE_QUALITY_LABELS.limited;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <h2 className="text-2xl font-semibold text-foreground text-center">
          We found your brand
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Review and adjust these details before we write your blog.
        </p>

        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Company</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{crawlResult.companyName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {crawlResult.pagesFound} pages analyzed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Industry</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={crawlResult.industry}
                onChange={(e) =>
                  updateCrawlResult({ industry: e.target.value })
                }
                className="text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Target Audience</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={crawlResult.audience}
                onChange={(e) =>
                  updateCrawlResult({ audience: e.target.value })
                }
                className="text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Voice Profile</CardTitle>
                <Badge variant={qualityInfo.variant}>{qualityInfo.label}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {crawlResult.voiceProfile.description}
              </p>
              {crawlResult.voiceProfile.toneAttributes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {crawlResult.voiceProfile.toneAttributes.map((attr) => (
                    <Badge key={attr} variant="outline" className="text-xs">
                      {attr}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Button
          onClick={() => router.push("/generate")}
          size="lg"
          className="mt-6 w-full h-12"
        >
          Choose a Topic
        </Button>
      </div>
    </div>
  );
}
