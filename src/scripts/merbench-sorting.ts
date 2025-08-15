import { sortLeaderboard, setSortState, getSortState, calculateCost } from '../lib/merbench';
import type { LeaderboardEntry } from '../lib/merbench-types';

// Global leaderboard data storage
let currentLeaderboardData: LeaderboardEntry[] = [];

// Initialize sorting functionality
export const initializeLeaderboardSorting = (leaderboardData: LeaderboardEntry[]): void => {
  currentLeaderboardData = [...leaderboardData];
  setupSortHandlers();
};

// Update leaderboard data (called when filters change)
export const updateLeaderboardData = (newData: LeaderboardEntry[]): void => {
  currentLeaderboardData = [...newData];

  // Apply current sort to the new data
  const sortState = getSortState();
  const sortedData = sortLeaderboard(currentLeaderboardData, sortState.key, sortState.direction);
  renderLeaderboard(sortedData);
};

// Setup click handlers for sortable headers
const setupSortHandlers = (): void => {
  const sortableHeaders = document.querySelectorAll('.sortable');

  sortableHeaders.forEach((header) => {
    header.addEventListener('click', (event) => {
      const target = event.currentTarget as HTMLElement;
      const sortKey = target.dataset.sortKey;
      const sortType = target.dataset.sortType;

      if (!sortKey) return;

      // Determine new sort direction
      const currentDirection = target.dataset.sortDirection;
      let newDirection: 'asc' | 'desc';

      if (target.classList.contains('active')) {
        // Toggle direction if clicking the same column
        newDirection = currentDirection === 'desc' ? 'asc' : 'desc';
      } else {
        // Default direction for new column
        newDirection = sortType === 'string' ? 'asc' : 'desc';
      }

      // Update sort state
      setSortState(sortKey, newDirection);

      // Update UI
      updateSortIndicators(sortKey, newDirection);

      // Sort and render data
      const sortedData = sortLeaderboard(currentLeaderboardData, sortKey, newDirection);
      renderLeaderboard(sortedData);
    });
  });
};

// Update visual sort indicators
const updateSortIndicators = (activeSortKey: string, direction: 'asc' | 'desc'): void => {
  const sortableHeaders = document.querySelectorAll('.sortable');

  sortableHeaders.forEach((header) => {
    const element = header as HTMLElement;
    const sortKey = element.dataset.sortKey;
    const indicator = element.querySelector('.sort-indicator');

    if (!indicator) return;

    if (sortKey === activeSortKey) {
      // Active column
      element.classList.add('active');
      element.dataset.sortDirection = direction;
      indicator.textContent = direction === 'desc' ? '↓' : '↑';
    } else {
      // Inactive columns
      element.classList.remove('active');
      element.removeAttribute('data-sort-direction');
      indicator.textContent = '';
    }
  });
};

// Render the leaderboard table
const renderLeaderboard = (data: LeaderboardEntry[]): void => {
  const tbody = document.querySelector('#leaderboard-table tbody');
  if (!tbody) return;

  // Calculate cost range for progress bar normalization
  const costs = data.map((entry) => entry.Avg_Cost || calculateCost(entry.Avg_Tokens));
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const costRange = maxCost - minCost;

  tbody.innerHTML = data
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
      <td class="cost">
        ${entry.Price_per_Success != null ? `$${entry.Price_per_Success.toFixed(4)}` : 'N/A'}
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
