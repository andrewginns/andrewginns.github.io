import { featuredProjects } from '../data/projects';

export interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  topics: string[];
  language: string | null;
  stargazers_count?: number;
  fork?: boolean;
}

// Called only by the projects page, at build time. Editorial content is the fallback.
export async function getFeaturedProjects(): Promise<GitHubRepo[]> {
  const token = import.meta.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (token) {
    try {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          query:
            '{ user(login: "andrewginns") { pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name description url primaryLanguage { name } stargazerCount repositoryTopics(first: 6) { nodes { topic { name } } } } } } } }',
        }),
      });
      if (!response.ok) throw new Error(`GitHub ${response.status}`);
      const result = await response.json();
      const nodes = result.data?.user?.pinnedItems?.nodes;
      if (Array.isArray(nodes) && nodes.length) {
        return nodes.map((repo) => ({
          name: repo.name,
          description: repo.description,
          html_url: repo.url,
          language: repo.primaryLanguage?.name ?? null,
          stargazers_count: repo.stargazerCount,
          topics: repo.repositoryTopics.nodes.map(
            (item: { topic: { name: string } }) => item.topic.name,
          ),
        }));
      }
    } catch {
      console.warn(
        'GitHub pinned projects unavailable; trying public repositories.',
      );
    }
  }
  try {
    const response = await fetch(
      'https://api.github.com/users/andrewginns/repos?per_page=100&sort=updated',
      { headers, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    const repos: GitHubRepo[] = await response.json();
    const projects = repos
      .filter(
        (repo) =>
          !repo.fork &&
          repo.description &&
          repo.name !== 'andrewginns.github.io',
      )
      .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
      .slice(0, 6);
    return projects.length ? projects : featuredProjects;
  } catch {
    console.warn('GitHub unavailable; using curated projects.');
    return featuredProjects;
  }
}
