import { getCachedGitHubData as getCachedData } from '../utils/github-cache';

export interface GitHubRepo {
  name: string;
  description: string;
  html_url: string;
  homepage: string | null;
  topics: string[];
  language: string;
  stargazers_count: number;
  updated_at: string;
  fork?: boolean;
}

export async function getGitHubData(username: string) {
  // Optional: Add GitHub token for higher rate limits
  const token = import.meta.env.GITHUB_TOKEN;

  try {
    console.log(`🔄 Fetching GitHub data for ${username}...`);

    // Fetch user profile with caching and rate limiting
    const profile = await getCachedData(`/users/${username}`);

    // Fetch repositories with caching and rate limiting
    const repos: GitHubRepo[] = await getCachedData(
      `/users/${username}/repos?per_page=100&sort=updated`
    );

    // For pinned repos, we'll use a GraphQL query (requires authentication)
    // Alternatively, we can use the most starred/recent repos as a fallback
    let pinnedRepos: GitHubRepo[] = [];

    if (token) {
      const headers: HeadersInit = {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${token}`,
      };
      // Use GraphQL to get pinned repos
      const graphqlQuery = `
        query {
          user(login: "${username}") {
            pinnedItems(first: 6, types: REPOSITORY) {
              nodes {
                ... on Repository {
                  name
                  description
                  url
                  homepageUrl
                  repositoryTopics(first: 10) {
                    nodes {
                      topic {
                        name
                      }
                    }
                  }
                  primaryLanguage {
                    name
                  }
                  stargazerCount
                  updatedAt
                }
              }
            }
          }
        }
      `;

      const graphqlResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: graphqlQuery }),
      });

      if (graphqlResponse.ok) {
        const data: GitHubGraphQLResponse = await graphqlResponse.json();
        pinnedRepos = data.data.user.pinnedItems.nodes.map((repo) => ({
          name: repo.name,
          description: repo.description,
          html_url: repo.url,
          homepage: repo.homepageUrl,
          topics: repo.repositoryTopics.nodes.map((t) => t.topic.name),
          language: repo.primaryLanguage?.name || 'Unknown',
          stargazers_count: repo.stargazerCount,
          updated_at: repo.updatedAt,
        }));
        console.log(`✅ Successfully fetched ${pinnedRepos.length} pinned repos via GraphQL`);
      }
    }

    // Fallback: Use most starred repos if no pinned repos or no token
    if (pinnedRepos.length === 0) {
      pinnedRepos = repos
        .filter((repo) => !repo.fork && repo.description)
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 6);
      console.log(
        `⚠️  Using fallback: top ${pinnedRepos.length} starred repos (no pinned repos found)`
      );
    }

    console.log(
      `✅ GitHub data fetched successfully: ${repos.length} repos, ${pinnedRepos.length} featured`
    );
    return {
      profile,
      repos,
      pinnedRepos,
    };
  } catch (error) {
    console.error('❌ Error fetching GitHub data:', error);
    console.log('⚠️  Using fallback: returning empty data');
    // Return empty data on error
    return {
      profile: null,
      repos: [],
      pinnedRepos: [],
    };
  }
}

interface GitHubGraphQLResponse {
  data: {
    user: {
      pinnedItems: {
        nodes: Array<{
          name: string;
          description: string;
          url: string;
          homepageUrl: string;
          repositoryTopics: {
            nodes: Array<{
              topic: {
                name: string;
              };
            }>;
          };
          primaryLanguage?: {
            name: string;
          };
          stargazerCount: number;
          updatedAt: string;
        }>;
      };
    };
  };
}

interface GitHubGist {
  id: string;
  description: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  files: Record<
    string,
    {
      filename: string;
      raw_url: string;
    }
  >;
}

interface GitHubProfile {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string | null;
  url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

interface BlogPost {
  id: string;
  title: string;
  url: string;
  created_at: string;
  updated_at: string;
  filename: string;
  raw_url: string;
}

interface CachedData {
  profile: GitHubProfile | null;
  repos: GitHubRepo[];
  pinnedRepos: GitHubRepo[];
}

interface CachedProfileData {
  company: string;
  role: string;
  bio: string;
  profile: GitHubProfile;
}

// Fetch gists for blog posts
export async function getGitHubGists(username: string) {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  const token = import.meta.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(`https://api.github.com/users/${username}/gists`, { headers });
    if (!response.ok) throw new Error('Failed to fetch gists');

    const gists = await response.json();

    // Filter for blog posts (gists with .md files and specific tags)
    const blogPosts: BlogPost[] = gists
      .filter((gist: GitHubGist) => {
        const files = Object.values(gist.files);
        return files.some(
          (file) =>
            file.filename.endsWith('.md') &&
            (gist.description?.includes('[blog]') || gist.description?.includes('[post]'))
        );
      })
      .map((gist: GitHubGist) => {
        const mdFile = Object.values(gist.files).find((file) => file.filename.endsWith('.md'));

        if (!mdFile) {
          throw new Error('No markdown file found in gist');
        }

        return {
          id: gist.id,
          title: gist.description.replace(/\[blog\]|\[post\]/gi, '').trim(),
          url: gist.html_url,
          created_at: gist.created_at,
          updated_at: gist.updated_at,
          filename: mdFile.filename,
          raw_url: mdFile.raw_url,
        };
      });

    return blogPosts;
  } catch (error) {
    console.error('Error fetching gists:', error);
    return [];
  }
}

// Fetch profile information from GitHub (company, role, etc.)
export async function getGitHubProfile(username: string) {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  const token = import.meta.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!response.ok) throw new Error('Failed to fetch profile');

    const profile: GitHubProfile = await response.json();
    const bio = profile.bio || '';

    // Extract role from bio (look for common patterns)
    const roleMatch = bio.match(
      /(?:I'm\s+(?:a\s+)?|I\s+am\s+(?:a\s+)?|Currently\s+(?:a\s+)?|Working\s+as\s+(?:a\s+)?)([^.]+(?:Engineer|Scientist|Developer|Manager|Architect|Lead|Director|Consultant))/i
    );
    const role = roleMatch ? roleMatch[1].trim() : 'AI Solutions Architect';

    return {
      company: profile.company || 'Motorway',
      role: role,
      bio: bio,
      profile: profile,
    };
  } catch (error) {
    console.error('Error fetching GitHub profile:', error);
    // Return a default profile structure when there's an error
    const defaultProfile: GitHubProfile = {
      login: username,
      id: 0,
      node_id: '',
      avatar_url: '/andrew-headshot.jpeg', // Fallback to local image
      gravatar_id: null,
      url: `https://api.github.com/users/${username}`,
      html_url: `https://github.com/${username}`,
      name: 'Andrew Ginns',
      company: 'Motorway',
      blog: null,
      location: null,
      email: null,
      bio: '',
      twitter_username: null,
      public_repos: 0,
      public_gists: 0,
      followers: 0,
      following: 0,
      created_at: '',
      updated_at: '',
    };

    return {
      company: 'Google',
      role: 'AI Solutions Architect',
      bio: '',
      profile: defaultProfile,
    };
  }
}

// Legacy function for backward compatibility
export async function getGitHubCompany(username: string): Promise<string> {
  const profileData = await getGitHubProfile(username);
  return profileData.company;
}

// Cache the data at build time
let cachedData: CachedData | null = null;
let cachedGists: BlogPost[] | null = null;
let cachedProfile: CachedProfileData | null = null;

export async function getCachedGitHubData(username: string) {
  if (!cachedData) {
    cachedData = await getGitHubData(username);
  }
  return cachedData;
}

export async function getCachedGitHubGists(username: string) {
  if (!cachedGists) {
    cachedGists = await getGitHubGists(username);
  }
  return cachedGists;
}

export async function getCachedGitHubProfile(username: string) {
  if (!cachedProfile) {
    cachedProfile = await getGitHubProfile(username);
  }
  return cachedProfile;
}

// Fetch last commit information for a specific file
export async function getFileLastCommit(
  owner: string,
  repo: string,
  path: string
): Promise<{ date: string; sha: string; message: string } | null> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  const token = import.meta.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const fetchWithTimeout = (url: string, options: RequestInit, timeout = 5000) => {
    return Promise.race([
      fetch(url, options),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  };

  try {
    console.log(`🔄 Fetching last commit for ${owner}/${repo}/${path}...`);

    const response = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`,
      { headers }
    );

    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch commit info: ${response.status}`);
      return null;
    }

    const commits = await response.json();

    if (!Array.isArray(commits) || commits.length === 0) {
      console.warn('⚠️  No commits found for file');
      return null;
    }

    const lastCommit = commits[0];
    console.log(`✅ Last commit fetched: ${lastCommit.sha.substring(0, 7)}`);

    return {
      date: lastCommit.commit.committer.date,
      sha: lastCommit.sha,
      message: lastCommit.commit.message,
    };
  } catch (error) {
    console.error('❌ Error fetching file commit info:', error);
    return null;
  }
}

// Cache for file commit data
const cachedFileCommits: Record<string, { date: string; sha: string; message: string } | null> = {};

export async function getCachedFileLastCommit(
  owner: string,
  repo: string,
  path: string
): Promise<{ date: string; sha: string; message: string } | null> {
  const cacheKey = `${owner}/${repo}/${path}`;

  if (!cachedFileCommits[cacheKey]) {
    cachedFileCommits[cacheKey] = await getFileLastCommit(owner, repo, path);
  }

  return cachedFileCommits[cacheKey];
}

// Legacy function for backward compatibility
export async function getCachedGitHubCompany(username: string): Promise<string> {
  const profile = await getCachedGitHubProfile(username);
  return profile.company;
}
