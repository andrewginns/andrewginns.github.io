import type {
  FilteredData,
  TestGroupData,
  RawData,
  FailureAnalysisData,
  ParetoData,
  ModelStats,
} from './merbench-types';

// Calculate cost per run (simplified pricing model)
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

// Filter data based on selected difficulties
export const getFilteredData = (
  selectedDifficulties: string[],
  originalRawData: RawData[],
  originalTestGroupsData: TestGroupData[]
): FilteredData => {
  // Filter raw data
  const filteredRawData = originalRawData.filter((d) =>
    selectedDifficulties.includes(d.test_group)
  );

  // Filter test groups data
  const filteredTestGroupsData = originalTestGroupsData.filter((d) =>
    selectedDifficulties.includes(d.test_group)
  );

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
      };
    }

    modelStats[d.Model].totalRuns++;
    modelStats[d.Model].totalDuration += d.Duration;
    modelStats[d.Model].totalTokens += d.total_tokens;

    if (d.Score_MermaidDiagramValid === 1) {
      modelStats[d.Model].successCount++;
    }
  });

  const filteredLeaderboard = Object.values(modelStats)
    .map((stats) => ({
      Model: stats.Model,
      Success_Rate: (stats.successCount / stats.totalRuns) * 100,
      Avg_Duration: stats.totalDuration / stats.totalRuns,
      Avg_Tokens: stats.totalTokens / stats.totalRuns,
      Runs: stats.totalRuns,
      Provider: stats.Provider,
    }))
    .sort((a, b) => b.Success_Rate - a.Success_Rate);

  // Recalculate pareto data
  const filteredParetoData = filteredLeaderboard.map((d) => ({
    Model: d.Model,
    Success_Rate: d.Success_Rate,
    Duration: d.Avg_Duration,
    total_tokens: d.Avg_Tokens,
    cost: calculateCost(d.Avg_Tokens),
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
      cost: d.cost || calculateCost(d.total_tokens),
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

// DOM manipulation utilities
export const updateSummaryStats = (filteredData: FilteredData): void => {
  const totalRuns = filteredData.rawData.length;
  const models = [...new Set(filteredData.rawData.map((d) => d.Model))];

  const statCards = document.querySelectorAll('.stat-card');
  if (statCards[0]) {
    const valueElement = statCards[0].querySelector('.stat-value');
    if (valueElement) valueElement.textContent = totalRuns.toString();
  }
  if (statCards[1]) {
    const valueElement = statCards[1].querySelector('.stat-value');
    if (valueElement) valueElement.textContent = models.length.toString();
  }
};

// Update leaderboard table
export const updateLeaderboard = (filteredData: FilteredData): void => {
  const tbody = document.querySelector('.leaderboard-table tbody');
  if (!tbody) return;

  tbody.innerHTML = filteredData.leaderboard
    .map(
      (entry, index) => `
    <tr>
      <td class="rank">${index + 1}</td>
      <td class="model-name">${entry.Model}</td>
      <td class="success-rate">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${entry.Success_Rate}%; background-color: ${
            entry.Success_Rate >= 30 ? '#27ae60' : entry.Success_Rate >= 15 ? '#f39c12' : '#e74c3c'
          }"></div>
          <span class="progress-text">${entry.Success_Rate.toFixed(1)}%</span>
        </div>
      </td>
      <td class="cost">$${calculateCost(entry.Avg_Tokens).toFixed(4)}</td>
      <td class="duration">${entry.Avg_Duration.toFixed(2)}s</td>
      <td class="tokens">${entry.Avg_Tokens.toLocaleString()}</td>
      <td class="runs">${entry.Runs}</td>
      <td class="provider">${entry.Provider}</td>
    </tr>
  `
    )
    .join('');
};

// Utility to show empty state message
export const showEmptyState = (): void => {
  const tbody = document.querySelector('.leaderboard-table tbody');
  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Please select at least one difficulty level</td></tr>';
  }
};
