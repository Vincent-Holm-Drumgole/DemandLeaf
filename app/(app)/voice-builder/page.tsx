"use client";

import { useAuthGuard } from "@/hooks/use-auth-guard";
import { WizardLayout } from "@/components/voice-builder/wizard-layout";
import { WizardStep1 } from "@/components/voice-builder/wizard-step1";
import { WizardStep2 } from "@/components/voice-builder/wizard-step2";
import { WizardStep3Calibration } from "@/components/voice-builder/wizard-step3-calibration";
import { useVoiceWizardStore } from "@/store/voice-wizard-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VoiceBuilderPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const currentStep = useVoiceWizardStore((s) => s.currentStep);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Settings
            </Link>
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-xl font-semibold">Voice Builder</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <WizardLayout>
          {currentStep === 1 && <WizardStep1 />}
          {currentStep === 2 && <WizardStep2 />}
          {currentStep === 3 && <WizardStep3Calibration />}
        </WizardLayout>
      </div>
    </div>
  );
}
