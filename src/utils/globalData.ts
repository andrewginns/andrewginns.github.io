import { getCachedGitHubData } from '../lib/github';
import { getTopTags } from './tagAggregator';

let cachedTopTags: string[] | null = null;

export async function getTopProjectTags(limit: number = 7): Promise<string[]> {
  if (cachedTopTags) {
    console.log('✅ Using cached top tags');
    return cachedTopTags;
  }

  try {
    console.log('🔄 Fetching top project tags...');
    const githubData = await getCachedGitHubData('andrewginns');

    if (!githubData.repos || githubData.repos.length === 0) {
      console.log('⚠️  No GitHub repos found, using default tags');
      return getDefaultTags();
    }

    // Filter out forked repositories to only include owned repos
    const ownedRepos = githubData.repos.filter((repo) => !repo.fork);

    if (ownedRepos.length === 0) {
      console.log('⚠️  No owned GitHub repos found, using default tags');
      return getDefaultTags();
    }

    // Use a consistent seed to ensure stable output during build
    const seed = 42; // Fixed seed for consistent builds
    const topTags = getTopTags(ownedRepos, limit, seed);

    console.log(
      `✅ Extracted ${topTags.length} tags from ${ownedRepos.length} owned GitHub repos (out of ${githubData.repos.length} total): ${topTags.join(', ')}`
    );
    cachedTopTags = topTags;
    return topTags;
  } catch (error) {
    console.error('❌ Error fetching top project tags:', error);
    console.log('⚠️  Using fallback: default tags');
    return getDefaultTags();
  }
}

function getDefaultTags(): string[] {
  return [
    'mlops',
    'genai',
    'python',
    'ci-cd',
    'data',
    'edge-ml',
    'ai',
    'machine-learning',
    'kubernetes',
    'docker',
  ];
}
