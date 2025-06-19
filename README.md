# Andrew Ginns - Personal Website

A modern, minimalist personal website for Andrew Ginns, Machine Learning Engineer. Built with Astro for optimal performance and developer experience.

## Overview

This website serves as a digital resume, project showcase, and writing platform, featuring:
- Professional experience and background
- Project portfolio highlighting ML and Data Science work
- Blog for technical writing and industry insights
- Clean, text-centric design inspired by modern minimalism

## Tech Stack

- **Framework**: [Astro](https://astro.build) - Static site generator with excellent performance
- **Language**: TypeScript
- **Styling**: Vanilla CSS with CSS custom properties
- **Deployment**: GitHub Pages & Cloudflare Pages
- **CI/CD**: GitHub Actions

## Project Structure

```
/
├── src/
│   ├── components/       # Reusable Astro components
│   │   └── LastUpdated.astro
│   ├── content/          # Local markdown content
│   │   └── writing/      # Blog posts (optional - can use GitHub)
│   ├── layouts/          # Page layouts
│   │   └── BaseLayout.astro
│   ├── lib/              # Utility functions
│   │   └── github.ts     # GitHub API integration
│   ├── pages/            # Route pages
│   │   ├── index.astro
│   │   ├── experience.astro
│   │   ├── projects.astro  # Auto-fetches from GitHub
│   │   ├── writing.astro
│   │   ├── writing/[...slug].astro
│   │   ├── about.astro
│   │   └── contact.astro
│   └── content.config.ts # Content schemas
├── public/               # Static assets
│   └── favicon.svg
├── .github/workflows/    # CI/CD pipelines
│   ├── deploy.yml        # Main deployment workflow
│   └── update-badge.yml  # Status updates
└── package.json
```

## Local Development

### Prerequisites
- Node.js 18.20.8+ or 20.3.0+
- npm 9.6.5+

### Setup
```bash
# Clone the repository
git clone https://github.com/andrewginns/andrewginns.github.io.git
cd andrewginns.github.io

# Install dependencies
npm install

# Start development server
npm run dev
```

The site will be available at `http://localhost:4321`

### Available Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Start development server |
| `npm run build` | Build production site |
| `npm run preview` | Preview production build locally |
| `astro check` | TypeScript type checking |

## Content Management

### Dynamic GitHub Integration

The website automatically pulls content from GitHub to minimise maintenance:

#### Profile Information
- **Company**: Automatically fetched from your GitHub profile company field
- **Role/Title**: Extracted from your GitHub bio using pattern matching
- **Unified caching**: Single API call per build for optimal performance
- **Fallback values**: Graceful degradation if GitHub API is unavailable

#### Projects
- **Automatic sync**: Projects are pulled from your GitHub pinned repositories
- **No manual updates needed**: Pin/unpin repos on GitHub to update the website
- **Fallback content**: Static projects display if GitHub API is unavailable

#### Blog Posts (Optional)
You can manage blog posts in two ways:

1. **Local Markdown Files** (current setup):
   - Create `.md` files in `src/content/writing/`
   - Add frontmatter:
   ```yaml
   ---
   title: "Your Post Title"
   description: "Brief description"
   date: 2024-01-18
   tags: ["machine-learning", "mlops"]
   ---
   ```

2. **GitHub Gists** (future enhancement):
   - Create gists with `[blog]` or `[post]` in the description
   - The site can fetch and display these automatically

### GitHub API Configuration

The website uses a unified caching mechanism for all GitHub API calls to optimise performance:

#### Core Functions
- `getCachedGitHubProfile()` - Fetches profile, company, and role information
- `getCachedGitHubData()` - Fetches repository and project data
- `getCachedGitHubGists()` - Fetches blog post content from gists

For better API rate limits and access to GraphQL (pinned repos):

1. Create a GitHub Personal Access Token with `public_repo` scope
2. Add to `.env` file:
   ```
   GITHUB_TOKEN=your_token_here
   ```
3. The build process will use this token when fetching data

**Note**: The site works without a token but may hit rate limits or not show pinned repos. All GitHub API calls include graceful error handling with fallback values.

## Deployment

The site automatically deploys to both GitHub Pages and Cloudflare Pages:

### Automatic Triggers
- **On push**: Deploys when code is pushed to `main` branch
- **Daily rebuild**: Runs at 00:00 UTC to fetch latest GitHub data
- **Manual trigger**: Can be triggered manually from GitHub Actions tab

### Environment Variables in CI/CD
The GitHub Actions workflow automatically provides:
- `GITHUB_TOKEN`: Automatically available in Actions for API access
- No additional configuration needed for basic functionality

For enhanced features (optional):
1. Create a Personal Access Token with `public_repo` scope
2. Add as repository secret: `PERSONAL_GITHUB_TOKEN`
3. Uncomment the relevant line in `.github/workflows/deploy.yml`

### GitHub Pages Setup
1. Enable GitHub Pages in repository settings
2. Set source to "GitHub Actions"
3. The site will be available at `https://andrewginns.github.io`

### Cloudflare Pages Setup
1. Add the following secrets to your GitHub repository:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
2. The workflow will automatically deploy to Cloudflare Pages

### Custom Domain
To use the custom domain `andrew.ginns.uk`:
1. Configure DNS to point to GitHub Pages or Cloudflare Pages
2. Add custom domain in GitHub Pages settings
3. Update `site` in `astro.config.mjs`

## Design Philosophy

The website follows a minimalist, content-first approach:
- Clean typography with system fonts
- Ample whitespace for readability
- Fixed sidebar navigation (responsive on mobile)
- Subtle color palette with high contrast
- No unnecessary visual elements
- Focus on content and user experience

## Contributing

While this is a personal website, suggestions and bug reports are welcome. Please open an issue for discussion.

## License

This project is licensed under the MIT License. Content (blog posts, project descriptions) remains copyright of Andrew Ginns.