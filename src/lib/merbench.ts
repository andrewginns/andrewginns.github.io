import type {
  FilteredData,
  TestGroupData,
  RawData,
  FailureAnalysisData,
  ParetoData,
  ModelStats,
  LeaderboardEntry,
} from './merbench-types';

// Filter data based on selected difficulties and providers
export const getFilteredData = (
  selectedDifficulties: string[],
  originalRawData: RawData[],
  originalTestGroupsData: TestGroupData[],
  selectedProviders?: string[],
): FilteredData => {
  // Filter raw data with AND logic
  const filteredRawData = originalRawData.filter((d) => {
    const difficultyMatch = selectedDifficulties.includes(d.test_group);
    const providerMatch =
      !selectedProviders || selectedProviders.includes(d.provider);
    return difficultyMatch && providerMatch;
  });

  // Get the list of models that remain after filtering raw data
  const filteredModels = new Set(filteredRawData.map((d) => d.Model));

  // Filter test groups data by difficulty AND by models that remain after provider filtering
  const filteredTestGroupsData = originalTestGroupsData.filter((d) => {
    const difficultyMatch = selectedDifficulties.includes(d.test_group);
    const modelMatch = filteredModels.has(d.Model);
    return difficultyMatch && modelMatch;
  });

  // Recalculate leaderboard data from filtered raw data
  const modelStats: Record<string, ModelStats> = {};
  filteredRawData.forEach((d) => {
    if (!modelStats[d.Model]) {
      modelStats[d.Model] = {
        Model: d.Model,
        Provider: d.provider,
        successCount: 0,
        totalRuns: 0,
        totalDuration: 0,
        totalTokens: 0,
        totalCost: 0,
        totalInputCost: 0,
        totalOutputCost: 0,
      };
    }

    modelStats[d.Model].totalRuns++;
    modelStats[d.Model].totalDuration += d.Duration;
    modelStats[d.Model].totalTokens += d.total_tokens;
    modelStats[d.Model].totalCost = addRecordedCost(
      modelStats[d.Model].totalCost,
      d.total_cost,
    );
    modelStats[d.Model].totalInputCost = addRecordedCost(
      modelStats[d.Model].totalInputCost,
      d.input_cost,
    );
    modelStats[d.Model].totalOutputCost = addRecordedCost(
      modelStats[d.Model].totalOutputCost,
      d.output_cost,
    );

    if (d.Score_MermaidDiagramValid === 1) {
      modelStats[d.Model].successCount++;
    }
  });

  const filteredLeaderboard = Object.values(modelStats)
    .map((stats) => {
      const successRate =
        stats.totalRuns > 0 ? (stats.successCount / stats.totalRuns) * 100 : 0;
      const avgCost =
        stats.totalCost == null ? undefined : stats.totalCost / stats.totalRuns;
      const pricePerSuccess =
        successRate > 0 && avgCost != null
          ? avgCost / (successRate / 100)
          : undefined;

      return {
        Model: stats.Model,
        Success_Rate: successRate,
        Avg_Duration:
          stats.totalRuns > 0 ? stats.totalDuration / stats.totalRuns : 0,
        Avg_Tokens:
          stats.totalRuns > 0 ? stats.totalTokens / stats.totalRuns : 0,
        Avg_Cost: avgCost,
        Avg_Input_Cost:
          stats.totalInputCost == null
            ? undefined
            : stats.totalInputCost / stats.totalRuns,
        Avg_Output_Cost:
          stats.totalOutputCost == null
            ? undefined
            : stats.totalOutputCost / stats.totalRuns,
        Price_per_Success: pricePerSuccess,
        Runs: stats.totalRuns,
        Provider: stats.Provider,
      };
    })
    .sort((a, b) => {
      const successDiff = b.Success_Rate - a.Success_Rate;
      if (successDiff !== 0) return successDiff;

      // Tie-break: lower Avg Cost/Run first
      const aCost = a.Avg_Cost ?? Infinity;
      const bCost = b.Avg_Cost ?? Infinity;
      return aCost - bCost;
    });

  // Recalculate pareto data
  const filteredParetoData = filteredLeaderboard.map((d) => ({
    Model: d.Model,
    Success_Rate: d.Success_Rate,
    Duration: d.Avg_Duration,
    total_tokens: d.Avg_Tokens,
    total_cost: d.Avg_Cost,
    input_cost: d.Avg_Input_Cost,
    output_cost: d.Avg_Output_Cost,
    cost: d.Avg_Cost,
  }));

  // Recalculate failure analysis data from filtered raw data
  const filteredFailureAnalysisData: Record<string, FailureAnalysisData> = {};
  filteredRawData.forEach((d) => {
    if (!filteredFailureAnalysisData[d.Model]) {
      filteredFailureAnalysisData[d.Model] = {
        Model: d.Model,
        'Invalid Diagram': 0,
        'MCP Tool Failure': 0,
        'Usage Limit Exceeded': 0,
      };
    }

    // Count failures based on the score fields
    // Only count as failure if the overall result was unsuccessful
    if (d.Score_MermaidDiagramValid < 1.0) {
      // Prioritize failure reasons: Usage Limit > MCP Tool > Invalid Diagram
      if (d.Score_UsageLimitNotExceeded < 1.0) {
        filteredFailureAnalysisData[d.Model]['Usage Limit Exceeded']++;
      } else if (d.Score_UsedBothMCPTools < 1.0) {
        filteredFailureAnalysisData[d.Model]['MCP Tool Failure']++;
      } else {
        filteredFailureAnalysisData[d.Model]['Invalid Diagram']++;
      }
    }
  });

  const filteredFailureAnalysisArray = Object.values(
    filteredFailureAnalysisData,
  );

  return {
    leaderboard: filteredLeaderboard,
    testGroupsData: filteredTestGroupsData,
    paretoData: filteredParetoData,
    rawData: filteredRawData,
    failureAnalysisData: filteredFailureAnalysisArray,
  };
};

// Chart data processors
export const processChartData = {
  pareto: (data: ParetoData[]) => {
    const dataWithCost = data.map((d) => ({
      ...d,
      cost: d.cost ?? d.total_cost ?? Number.NaN,
    }));

    return {
      dataWithCost,
    };
  },

  testGroup: (data: TestGroupData[]) => {
    // Process data for grouped bar chart
    const models = [...new Set(data.map((d) => d.Model))];
    const testGroups = [...new Set(data.map((d) => d.test_group))];

    const traces = testGroups.map((group) => {
      const groupData = data.filter((d) => d.test_group === group);
      const successRates = models.map((model) => {
        const modelData = groupData.find((d) => d.Model === model);
        return modelData ? modelData.Score_MermaidDiagramValid * 100 : 0;
      });

      return {
        name: group.charAt(0).toUpperCase() + group.slice(1),
        x: models,
        y: successRates,
        type: 'bar',
        marker: {
          color:
            group === 'easy'
              ? '#27ae60'
              : group === 'medium'
                ? '#f39c12'
                : '#e74c3c',
        },
      };
    });

    return { traces, models, testGroups };
  },

  tokens: (data: RawData[]) => {
    // Average token usage by model
    const modelTokens: Record<
      string,
      { request: number[]; response: number[] }
    > = {};
    data.forEach((d) => {
      if (!modelTokens[d.Model]) {
        modelTokens[d.Model] = { request: [], response: [] };
      }
      modelTokens[d.Model].request.push(d.Metric_request_tokens);
      modelTokens[d.Model].response.push(d.Metric_response_tokens);
    });

    const models = Object.keys(modelTokens);
    const avgRequestTokens = models.map((model) => {
      const tokens = modelTokens[model].request.filter(
        (t) => Number.isFinite(t) && t >= 0,
      );
      return tokens.length > 0
        ? tokens.reduce((a, b) => a + b) / tokens.length
        : 0;
    });
    const avgResponseTokens = models.map((model) => {
      const tokens = modelTokens[model].response.filter(
        (t) => Number.isFinite(t) && t >= 0,
      );
      return tokens.length > 0
        ? tokens.reduce((a, b) => a + b) / tokens.length
        : 0;
    });

    // Sort by total tokens
    const totalTokens = models.map(
      (_, i) => avgRequestTokens[i] + avgResponseTokens[i],
    );
    const sortedIndices = [...Array(models.length).keys()].sort(
      (a, b) => totalTokens[b] - totalTokens[a],
    );

    return {
      models,
      avgRequestTokens,
      avgResponseTokens,
      sortedIndices,
    };
  },

  failureAnalysis: (data: FailureAnalysisData[]) => {
    if (!data || data.length === 0) {
      return null;
    }

    // Extract models and failure types
    const models = data.map((d) => d.Model);
    const failureTypes = [
      'Invalid Diagram',
      'MCP Tool Failure',
      'Usage Limit Exceeded',
    ];
    const colors = ['#e74c3c', '#f39c12', '#9b59b6'];

    // Create traces for each failure type
    const traces = failureTypes.map((failureType, index) => ({
      x: models,
      y: data.map((d) => d[failureType] || 0),
      name: failureType,
      type: 'bar',
      marker: { color: colors[index] },
    }));

    return { traces, models, failureTypes };
  },
};

export const sortLeaderboard = (
  data: LeaderboardEntry[],
  sortKey: string,
  direction: 'asc' | 'desc',
): LeaderboardEntry[] => {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortKey as keyof LeaderboardEntry];
    const bVal = b[sortKey as keyof LeaderboardEntry];

    // Handle null/undefined values
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // Numeric comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      // Special-case: Success Rate ties are broken by lower Avg Cost/Run (ascending)
      if (sortKey === 'Success_Rate' && aVal === bVal) {
        const aCost = a.Avg_Cost ?? Infinity;
        const bCost = b.Avg_Cost ?? Infinity;
        if (aCost !== bCost) return aCost - bCost;
        return 0;
      }

      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // String comparison
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();

    if (aStr < bStr) return direction === 'asc' ? -1 : 1;
    if (aStr > bStr) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
};

// Missing recorded costs remain unavailable; zero is a valid recorded value.
const addRecordedCost = (
  total: number | undefined,
  value: number | undefined,
) =>
  total == null || value == null || !Number.isFinite(value)
    ? undefined
    : total + value;

export const formatCost = (value: number | undefined): string =>
  value == null || !Number.isFinite(value) ? 'N/A' : `$${value.toFixed(4)}`;
