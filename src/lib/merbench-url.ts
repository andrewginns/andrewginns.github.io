export const MERBENCH_SORT_KEYS = [
  'Model',
  'Success_Rate',
  'Avg_Cost',
  'Price_per_Success',
  'Avg_Duration',
  'Avg_Tokens',
  'Runs',
  'Provider',
] as const;

export type MerbenchSortKey = (typeof MERBENCH_SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

export const MERBENCH_METRICS = ['cost', 'time', 'tokens'] as const;
export type MerbenchMetric = (typeof MERBENCH_METRICS)[number];

export interface MerbenchFilterOptions {
  difficulties: readonly string[];
  providers: readonly string[];
}

export interface MerbenchUrlState {
  difficulties: string[];
  providers: string[];
  sort: MerbenchSortKey;
  dir: SortDirection;
  metric: MerbenchMetric;
}

export const DEFAULT_SORT_KEY: MerbenchSortKey = 'Success_Rate';
export const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';
export const DEFAULT_METRIC: MerbenchMetric = 'cost';
export const EMPTY_FILTER_SENTINEL = 'none';

const OWNED_PARAMS = [
  'difficulty',
  'provider',
  'sort',
  'dir',
  'metric',
] as const;

export function getDefaultSortDirection(key: MerbenchSortKey): SortDirection {
  return key === 'Model' ||
    key === 'Provider' ||
    key === 'Avg_Cost' ||
    key === 'Price_per_Success' ||
    key === 'Avg_Duration'
    ? 'asc'
    : 'desc';
}

export function isMerbenchSortKey(
  value: string | null | undefined,
): value is MerbenchSortKey {
  return (
    value != null && (MERBENCH_SORT_KEYS as readonly string[]).includes(value)
  );
}

export function isSortDirection(
  value: string | null | undefined,
): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

export function isMerbenchMetric(
  value: string | null | undefined,
): value is MerbenchMetric {
  return (
    value != null && (MERBENCH_METRICS as readonly string[]).includes(value)
  );
}

function toUrl(input: string | URL): URL {
  if (input instanceof URL) return new URL(input.href);
  return new URL(input, 'http://localhost');
}

function parseSelectionParam(
  params: URLSearchParams,
  key: string,
  allowed: readonly string[],
): string[] {
  if (!params.has(key)) return [...allowed];
  const tokens = params
    .getAll(key)
    .flatMap((entry) => entry.split(','))
    .map((token) => token.trim());
  const sentinelAllowed = !allowed.includes(EMPTY_FILTER_SENTINEL);
  if (
    tokens.length > 0 &&
    tokens.every(
      (token) =>
        token === '' || (sentinelAllowed && token === EMPTY_FILTER_SENTINEL),
    )
  ) {
    return [];
  }
  const valid = new Set(tokens.filter((token) => allowed.includes(token)));
  if (!valid.size) return [...allowed];
  return allowed.filter((value) => valid.has(value));
}

export function parseMerbenchUrl(
  input: string | URL,
  options: MerbenchFilterOptions,
): MerbenchUrlState {
  const { searchParams } = toUrl(input);
  const difficulties = parseSelectionParam(
    searchParams,
    'difficulty',
    options.difficulties,
  );
  const providers = parseSelectionParam(
    searchParams,
    'provider',
    options.providers,
  );
  const rawSort = searchParams.get('sort');
  const sort = isMerbenchSortKey(rawSort) ? rawSort : DEFAULT_SORT_KEY;
  const rawDir = searchParams.get('dir');
  const dir = isSortDirection(rawDir) ? rawDir : getDefaultSortDirection(sort);
  const rawMetric = searchParams.get('metric');
  const metric = isMerbenchMetric(rawMetric) ? rawMetric : DEFAULT_METRIC;
  return { difficulties, providers, sort, dir, metric };
}

export function serializeFilterKey(
  difficulties: readonly string[],
  providers: readonly string[],
  options: MerbenchFilterOptions,
): string {
  const difficultySet = new Set(difficulties);
  const providerSet = new Set(providers);
  const normalizedDifficulties = options.difficulties.filter((value) =>
    difficultySet.has(value),
  );
  const normalizedProviders = options.providers.filter((value) =>
    providerSet.has(value),
  );
  return `${normalizedDifficulties.join(',')}|${normalizedProviders.join(',')}`;
}

function writeSelectionParam(
  params: URLSearchParams,
  key: string,
  selected: readonly string[],
  allowed: readonly string[],
): void {
  const selectedSet = new Set(selected);
  const canonical = allowed.filter((value) => selectedSet.has(value));
  if (!canonical.length) {
    params.set(key, EMPTY_FILTER_SENTINEL);
    return;
  }
  if (canonical.length === allowed.length) return;
  for (const value of canonical) params.append(key, value);
}

export function buildMerbenchUrl(
  currentUrl: string | URL,
  state: MerbenchUrlState,
  options: MerbenchFilterOptions,
): string {
  const url = toUrl(currentUrl);
  for (const key of OWNED_PARAMS) url.searchParams.delete(key);

  writeSelectionParam(
    url.searchParams,
    'difficulty',
    state.difficulties,
    options.difficulties,
  );
  writeSelectionParam(
    url.searchParams,
    'provider',
    state.providers,
    options.providers,
  );

  const sort = isMerbenchSortKey(state.sort) ? state.sort : DEFAULT_SORT_KEY;
  const dir = isSortDirection(state.dir)
    ? state.dir
    : getDefaultSortDirection(sort);
  if (sort !== DEFAULT_SORT_KEY || dir !== DEFAULT_SORT_DIRECTION) {
    url.searchParams.set('sort', sort);
    url.searchParams.set('dir', dir);
  }

  const metric = isMerbenchMetric(state.metric) ? state.metric : DEFAULT_METRIC;
  if (metric !== DEFAULT_METRIC) {
    url.searchParams.set('metric', metric);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
