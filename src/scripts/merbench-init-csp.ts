import { MerbenchCharts } from './merbench-charts';
import { MerbenchFilters } from './merbench-filters';
import type { MerbenchData, RawData } from '../lib/merbench-types';

declare global {
  interface Window {
    merbenchCharts?: MerbenchCharts;
    currentFilteredData?: any;
  }
}

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

// Function to get data from JSON script tag
function getMerbenchData(): MerbenchData | null {
  const dataElement = document.getElementById('merbench-data');
  if (!dataElement || !dataElement.textContent) {
    console.error('Merbench data not found');
    return null;
  }

  try {
    return JSON.parse(dataElement.textContent);
  } catch (error) {
    console.error('Failed to parse Merbench data:', error);
    return null;
  }
}

// Initialize Merbench functionality
async function initializeMerbench() {
  // Get data from JSON script tag
  const data = getMerbenchData();
  if (!data) {
    console.error('Failed to load Merbench data');
    return;
  }

  const charts = new MerbenchCharts();

  // Make charts instance globally available
  window.merbenchCharts = charts;

  // Setup theme listener for chart updates
  charts.setupThemeListener();

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
  try {
    await charts.waitForPlotly();

    // Prepare chart data
    const chartData = {
      paretoData: originalData.leaderboard.map((entry) => ({
        Model: entry.Model,
        Success_Rate: entry.Success_Rate,
        Duration: entry.Avg_Duration,
        total_tokens: entry.Avg_Tokens,
        total_cost: entry.Avg_Cost || 0,
        input_cost: entry.Avg_Input_Cost || 0,
        output_cost: entry.Avg_Output_Cost || 0,
        cost: entry.Avg_Cost || 0, // Use actual cost from data
      })),
      testGroupsData: originalData.testGroupsData,
      rawData: originalData.rawData,
      failureAnalysisData: calculateFailureAnalysis(originalData.rawData),
    };

    // Store initial chart data globally for metric selector access
    window.currentFilteredData = chartData;

    await charts.initializeAllCharts(chartData);

    // Setup responsive behavior
    let resizeTimeout: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        charts.resizeCharts();
      }, 250);
    });
  } catch (error) {
    console.error('Failed to initialize charts:', error);
  }
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMerbench);
} else {
  // DOM is already ready, initialize immediately
  initializeMerbench();
}
