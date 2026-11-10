import { processChartData } from '../lib/merbench';
import type {
  FilteredData,
  ParetoData,
  TestGroupData,
  RawData,
  FailureAnalysisData,
} from '../lib/merbench-types';

declare global {
  interface Window {
    // The pinned browser bundle has no declarations; only its four used APIs cross this boundary.
    Plotly: {
      newPlot: (
        id: string,
        traces: object[],
        layout: object,
        config: object,
      ) => Promise<unknown>;
      relayout: (id: string, changes: object) => Promise<unknown>;
      purge: (id: string) => void;
      Plots: { resize: (id: string) => Promise<unknown> };
    };
  }
}

export class MerbenchCharts {
  private plotlyLoaded = false;
  private charts = new Set<string>();

  private isDarkMode(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  private getThemeColors() {
    const isDark = this.isDarkMode();
    return {
      background: getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-secondary')
        .trim(),
      paper: getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-secondary')
        .trim(),
      text: getComputedStyle(document.documentElement)
        .getPropertyValue('--text-primary')
        .trim(),
      textSecondary: getComputedStyle(document.documentElement)
        .getPropertyValue('--text-secondary')
        .trim(),
      grid: isDark ? 'rgba(240, 246, 252, 0.05)' : '#dfe6e9',
      gridLines: isDark ? 'rgba(240, 246, 252, 0.1)' : '#ecf0f1',
      accent: isDark ? '#f85149' : '#e74c3c',
      blue: isDark ? '#58a6ff' : '#3498db',
      green: isDark ? '#3fb950' : '#27ae60',
      yellow: isDark ? '#f2cc60' : '#f39c12',
      purple: isDark ? '#a5a2ff' : '#9c27b0',
      orange: isDark ? '#ffab70' : '#ff5722',
      pink: isDark ? '#ff7b72' : '#e91e63',
      cyan: isDark ? '#76e3ea' : '#17a2b8',
    };
  }

  async waitForPlotly(): Promise<void> {
    if (typeof window.Plotly !== 'undefined') {
      this.plotlyLoaded = true;
      return;
    }

    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000;
      const checkPlotly = () => {
        if (typeof window.Plotly !== 'undefined') {
          this.plotlyLoaded = true;
          resolve();
        } else if (Date.now() > deadline) {
          reject(new Error('Chart library did not load'));
        } else {
          setTimeout(checkPlotly, 100);
        }
      };
      checkPlotly();
    });
  }

  private hideLoading(containerId: string): void {
    const loadingElement = document.getElementById(
      `chart-loading-${containerId}`,
    );
    if (loadingElement) {
      loadingElement.classList.add('hidden');
    }
  }

  private showChartError(containerId: string, message: string): void {
    const container = document.getElementById(containerId);
    if (container) {
      this.hideLoading(containerId);
      const paragraph = document.createElement('p');
      paragraph.textContent = `${message}. The results are available in the table above.`;
      container.replaceChildren(paragraph);
    }
  }

  async initParetoChart(
    data: ParetoData[],
    containerId: string,
    metric: 'cost' | 'time' | 'tokens' = 'cost',
  ): Promise<void> {
    try {
      if (!this.plotlyLoaded) await this.waitForPlotly();

      const processed = processChartData.pareto(data);
      // Unknown costs are omitted only from the cost view, never estimated.
      const dataWithCost = processed.dataWithCost.filter(
        (point) => metric !== 'cost' || Number.isFinite(point.cost),
      );

      if (!dataWithCost.length) {
        this.showChartError(
          containerId,
          'No recorded costs for this selection',
        );
        return;
      }

      // Get X-axis data based on selected metric
      let xData: number[];
      let xAxisTitle: string;
      let xAxisType: 'linear' | 'log' = 'log';
      let chartTitle: string;

      switch (metric) {
        case 'time':
          xData = dataWithCost.map((d) => d.Duration);
          xAxisTitle = 'Average Duration (seconds)';
          xAxisType = 'linear';
          chartTitle = 'Model Performance vs Time Trade-off';
          break;
        case 'tokens':
          xData = dataWithCost.map((d) => d.total_tokens);
          xAxisTitle = 'Average Tokens per Run';
          xAxisType = dataWithCost.some((point) => point.total_tokens === 0)
            ? 'linear'
            : 'log';
          chartTitle = 'Model Performance vs Token Usage Trade-off';
          break;
        case 'cost':
        default:
          xData = dataWithCost.map((d) => d.cost);
          xAxisTitle = 'Average Cost per Run ($)';
          xAxisType = dataWithCost.some((point) => point.cost === 0)
            ? 'linear'
            : 'log';
          chartTitle = 'Model Performance vs Cost Trade-off';
          break;
      }

      // Calculate pareto frontier for selected metric
      const paretoData = dataWithCost
        .map((d, index) => ({ ...d, originalIndex: index }))
        .sort((a, b) => {
          const aValue =
            metric === 'time'
              ? a.Duration
              : metric === 'tokens'
                ? a.total_tokens
                : a.cost;
          const bValue =
            metric === 'time'
              ? b.Duration
              : metric === 'tokens'
                ? b.total_tokens
                : b.cost;
          return aValue - bValue || b.Success_Rate - a.Success_Rate;
        });

      const paretoFrontier: typeof paretoData = [];
      let maxSuccessRate = -1;

      for (const point of paretoData) {
        if (point.Success_Rate > maxSuccessRate) {
          paretoFrontier.push(point);
          maxSuccessRate = point.Success_Rate;
        }
      }

      // Create hover template based on selected metric
      let hoverTemplate: string;
      switch (metric) {
        case 'time':
          hoverTemplate =
            '<b>%{text}</b><br>' +
            'Success Rate: %{y:.1f}%<br>' +
            'Avg Duration: %{x:.2f}s<br>' +
            'Cost per Run: $%{customdata[0]:.4f}<br>' +
            'Avg Tokens: %{customdata[1]:,.0f}<br>' +
            '<extra></extra>';
          break;
        case 'tokens':
          hoverTemplate =
            '<b>%{text}</b><br>' +
            'Success Rate: %{y:.1f}%<br>' +
            'Avg Tokens: %{x:,.0f}<br>' +
            'Cost per Run: $%{customdata[0]:.4f}<br>' +
            'Avg Duration: %{customdata[1]:.2f}s<br>' +
            '<extra></extra>';
          break;
        case 'cost':
        default:
          hoverTemplate =
            '<b>%{text}</b><br>' +
            'Success Rate: %{y:.1f}%<br>' +
            'Cost per Run: $%{x:.4f}<br>' +
            'Avg Tokens: %{customdata[0]:,.0f}<br>' +
            'Avg Duration: %{customdata[1]:.2f}s<br>' +
            '<extra></extra>';
          break;
      }

      const trace = {
        x: xData,
        y: dataWithCost.map((d) => d.Success_Rate),
        mode: 'markers',
        type: 'scatter',
        text: dataWithCost.map((d) => d.Model),
        showlegend: false,
        hoverlabel: {
          bgcolor: this.getThemeColors().background,
          bordercolor: this.getThemeColors().textSecondary,
          font: {
            family: 'system-ui, -apple-system, sans-serif',
            size: 14,
            color: this.getThemeColors().text,
          },
        },
        marker: {
          size: 12,
          color: dataWithCost.map((d) => d.Duration),
          colorscale: 'Viridis',
          showscale: true,
          colorbar:
            window.innerWidth < 768
              ? {
                  title: {
                    text: 'Duration (s)',
                    side: 'bottom',
                    font: {
                      size: 10,
                    },
                  },
                  orientation: 'h',
                  thickness: 15,
                  len: 0.5,
                  x: 0.5,
                  xanchor: 'center',
                  y: -0.25,
                  yanchor: 'top',
                }
              : {
                  title: {
                    text: 'Avg Duration (s)',
                    side: 'right',
                    font: {
                      size: 12,
                    },
                  },
                  thickness: 15,
                  len: 0.5,
                  x: 1.05,
                },
          line: {
            color: this.getThemeColors().text,
            width: 1,
          },
        },
        hovertemplate: hoverTemplate,
        customdata:
          metric === 'time'
            ? dataWithCost.map((d) => [d.cost, d.total_tokens])
            : metric === 'tokens'
              ? dataWithCost.map((d) => [d.cost, d.Duration])
              : dataWithCost.map((d) => [d.total_tokens, d.Duration]),
      };

      const isMobile = window.innerWidth < 768;

      const layout = {
        font: { color: this.getThemeColors().text },
        title: {
          text: chartTitle,
          font: {
            size: 16,
            color: this.getThemeColors().text,
          },
        },
        xaxis: {
          title: {
            text: xAxisTitle,
            font: { color: this.getThemeColors().textSecondary },
          },
          type: xAxisType,
          gridcolor: this.getThemeColors().gridLines,
          tickfont: { color: this.getThemeColors().textSecondary },
          zeroline: false,
          spikemode: 'across',
          spikethickness: 1,
          spikecolor: this.getThemeColors().text,
          spikedash: 'dot',
        },
        yaxis: {
          title: {
            text: 'Success Rate (%)',
            font: { color: this.getThemeColors().textSecondary },
          },
          gridcolor: this.getThemeColors().gridLines,
          tickfont: { color: this.getThemeColors().textSecondary },
          zeroline: false,
          range: [-5, Math.max(...dataWithCost.map((d) => d.Success_Rate)) + 5],
          spikemode: 'across',
          spikethickness: 1,
          spikecolor: this.getThemeColors().text,
          spikedash: 'dot',
        },
        plot_bgcolor: this.getThemeColors().background,
        paper_bgcolor: this.getThemeColors().paper,
        hovermode: 'closest',
        dragmode: false,
        hoverdistance: -1, // This makes hover work across entire plot
        spikedistance: -1, // Show spikes for any distance
        legend: isMobile
          ? {
              orientation: 'h',
              x: 0,
              y: -0.6,
              xanchor: 'left',
              yanchor: 'top',
            }
          : {
              // Default position for desktop
            },
        margin: {
          l: isMobile ? 40 : 60,
          r: isMobile ? 0 : 120,
          t: 40,
          b: isMobile ? 160 : 60,
        },
      };

      const traces: Record<string, unknown>[] = [trace];
      if (paretoFrontier.length > 1) {
        const paretoTrace = {
          x: paretoFrontier.map((p) => {
            switch (metric) {
              case 'time':
                return p.Duration;
              case 'tokens':
                return p.total_tokens;
              case 'cost':
              default:
                return p.cost;
            }
          }),
          y: paretoFrontier.map((p) => p.Success_Rate),
          mode: 'lines',
          type: 'scatter',
          line: {
            color: this.isDarkMode()
              ? 'rgba(242, 139, 130, 0.3)'
              : 'rgba(231, 76, 60, 0.3)',
            width: 2,
            dash: 'dash',
          },
          name: 'Pareto Frontier',
          hoverinfo: 'skip',
        };
        traces.unshift(paretoTrace);
      }

      const config = {
        responsive: true,
        displayModeBar: false,
        scrollZoom: false,
        doubleClick: false,
      };

      await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.add(containerId);
      this.refreshChartTheme(containerId);
      this.hideLoading(containerId);
    } catch (error) {
      console.error('Failed to initialize Pareto chart:', error);
      this.showChartError(containerId, 'Failed to load chart data');
    }
  }

  async initTestGroupChart(
    data: TestGroupData[],
    containerId: string,
  ): Promise<void> {
    try {
      if (!this.plotlyLoaded) await this.waitForPlotly();

      const { traces } = processChartData.testGroup(data);

      const isMobile = window.innerWidth < 768;

      const layout = {
        font: { color: this.getThemeColors().text },
        title: {
          text: 'Success Rate by Test Difficulty',
          font: {
            size: 16,
            color: this.getThemeColors().text,
          },
        },
        xaxis: {
          title: { text: isMobile ? '' : 'Model' },
          tickangle: isMobile ? -65 : -55,
          automargin: true,
          tickfont: {
            size: isMobile ? 8 : 10,
            color: this.getThemeColors().textSecondary,
          },
        },
        yaxis: {
          title: { text: 'Success Rate (%)' },
          range: [0, 105],
        },
        barmode: 'group',
        plot_bgcolor: this.getThemeColors().background,
        paper_bgcolor: this.getThemeColors().paper,
        legend: isMobile
          ? {
              orientation: 'h',
              x: 0,
              y: -0.85,
              xanchor: 'left',
              yanchor: 'top',
            }
          : {
              // Default position for desktop
            },
        margin: {
          l: isMobile ? 40 : 60,
          r: isMobile ? 0 : 60,
          t: 40,
          b: isMobile ? 240 : 160,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        scrollZoom: false,
        doubleClick: false,
      };

      await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.add(containerId);
      this.refreshChartTheme(containerId);
      this.hideLoading(containerId);
    } catch (error) {
      console.error('Failed to initialize Test Group chart:', error);
      this.showChartError(containerId, 'Failed to load chart data');
    }
  }

  async initTokenChart(data: RawData[], containerId: string): Promise<void> {
    try {
      if (!this.plotlyLoaded) await this.waitForPlotly();

      const { models, avgRequestTokens, avgResponseTokens, sortedIndices } =
        processChartData.tokens(data);

      const trace1 = {
        x: sortedIndices.map((i) => models[i]),
        y: sortedIndices.map((i) => avgRequestTokens[i]),
        name: 'Request Tokens',
        type: 'bar',
        marker: { color: '#3498db' },
      };

      const trace2 = {
        x: sortedIndices.map((i) => models[i]),
        y: sortedIndices.map((i) => avgResponseTokens[i]),
        name: 'Response Tokens',
        type: 'bar',
        marker: { color: '#e74c3c' },
      };

      const isMobile = window.innerWidth < 768;

      const layout = {
        font: { color: this.getThemeColors().text },
        title: {
          text: 'Average Token Usage per Model',
          font: {
            size: 16,
            color: this.getThemeColors().text,
          },
        },
        xaxis: {
          title: { text: isMobile ? '' : 'Model' },
          tickangle: isMobile ? -65 : -55,
          automargin: true,
          tickfont: {
            size: isMobile ? 8 : 10,
            color: this.getThemeColors().textSecondary,
          },
        },
        yaxis: {
          title: { text: 'Average Tokens' },
        },
        barmode: 'stack',
        plot_bgcolor: this.getThemeColors().background,
        paper_bgcolor: this.getThemeColors().paper,
        legend: isMobile
          ? {
              orientation: 'h',
              x: 0,
              y: -0.85,
              xanchor: 'left',
              yanchor: 'top',
            }
          : {
              // Default position for desktop
            },
        margin: {
          l: isMobile ? 50 : 80,
          r: isMobile ? 0 : 60,
          t: 40,
          b: isMobile ? 240 : 160,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        scrollZoom: false,
        doubleClick: false,
      };

      await window.Plotly.newPlot(
        containerId,
        [trace1, trace2],
        layout,
        config,
      );
      this.charts.add(containerId);
      this.refreshChartTheme(containerId);
      this.hideLoading(containerId);
    } catch (error) {
      console.error('Failed to initialize Token chart:', error);
      this.showChartError(containerId, 'Failed to load chart data');
    }
  }

  async initFailureAnalysisChart(
    data: FailureAnalysisData[],
    containerId: string,
  ): Promise<void> {
    try {
      if (!this.plotlyLoaded) await this.waitForPlotly();

      const result = processChartData.failureAnalysis(data);
      if (!result) {
        this.hideLoading(containerId);
        return;
      }

      const { traces } = result;

      const isMobile = window.innerWidth < 768;

      const layout = {
        font: { color: this.getThemeColors().text },
        title: {
          text: 'Failure Analysis by Reason',
          font: {
            size: 16,
            color: this.getThemeColors().text,
          },
        },
        xaxis: {
          title: { text: isMobile ? '' : 'Model' },
          tickangle: isMobile ? -65 : -55,
          automargin: true,
          tickfont: {
            size: isMobile ? 8 : 10,
            color: this.getThemeColors().textSecondary,
          },
        },
        yaxis: {
          title: { text: 'Number of Failures' },
        },
        barmode: 'stack',
        plot_bgcolor: this.getThemeColors().background,
        paper_bgcolor: this.getThemeColors().paper,
        legend: isMobile
          ? {
              orientation: 'h',
              x: 0,
              y: -0.85,
              xanchor: 'left',
              yanchor: 'top',
            }
          : {
              // Default position for desktop
            },
        margin: {
          l: isMobile ? 50 : 80,
          r: isMobile ? 0 : 60,
          t: 40,
          b: isMobile ? 240 : 160,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        scrollZoom: false,
        doubleClick: false,
      };

      await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.add(containerId);
      this.refreshChartTheme(containerId);
      this.hideLoading(containerId);
    } catch (error) {
      console.error('Failed to initialize Failure Analysis chart:', error);
      this.showChartError(containerId, 'Failed to load chart data');
    }
  }

  async updateAllCharts(
    data: FilteredData,
    metric: 'cost' | 'time' | 'tokens' = 'cost',
  ): Promise<void> {
    if (!this.plotlyLoaded) return;
    if (!data.rawData.length) {
      this.purgeCharts();
      for (const id of [
        'pareto-chart',
        'test-group-chart',
        'token-chart',
        'failure-analysis-chart',
      ]) {
        this.hideLoading(id);
        const container = document.getElementById(id);
        if (container)
          container.textContent = 'No matching runs. Adjust the filters above.';
      }
      return;
    }
    await Promise.all([
      this.initParetoChart(data.paretoData, 'pareto-chart', metric),
      this.initTestGroupChart(data.testGroupsData, 'test-group-chart'),
      this.initTokenChart(data.rawData, 'token-chart'),
      this.initFailureAnalysisChart(
        data.failureAnalysisData,
        'failure-analysis-chart',
      ),
    ]);
  }

  updateParetoChart(
    data: ParetoData[],
    metric: 'cost' | 'time' | 'tokens',
  ): void {
    if (!this.plotlyLoaded) return;

    try {
      this.initParetoChart(data, 'pareto-chart', metric);
    } catch (error) {
      console.error('Failed to update Pareto chart:', error);
    }
  }

  resizeCharts(): void {
    if (!this.plotlyLoaded) return;
    void Promise.all(
      [...this.charts].map((id) => window.Plotly.Plots.resize(id)),
    ).catch((error) => console.error('Failed to resize charts:', error));
  }

  purgeCharts(): void {
    if (!this.plotlyLoaded || typeof window.Plotly === 'undefined') return;

    try {
      window.Plotly.purge('pareto-chart');
      window.Plotly.purge('test-group-chart');
      window.Plotly.purge('token-chart');
      window.Plotly.purge('failure-analysis-chart');

      this.charts.clear();
    } catch (error) {
      console.error('Failed to purge charts:', error);
    }
  }

  // Listen for theme changes and update all charts
  setupThemeListener(): void {
    window.addEventListener('theme-changed', () => {
      this.charts.forEach((id) => this.refreshChartTheme(id));
    });
  }

  // Apply the current theme after rendering too: the theme can change while newPlot awaits.
  private refreshChartTheme(id: string): void {
    const colors = this.getThemeColors();
    const update = {
      plot_bgcolor: colors.background,
      paper_bgcolor: colors.paper,
      'xaxis.gridcolor': colors.grid,
      'yaxis.gridcolor': colors.grid,
      'xaxis.spikecolor': colors.text,
      'yaxis.spikecolor': colors.text,
      'font.color': colors.text,
      'title.font.color': colors.text,
      'xaxis.tickfont.color': colors.textSecondary,
      'yaxis.tickfont.color': colors.textSecondary,
      'xaxis.title.font.color': colors.textSecondary,
      'yaxis.title.font.color': colors.textSecondary,
    };

    void window.Plotly.relayout(id, update);
  }
}
