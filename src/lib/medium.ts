import { XMLParser } from 'fast-xml-parser';

export interface MediumArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  tags: string[];
}
interface RSSItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  category?: string | string[];
}

export async function getMediumArticles(): Promise<MediumArticle[]> {
  try {
    const response = await fetch('https://medium.com/feed/@andrewginns', {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Medium ${response.status}`);
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      processEntities: false,
    });
    const feed = parser.parse(await response.text());
    const items: RSSItem[] = [feed.rss?.channel?.item ?? []].flat();
    return items.flatMap((item) => {
      if (
        !item.title ||
        !item.link ||
        !item.pubDate ||
        !Number.isFinite(Date.parse(item.pubDate))
      )
        return [];
      const url = new URL(item.link);
      if (url.protocol !== 'https:') return [];
      return [
        {
          title: item.title,
          description: (item.description ?? '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 220),
          url: url.href,
          publishedAt: new Date(item.pubDate).toISOString(),
          tags: [item.category ?? []]
            .flat()
            .filter((tag): tag is string => typeof tag === 'string'),
        },
      ];
    });
  } catch {
    console.warn(
      'Medium unavailable; local writing and the publication link remain available.',
    );
    return [];
  }
}
