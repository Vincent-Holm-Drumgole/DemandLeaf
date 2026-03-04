"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";

interface GoogleConnectBannerProps {
  onConnect: () => void;
}

export function GoogleConnectBanner({ onConnect }: GoogleConnectBannerProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div>
          <p className="text-sm font-medium">
            Connect Google Analytics & Search Console
          </p>
          <p className="text-xs text-muted-foreground">
            Track traffic, clicks, impressions, and CTR for your published posts.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onConnect}>
          <Link2 className="mr-1 h-3.5 w-3.5" />
          Connect
        </Button>
      </CardContent>
    </Card>
  );
}
