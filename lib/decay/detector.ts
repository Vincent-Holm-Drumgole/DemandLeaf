import type { DecaySignal } from "@/types";

const MIN_BASELINE_POINTS = 2;
const BASELINE_START_DAYS = 21;
const BASELINE_END_DAYS = 8;
const CURRENT_WINDOW_DAYS = 8;
const RANK_WARNING_THRESHOLD = 3;
const RANK_CRITICAL_THRESHOLD = 5;
const TRAFFIC_WARNING_THRESHOLD = 0.10;
const TRAFFIC_CRITICAL_THRESHOLD = 0.20;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Analyze rank snapshots for a blog and detect position decay.
 * Pure code — no AI.
 *
 * Baseline: median of snapshots 8-21 days ago (min 2 data points).
 * Current: most recent snapshot within 8 days.
 * Warning: 3-4 position drop. Critical: 5+ position drop.
 */
export function detectRankDecay(
  snapshots: Array<{
    position: number | null;
    keyword: string;
    checkedAt: number;
  }>,
  keyword: string,
  blogId: string
): DecaySignal | null {
  const now = Date.now();
  const filtered = snapshots.filter((s) => s.keyword === keyword && s.position !== null);

  const baselineSnapshots = filtered.filter(
    (s) =>
      s.checkedAt >= now - BASELINE_START_DAYS * DAY_MS &&
      s.checkedAt <= now - BASELINE_END_DAYS * DAY_MS
  );

  if (baselineSnapshots.length < MIN_BASELINE_POINTS) return null;

  const currentSnapshot = filtered
    .filter((s) => s.checkedAt >= now - CURRENT_WINDOW_DAYS * DAY_MS)
    .sort((a, b) => b.checkedAt - a.checkedAt)[0];

  if (!currentSnapshot) return null;

  const baselinePositions = baselineSnapshots
    .map((s) => s.position!)
    .sort((a, b) => a - b);
  const medianIdx = Math.floor(baselinePositions.length / 2);
  const baseline =
    baselinePositions.length % 2 === 0
      ? (baselinePositions[medianIdx - 1] + baselinePositions[medianIdx]) / 2
      : baselinePositions[medianIdx];

  const current = currentSnapshot.position!;
  const drop = current - baseline; // positive = worse position

  if (drop < RANK_WARNING_THRESHOLD) return null;

  return {
    blogId,
    keyword,
    alertType: "rank_drop",
    severity: drop >= RANK_CRITICAL_THRESHOLD ? "critical" : "warning",
    baselineValue: baseline,
    currentValue: current,
    deltaPercent: Math.round((drop / baseline) * 100),
  };
}

interface MetricRow {
  sessions: number | null;
  clicks: number | null;
  ctr: number | null;
  impressions: number | null;
  periodStart: number;
}

/**
 * Analyze performance metrics for traffic decay.
 * Baseline: avg metrics 5-8 weeks ago. Current: avg last 4 weeks.
 * Warning: 10-19% decline. Critical: 20%+ decline.
 */
export function detectTrafficDecay(
  metrics: MetricRow[],
  blogId: string
): DecaySignal[] {
  const now = Date.now();
  const signals: DecaySignal[] = [];

  const baselineMetrics = metrics.filter(
    (m) =>
      m.periodStart >= now - 8 * 7 * DAY_MS &&
      m.periodStart < now - 4 * 7 * DAY_MS
  );
  const currentMetrics = metrics.filter(
    (m) => m.periodStart >= now - 4 * 7 * DAY_MS
  );

  if (baselineMetrics.length === 0 || currentMetrics.length === 0) return signals;

  const checks: Array<{
    field: keyof MetricRow;
    alertType: DecaySignal["alertType"];
  }> = [
    { field: "clicks", alertType: "traffic_decline" },
    { field: "impressions", alertType: "impressions_decline" },
    { field: "ctr", alertType: "ctr_decline" },
  ];

  for (const { field, alertType } of checks) {
    const baselineAvg = avg(baselineMetrics.map((m) => m[field] as number | null));
    const currentAvg = avg(currentMetrics.map((m) => m[field] as number | null));

    if (baselineAvg === null || currentAvg === null || baselineAvg === 0) continue;

    const declinePercent = (baselineAvg - currentAvg) / baselineAvg;
    if (declinePercent < TRAFFIC_WARNING_THRESHOLD) continue;

    signals.push({
      blogId,
      keyword: "",
      alertType,
      severity:
        declinePercent >= TRAFFIC_CRITICAL_THRESHOLD ? "critical" : "warning",
      baselineValue: Math.round(baselineAvg * 100) / 100,
      currentValue: Math.round(currentAvg * 100) / 100,
      deltaPercent: -Math.round(declinePercent * 100),
    });
  }

  return signals;
}

/**
 * De-duplicate: skip alerts where an open/acknowledged/refreshing alert
 * already exists for the same (blogId, alertType).
 */
export function filterNewAlerts(
  signals: DecaySignal[],
  existingOpenAlerts: Array<{
    blogId: string;
    alertType: string;
    status: string;
  }>
): DecaySignal[] {
  const activeKeys = new Set(
    existingOpenAlerts
      .filter((a) => ["open", "acknowledged", "refreshing"].includes(a.status))
      .map((a) => `${a.blogId}:${a.alertType}`)
  );

  return signals.filter(
    (s) => !activeKeys.has(`${s.blogId}:${s.alertType}`)
  );
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
