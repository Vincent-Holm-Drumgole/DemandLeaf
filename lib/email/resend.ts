import "server-only";
import { buildDigestHtml } from "./templates/agent-digest";
import type { AgentType } from "@/types";

const AGENT_SUBJECTS: Record<AgentType, string> = {
  calendar: "Weekly Calendar Recommendations",
  refresh: "Content Refresh Needed",
  internal_links: "New Internal Link Suggestions",
  competitive_response: "Competitor Content Alert",
  strategy_drift: "Strategy Health Check",
  publishing: "Publishing Agent Update",
};

/**
 * Send an agent digest email via Resend.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function sendAgentDigestEmail(params: {
  to: string;
  agentType: AgentType;
  digest: string;
  actionId: string;
  appUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set, skipping email");
    return;
  }

  const subject = `DemandLeaf: ${AGENT_SUBJECTS[params.agentType] ?? "Agent Update"}`;
  const html = buildDigestHtml(
    params.digest,
    params.actionId,
    params.appUrl,
    params.agentType
  );

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "DemandLeaf <noreply@demandleaf.com>",
        to: params.to,
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.error(`[email] Resend API error: ${res.status} ${text}`);
    }
  } catch (err) {
    console.error("[email] Failed to send digest:", err);
  }
}
