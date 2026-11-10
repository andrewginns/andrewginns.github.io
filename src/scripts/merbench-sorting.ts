import { formatCost, sortLeaderboard } from '../lib/merbench';
import type { LeaderboardEntry } from '../lib/merbench-types';

let currentData: LeaderboardEntry[] = [];
let sortKey: keyof LeaderboardEntry = 'Success_Rate';
let direction: 'asc' | 'desc' = 'desc';

export function initializeLeaderboardSorting(data: LeaderboardEntry[]): void {
  currentData = data;
  document
    .querySelectorAll<HTMLButtonElement>('[data-sort-key]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.sortKey as keyof LeaderboardEntry;
        direction =
          key === sortKey
            ? direction === 'desc'
              ? 'asc'
              : 'desc'
            : key === 'Model' ||
                key === 'Provider' ||
                key === 'Avg_Cost' ||
                key === 'Price_per_Success' ||
                key === 'Avg_Duration'
              ? 'asc'
              : 'desc';
        sortKey = key;
        updateLeaderboardData(currentData);
      });
    });
}

export function updateLeaderboardData(data: LeaderboardEntry[]): void {
  currentData = data;
  document
    .querySelectorAll<HTMLButtonElement>('[data-sort-key]')
    .forEach((button) => {
      const active = button.dataset.sortKey === sortKey;
      const header = button.closest('th');
      if (active)
        header?.setAttribute(
          'aria-sort',
          direction === 'asc' ? 'ascending' : 'descending',
        );
      else header?.removeAttribute('aria-sort');
      const indicator = button.querySelector('.sort-indicator');
      if (indicator)
        indicator.textContent = active
          ? direction === 'desc'
            ? '↓'
            : '↑'
          : '';
    });
  const tbody = document.querySelector<HTMLTableSectionElement>(
    '#leaderboard-table tbody',
  );
  if (!tbody) return;
  const rows = sortLeaderboard(data, sortKey, direction).map((entry, index) => {
    const row = document.createElement('tr');
    const values = [
      String(index + 1),
      entry.Model,
      `${entry.Success_Rate.toFixed(1)}%`,
      formatCost(entry.Avg_Cost),
      formatCost(entry.Price_per_Success),
      `${entry.Avg_Duration.toFixed(2)}s`,
      Math.ceil(entry.Avg_Tokens).toLocaleString('en-GB'),
      String(entry.Runs),
      entry.Provider,
    ];
    values.forEach((value, column) => {
      const cell = row.insertCell();
      cell.textContent = value;
      if (column === 1) cell.className = 'model-name';
    });
    return row;
  });
  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = row.insertCell();
    cell.colSpan = 9;
    cell.textContent =
      'No matching runs. Select at least one difficulty and one provider.';
    rows.push(row);
  }
  tbody.replaceChildren(...rows);
}
