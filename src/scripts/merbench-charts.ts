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
    Plotly: any;
  }
}

export class MerbenchCharts {
  private plotlyLoaded = false;
  private charts = new Map<string, any>();

  async waitForPlotly(): Promise<void> {
    if (typeof window.Plotly !== 'undefined') {
      this.plotlyLoaded = true;
      return;
    }

    return new Promise((resolve) => {
      const checkPlotly = () => {
        if (typeof window.Plotly !== 'undefined') {
          this.plotlyLoaded = true;
          resolve();
        } else {
          setTimeout(checkPlotly, 100);
        }
      };
      checkPlotly();
    });
  }

  private hideLoading(containerId: string): void {
    const loadingElement = document.getElementById(`chart-loading-${containerId}`);
    if (loadingElement) {
      loadingElement.classList.add('hidden');
    }
  }

  private showChartError(containerId: string, message: string): void {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="chart-error">
          <p>Failed to load chart: ${message}</p>
          <button onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  async initParetoChart(data: ParetoData[], containerId: string): Promise<void> {
    try {
      if (!this.plotlyLoaded) await this.waitForPlotly();

      const processed = processChartData.pareto(data);
      const { dataWithCost, paretoPoints } = processed;

      const trace = {
        x: dataWithCost.map((d) => d.cost),
        y: dataWithCost.map((d) => d.Success_Rate),
        mode: 'markers+text',
        type: 'scatter',
        text: dataWithCost.map((d) => d.Model),
        textposition: 'top center',
        textfont: {
          size: window.innerWidth < 768 ? 8 : 10,
          color: '#666',
        },
        showlegend: false,
        marker: {
          size: dataWithCost.map((d) => Math.log(d.Duration + 1) * 5 + 10),
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
            color: 'white',
            width: 1,
          },
        },
        hovertemplate:
          '<b>%{text}</b><br>' +
          'Success Rate: %{y:.1f}%<br>' +
          'Cost per Run: $%{x:.4f}<br>' +
          'Avg Tokens: %{customdata[0]:,.0f}<br>' +
          'Avg Duration: %{customdata[1]:.2f}s<br>' +
          '<extra></extra>',
        customdata: dataWithCost.map((d) => [d.total_tokens, d.Duration]),
      };

      const isMobile = window.innerWidth < 768;

      const layout = {
        title: {
          text: 'Model Performance vs Cost Trade-off',
          font: {
            size: 16,
            color: '#2c3e50',
          },
        },
        xaxis: {
          title: 'Average Cost per Run ($)',
          type: 'log',
          gridcolor: '#e0e0e0',
          zeroline: false,
        },
        yaxis: {
          title: 'Success Rate (%)',
          gridcolor: '#e0e0e0',
          zeroline: false,
          range: [-5, Math.max(...dataWithCost.map((d) => d.Success_Rate)) + 5],
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        hovermode: 'closest',
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
          r: isMobile ? 40 : 120,
          t: 40,
          b: isMobile ? 160 : 60,
        },
      };

      const traces: any[] = [trace];
      if (paretoPoints.length > 1) {
        const paretoTrace = {
          x: paretoPoints.map((p) => p.cost),
          y: paretoPoints.map((p) => p.Success_Rate),
          mode: 'lines',
          type: 'scatter',
          line: {
            color: 'rgba(231, 76, 60, 0.3)',
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
        staticPlot: window.innerWidth < 768,
      };

      await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.set(containerId, { traces, layout, config });
      this.hideLoading(containerId);
    } catch (error) {
      console.error('Failed to initialize Pareto chart:', error);
      this.showChartError(containerId, 'Failed to load chart data');
    }
  }

  async initTestGroupChart(data: TestGroupData[], containerId: string): Promise<void> {
    try {
      if (!this.plotlyLoaded) await this.waitForPlotly();

      const { traces } = processChartData.testGroup(data);

      const isMobile = window.innerWidth < 768;

      const layout = {
        title: {
          text: 'Success Rate by Test Difficulty',
          font: {
            size: 16,
            color: '#2c3e50',
          },
        },
        xaxis: {
          title: isMobile ? '' : 'Model',
          tickangle: -45,
        },
        yaxis: {
          title: 'Success Rate (%)',
          range: [0, 105],
        },
        barmode: 'group',
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
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
          r: isMobile ? 40 : 60,
          t: 40,
          b: isMobile ? 200 : 120,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: window.innerWidth < 768,
      };

      await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.set(containerId, { traces, layout, config });
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
        title: {
          text: 'Average Token Usage per Model',
          font: {
            size: 16,
            color: '#2c3e50',
          },
        },
        xaxis: {
          title: isMobile ? '' : 'Model',
          tickangle: -45,
        },
        yaxis: {
          title: 'Average Tokens',
        },
        barmode: 'stack',
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
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
          r: isMobile ? 40 : 60,
          t: 40,
          b: isMobile ? 200 : 120,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: window.innerWidth < 768,
      };

      await window.Plotly.newPlot(containerId, [trace1, trace2], layout, config);
      this.charts.set(containerId, { traces: [trace1, trace2], layout, config });
      this.hideLoading(containerId);
    } catch (error) {
      console.error('Failed to initialize Token chart:', error);
      this.showChartError(containerId, 'Failed to load chart data');
    }
  }

  async initFailureAnalysisChart(data: FailureAnalysisData[], containerId: string): Promise<void> {
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
        title: {
          text: 'Failure Analysis by Reason',
          font: {
            size: 16,
            color: '#2c3e50',
          },
        },
        xaxis: {
          title: isMobile ? '' : 'Model',
          tickangle: -45,
        },
        yaxis: {
          title: 'Number of Failures',
        },
        barmode: 'stack',
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
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
          r: isMobile ? 40 : 60,
          t: 40,
          b: isMobile ? 200 : 120,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: window.innerWidth < 768,
      };

      await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.set(containerId, { traces, layout, config });
      this.hideLoading(containerId);
    } catch (error) {
      console.error('Failed to initialize Failure Analysis chart:', error);
      this.showChartError(containerId, 'Failed to load chart data');
    }
  }

  async initializeAllCharts(data: {
    paretoData: ParetoData[];
    testGroupsData: TestGroupData[];
    rawData: RawData[];
    failureAnalysisData: FailureAnalysisData[];
  }): Promise<void> {
    await Promise.all([
      this.initParetoChart(data.paretoData, 'pareto-chart'),
      this.initTestGroupChart(data.testGroupsData, 'test-group-chart'),
      this.initTokenChart(data.rawData, 'token-chart'),
      this.initFailureAnalysisChart(data.failureAnalysisData, 'failure-analysis-chart'),
    ]);
  }

  updateAllCharts(filteredData: FilteredData): void {
    if (!this.plotlyLoaded) return;

    try {
      this.initParetoChart(filteredData.paretoData, 'pareto-chart');
      this.initTestGroupChart(filteredData.testGroupsData, 'test-group-chart');
      this.initTokenChart(filteredData.rawData, 'token-chart');
      this.initFailureAnalysisChart(filteredData.failureAnalysisData, 'failure-analysis-chart');
    } catch (error) {
      console.error('Failed to update charts:', error);
    }
  }

  resizeCharts(): void {
    if (!this.plotlyLoaded || typeof window.Plotly === 'undefined') return;

    try {
      window.Plotly.Plots.resize('pareto-chart');
      window.Plotly.Plots.resize('test-group-chart');
      window.Plotly.Plots.resize('token-chart');
      window.Plotly.Plots.resize('failure-analysis-chart');
    } catch (error) {
      console.error('Failed to resize charts:', error);
    }
  }

  purgeCharts(): void {
    if (!this.plotlyLoaded || typeof window.Plotly === 'undefined') return;

    try {
      window.Plotly.purge('pareto-chart');
      window.Plotly.purge('test-group-chart');
      window.Plotly.purge('token-chart');
      window.Plotly.purge('failure-analysis-chart');
    } catch (error) {
      console.error('Failed to purge charts:', error);
    }
  }
}
