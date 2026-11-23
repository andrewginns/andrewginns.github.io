import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { getChartTables } from '../src/lib/merbench-tables';
import {
  formatCost,
  getFilteredData,
  processChartData,
  sortLeaderboard,
} from '../src/lib/merbench';
import { buildMerbenchUrl, parseMerbenchUrl } from '../src/lib/merbench-url';
import type { RawData, LeaderboardEntry } from '../src/lib/merbench-types';
import snapshot from '../src/data/merbench_data.json' with { type: 'json' };

async function revealCharts(page: Page) {
  for (const id of [
    'pareto-chart',
    'test-group-chart',
    'token-chart',
    'failure-analysis-chart',
  ]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await expect(page.locator(`#${id} .plot-container`)).toBeVisible();
  }
}

const zeroRun: RawData = {
  Model: 'zero-cost',
  provider: 'Local',
  test_group: 'easy',
  Duration: 2,
  total_tokens: 10,
  Metric_request_tokens: 0,
  Metric_response_tokens: 10,
  Score_MermaidDiagramValid: 1,
  Score_UsedBothMCPTools: 1,
  Score_UsageLimitNotExceeded: 1,
  total_cost: 0,
  input_cost: 0,
  output_cost: 0,
};

test('filtering preserves zero costs and treats missing costs as unavailable', () => {
  const unknown = { ...zeroRun, Model: 'unknown-cost', total_cost: undefined };
  const result = getFilteredData(['easy'], [zeroRun, unknown], [], ['Local']);
  expect(result.leaderboard[0].Avg_Cost).toBe(0);
  expect(result.leaderboard[0].Price_per_Success).toBe(0);
  expect(result.leaderboard[1].Avg_Cost).toBeUndefined();
  expect(result.leaderboard[1].Price_per_Success).toBeUndefined();
  expect(formatCost(0)).toBe('$0.0000');
  expect(formatCost(undefined)).toBe('N/A');
  expect(processChartData.pareto(result.paretoData).dataWithCost[0].cost).toBe(
    0,
  );
  for (const direction of ['asc', 'desc'] as const) {
    expect(
      sortLeaderboard(result.leaderboard, 'Avg_Cost', direction).at(-1)?.Model,
    ).toBe('unknown-cost');
  }
});

test('either empty filter group means no results and actual snapshot totals agree', () => {
  expect(getFilteredData([], [zeroRun], [], ['Local']).leaderboard).toEqual([]);
  expect(getFilteredData(['easy'], [zeroRun], [], []).leaderboard).toEqual([]);
  const result = getFilteredData(
    ['easy', 'medium', 'hard'],
    snapshot.raw_data,
    snapshot.test_groups_data,
    snapshot.stats.providers,
  );
  expect(result.rawData.length).toBe(snapshot.stats.total_runs);
  expect(result.leaderboard.length).toBe(snapshot.stats.models_evaluated);
  expect(result.leaderboard.reduce((sum, entry) => sum + entry.Runs, 0)).toBe(
    snapshot.stats.total_runs,
  );
  const entries = result.leaderboard as LeaderboardEntry[];
  const sorted = sortLeaderboard(entries, 'Success_Rate', 'desc');
  expect(sorted[0].Success_Rate).toBe(
    Math.max(...entries.map((entry) => entry.Success_Rate)),
  );
});

test('token averages include valid zero measurements', () => {
  const result = processChartData.tokens([
    zeroRun,
    { ...zeroRun, Metric_request_tokens: 20 },
  ]);
  expect(result.avgRequestTokens).toEqual([10]);
});

test('archive supports local charts, keyboard sorting and filter reset', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/merbench/');
  await expect(
    page.getByText('Legacy · Saturated', { exact: true }),
  ).toBeVisible();
  await revealCharts(page);
  await expect(page.locator('#pareto-chart .plot-container')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    snapshot.stats.models_evaluated,
  );
  await expect(page.locator('script[src*="plotly"]')).toHaveAttribute(
    'src',
    /^\/_astro\//,
  );
  await expect(page.locator('#test-group-chart .ytitle')).toHaveText(
    'Success Rate (%)',
  );
  await expect(page.locator('#token-chart .ytitle')).toHaveText(
    'Average Tokens',
  );
  await expect(page.locator('#failure-analysis-chart .ytitle')).toHaveText(
    'Number of Failures',
  );
  const costHeading = page.getByRole('button', { name: 'Cost / run' });
  await costHeading.focus();
  await page.keyboard.press('Enter');
  await expect(costHeading.locator('..')).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '0 runs across 0 models' }),
  ).toBeVisible();
  await expect(page.locator('#leaderboard-table tbody')).toContainText(
    'No matching runs',
  );
  await page.getByLabel('Easy', { exact: true }).check();
  await expect(page.locator('#leaderboard-table tbody')).toContainText(
    'No matching runs',
  );
  await page.getByLabel('OpenAI', { exact: true }).check();
  await expect(page.locator('#leaderboard-table tbody')).not.toContainText(
    'No matching runs',
  );
  const providers = await page
    .locator('#leaderboard-table tbody td:last-child')
    .allTextContents();
  expect(providers.length).toBeGreaterThan(0);
  expect(providers.every((provider) => provider === 'OpenAI')).toBe(true);
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    snapshot.stats.models_evaluated,
  );
  await expect(page.locator('#pareto-chart .plot-container')).toBeVisible();
  await page.getByRole('button', { name: 'Time', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Time', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'Cost', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page
    .getByRole('combobox', { name: 'Color theme' })
    .selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const chartText = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--text-primary')
      .trim(),
  );
  await expect
    .poll(() =>
      page.locator('.chart-container').evaluateAll((elements) =>
        elements.map(
          (element) =>
            (
              element as HTMLElement & {
                layout?: { title?: { font?: { color: string } } };
              }
            ).layout?.title?.font?.color,
        ),
      ),
    )
    .toEqual(Array(4).fill(chartText));
  expect(pageErrors).toEqual([]);
});

test('mobile filters stay accessible without overflowing the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/merbench/');
  await expect(
    page.getByRole('button', { name: 'Clear all', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.locator('#leaderboard-table tbody')).toContainText(
    'No matching runs',
  );
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    snapshot.stats.models_evaluated,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('complete historical results remain readable without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto('/merbench/');
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    snapshot.stats.models_evaluated,
  );
  await expect(
    page.getByText('Legacy · Saturated', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.chart-loading').first()).not.toBeVisible();
  await expect(page.locator('.chart-data table')).toHaveCount(3);
  await page.getByText('View token usage data table', { exact: true }).click();
  await expect(
    page.getByRole('columnheader', { name: 'Average request tokens' }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Average response tokens' }),
  ).toBeVisible();
  await context.close();
});

test('zero-token runs remain visible on the efficiency chart', async ({
  page,
}) => {
  await page.goto('/merbench/');
  await page.locator('#pareto-chart').scrollIntoViewIfNeeded();
  await expect(page.locator('#pareto-chart .plot-container')).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.getByLabel('Hard', { exact: true }).check();
  await page.getByLabel('Amazon', { exact: true }).check();
  await page
    .getByRole('group', { name: 'Compare performance by' })
    .getByRole('button', { name: 'Tokens', exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator('#pareto-chart').evaluate((element) => {
        const plot = element as HTMLElement & {
          _fullLayout?: { xaxis: { type: string } };
          data?: Array<{ mode: string; x: number[]; text: string[] }>;
        };
        const points = plot.data?.find((trace) => trace.mode === 'markers');
        const index = points?.text.indexOf('nova-pro-v1:0') ?? -1;
        return {
          scale: plot._fullLayout?.xaxis.type,
          zeroTokens: index >= 0 ? points?.x[index] : undefined,
        };
      }),
    )
    .toEqual({ scale: 'linear', zeroTokens: 0 });
});

test('chart data tables preserve the plot values, including zero measurements', () => {
  const filtered = getFilteredData(
    ['easy'],
    [zeroRun, { ...zeroRun, Metric_request_tokens: 20 }],
    [{ Model: 'zero-cost', test_group: 'easy', Score_MermaidDiagramValid: 1 }],
    ['Local'],
  );
  const tables = getChartTables(filtered);
  expect(tables['test-group-chart'].rows).toEqual([['zero-cost', '100%']]);
  expect(tables['token-chart'].rows).toEqual([['zero-cost', '10', '10']]);
  expect(tables['failure-analysis-chart'].rows).toEqual([
    ['zero-cost', '0', '0', '0'],
  ]);
});

test('the initial archive is small and sortable before chart data or Plotly loads', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/plotly-basic|merbench_data.*\.json/.test(request.url()))
      requests.push(request.url());
  });
  const response = await page.goto('/merbench/');
  expect((await response!.body()).length).toBeLessThan(150000);
  await page
    .getByRole('button', { name: 'Cost / run', exact: true })
    .press('Enter');
  await expect(page.locator('th[aria-sort]')).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  expect(requests).toEqual([]);
  await page.locator('#pareto-chart').scrollIntoViewIfNeeded();
  await expect(page.locator('#pareto-chart .plot-container')).toBeVisible();
  expect(requests.filter((url) => /plotly-basic/.test(url))).toHaveLength(1);
  expect(
    requests.filter((url) => /merbench_data.*\.json/.test(url)),
  ).toHaveLength(1);
  await expect(
    page.locator('#failure-analysis-chart .plot-container'),
  ).toHaveCount(0);
});

test('filter changes during snapshot loading keep the latest selection', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/merbench_data.*\.json/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/merbench/');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.getByLabel('Easy', { exact: true }).check();
  await page.getByLabel('Amazon', { exact: true }).check();
  release();
  const expected = getFilteredData(
    ['easy'],
    snapshot.raw_data,
    snapshot.test_groups_data,
    ['Amazon'],
  );
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    expected.leaderboard.length,
  );
  await expect(page.locator('#filter-status')).toHaveText(
    `${expected.rawData.length.toLocaleString('en-GB')} runs across ${expected.leaderboard.length} models match your filters.`,
  );
  const providers = await page
    .locator('#leaderboard-table tbody td:last-child')
    .allTextContents();
  expect(providers.every((provider) => provider === 'Amazon')).toBe(true);
  const rows = await page.locator('#token-chart-data tbody tr').count();
  expect(rows).toBe(expected.leaderboard.length);
});

test('chart load failure leaves filters and data tables usable', async ({
  page,
}) => {
  await page.route(/plotly-basic.*\.js/, (route) => route.abort());
  await page.goto('/merbench/');
  await page.locator('#pareto-chart').scrollIntoViewIfNeeded();
  await expect(page.locator('#chart-loading-pareto-chart')).toContainText(
    'Use the data table',
  );
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.locator('#filter-status')).toHaveText(
    '0 runs across 0 models match your filters.',
  );
  await expect(page.locator('#token-chart-data tbody')).toContainText(
    'No matching runs',
  );
});

test('filters remain responsive while Plotly loads and charts use the latest choice', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let loading!: () => void;
  const requested = new Promise<void>((resolve) => {
    loading = resolve;
  });
  await page.route(/plotly-basic.*\.js/, async (route) => {
    loading();
    await gate;
    await route.continue();
  });
  await page.goto('/merbench/');
  await page.locator('#pareto-chart').scrollIntoViewIfNeeded();
  await requested;
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.locator('#filter-status')).toHaveText(
    '0 runs across 0 models match your filters.',
  );
  await page.getByLabel('Easy', { exact: true }).check();
  await page.getByLabel('Amazon', { exact: true }).check();
  const expected = getFilteredData(
    ['easy'],
    snapshot.raw_data,
    snapshot.test_groups_data,
    ['Amazon'],
  );
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    expected.leaderboard.length,
  );
  await page.getByRole('button', { name: 'Time', exact: true }).click();
  release();
  await expect(page.locator('#pareto-chart .plot-container')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('#pareto-chart').evaluate((el) => {
        const plot = el as HTMLElement & {
          layout?: { xaxis: { title: { text: string } } };
          data?: Array<{ mode: string; text?: string[] }>;
        };
        return {
          axis: plot.layout?.xaxis.title.text,
          models: plot.data
            ?.find((trace) => trace.mode === 'markers')
            ?.text?.slice()
            .sort(),
        };
      }),
    )
    .toEqual({
      axis: 'Average Duration (seconds)',
      models: expected.leaderboard.map((entry) => entry.Model).sort(),
    });
});

test('URL state validates enums, preserves unknown params/hashes, and separates empty from default', () => {
  const options = {
    difficulties: ['easy', 'medium', 'hard'],
    providers: snapshot.stats.providers,
  };
  expect(parseMerbenchUrl('/merbench/', options)).toEqual({
    difficulties: ['easy', 'medium', 'hard'],
    providers: snapshot.stats.providers,
    sort: 'Success_Rate',
    dir: 'desc',
    metric: 'cost',
  });
  expect(
    parseMerbenchUrl(
      '/merbench/?difficulty=none&provider=&sort=Avg_Cost&metric=tokens',
      options,
    ),
  ).toEqual({
    difficulties: [],
    providers: [],
    sort: 'Avg_Cost',
    dir: 'asc',
    metric: 'tokens',
  });
  expect(
    parseMerbenchUrl(
      '/merbench/?difficulty=bogus&provider=nope&sort=fake&dir=sideways&metric=fps',
      options,
    ),
  ).toEqual({
    difficulties: ['easy', 'medium', 'hard'],
    providers: snapshot.stats.providers,
    sort: 'Success_Rate',
    dir: 'desc',
    metric: 'cost',
  });
  expect(
    parseMerbenchUrl(
      '/merbench/?difficulty=hard,easy,bogus&provider=OpenAI&provider=unknown',
      options,
    ),
  ).toEqual({
    difficulties: ['easy', 'hard'],
    providers: ['OpenAI'],
    sort: 'Success_Rate',
    dir: 'desc',
    metric: 'cost',
  });
  expect(
    buildMerbenchUrl(
      '/merbench/?utm_source=hn&tag=a&tag=b&difficulty=hard#pareto-chart',
      {
        difficulties: [],
        providers: ['OpenAI'],
        sort: 'Avg_Duration',
        dir: 'asc',
        metric: 'time',
      },
      options,
    ),
  ).toBe(
    '/merbench/?utm_source=hn&tag=a&tag=b&difficulty=none&provider=OpenAI&sort=Avg_Duration&dir=asc&metric=time#pareto-chart',
  );
  expect(
    buildMerbenchUrl(
      '/merbench/?utm_source=hn&difficulty=none&sort=Avg_Cost&dir=asc&metric=time#top',
      {
        difficulties: ['easy', 'medium', 'hard'],
        providers: snapshot.stats.providers,
        sort: 'Success_Rate',
        dir: 'desc',
        metric: 'cost',
      },
      options,
    ),
  ).toBe('/merbench/?utm_source=hn#top');
});

test('failed fetch after Clear all preserves stale rows and recovers via keyboard Retry', async ({
  page,
}) => {
  let failData = true;
  await page.route(/merbench_data.*\.json/, async (route) => {
    if (failData) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto('/merbench/');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    snapshot.stats.models_evaluated,
  );
  await expect(page.locator('#leaderboard-table tbody')).not.toContainText(
    'No matching runs',
  );
  await expect(page.locator('#filter-status')).toContainText(/stale/i);
  const retryButton = page.getByRole('button', { name: 'Retry', exact: true });
  await expect(retryButton).toBeVisible();

  failData = false;
  await retryButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('#filter-status')).toHaveText(
    '0 runs across 0 models match your filters.',
  );
  await expect(page.locator('#leaderboard-table tbody')).toContainText(
    'No matching runs',
  );
  await expect(page.locator('#token-chart-data tbody')).toContainText(
    'No matching runs',
  );
  await expect(retryButton).toBeHidden();
  await expect(page.locator('#filter-status')).toBeFocused();
});

test('Retry applies the latest filter selection changed during recovery', async ({
  page,
}) => {
  let mode: 'fail' | 'gate' | 'ok' = 'fail';
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const retryStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route(/merbench_data.*\.json/, async (route) => {
    if (mode === 'fail') {
      await route.abort();
      return;
    }
    if (mode === 'gate') {
      started();
      await gate;
    }
    await route.continue();
  });

  await page.goto('/merbench/');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  const retryButton = page.getByRole('button', { name: 'Retry', exact: true });
  await expect(retryButton).toBeVisible();

  mode = 'gate';
  await retryButton.click();
  await retryStarted;
  await page.getByLabel('Easy', { exact: true }).check();
  await page.getByLabel('Amazon', { exact: true }).check();
  mode = 'ok';
  release();

  const expected = getFilteredData(
    ['easy'],
    snapshot.raw_data,
    snapshot.test_groups_data,
    ['Amazon'],
  );
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    expected.leaderboard.length,
  );
  await expect(page.locator('#filter-status')).toHaveText(
    `${expected.rawData.length.toLocaleString('en-GB')} runs across ${expected.leaderboard.length} models match your filters.`,
  );
  await expect(retryButton).toBeHidden();
});

test('shared URL, reload, and Back/Forward restore controls, sort, metric, and aria', async ({
  page,
}) => {
  const metrics = page.getByRole('group', { name: 'Compare performance by' });
  const cost = metrics.getByRole('button', { name: 'Cost', exact: true });
  const time = metrics.getByRole('button', { name: 'Time', exact: true });
  const tokens = metrics.getByRole('button', { name: 'Tokens', exact: true });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/plotly-basic|merbench_data.*\.json/.test(request.url()))
      requests.push(request.url());
  });

  // Non-default sort/metric with invalid filter falls back to lazy default data without fetching.
  await page.goto(
    '/merbench/?utm_source=test&difficulty=invalid&sort=Avg_Cost&dir=asc&metric=time#top',
  );
  await expect(
    page.getByRole('button', { name: 'Cost / run', exact: true }).locator('..'),
  ).toHaveAttribute('aria-sort', 'ascending');
  await expect(time).toHaveAttribute('aria-pressed', 'true');
  await expect(cost).toHaveAttribute('aria-pressed', 'false');
  expect(requests).toEqual([]);
  await expect(page).toHaveURL(
    /\/merbench\/\?utm_source=test&sort=Avg_Cost&dir=asc&metric=time#top$/,
  );

  // Shared filtered URL restores controls, rows, sort, metric, unknown params, and hash on load & reload.
  const sharedUrl =
    '/merbench/?utm_source=share&difficulty=easy&provider=OpenAI&sort=Avg_Duration&dir=asc&metric=tokens#sec';
  const expectedOpenAi = getFilteredData(
    ['easy'],
    snapshot.raw_data,
    snapshot.test_groups_data,
    ['OpenAI'],
  );
  const expectedDurationOrder = sortLeaderboard(
    expectedOpenAi.leaderboard,
    'Avg_Duration',
    'asc',
  ).map((entry) => entry.Model);

  await page.goto(sharedUrl);
  for (const step of ['initial', 'reload'] as const) {
    if (step === 'reload') await page.reload();
    await expect(page.getByLabel('Easy', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Medium', { exact: true })).not.toBeChecked();
    await expect(page.getByLabel('Hard', { exact: true })).not.toBeChecked();
    await expect(page.getByLabel('OpenAI', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Amazon', { exact: true })).not.toBeChecked();
    await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
      expectedOpenAi.leaderboard.length,
    );
    await expect(
      page.locator('#leaderboard-table tbody td.model-name'),
    ).toHaveText(expectedDurationOrder);
    await expect(
      page.getByRole('button', { name: 'Duration', exact: true }).locator('..'),
    ).toHaveAttribute('aria-sort', 'ascending');
    await expect(tokens).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(
      /\/merbench\/\?utm_source=share&difficulty=easy&provider=OpenAI&sort=Avg_Duration&dir=asc&metric=tokens#sec$/,
    );
  }

  // Intentional empty persists across reload, and Back/Forward restores every dimension cleanly.
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.locator('#leaderboard-table tbody')).toContainText(
    'No matching runs',
  );
  await expect(page).toHaveURL(
    /utm_source=share&difficulty=none&provider=none&sort=Avg_Duration&dir=asc&metric=tokens#sec$/,
  );
  await page.reload();
  await expect(page.locator('#leaderboard-table tbody')).toContainText(
    'No matching runs',
  );
  await expect(page.getByLabel('Easy', { exact: true })).not.toBeChecked();

  await page.getByLabel('Easy', { exact: true }).check();
  await page.getByLabel('Amazon', { exact: true }).check();
  const expectedAmazon = getFilteredData(
    ['easy'],
    snapshot.raw_data,
    snapshot.test_groups_data,
    ['Amazon'],
  );
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    expectedAmazon.leaderboard.length,
  );
  await page.getByRole('button', { name: 'Cost / run', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cost / run', exact: true }).locator('..'),
  ).toHaveAttribute('aria-sort', 'ascending');
  await time.click();
  await expect(time).toHaveAttribute('aria-pressed', 'true');

  await page.goBack();
  await expect(tokens).toHaveAttribute('aria-pressed', 'true');
  await expect(time).toHaveAttribute('aria-pressed', 'false');

  await page.goBack();
  await expect(
    page.getByRole('button', { name: 'Duration', exact: true }).locator('..'),
  ).toHaveAttribute('aria-sort', 'ascending');
  await expect(
    page.getByRole('button', { name: 'Cost / run', exact: true }).locator('..'),
  ).not.toHaveAttribute('aria-sort');

  await page.goBack();
  await expect(page.getByLabel('Amazon', { exact: true })).not.toBeChecked();
  await expect(page.locator('#leaderboard-table tbody')).toContainText(
    'No matching runs',
  );

  await page.goForward();
  await expect(page.getByLabel('Amazon', { exact: true })).toBeChecked();
  await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(
    expectedAmazon.leaderboard.length,
  );

  await page.goForward();
  await expect(
    page.getByRole('button', { name: 'Cost / run', exact: true }).locator('..'),
  ).toHaveAttribute('aria-sort', 'ascending');

  await page.goForward();
  await expect(time).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/utm_source=share.*#sec$/);
});
