import type { DetectionRisk } from "./blog";

export interface DetectionFlag {
  algorithm: string;
  severity: number;
  location?: string;
  detail: string;
}

export interface BurstinessStats {
  mean: number;
  standardDeviation: number;
  percentShort: number; // % of sentences under 8 words
  percentLong: number; // % of sentences over 25 words
}

export interface DetectionResult {
  riskScore: number;
  riskLevel: DetectionRisk;
  flags: DetectionFlag[];
  burstinessStats: BurstinessStats;
}
