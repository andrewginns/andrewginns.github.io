interface CacheEntry {
  data: unknown;
  timestamp: number;
  etag?: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

let lastRequestTime = 0;

async function fetchWithRateLimit(url: string, options: RequestInit = {}) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
  return fetch(url, options);
}

export async function getCachedGitHubData(endpoint: string) {
  const cacheKey = `github-${endpoint}`;
  const cached = cache.get(cacheKey);

  // Check cache first
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const headers: HeadersInit = {
      'User-Agent': 'andrew.ginns.uk',
      Accept: 'application/vnd.github.v3+json',
    };

    // Use ETag for conditional requests
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    const response = await fetchWithRateLimit(`https://api.github.com${endpoint}`, { headers });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    // Handle not modified
    if (response.status === 304 && cached) {
      cached.timestamp = Date.now();
      return cached.data;
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const etag = response.headers.get('ETag');

    // Update cache
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      etag: etag || undefined,
    });

    return data;
  } catch (error) {
    // Return cached data if available during errors
    if (cached) {
      return cached.data;
    }
    throw error;
  }
}
