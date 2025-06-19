import { getCachedGitHubProfile } from './github.ts';

// Calculate years of experience from April 2019
function calculateYearsOfExperience(): number {
  const startDate = new Date(2019, 3); // April 2019 (month is 0-indexed)
  const currentDate = new Date();
  return Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

// Generate dynamic intro content
export async function getIntroContent() {
  const githubProfile = await getCachedGitHubProfile('andrewginns');
  const yearsOfExperience = calculateYearsOfExperience();
  
  return {
    role: githubProfile.role,
    company: githubProfile.company,
    yearsOfExperience,
    introText: `I'm a ${githubProfile.role} with ${yearsOfExperience}+ years of experience building scalable ML systems and leading data science teams. Currently working at ${githubProfile.company}, where I'm focused on GenAI as well as supporting our various ML teams to develop MLOps solutions and production-grade ML pipelines.`
  };
}