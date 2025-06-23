import type { GitHubRepo } from '../lib/github';

export interface TagCount {
  tag: string;
  count: number;
}

export function aggregateTagsFromRepos(repos: GitHubRepo[]): TagCount[] {
  const tagCounts = new Map<string, number>();

  repos.forEach((repo) => {
    if (repo.topics && Array.isArray(repo.topics)) {
      repo.topics.forEach((topic: string) => {
        const normalizedTopic = topic.toLowerCase().trim();
        if (normalizedTopic) {
          tagCounts.set(normalizedTopic, (tagCounts.get(normalizedTopic) || 0) + 1);
        }
      });
    }
  });

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function getTopTags(repos: GitHubRepo[], limit: number = 10, seed?: number): string[] {
  const aggregatedTags = aggregateTagsFromRepos(repos);

  if (aggregatedTags.length <= limit) {
    return aggregatedTags.map((item) => item.tag);
  }

  const topTags: string[] = [];
  let currentRank = 0;
  let currentCount = -1;
  let tieBreakers: string[] = [];

  for (const { tag, count } of aggregatedTags) {
    if (count !== currentCount) {
      if (tieBreakers.length > 0 && currentRank < limit) {
        const remaining = limit - topTags.length;
        if (tieBreakers.length <= remaining) {
          topTags.push(...tieBreakers);
        } else {
          const selected = selectFromTies(tieBreakers, remaining, seed);
          topTags.push(...selected);
        }
      }

      if (topTags.length >= limit) break;

      currentCount = count;
      currentRank = topTags.length;
      tieBreakers = [tag];
    } else {
      tieBreakers.push(tag);
    }
  }

  if (topTags.length < limit && tieBreakers.length > 0) {
    const remaining = limit - topTags.length;
    const selected = selectFromTies(tieBreakers, remaining, seed);
    topTags.push(...selected);
  }

  return topTags.slice(0, limit);
}

function selectFromTies(ties: string[], count: number, seed?: number): string[] {
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;

  const shuffled = [...ties].sort(() => rng() - 0.5);
  return shuffled.slice(0, count);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function formatTagForDisplay(tag: string): string {
  // Convert kebab-case to Title Case with spaces
  const formatted = tag
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // If the formatted tag is too long, return a shortened version
  if (formatted.length > 15) {
    // Try to abbreviate common words
    return formatted
      .replace(/Machine Learning/i, 'ML')
      .replace(/Artificial Intelligence/i, 'AI')
      .replace(/Continuous Integration/i, 'CI')
      .replace(/Continuous Deployment/i, 'CD')
      .replace(/Development/i, 'Dev')
      .replace(/Operations/i, 'Ops')
      .replace(/Infrastructure/i, 'Infra');
  }

  return formatted;
}

export function formatTagForFloatingElement(tag: string): string {
  // Special formatting for floating elements to keep them compact
  const formatted = tag
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Common abbreviations for floating elements
  const abbreviations: Record<string, string> = {
    'machine-learning': 'ML',
    'artificial-intelligence': 'AI',
    'deep-learning': 'Deep Learning',
    'computer-vision': 'Computer Vision',
    'natural-language-processing': 'NLP',
    'generative-ai': 'GenAI',
    'continuous-integration': 'CI/CD',
    'continuous-deployment': 'CI/CD',
    'infrastructure-as-code': 'IaC',
    'edge-computing': 'Edge ML',
    'data-science': 'Data Science',
    'data-engineering': 'Data Eng',
    devops: 'DevOps',
    mlops: 'MLOps',
    python: 'Python',
    tensorflow: 'TensorFlow',
    pytorch: 'PyTorch',
    kubernetes: 'K8s',
    docker: 'Docker',
    'agents-sdk': 'Agents SDK',
    'adk-python': 'ADK Python',
    llm: 'LLM',
    openai: 'OpenAI',
    gemini: 'Gemini',
    logfire: 'Logfire',
    agents: 'AI Agents',
  };

  // Check if we have a specific abbreviation for this tag
  const lowerTag = tag.toLowerCase();
  if (abbreviations[lowerTag]) {
    return abbreviations[lowerTag];
  }

  // For tags with multiple words, try to create smart abbreviations
  const words = formatted.split(' ');
  if (words.length > 2 && formatted.length > 15) {
    // Take first letter of each word for very long multi-word tags
    const acronym = words.map((w) => w.charAt(0)).join('');
    if (acronym.length <= 5) {
      return acronym.toUpperCase();
    }
  }

  // If still too long but not multi-word, keep it as is (wrapping will handle it)
  // Don't truncate with ellipsis since we now have text wrapping
  return formatted;
}
