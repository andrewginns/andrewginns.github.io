import { expect, test } from '@playwright/test';
import {
  formatCost,
  getFilteredData,
  processChartData,
  sortLeaderboard,
} from '../src/lib/merbench';
import type { RawData, LeaderboardEntry } from '../src/lib/merbench-types';
import snapshot from '../src/data/merbench_data.json' with { type: 'json' };

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
  await page.getByRole('switch', { name: 'Dark mode' }).click();
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
  await context.close();
});

test('zero-token runs remain visible on the efficiency chart', async ({
  page,
}) => {
  await page.goto('/merbench/');
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
