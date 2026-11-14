import { getFilteredData } from '../lib/merbench';
import type { LeaderboardEntry, MerbenchData } from '../lib/merbench-types';
import { updateChartTables } from '../lib/merbench-tables';
import type { MerbenchCharts } from './merbench-charts';
import {
  initializeLeaderboardSorting,
  updateLeaderboardData,
} from './merbench-sorting';

function initializeMerbench() {
  const source = document.getElementById('merbench-data');
  const form = document.querySelector<HTMLFormElement>('#merbench-filters');
  if (!source?.textContent || !source.dataset.source || !form) return;
  const initial: LeaderboardEntry[] = JSON.parse(source.textContent);
  const dataUrl = source.dataset.source;
  initializeLeaderboardSorting(initial);

  let dataPromise: Promise<MerbenchData> | undefined;
  const loadData = () => {
    dataPromise ??= fetch(dataUrl, { signal: AbortSignal.timeout(10000) })
      .then((response) => {
        if (!response.ok) throw new Error('Benchmark data could not load');
        return response.json() as Promise<MerbenchData>;
      })
      .catch((error) => {
        dataPromise = undefined;
        throw error;
      });
    return dataPromise;
  };
  let charts: MerbenchCharts | null | undefined;
  let chartPromise: Promise<void> | undefined;
  const loadCharts = () => {
    chartPromise ??= import('./merbench-charts')
      .then(async ({ MerbenchCharts }) => {
        const loaded = new MerbenchCharts();
        await loaded.waitForPlotly();
        loaded.setupThemeListener();
        let resizeTimer: ReturnType<typeof setTimeout>;
        window.addEventListener('resize', () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => loaded.resizeCharts(), 150);
        });
        charts = loaded;
        void update();
      })
      .catch(() => {
        charts = null;
        chartError();
      });
  };
  const selected = (name: string) =>
    Array.from(
      form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`),
      (input) => input.value,
    );
  const activeCharts = new Set<string>();
  const pendingCharts = new Set<string>();
  let filtersDirty = false;
  let updating = false;
  let metric: 'cost' | 'time' | 'tokens' = 'cost';
  const status = document.getElementById('filter-status');

  function chartError() {
    for (const id of pendingCharts) {
      const loading = document.getElementById(`chart-loading-${id}`);
      if (loading)
        loading.textContent =
          'Chart could not load. Use the data table instead.';
    }
    pendingCharts.clear();
  }

  // One local queue coalesces input during lazy loading/rendering; the latest selection wins.
  async function update() {
    if (updating) return;
    updating = true;
    try {
      while (filtersDirty || pendingCharts.size) {
        const data = await loadData();
        const current = getFilteredData(
          selected('difficulty'),
          data.raw_data,
          data.test_groups_data,
          selected('provider'),
        );
        if (filtersDirty) {
          updateLeaderboardData(current.leaderboard);
          updateChartTables(current);
          const values = [
            current.rawData.length,
            current.leaderboard.length,
            new Set(current.rawData.map((run) => run.test_group)).size,
          ];
          document.querySelectorAll('.stat-value').forEach((element, index) => {
            element.textContent = values[index].toLocaleString('en-GB');
          });
          if (status)
            status.textContent = `${values[0].toLocaleString('en-GB')} runs across ${values[1]} models match your filters.`;
          filtersDirty = false;
        }
        if (pendingCharts.size) {
          if (charts === null) {
            chartError();
            continue;
          }
          if (!charts) {
            loadCharts();
            break;
          }
          const ids = [...pendingCharts];
          pendingCharts.clear();
          await charts.updateCharts(current, metric, ids);
        }
      }
    } catch {
      if (filtersDirty && status)
        status.textContent =
          'Results could not be updated. The previous results remain shown; change a filter to retry.';
      filtersDirty = false;
      chartError();
    } finally {
      updating = false;
    }
  }

  function filterChanged() {
    filtersDirty = true;
    for (const id of activeCharts) pendingCharts.add(id);
    if (status) status.textContent = 'Updating results…';
    void update();
  }
  form.addEventListener('change', filterChanged);
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
      filterChanged();
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
        if (activeCharts.has('pareto-chart')) {
          pendingCharts.add('pareto-chart');
          void update();
        }
      });
    });
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).dataset.chartId;
        if (!id) continue;
        activeCharts.add(id);
        pendingCharts.add(id);
        observer.unobserve(entry.target);
      }
      if (pendingCharts.size) void update();
    },
    { rootMargin: '300px 0px' },
  );
  document
    .querySelectorAll('.chart-section')
    .forEach((section) => observer.observe(section));
}

initializeMerbench();
