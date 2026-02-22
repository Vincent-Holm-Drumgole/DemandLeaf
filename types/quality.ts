export interface GateResult {
  gate: string;
  passed: boolean;
  reason?: string;
  autoFixable: boolean;
  suggestion?: string;
}

export interface QualityGatesResult {
  passed: boolean;
  gates: GateResult[];
  overallScore: number;
}
