"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NeverSayList } from "@/components/never-say/never-say-list";
import { Wand2 } from "lucide-react";

export default function SettingsPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <Tabs defaultValue="account">
          <TabsList className="mb-6">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="voice">Voice Profile</TabsTrigger>
            <TabsTrigger value="never-say">Never-Say List</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{user.primaryEmailAddress?.emailAddress ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{user.fullName ?? "—"}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voice">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Voice Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your brand voice profile guides the tone, style, and personality of every
                  generated blog post. Complete the Voice Builder wizard to set it up, or
                  re-run it to update your profile.
                </p>
                <Button asChild>
                  <Link href="/voice-builder">
                    <Wand2 className="mr-2 h-4 w-4" />
                    Open Voice Builder
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  The wizard takes about 5 minutes and covers your communication style,
                  personality, and writing preferences. High-rated calibration samples are
                  automatically added as writing examples for the AI.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="never-say">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Never-Say List</CardTitle>
              </CardHeader>
              <CardContent>
                <NeverSayList />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
