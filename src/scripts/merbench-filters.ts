import { getFilteredData, updateSummaryStats, showEmptyState } from '../lib/merbench';
import { updateLeaderboardData } from './merbench-sorting';
import type { RawData, TestGroupData, MerbenchData } from '../lib/merbench-types';
import { MerbenchCharts } from './merbench-charts';

declare global {
  interface Window {
    getCurrentParetoMetric?: () => 'cost' | 'time' | 'tokens';
    currentFilteredData?: any;
    merbenchCharts?: MerbenchCharts;
  }
}

export class MerbenchFilters {
  private originalRawData: RawData[];
  private originalTestGroupsData: TestGroupData[];
  private charts: MerbenchCharts;

  constructor(data: MerbenchData, charts: MerbenchCharts) {
    this.originalRawData = [...data.raw_data];
    this.originalTestGroupsData = [...data.test_groups_data];
    this.charts = charts;
  }

  private captureScrollState() {
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const maxScroll = documentHeight - viewportHeight;

    // Check if user is at the bottom of the page
    const isAtBottom = scrollY >= maxScroll - 5; // 5px tolerance

    // Check if user is at the top of the page
    const isAtTop = scrollY <= 5; // 5px tolerance

    // Find all potential reference elements
    const allElements = Array.from(
      document.querySelectorAll(
        '.leaderboard-table tbody tr, .chart-section, h2, .filter-container'
      )
    );

    // Find the element closest to the viewport center
    let referenceElement: HTMLElement | null = null;
    let referenceOffset = 0;
    let minDistance = Infinity;

    for (const element of allElements) {
      const rect = element.getBoundingClientRect();
      // Only consider elements that are at least partially visible
      if (rect.bottom > 0 && rect.top < viewportHeight) {
        const elementCenter = rect.top + rect.height / 2;
        const distanceFromCenter = Math.abs(elementCenter - viewportHeight / 2);

        if (distanceFromCenter < minDistance) {
          minDistance = distanceFromCenter;
          referenceElement = element as HTMLElement;
          // Store the exact offset from viewport top to element top
          referenceOffset = rect.top;

          // For table rows, store model name
          if (element.matches('.leaderboard-table tbody tr')) {
            const modelCell = element.querySelector('.model-name');
            if (modelCell) {
              referenceElement.dataset.referenceModel = modelCell.textContent || '';
              referenceElement.dataset.referenceType = 'table-row';
            }
          } else {
            referenceElement.dataset.referenceType = 'section';
            // Store unique identifier
            if (element.id) {
              referenceElement.dataset.sectionId = element.id;
            } else {
              // Create a unique identifier based on tag, class, and text
              const tag = element.tagName.toLowerCase();
              const classes = element.className
                .split(' ')
                .filter((c) => c)
                .join('.');
              const text = element.textContent?.trim().substring(0, 30) || '';
              referenceElement.dataset.uniqueId = `${tag}${classes ? '.' + classes : ''}-${text}`;
            }
          }
        }
      }
    }

    return {
      scrollY,
      viewportHeight,
      documentHeight,
      maxScroll,
      isAtBottom,
      isAtTop,
      referenceElement,
      referenceOffset,
      proportionalPosition: maxScroll > 0 ? scrollY / maxScroll : 0,
    };
  }

  private restoreScrollPosition(scrollState: ReturnType<typeof this.captureScrollState>) {
    const {
      referenceElement,
      referenceOffset,
      proportionalPosition,
      viewportHeight,
      isAtBottom,
      isAtTop,
    } = scrollState;

    // Handle special case: user was at the top of the page
    if (isAtTop) {
      window.scrollTo({
        top: 0,
        behavior: 'instant' as ScrollBehavior,
      });
      return;
    }

    // Handle special case: user was at the bottom of the page
    if (isAtBottom) {
      const newDocumentHeight = document.documentElement.scrollHeight;
      const newMaxScroll = Math.max(0, newDocumentHeight - viewportHeight);

      window.scrollTo({
        top: newMaxScroll,
        behavior: 'instant' as ScrollBehavior,
      });
      return;
    }

    // Try to restore position based on reference element
    if (referenceElement) {
      const referenceType = referenceElement.dataset.referenceType;

      // Handle table row references
      if (referenceType === 'table-row' && referenceElement.dataset.referenceModel) {
        const modelCells = document.querySelectorAll('.model-name');
        for (const cell of modelCells) {
          if (cell.textContent === referenceElement.dataset.referenceModel) {
            const row = cell.closest('tr');
            if (row) {
              const rect = row.getBoundingClientRect();
              const newScrollY = window.scrollY + rect.top - referenceOffset;

              window.scrollTo({
                top: Math.max(0, newScrollY),
                behavior: 'instant' as ScrollBehavior,
              });
              return;
            }
          }
        }
      }

      // Handle section references
      if (referenceType === 'section') {
        // Try to find by ID
        if (referenceElement.dataset.sectionId) {
          const section = document.getElementById(referenceElement.dataset.sectionId);
          if (section) {
            const rect = section.getBoundingClientRect();
            const newScrollY = window.scrollY + rect.top - referenceOffset;
            window.scrollTo({
              top: Math.max(0, newScrollY),
              behavior: 'instant' as ScrollBehavior,
            });
            return;
          }
        }

        // Try to find by unique identifier
        if (referenceElement.dataset.uniqueId) {
          const allElements = document.querySelectorAll('.chart-section, h2, .filter-container');
          for (const element of allElements) {
            const tag = element.tagName.toLowerCase();
            const classes = element.className
              .split(' ')
              .filter((c) => c)
              .join('.');
            const text = element.textContent?.trim().substring(0, 30) || '';
            const uniqueId = `${tag}${classes ? '.' + classes : ''}-${text}`;

            if (uniqueId === referenceElement.dataset.uniqueId) {
              const rect = element.getBoundingClientRect();
              const newScrollY = window.scrollY + rect.top - referenceOffset;
              window.scrollTo({
                top: Math.max(0, newScrollY),
                behavior: 'instant' as ScrollBehavior,
              });
              return;
            }
          }
        }
      }
    }

    // Final fallback: maintain proportional position
    const newMaxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
    const newScrollY = proportionalPosition * newMaxScroll;

    window.scrollTo({
      top: Math.max(0, newScrollY),
      behavior: 'instant' as ScrollBehavior,
    });
  }

  initialize(): void {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const checkboxes = document.querySelectorAll(
      'input[name="difficulty"], input[name="provider"], input[name="model"]'
    );
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        // Use async IIFE to handle the promise
        (async () => {
          await this.handleFilterChange();
        })();
      });
    });
  }

  private getSelectedDifficulties(): string[] {
    const selectedCheckboxes = document.querySelectorAll('input[name="difficulty"]:checked');
    return Array.from(selectedCheckboxes).map((cb) => (cb as HTMLInputElement).value);
  }

  private getSelectedProviders(): string[] {
    const selectedCheckboxes = document.querySelectorAll('input[name="provider"]:checked');
    return Array.from(selectedCheckboxes).map((cb) => (cb as HTMLInputElement).value);
  }

  private getSelectedModels(): string[] {
    const selectedCheckboxes = document.querySelectorAll('input[name="model"]:checked');
    return Array.from(selectedCheckboxes).map((cb) => (cb as HTMLInputElement).value);
  }

  private async handleFilterChange(): Promise<void> {
    try {
      // Capture scroll state before any changes
      const scrollState = this.captureScrollState();

      const selectedDifficulties = this.getSelectedDifficulties();
      const selectedProviders = this.getSelectedProviders();
      const selectedModels = this.getSelectedModels();

      if (
        selectedDifficulties.length === 0 &&
        selectedProviders.length === 0 &&
        selectedModels.length === 0
      ) {
        this.showNoDataMessage();
        this.charts.purgeCharts();
        return;
      }

      const filteredData = getFilteredData(
        selectedDifficulties,
        this.originalRawData,
        this.originalTestGroupsData,
        selectedProviders,
        selectedModels
      );

      this.updateUI(filteredData);

      // Store filtered data globally for metric selector access
      window.currentFilteredData = filteredData;

      // Get current pareto metric if available
      const currentMetric =
        typeof window.getCurrentParetoMetric === 'function'
          ? window.getCurrentParetoMetric()
          : 'cost';

      // Update charts and wait for completion
      await this.updateChartsWithScrollPreservation(filteredData, currentMetric, scrollState);
    } catch (error) {
      console.error('Error handling filter change:', error);
      this.showErrorMessage('An error occurred while filtering data. Please try again.');
    }
  }

  private async updateChartsWithScrollPreservation(
    filteredData: any,
    currentMetric: 'cost' | 'time' | 'tokens',
    scrollState: ReturnType<typeof this.captureScrollState>
  ): Promise<void> {
    // Temporarily disable transitions to prevent animations
    const plotContainers = document.querySelectorAll('.chart-container');
    plotContainers.forEach((container) => {
      (container as HTMLElement).style.transition = 'none';
    });

    // Update charts
    this.charts.updateAllCharts(filteredData, currentMetric);

    // Wait for multiple animation frames to ensure all layout changes are complete
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Additional delay for Plotly to complete rendering
          setTimeout(() => {
            resolve(undefined);
          }, 50);
        });
      });
    });

    // Restore scroll position
    this.restoreScrollPosition(scrollState);

    // Re-enable transitions after a short delay
    setTimeout(() => {
      plotContainers.forEach((container) => {
        (container as HTMLElement).style.transition = '';
      });
    }, 100);
  }

  private updateUI(filteredData: any): void {
    updateSummaryStats(filteredData);
    // Use sorting-aware leaderboard update instead of basic update
    updateLeaderboardData(filteredData.leaderboard);
  }

  private showNoDataMessage(): void {
    showEmptyState();
  }

  private showErrorMessage(message: string): void {
    const tbody = document.querySelector('.leaderboard-table tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: var(--accent-primary);">
            ${message}
          </td>
        </tr>
      `;
    }
  }

  // Public method to manually trigger filter update
  public updateFilters(): void {
    this.handleFilterChange();
  }

  // Method to reset all filters
  public resetFilters(): void {
    const checkboxes = document.querySelectorAll(
      'input[name="difficulty"], input[name="provider"], input[name="model"]'
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });
    this.handleFilterChange();
  }

  // Method to get current filter state
  public getCurrentFilters(): { difficulties: string[]; providers: string[]; models: string[] } {
    return {
      difficulties: this.getSelectedDifficulties(),
      providers: this.getSelectedProviders(),
      models: this.getSelectedModels(),
    };
  }
}
