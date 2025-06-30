import {
  getFilteredData,
  updateSummaryStats,
  updateLeaderboard,
  showEmptyState,
} from '../lib/merbench';
import type { RawData, TestGroupData, MerbenchData } from '../lib/merbench-types';
import { MerbenchCharts } from './merbench-charts';

export class MerbenchFilters {
  private originalRawData: RawData[];
  private originalTestGroupsData: TestGroupData[];
  private charts: MerbenchCharts;

  constructor(data: MerbenchData, charts: MerbenchCharts) {
    this.originalRawData = [...data.raw_data];
    this.originalTestGroupsData = [...data.test_groups_data];
    this.charts = charts;
  }

  initialize(): void {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const checkboxes = document.querySelectorAll('input[name="difficulty"]');
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handleFilterChange());
    });
  }

  private getSelectedDifficulties(): string[] {
    const selectedCheckboxes = document.querySelectorAll('input[name="difficulty"]:checked');
    return Array.from(selectedCheckboxes).map((cb) => (cb as HTMLInputElement).value);
  }

  private handleFilterChange(): void {
    try {
      const selectedDifficulties = this.getSelectedDifficulties();

      if (selectedDifficulties.length === 0) {
        this.showNoDataMessage();
        this.charts.purgeCharts();
        return;
      }

      const filteredData = getFilteredData(
        selectedDifficulties,
        this.originalRawData,
        this.originalTestGroupsData
      );

      this.updateUI(filteredData);
      this.charts.updateAllCharts(filteredData);
    } catch (error) {
      console.error('Error handling filter change:', error);
      this.showErrorMessage('An error occurred while filtering data. Please try again.');
    }
  }

  private updateUI(filteredData: any): void {
    updateSummaryStats(filteredData);
    updateLeaderboard(filteredData);
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
      'input[name="difficulty"]'
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });
    this.handleFilterChange();
  }

  // Method to get current filter state
  public getCurrentFilters(): string[] {
    return this.getSelectedDifficulties();
  }
}
