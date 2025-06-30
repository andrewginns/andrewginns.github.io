// Types for Merbench data structures
export interface Stats {
  total_runs: number;
  models_evaluated: number;
  test_cases: number;
  providers: string[];
}

export interface LeaderboardEntry {
  Model: string;
  Success_Rate: number;
  Avg_Duration: number;
  Avg_Tokens: number;
  Runs: number;
  Provider: string;
}

export interface ParetoData {
  Model: string;
  Success_Rate: number;
  Duration: number;
  total_tokens: number;
  cost?: number;
}

export interface TestGroupData {
  Model: string;
  test_group: string;
  Score_MermaidDiagramValid: number;
}

export interface RawData {
  Model: string;
  provider: string;
  test_group: string;
  Duration: number;
  total_tokens: number;
  Metric_request_tokens: number;
  Metric_response_tokens: number;
  Score_MermaidDiagramValid: number;
  Score_UsedBothMCPTools: number;
  Score_UsageLimitNotExceeded: number;
}

export interface FailureAnalysisData {
  Model: string;
  'Invalid Diagram': number;
  'MCP Tool Failure': number;
  'Usage Limit Exceeded': number;
  [key: string]: string | number;
}

export interface Config {
  title: string;
  description: string;
}

export interface MerbenchData {
  stats: Stats;
  leaderboard: LeaderboardEntry[];
  pareto_data: ParetoData[];
  test_groups_data: TestGroupData[];
  failure_analysis_data: FailureAnalysisData[];
  raw_data: RawData[];
  config: Config;
}

export interface FilteredData {
  leaderboard: LeaderboardEntry[];
  testGroupsData: TestGroupData[];
  paretoData: ParetoData[];
  rawData: RawData[];
  failureAnalysisData: FailureAnalysisData[];
}

export interface ModelStats {
  Model: string;
  Provider: string;
  successCount: number;
  totalRuns: number;
  totalDuration: number;
  totalTokens: number;
}
