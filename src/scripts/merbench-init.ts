import { MerbenchCharts } from './merbench-charts';
import { MerbenchFilters } from './merbench-filters';
import type { MerbenchData, RawData } from '../lib/merbench-types';

declare global {
  interface Window {
    initializeMerbench: (data: MerbenchData) => void;
  }
}

// Initialize Merbench functionality
window.initializeMerbench = function (data: MerbenchData) {
  const charts = new MerbenchCharts();

  // Set up initial data
  const originalData = {
    rawData: data.raw_data || [],
    testGroupsData: data.test_groups_data || [],
    leaderboard: data.leaderboard || [],
  };

  // Initialize filters (will be used by the charts for updates)
  const filters = new MerbenchFilters(data, charts);
  filters.initialize();

  // Initialize charts with all data
  const initializeAllCharts = async () => {
    try {
      await charts.waitForPlotly();

      // Prepare chart data
      const chartData = {
        paretoData: originalData.leaderboard.map((entry) => ({
          Model: entry.Model,
          Success_Rate: entry.Success_Rate,
          Duration: entry.Avg_Duration,
          total_tokens: entry.Avg_Tokens,
          cost: (entry.Avg_Tokens / 1000) * 0.001, // Calculate cost
        })),
        testGroupsData: originalData.testGroupsData,
        rawData: originalData.rawData,
        failureAnalysisData: calculateFailureAnalysis(originalData.rawData),
      };

      await charts.initializeAllCharts(chartData);
    } catch (error) {
      console.error('Failed to initialize charts:', error);
    }
  };

  // Set up event listeners
  const setupEventListeners = () => {
    // Setup responsive behavior
    let resizeTimeout: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        charts.resizeCharts();
      }, 250);
    });
  };

  // Initialize everything
  const init = async () => {
    try {
      await initializeAllCharts();
      setupEventListeners();

      // Make sure all filters are checked by default (handled by the HTML default)
    } catch (error) {
      console.error('Failed to initialize Merbench:', error);
    }
  };

  // Start initialization
  init();
};

// Helper function to calculate failure analysis
function calculateFailureAnalysis(rawData: RawData[]) {
  const failureAnalysis: Record<string, any> = {};

  rawData.forEach((d) => {
    if (!failureAnalysis[d.Model]) {
      failureAnalysis[d.Model] = {
        Model: d.Model,
        'Invalid Diagram': 0,
        'MCP Tool Failure': 0,
        'Usage Limit Exceeded': 0,
      };
    }

    // Count failures based on the score fields
    if (d.Score_MermaidDiagramValid < 1.0) {
      if (d.Score_UsageLimitNotExceeded < 1.0) {
        failureAnalysis[d.Model]['Usage Limit Exceeded']++;
      } else if (d.Score_UsedBothMCPTools < 1.0) {
        failureAnalysis[d.Model]['MCP Tool Failure']++;
      } else {
        failureAnalysis[d.Model]['Invalid Diagram']++;
      }
    }
  });

  return Object.values(failureAnalysis);
}
