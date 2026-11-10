import { getFilteredData } from '../lib/merbench';
import type { MerbenchData } from '../lib/merbench-types';
import { MerbenchCharts } from './merbench-charts';
import {
  initializeLeaderboardSorting,
  updateLeaderboardData,
} from './merbench-sorting';

async function initializeMerbench() {
  const source = document.getElementById('merbench-data');
  const form = document.querySelector<HTMLFormElement>('#merbench-filters');
  if (!source?.textContent || !form) return;
  const data: Pick<MerbenchData, 'raw_data' | 'test_groups_data'> = JSON.parse(
    source.textContent,
  );
  const charts = new MerbenchCharts();
  let ready = false;
  let metric: 'cost' | 'time' | 'tokens' = 'cost';
  const selected = (name: string) =>
    Array.from(
      form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`),
      (input) => input.value,
    );
  const filtered = () =>
    getFilteredData(
      selected('difficulty'),
      data.raw_data,
      data.test_groups_data,
      selected('provider'),
    );
  let current = filtered();
  initializeLeaderboardSorting(current.leaderboard);
  charts.setupThemeListener();

  function update() {
    current = filtered();
    updateLeaderboardData(current.leaderboard);
    const values = [
      current.rawData.length,
      current.leaderboard.length,
      new Set(current.rawData.map((run) => run.test_group)).size,
    ];
    document.querySelectorAll('.stat-value').forEach((element, index) => {
      element.textContent = values[index].toLocaleString('en-GB');
    });
    const status = document.getElementById('filter-status');
    if (status)
      status.textContent = `${values[0].toLocaleString('en-GB')} runs across ${values[1]} models match your filters.`;
    if (ready) void charts.updateAllCharts(current, metric);
  }
  form.addEventListener('change', update);
  for (const [id, checked] of [
    ['select-all', true],
    ['clear-all', false],
  ] as const) {
    document.getElementById(id)?.addEventListener('click', () => {
      form
        .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        .forEach((input) => {
          input.checked = checked;
        });
      update();
    });
  }
  document
    .querySelectorAll<HTMLButtonElement>('[data-metric]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        metric = button.dataset.metric as typeof metric;
        document
          .querySelectorAll<HTMLButtonElement>('[data-metric]')
          .forEach((item) => {
            item.classList.toggle('active', item === button);
            item.setAttribute('aria-pressed', String(item === button));
          });
        if (ready) charts.updateParetoChart(current.paretoData, metric);
      });
    });
  update();
  try {
    await charts.waitForPlotly();
    ready = true;
    await charts.updateAllCharts(current, metric);
    let resizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => charts.resizeCharts(), 150);
    });
  } catch {
    document
      .querySelectorAll<HTMLElement>('.chart-loading')
      .forEach((element) => {
        element.textContent =
          'Charts could not load. All results remain available in the table above.';
      });
  }
}

void initializeMerbench();
