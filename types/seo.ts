export interface SEOCheckResult {
  name: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  suggestion?: string;
}

export interface SEOScore {
  score: number; // 0-100
  checks: SEOCheckResult[];
  passedChecks: number;
  totalChecks: number;
}
