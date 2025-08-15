import type {
  FilteredData,
  TestGroupData,
  RawData,
  FailureAnalysisData,
  ParetoData,
  ModelStats,
  LeaderboardEntry,
} from './merbench-types';

// Calculate cost per run (simplified pricing model) - DEPRECATED
// Use actual costs from the data instead
export const calculateCost = (tokens: number): number => {
  // Simplified pricing: $0.001 per 1000 tokens
  return (tokens / 1000) * 0.001;
};

// Convert markdown-style formatting to HTML
export const renderMarkdownToHTML = (text: string): string => {
  // Split into paragraphs
  const paragraphs = text.split('\n\n').filter((p) => p.trim());

  return paragraphs
    .map((paragraph) => {
      // Convert bold (**text** or __text__)
      let html = paragraph.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

      // Convert italics (*text* or _text_)
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(/_(.+?)_/g, '<em>$1</em>');

      return `<p>${html}</p>`;
    })
    .join('\n      ');
};

// Filter data based on selected difficulties and providers
export const getFilteredData = (
  selectedDifficulties: string[],
  originalRawData: RawData[],
  originalTestGroupsData: TestGroupData[],
  selectedProviders?: string[]
): FilteredData => {
  // Filter raw data with AND logic
  const filteredRawData = originalRawData.filter((d) => {
    const difficultyMatch =
      selectedDifficulties.length === 0 || selectedDifficulties.includes(d.test_group);
    const providerMatch =
      !selectedProviders ||
      selectedProviders.length === 0 ||
      selectedProviders.includes(d.provider);
    return difficultyMatch && providerMatch;
  });

  // Get the list of models that remain after filtering raw data
  const filteredModels = new Set(filteredRawData.map((d) => d.Model));

  // Filter test groups data by difficulty AND by models that remain after provider filtering
  const filteredTestGroupsData = originalTestGroupsData.filter((d) => {
    const difficultyMatch =
      selectedDifficulties.length === 0 || selectedDifficulties.includes(d.test_group);
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
    modelStats[d.Model].totalCost += d.total_cost;
    modelStats[d.Model].totalInputCost += d.input_cost;
    modelStats[d.Model].totalOutputCost += d.output_cost;

    if (d.Score_MermaidDiagramValid === 1) {
      modelStats[d.Model].successCount++;
    }
  });

  const filteredLeaderboard = Object.values(modelStats)
    .map((stats) => {
      const successRate = stats.totalRuns > 0 ? (stats.successCount / stats.totalRuns) * 100 : 0;
      const avgCost = stats.totalRuns > 0 ? stats.totalCost / stats.totalRuns : 0;
      const pricePerSuccess = successRate > 0 ? avgCost / (successRate / 100) : undefined;

      return {
        Model: stats.Model,
        Success_Rate: successRate,
        Avg_Duration: stats.totalRuns > 0 ? stats.totalDuration / stats.totalRuns : 0,
        Avg_Tokens: stats.totalRuns > 0 ? stats.totalTokens / stats.totalRuns : 0,
        Avg_Cost: avgCost,
        Avg_Input_Cost: stats.totalRuns > 0 ? stats.totalInputCost / stats.totalRuns : 0,
        Avg_Output_Cost: stats.totalRuns > 0 ? stats.totalOutputCost / stats.totalRuns : 0,
        Price_per_Success: pricePerSuccess,
        Runs: stats.totalRuns,
        Provider: stats.Provider,
      };
    })
    .sort((a, b) => b.Success_Rate - a.Success_Rate);

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

  const filteredFailureAnalysisArray = Object.values(filteredFailureAnalysisData);

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
      cost: d.cost || d.total_cost || calculateCost(d.total_tokens),
    }));

    return {
      dataWithCost,
      paretoPoints: calculateParetoFrontier(dataWithCost),
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
          color: group === 'easy' ? '#27ae60' : group === 'medium' ? '#f39c12' : '#e74c3c',
        },
      };
    });

    return { traces, models, testGroups };
  },

  tokens: (data: RawData[]) => {
    // Average token usage by model
    const modelTokens: Record<string, { request: number[]; response: number[] }> = {};
    data.forEach((d) => {
      if (!modelTokens[d.Model]) {
        modelTokens[d.Model] = { request: [], response: [] };
      }
      modelTokens[d.Model].request.push(d.Metric_request_tokens);
      modelTokens[d.Model].response.push(d.Metric_response_tokens);
    });

    const models = Object.keys(modelTokens);
    const avgRequestTokens = models.map((model) => {
      const tokens = modelTokens[model].request.filter((t) => t > 0);
      return tokens.length > 0 ? tokens.reduce((a, b) => a + b) / tokens.length : 0;
    });
    const avgResponseTokens = models.map((model) => {
      const tokens = modelTokens[model].response.filter((t) => t > 0);
      return tokens.length > 0 ? tokens.reduce((a, b) => a + b) / tokens.length : 0;
    });

    // Sort by total tokens
    const totalTokens = models.map((_, i) => avgRequestTokens[i] + avgResponseTokens[i]);
    const sortedIndices = [...Array(models.length).keys()].sort(
      (a, b) => totalTokens[b] - totalTokens[a]
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
    const failureTypes = ['Invalid Diagram', 'MCP Tool Failure', 'Usage Limit Exceeded'];
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

// Calculate Pareto frontier points
const calculateParetoFrontier = (data: Array<{ cost: number; Success_Rate: number }>) => {
  const sortedByEfficiency = [...data].sort((a, b) => a.cost - b.cost);
  const paretoPoints = [];
  let maxSuccessRate = -Infinity;

  for (const point of sortedByEfficiency) {
    if (point.Success_Rate > maxSuccessRate) {
      paretoPoints.push(point);
      maxSuccessRate = point.Success_Rate;
    }
  }

  return paretoPoints;
};

// Sorting utilities
let currentSortKey = 'Success_Rate';
let currentSortDirection: 'asc' | 'desc' = 'desc';

export const sortLeaderboard = (
  data: LeaderboardEntry[],
  sortKey: string,
  direction: 'asc' | 'desc'
): LeaderboardEntry[] => {
  const sorted = [...data].sort((a, b) => {
    let aVal: LeaderboardEntry[keyof LeaderboardEntry];
    let bVal: LeaderboardEntry[keyof LeaderboardEntry];

    // Handle special cases for cost calculation
    if (sortKey === 'Avg_Cost') {
      aVal = a.Avg_Cost || calculateCost(a.Avg_Tokens);
      bVal = b.Avg_Cost || calculateCost(b.Avg_Tokens);
    } else {
      aVal = a[sortKey as keyof LeaderboardEntry];
      bVal = b[sortKey as keyof LeaderboardEntry];
    }

    // Handle null/undefined values
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return direction === 'asc' ? -1 : 1;
    if (bVal == null) return direction === 'asc' ? 1 : -1;

    // Numeric comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
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

export const setSortState = (sortKey: string, direction: 'asc' | 'desc'): void => {
  currentSortKey = sortKey;
  currentSortDirection = direction;
};

export const getSortState = () => ({
  key: currentSortKey,
  direction: currentSortDirection,
});

// DOM manipulation utilities
export const updateSummaryStats = (filteredData: FilteredData): void => {
  const totalRuns = filteredData.rawData.length;
  const models = [...new Set(filteredData.rawData.map((d) => d.Model))];

  // Calculate unique test cases (difficulty levels) in filtered data
  const testCases = [...new Set(filteredData.rawData.map((d) => d.test_group))];

  const statCards = document.querySelectorAll('.stat-card');

  // Update Total Evaluation Runs (first card)
  if (statCards[0]) {
    const valueElement = statCards[0].querySelector('.stat-value');
    if (valueElement) valueElement.textContent = totalRuns.toString();
  }

  // Update Models Evaluated (second card)
  if (statCards[1]) {
    const valueElement = statCards[1].querySelector('.stat-value');
    if (valueElement) valueElement.textContent = models.length.toString();
  }

  // Update Test Cases (third card) with actual unique difficulty levels in filtered data
  if (statCards[2]) {
    const valueElement = statCards[2].querySelector('.stat-value');
    if (valueElement) valueElement.textContent = testCases.length.toString();
  }
};

// Update leaderboard table
export const updateLeaderboard = (filteredData: FilteredData): void => {
  const tbody = document.querySelector('.leaderboard-table tbody');
  if (!tbody) return;

  // Calculate cost range for progress bar normalization
  const costs = filteredData.leaderboard.map(
    (entry) => entry.Avg_Cost || calculateCost(entry.Avg_Tokens)
  );
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const costRange = maxCost - minCost;

  tbody.innerHTML = filteredData.leaderboard
    .map((entry, index) => {
      const currentCost = entry.Avg_Cost || calculateCost(entry.Avg_Tokens);
      const costWidth = costRange > 0 ? (currentCost / maxCost) * 100 : 0;

      const successRateClass =
        entry.Success_Rate >= 30
          ? 'progress-fill--high'
          : entry.Success_Rate >= 15
            ? 'progress-fill--medium'
            : 'progress-fill--low';

      return `
    <tr>
      <td class="rank">${index + 1}</td>
      <td class="model-name">${entry.Model}</td>
      <td class="success-rate">
        <div class="progress-bar">
          <div class="progress-fill ${successRateClass}" style="width: ${entry.Success_Rate}%; background-color: ${entry.Success_Rate >= 30 ? 'var(--progress-high)' : entry.Success_Rate >= 15 ? 'var(--progress-medium)' : 'var(--progress-low)'};"></div>
          <span class="progress-text" style="color: var(--progress-text-color); text-shadow: var(--progress-text-shadow);">${entry.Success_Rate.toFixed(1)}%</span>
        </div>
      </td>
      <td class="cost">
        <div class="progress-bar">
          <div class="progress-fill progress-fill--cost" style="width: ${costWidth}%; background-color: #9ca3af;"></div>
          <span class="progress-text" style="color: var(--progress-text-color); text-shadow: var(--progress-text-shadow);">$${currentCost.toFixed(4)}</span>
        </div>
      </td>
      <td class="duration">${entry.Avg_Duration.toFixed(2)}s</td>
      <td class="tokens">${entry.Avg_Tokens.toLocaleString()}</td>
      <td class="runs">${entry.Runs}</td>
      <td class="provider">${entry.Provider}</td>
    </tr>
  `;
    })
    .join('');
};

// Utility to show empty state message
export const showEmptyState = (): void => {
  const tbody = document.querySelector('.leaderboard-table tbody');
  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Please select at least one filter to view results</td></tr>';
  }
};
