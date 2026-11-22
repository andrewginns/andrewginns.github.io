import { getFilteredData } from '../lib/merbench';
import type { LeaderboardEntry, MerbenchData } from '../lib/merbench-types';
import { updateChartTables } from '../lib/merbench-tables';
import {
  buildMerbenchUrl,
  isMerbenchMetric,
  parseMerbenchUrl,
  serializeFilterKey,
  type MerbenchMetric,
  type MerbenchUrlState,
} from '../lib/merbench-url';
import type { MerbenchCharts } from './merbench-charts';
import {
  getLeaderboardSort,
  initializeLeaderboardSorting,
  setLeaderboardSort,
  updateLeaderboardData,
} from './merbench-sorting';

// History granularity: pushState on each discrete user action (filter, sort, or metric change)
// when the canonical URL changes; skip no-ops; replaceState only to normalize invalid initial
// params; never write history during popstate restoration.
function initializeMerbench() {
  const source = document.getElementById('merbench-data');
  const form = document.querySelector<HTMLFormElement>('#merbench-filters');
  if (!source?.textContent || !source.dataset.source || !form) return;
  const initial: LeaderboardEntry[] = JSON.parse(source.textContent);
  const dataUrl = source.dataset.source;
  const status = document.getElementById('filter-status');
  const retryButton =
    document.querySelector<HTMLButtonElement>('#retry-filters');
  const metricButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-metric]'),
  );
  const difficultyInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="difficulty"]'),
  );
  const providerInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="provider"]'),
  );
  const filterOptions = {
    difficulties: difficultyInputs.map((input) => input.value),
    providers: providerInputs.map((input) => input.value),
  };

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
  const selected = (inputs: HTMLInputElement[]) =>
    inputs.filter((input) => input.checked).map((input) => input.value);
  const activeCharts = new Set<string>();
  const pendingCharts = new Set<string>();
  let filtersDirty = false;
  let updating = false;
  let resultsStale = false;
  let metric: MerbenchMetric = 'cost';
  let lastAppliedFilterKey = serializeFilterKey(
    filterOptions.difficulties,
    filterOptions.providers,
    filterOptions,
  );
  let lastAppliedStatus =
    status?.textContent?.trim() || 'Showing all recorded runs.';

  function applyCheckboxState(
    difficulties: readonly string[],
    providers: readonly string[],
  ) {
    const difficultySet = new Set(difficulties);
    const providerSet = new Set(providers);
    difficultyInputs.forEach((input) => {
      input.checked = difficultySet.has(input.value);
    });
    providerInputs.forEach((input) => {
      input.checked = providerSet.has(input.value);
    });
  }

  function applyMetricState(nextMetric: MerbenchMetric) {
    metric = nextMetric;
    metricButtons.forEach((item) => {
      const active = item.dataset.metric === metric;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
  }

  function getCurrentState(): MerbenchUrlState {
    const { sort, dir } = getLeaderboardSort();
    return {
      difficulties: selected(difficultyInputs),
      providers: selected(providerInputs),
      sort,
      dir,
      metric,
    };
  }

  function syncUrl(mode: 'push' | 'replace') {
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextUrl = buildMerbenchUrl(
      window.location.href,
      getCurrentState(),
      filterOptions,
    );
    if (nextUrl === currentUrl) return;
    if (mode === 'push') window.history.pushState(null, '', nextUrl);
    else window.history.replaceState(null, '', nextUrl);
  }

  function showRetry(message: string) {
    resultsStale = true;
    if (status) status.textContent = message;
    if (retryButton) retryButton.hidden = false;
  }

  function hideRetry() {
    resultsStale = false;
    if (!retryButton || retryButton.hidden) return;
    const restoreFocus = document.activeElement === retryButton;
    retryButton.hidden = true;
    if (restoreFocus) status?.focus();
  }

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
        const difficulties = selected(difficultyInputs);
        const providers = selected(providerInputs);
        const current = getFilteredData(
          difficulties,
          data.raw_data,
          data.test_groups_data,
          providers,
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
          lastAppliedFilterKey = serializeFilterKey(
            difficulties,
            providers,
            filterOptions,
          );
          lastAppliedStatus = `${values[0].toLocaleString('en-GB')} runs across ${values[1]} models match your filters.`;
          if (status) status.textContent = lastAppliedStatus;
          hideRetry();
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
      const hadPendingFilters = filtersDirty;
      filtersDirty = false;
      const desiredFilterKey = serializeFilterKey(
        selected(difficultyInputs),
        selected(providerInputs),
        filterOptions,
      );
      if (
        (hadPendingFilters || resultsStale) &&
        desiredFilterKey !== lastAppliedFilterKey
      ) {
        showRetry(
          'Could not load benchmark data. Showing stale results — use Retry to apply your current filters.',
        );
      } else if (
        desiredFilterKey === lastAppliedFilterKey &&
        (hadPendingFilters || resultsStale)
      ) {
        if (status) status.textContent = lastAppliedStatus;
        hideRetry();
      }
      chartError();
    } finally {
      updating = false;
    }
  }

  function queueFilterUpdate(statusMessage = 'Updating results…') {
    filtersDirty = true;
    for (const id of activeCharts) pendingCharts.add(id);
    if (status) status.textContent = statusMessage;
    void update();
  }

  function filterChanged() {
    syncUrl('push');
    const desiredFilterKey = serializeFilterKey(
      selected(difficultyInputs),
      selected(providerInputs),
      filterOptions,
    );
    if (desiredFilterKey === lastAppliedFilterKey) {
      if (resultsStale) {
        if (status) status.textContent = lastAppliedStatus;
        hideRetry();
      }
      return;
    }
    queueFilterUpdate();
  }

  function restoreFromUrl() {
    const state = parseMerbenchUrl(window.location.href, filterOptions);
    const metricChanged = state.metric !== metric;
    applyCheckboxState(state.difficulties, state.providers);
    applyMetricState(state.metric);
    setLeaderboardSort(state.sort, state.dir);

    const desiredFilterKey = serializeFilterKey(
      state.difficulties,
      state.providers,
      filterOptions,
    );
    if (desiredFilterKey !== lastAppliedFilterKey) {
      queueFilterUpdate();
    } else {
      if (resultsStale) {
        if (status) status.textContent = lastAppliedStatus;
        hideRetry();
      }
      if (metricChanged && activeCharts.has('pareto-chart')) {
        pendingCharts.add('pareto-chart');
        void update();
      }
    }
  }

  const initialState = parseMerbenchUrl(window.location.href, filterOptions);
  applyCheckboxState(initialState.difficulties, initialState.providers);
  applyMetricState(initialState.metric);
  initializeLeaderboardSorting(initial, initialState, () => syncUrl('push'));
  syncUrl('replace');

  if (
    serializeFilterKey(
      initialState.difficulties,
      initialState.providers,
      filterOptions,
    ) !== lastAppliedFilterKey
  ) {
    queueFilterUpdate();
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
  retryButton?.addEventListener('click', () => {
    const desiredFilterKey = serializeFilterKey(
      selected(difficultyInputs),
      selected(providerInputs),
      filterOptions,
    );
    if (desiredFilterKey === lastAppliedFilterKey && !resultsStale) {
      hideRetry();
      return;
    }
    queueFilterUpdate('Retrying update…');
  });
  metricButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextMetric = button.dataset.metric;
      if (!isMerbenchMetric(nextMetric) || nextMetric === metric) return;
      applyMetricState(nextMetric);
      syncUrl('push');
      if (activeCharts.has('pareto-chart')) {
        pendingCharts.add('pareto-chart');
        void update();
      }
    });
  });
  window.addEventListener('popstate', restoreFromUrl);
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
