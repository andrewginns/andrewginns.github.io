import { formatCost, sortLeaderboard } from '../lib/merbench';
import type { LeaderboardEntry } from '../lib/merbench-types';
import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEY,
  getDefaultSortDirection,
  isMerbenchSortKey,
  type MerbenchSortKey,
  type SortDirection,
} from '../lib/merbench-url';

interface LeaderboardSortState {
  sort: MerbenchSortKey;
  dir: SortDirection;
}

let currentData: LeaderboardEntry[] = [];
let sortKey: MerbenchSortKey = DEFAULT_SORT_KEY;
let direction: SortDirection = DEFAULT_SORT_DIRECTION;

export function getLeaderboardSort(): LeaderboardSortState {
  return { sort: sortKey, dir: direction };
}

export function setLeaderboardSort(
  key: MerbenchSortKey,
  dir: SortDirection,
): void {
  if (sortKey === key && direction === dir) return;
  sortKey = key;
  direction = dir;
  updateLeaderboardData(currentData);
}

export function initializeLeaderboardSorting(
  data: LeaderboardEntry[],
  initialSort: LeaderboardSortState,
  onSortChange: () => void,
): void {
  currentData = data;
  sortKey = initialSort.sort;
  direction = initialSort.dir;

  document
    .querySelectorAll<HTMLButtonElement>('[data-sort-key]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.sortKey;
        if (!isMerbenchSortKey(key)) return;
        const nextDirection =
          key === sortKey
            ? direction === 'desc'
              ? 'asc'
              : 'desc'
            : getDefaultSortDirection(key);
        setLeaderboardSort(key, nextDirection);
        onSortChange();
      });
    });

  if (sortKey !== DEFAULT_SORT_KEY || direction !== DEFAULT_SORT_DIRECTION) {
    updateLeaderboardData(currentData);
  }
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
