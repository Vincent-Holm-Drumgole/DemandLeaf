import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireRequestWorkspace } from "@/lib/workspace-server";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`report:${userId}`, {
    limit: 10,
    windowSec: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM format

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Determine date range
  const now = new Date();
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month format" }, { status: 400 });
  }
  let year = month ? Number(month.slice(0, 4)) : now.getFullYear();
  let mon = month ? Number(month.slice(5, 7)) - 1 : now.getMonth() - 1;
  if (!month && mon < 0) {
    mon = 11;
    year -= 1;
  }
  if (month && (!Number.isInteger(year) || !Number.isInteger(mon) || mon < 0 || mon > 11)) {
    return NextResponse.json({ error: "Invalid month value" }, { status: 400 });
  }
  const periodStart = new Date(year, mon, 1).getTime();
  const periodEnd = new Date(year, mon + 1, 0, 23, 59, 59).getTime();

  // Gather data
  const blogs = await convex.query(api.blogs.listByWorkspaceId, {
    workspaceId: workspace._id,
  });
  const publishedBlogs = blogs.filter(
    (b: { status: string; publishedAt?: number }) =>
      b.status === "published" &&
      b.publishedAt &&
      b.publishedAt >= periodStart &&
      b.publishedAt <= periodEnd
  );

  const snapshots = await convex.query(
    api.rankSnapshots.getRecentForWorkspace,
    { workspaceId: workspace._id, since: periodStart }
  );

  const alerts = await convex.query(api.decayAlerts.listByWorkspace, {
    workspaceId: workspace._id,
  });
  const periodAlerts = alerts.filter(
    (a: { triggeredAt: number }) =>
      a.triggeredAt >= periodStart && a.triggeredAt <= periodEnd
  );

  const totalCostCents = publishedBlogs.reduce(
    (sum: number, b: { generationCostCents?: number }) =>
      sum + (b.generationCostCents ?? 0),
    0
  );

  // Build SSR HTML report
  const monthLabel = new Date(year, mon).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const safeWorkspaceName = escapeHtml(workspace.name ?? "DemandLeaf");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Content Performance Report — ${escapeHtml(monthLabel)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1e293b; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #64748b; margin-bottom: 32px; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .card-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .card-value { font-size: 24px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th { text-align: left; font-size: 12px; color: #64748b; padding: 8px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .footer { font-size: 12px; color: #94a3b8; margin-top: 40px; text-align: center; }
    @media print { body { padding: 0; } .cards { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>${safeWorkspaceName} — Content Performance Report</h1>
  <p class="subtitle">${escapeHtml(monthLabel)}</p>

  <div class="cards">
    <div class="card">
      <div class="card-label">Published Posts</div>
      <div class="card-value">${publishedBlogs.length}</div>
    </div>
    <div class="card">
      <div class="card-label">Rank Checks</div>
      <div class="card-value">${snapshots.length}</div>
    </div>
    <div class="card">
      <div class="card-label">Decay Alerts</div>
      <div class="card-value">${periodAlerts.length}</div>
    </div>
    <div class="card">
      <div class="card-label">Generation Cost</div>
      <div class="card-value">$${(totalCostCents / 100).toFixed(2)}</div>
    </div>
  </div>

  <h2>Published Posts</h2>
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Keyword</th>
        <th>SEO Score</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${publishedBlogs
        .map(
          (b: {
            title: string;
            focusKeyword?: string;
            seoScore?: number;
            status: string;
          }) =>
            `<tr><td>${escapeHtml(b.title)}</td><td>${escapeHtml(b.focusKeyword ?? "—")}</td><td>${b.seoScore ?? "—"}</td><td>${escapeHtml(b.status)}</td></tr>`
        )
        .join("\n      ")}
    </tbody>
  </table>

  ${
    periodAlerts.length > 0
      ? `<h2>Decay Alerts</h2>
  <table>
    <thead><tr><th>Type</th><th>Severity</th><th>Delta</th><th>Status</th></tr></thead>
    <tbody>
      ${periodAlerts
        .map(
          (a: {
            alertType: string;
            severity: string;
            deltaPercent: number;
            status: string;
          }) =>
            `<tr><td>${escapeHtml(a.alertType)}</td><td>${escapeHtml(a.severity)}</td><td>${a.deltaPercent}%</td><td>${escapeHtml(a.status)}</td></tr>`
        )
        .join("\n      ")}
    </tbody>
  </table>`
      : ""
  }

  <div class="footer">
    Generated by DemandLeaf on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
