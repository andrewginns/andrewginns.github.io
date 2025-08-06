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
    introText: `I'm a ${githubProfile.role} with ${yearsOfExperience}+ years of experience in the AI/ML space. At ${githubProfile.company}, I help customers benefit from AI by designing and implementing solution architectures to meet their business needs.`
  };
}