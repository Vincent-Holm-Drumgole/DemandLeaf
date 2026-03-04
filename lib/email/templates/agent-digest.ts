import { marked } from "marked";
import type { AgentType } from "@/types";

const AGENT_LABELS: Record<AgentType, string> = {
  calendar: "Content Calendar",
  refresh: "Content Refresh",
  internal_links: "Internal Linking",
  competitive_response: "Competitive Response",
  strategy_drift: "Strategy Drift",
  publishing: "Autonomous Publishing",
};

export function buildDigestHtml(
  digest: string,
  actionId: string,
  appUrl: string,
  agentType: AgentType
): string {
  const contentHtml = marked.parse(digest, { async: false }) as string;
  const agentLabel = AGENT_LABELS[agentType] ?? agentType;
  const reviewUrl = `${appUrl}/agents?action=${encodeURIComponent(actionId)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
    <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 24px;">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
          ${agentLabel} Agent
        </span>
      </div>
      <div style="font-size: 14px; line-height: 1.6; color: #1e293b;">
        ${contentHtml}
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${reviewUrl}" style="display: inline-block; background: #0f172a; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          Review & Approve
        </a>
      </div>
    </div>
    <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 16px;">
      DemandLeaf — AI Content Intelligence
    </p>
  </div>
</body>
</html>`;
}
