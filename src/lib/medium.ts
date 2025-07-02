import { XMLParser } from 'fast-xml-parser';

export interface MediumArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  tags: string[];
  guid: string;
}

interface MediumRSSFeed {
  rss: {
    channel: {
      title: string;
      description: string;
      link: string;
      item: MediumRSSItem | MediumRSSItem[];
    };
  };
}

interface MediumRSSItem {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  category?: string | string[];
  'content:encoded'?: string;
}

export async function getMediumData(username: string) {
  const fetchWithTimeout = (url: string, timeout = 5000) => {
    return Promise.race([
      fetch(url),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  };

  try {
    console.log(`🔄 Fetching Medium data for @${username}...`);

    const rssUrl = `https://medium.com/feed/@${username}`;
    const response = await fetchWithTimeout(rssUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch Medium RSS: ${response.status}`);
    }

    const xmlText = await response.text();

    // Parse XML with fast-xml-parser
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
    });

    const feedData: MediumRSSFeed = parser.parse(xmlText);

    if (!feedData.rss?.channel?.item) {
      throw new Error('No articles found in Medium RSS feed');
    }

    // Normalize items to array
    const items = Array.isArray(feedData.rss.channel.item)
      ? feedData.rss.channel.item
      : [feedData.rss.channel.item];

    // Transform to our article format
    const articles: MediumArticle[] = items.map((item: MediumRSSItem) => {
      // Clean up description (remove HTML tags and extra whitespace)
      const cleanDescription = item.description
        ? item.description
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        : '';

      // Extract tags from categories
      let tags: string[] = [];
      if (item.category) {
        tags = Array.isArray(item.category) ? item.category : [item.category];
        tags = tags.filter((tag) => tag && typeof tag === 'string');
      }

      return {
        title: item.title || 'Untitled',
        description:
          cleanDescription.length > 200
            ? cleanDescription.substring(0, 200) + '...'
            : cleanDescription,
        url: item.link || '',
        publishedAt: item.pubDate || '',
        tags: tags,
        guid: item.guid || item.link || '',
      };
    });

    console.log(`✅ Successfully fetched ${articles.length} Medium articles`);

    return {
      articles,
      feedInfo: {
        title: feedData.rss.channel.title || '',
        description: feedData.rss.channel.description || '',
        link: feedData.rss.channel.link || '',
      },
    };
  } catch (error) {
    console.error('❌ Error fetching Medium data:', error);
    console.log('⚠️  Using fallback: returning empty data');

    return {
      articles: [],
      feedInfo: {
        title: '',
        description: '',
        link: '',
      },
    };
  }
}

interface CachedMediumData {
  articles: MediumArticle[];
  feedInfo: {
    title: string;
    description: string;
    link: string;
  };
}

// Cache the data at build time
let cachedData: CachedMediumData | null = null;

export async function getCachedMediumData(username: string) {
  if (!cachedData) {
    cachedData = await getMediumData(username);
  }
  return cachedData;
}

// Helper function to format date for display
export function formatMediumDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    console.warn('Error formatting date:', dateString);
    return dateString;
  }
}

// Helper function to get unique tags from articles
export function getMediumTags(articles: MediumArticle[]): string[] {
  const allTags = articles.flatMap((article) => article.tags);
  const uniqueTags = [...new Set(allTags)];
  return uniqueTags.filter((tag) => tag.trim().length > 0);
}
