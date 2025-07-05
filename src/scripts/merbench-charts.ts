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

  private isDarkMode(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  private getThemeColors() {
    const isDark = this.isDarkMode();
    return {
      background: isDark ? '#0d1117' : '#ffffff',
      paper: isDark ? '#161b22' : '#ffffff',
      text: isDark ? '#f0f6fc' : '#2c3e50',
      textSecondary: isDark ? '#8b949e' : '#7f8c8d',
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

  async initParetoChart(
    data: ParetoData[],
    containerId: string,
    metric: 'cost' | 'time' | 'tokens' = 'cost'
  ): Promise<void> {
    try {
      if (!this.plotlyLoaded) await this.waitForPlotly();

      const processed = processChartData.pareto(data);
      const { dataWithCost } = processed;

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
          xAxisType = 'log';
          chartTitle = 'Model Performance vs Token Usage Trade-off';
          break;
        case 'cost':
        default:
          xData = dataWithCost.map((d) => d.cost);
          xAxisTitle = 'Average Cost per Run ($)';
          xAxisType = 'log';
          chartTitle = 'Model Performance vs Cost Trade-off';
          break;
      }

      // Calculate pareto frontier for selected metric
      const paretoData = dataWithCost
        .map((d, index) => ({ ...d, originalIndex: index }))
        .sort((a, b) => {
          const aValue =
            metric === 'time' ? a.Duration : metric === 'tokens' ? a.total_tokens : a.cost;
          const bValue =
            metric === 'time' ? b.Duration : metric === 'tokens' ? b.total_tokens : b.cost;
          return aValue - bValue;
        });

      const paretoFrontier: any[] = [];
      let maxSuccessRate = -1;

      for (const point of paretoData) {
        if (point.Success_Rate > maxSuccessRate) {
          paretoFrontier.push(point);
          maxSuccessRate = point.Success_Rate;
        }
      }

      // Calculate colors for each point based on Duration values
      const durations = dataWithCost.map((d) => d.Duration);
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      // Get colors for each point using the Viridis colorscale
      const markerColors = dataWithCost.map((d) => {
        const normalized = (d.Duration - minDuration) / (maxDuration - minDuration);
        return this.getViridisColor(normalized);
      });

      // Calculate appropriate text colors based on background luminance
      const textColors = markerColors.map((bgColor) => {
        return this.getContrastColor(bgColor);
      });

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
        mode: 'markers+text',
        type: 'scatter',
        text: dataWithCost.map((d) => d.Model),
        textposition: 'top center',
        textfont: {
          size: window.innerWidth < 768 ? 8 : 10,
          color: '#666',
        },
        showlegend: false,
        hoverlabel: {
          bgcolor: markerColors,
          bordercolor: markerColors.map((color) => this.darkenColor(color, 0.2)),
          font: {
            family: 'system-ui, -apple-system, sans-serif',
            size: 14,
            color: textColors,
          },
        },
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

      const traces: any[] = [trace];
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
            color: this.isDarkMode() ? 'rgba(242, 139, 130, 0.3)' : 'rgba(231, 76, 60, 0.3)',
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

      const plot = await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.set(containerId, plot);
      this.charts.set(containerId, { traces, layout, config, dataWithCost });

      // Add enhanced hover behavior for desktop
      if (!window.innerWidth || window.innerWidth >= 768) {
        this.addEnhancedHover(containerId, dataWithCost, metric);
      }

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
          b: isMobile ? 200 : 120,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: window.innerWidth < 768,
      };

      const plot = await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.set(containerId, plot);
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
          b: isMobile ? 200 : 120,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: window.innerWidth < 768,
      };

      const plot = await window.Plotly.newPlot(containerId, [trace1, trace2], layout, config);
      this.charts.set(containerId, plot);
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
          b: isMobile ? 200 : 120,
        },
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: window.innerWidth < 768,
      };

      const plot = await window.Plotly.newPlot(containerId, traces, layout, config);
      this.charts.set(containerId, plot);
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

  updateAllCharts(filteredData: FilteredData, paretoMetric?: 'cost' | 'time' | 'tokens'): void {
    if (!this.plotlyLoaded) return;

    try {
      this.initParetoChart(filteredData.paretoData, 'pareto-chart', paretoMetric);
      this.initTestGroupChart(filteredData.testGroupsData, 'test-group-chart');
      this.initTokenChart(filteredData.rawData, 'token-chart');
      this.initFailureAnalysisChart(filteredData.failureAnalysisData, 'failure-analysis-chart');
    } catch (error) {
      console.error('Failed to update charts:', error);
    }
  }

  updateParetoChart(data: ParetoData[], metric: 'cost' | 'time' | 'tokens'): void {
    if (!this.plotlyLoaded) return;

    try {
      this.initParetoChart(data, 'pareto-chart', metric);
    } catch (error) {
      console.error('Failed to update Pareto chart:', error);
    }
  }

  private addEnhancedHover(
    containerId: string,
    dataWithCost: any[],
    metric: 'cost' | 'time' | 'tokens' = 'cost'
  ): void {
    const plotElement = document.getElementById(containerId);
    if (!plotElement) return;

    // Store the current hover data
    let currentHoverIndex = -1;

    // Function to find the nearest point
    const findNearestPoint = (xPixel: number, yPixel: number) => {
      const plotly = (plotElement as any)._fullLayout;
      if (!plotly) return -1;

      // Convert pixel coordinates to data coordinates
      const xaxis = plotly.xaxis;
      const yaxis = plotly.yaxis;

      // Get data coordinates from pixel coordinates
      const xData = xaxis.p2d ? xaxis.p2d(xPixel) : xaxis.p2c(xPixel);
      const yData = yaxis.p2d ? yaxis.p2d(yPixel) : yaxis.p2c(yPixel);

      // Find the nearest point
      let minDistance = Infinity;
      let nearestIndex = -1;

      dataWithCost.forEach((point, index) => {
        // Calculate distance based on current metric
        let xDist: number;
        if (metric === 'time') {
          // Linear scale for time
          xDist = (point.Duration - xData) / 60; // Normalize by 60 seconds
        } else if (metric === 'tokens') {
          // Log scale for tokens
          xDist = Math.log10(point.total_tokens) - Math.log10(xData);
        } else {
          // Log scale for cost (default)
          xDist = Math.log10(point.cost) - Math.log10(xData);
        }

        const yDist = (point.Success_Rate - yData) / 100; // Normalize y distance
        const distance = Math.sqrt(xDist * xDist + yDist * yDist);

        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      return nearestIndex;
    };

    // Mouse move handler
    const handleMouseMove = (event: MouseEvent) => {
      const rect = plotElement.getBoundingClientRect();
      const plotly = (plotElement as any)._fullLayout;
      if (!plotly) return;

      // Get mouse position relative to plot area
      const xPixel = event.clientX - rect.left - plotly.margin.l;
      const yPixel = event.clientY - rect.top - plotly.margin.t;

      // Check if mouse is within plot area
      const plotWidth = rect.width - plotly.margin.l - plotly.margin.r;
      const plotHeight = rect.height - plotly.margin.t - plotly.margin.b;

      if (xPixel >= 0 && xPixel <= plotWidth && yPixel >= 0 && yPixel <= plotHeight) {
        const nearestIndex = findNearestPoint(xPixel, yPixel);

        if (nearestIndex !== -1 && nearestIndex !== currentHoverIndex) {
          currentHoverIndex = nearestIndex;

          // Trigger hover on the nearest point
          window.Plotly.Fx.hover(plotElement, [
            {
              curveNumber: 0,
              pointNumber: nearestIndex,
            },
          ]);
        }
      } else {
        // Mouse is outside plot area
        currentHoverIndex = -1;
        window.Plotly.Fx.unhover(plotElement);
      }
    };

    // Mouse leave handler
    const handleMouseLeave = () => {
      currentHoverIndex = -1;
      window.Plotly.Fx.unhover(plotElement);
    };

    // Add event listeners
    plotElement.addEventListener('mousemove', handleMouseMove);
    plotElement.addEventListener('mouseleave', handleMouseLeave);

    // Store cleanup function
    const chartData = this.charts.get(containerId);
    if (chartData) {
      chartData.cleanup = () => {
        plotElement.removeEventListener('mousemove', handleMouseMove);
        plotElement.removeEventListener('mouseleave', handleMouseLeave);
      };
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
      // Clean up event listeners before purging
      ['pareto-chart', 'test-group-chart', 'token-chart', 'failure-analysis-chart'].forEach(
        (id) => {
          const chartData = this.charts.get(id);
          if (chartData && chartData.cleanup) {
            chartData.cleanup();
          }
        }
      );

      window.Plotly.purge('pareto-chart');
      window.Plotly.purge('test-group-chart');
      window.Plotly.purge('token-chart');
      window.Plotly.purge('failure-analysis-chart');

      this.charts.clear();
    } catch (error) {
      console.error('Failed to purge charts:', error);
    }
  }

  // Color helper methods
  private getViridisColor(value: number): string {
    // Viridis colorscale approximation using RGB values
    // Value should be between 0 and 1
    const clampedValue = Math.max(0, Math.min(1, value));

    // Define key points in the Viridis colorscale
    const colorPoints = [
      { pos: 0.0, r: 68, g: 1, b: 84 }, // Dark purple
      { pos: 0.25, r: 58, g: 82, b: 139 }, // Blue
      { pos: 0.5, r: 32, g: 144, b: 140 }, // Teal
      { pos: 0.75, r: 94, g: 201, b: 97 }, // Green
      { pos: 1.0, r: 253, g: 231, b: 36 }, // Yellow
    ];

    // Find the two colors to interpolate between
    let lowerIndex = 0;
    let upperIndex = colorPoints.length - 1;

    for (let i = 0; i < colorPoints.length - 1; i++) {
      if (clampedValue >= colorPoints[i].pos && clampedValue <= colorPoints[i + 1].pos) {
        lowerIndex = i;
        upperIndex = i + 1;
        break;
      }
    }

    const lower = colorPoints[lowerIndex];
    const upper = colorPoints[upperIndex];

    // Interpolate between the colors
    const range = upper.pos - lower.pos;
    const t = range === 0 ? 0 : (clampedValue - lower.pos) / range;

    const r = Math.round(lower.r + (upper.r - lower.r) * t);
    const g = Math.round(lower.g + (upper.g - lower.g) * t);
    const b = Math.round(lower.b + (upper.b - lower.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  private getContrastColor(bgColor: string): string {
    // Extract RGB values from the color string
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return '#000000'; // Default to black if parsing fails

    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);

    // Calculate relative luminance using WCAG formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return white for dark backgrounds, black for light backgrounds
    // Using a threshold of 0.5 for good contrast
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  private darkenColor(color: string, amount: number): string {
    // Extract RGB values
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return color;

    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);

    // Darken by reducing each component
    const factor = 1 - amount;
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);

    return `rgb(${newR}, ${newG}, ${newB})`;
  }

  // Listen for theme changes and update all charts
  setupThemeListener(): void {
    window.addEventListener('theme-changed', () => {
      this.refreshAllCharts();
    });
  }

  private refreshAllCharts(): void {
    // Refresh all existing charts with new theme colors
    this.charts.forEach((_, id) => {
      const colors = this.getThemeColors();
      const update = {
        plot_bgcolor: colors.background,
        paper_bgcolor: colors.paper,
        'xaxis.gridcolor': colors.grid,
        'yaxis.gridcolor': colors.grid,
        'xaxis.spikecolor': colors.text,
        'yaxis.spikecolor': colors.text,
      };

      if (window.Plotly) {
        window.Plotly.relayout(id, update);
      }
    });
  }
}
