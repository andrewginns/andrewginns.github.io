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
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  // Optional: Add GitHub token for higher rate limits
  const token = import.meta.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    // Fetch user profile
    const profileResponse = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!profileResponse.ok) throw new Error('Failed to fetch profile');
    const profile = await profileResponse.json();

    // Fetch repositories
    const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers });
    if (!reposResponse.ok) throw new Error('Failed to fetch repositories');
    const repos: GitHubRepo[] = await reposResponse.json();

    // For pinned repos, we'll use a GraphQL query (requires authentication)
    // Alternatively, we can use the most starred/recent repos as a fallback
    let pinnedRepos: GitHubRepo[] = [];
    
    if (token) {
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
        const data = await graphqlResponse.json();
        pinnedRepos = data.data.user.pinnedItems.nodes.map((repo: any) => ({
          name: repo.name,
          description: repo.description,
          html_url: repo.url,
          homepage: repo.homepageUrl,
          topics: repo.repositoryTopics.nodes.map((t: any) => t.topic.name),
          language: repo.primaryLanguage?.name || 'Unknown',
          stargazers_count: repo.stargazerCount,
          updated_at: repo.updatedAt,
        }));
      }
    }
    
    // Fallback: Use most starred repos if no pinned repos or no token
    if (pinnedRepos.length === 0) {
      pinnedRepos = repos
        .filter(repo => !repo.fork && repo.description)
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 6);
    }

    return {
      profile,
      repos,
      pinnedRepos,
    };
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    // Return empty data on error
    return {
      profile: null,
      repos: [],
      pinnedRepos: [],
    };
  }
}

// Fetch gists for blog posts
export async function getGitHubGists(username: string) {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
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
    const blogPosts = gists
      .filter((gist: any) => {
        const files = Object.values(gist.files);
        return files.some((file: any) => 
          file.filename.endsWith('.md') && 
          (gist.description?.includes('[blog]') || gist.description?.includes('[post]'))
        );
      })
      .map((gist: any) => {
        const mdFile = Object.values(gist.files).find((file: any) => 
          file.filename.endsWith('.md')
        ) as any;
        
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
    'Accept': 'application/vnd.github.v3+json',
  };
  
  const token = import.meta.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!response.ok) throw new Error('Failed to fetch profile');
    
    const profile = await response.json();
    const bio = profile.bio || "";
    
    // Extract role from bio (look for common patterns)
    const roleMatch = bio.match(/(?:I'm\s+(?:a\s+)?|I\s+am\s+(?:a\s+)?|Currently\s+(?:a\s+)?|Working\s+as\s+(?:a\s+)?)([^.]+(?:Engineer|Scientist|Developer|Manager|Architect|Lead|Director|Consultant))/i);
    const role = roleMatch ? roleMatch[1].trim() : "Lead Machine Learning Engineer";
    
    return {
      company: profile.company || 'Motorway',
      role: role,
      bio: bio,
      profile: profile
    };
  } catch (error) {
    console.error('Error fetching GitHub profile:', error);
    return {
      company: 'Motorway',
      role: 'Lead Machine Learning Engineer',
      bio: '',
      profile: null
    };
  }
}

// Legacy function for backward compatibility
export async function getGitHubCompany(username: string): Promise<string> {
  const profileData = await getGitHubProfile(username);
  return profileData.company;
}

// Cache the data at build time
let cachedData: any = null;
let cachedGists: any = null;
let cachedProfile: any = null;

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

// Legacy function for backward compatibility
export async function getCachedGitHubCompany(username: string): Promise<string> {
  const profile = await getCachedGitHubProfile(username);
  return profile.company;
}