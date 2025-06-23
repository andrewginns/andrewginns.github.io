# Andrew Ginns - Personal Website ✨

Welcome! This is the source code for my personal website, [andrew.ginns.uk](https://andrew.ginns.uk). If you've arrived here from my site, hello!

This repository showcases how a modern, minimalist personal website can be built with [Astro](https://astro.build) for optimum performance and a fantastic developer experience. It's designed to be a living digital CV, project showcase, and a space for technical writing.

## 🌐 Live Demo

Check out the live website at: **[andrew.ginns.uk](https://andrew.ginns.uk)**

## ✨ Key Features

*   **Blazing Fast Performance**: Built with Astro for a lightweight, super-fast static site.
*   **Dynamic Content**: Automatically syncs profile information and projects from my GitHub profile.
*   **Minimalist Design**: Clean, text-centric, and responsive, focusing on content and readability.
*   **Blog Ready**: Easily manage blog posts using local Markdown files.
*   **Developer Friendly**: Uses TypeScript, Prettier, ESLint, and Husky for a smooth development workflow.
*   **Dual Deployment**: Continuously deployed to both GitHub Pages and Cloudflare Pages.

## Tech Stack

- **Framework**: [Astro](https://astro.build) - Static site generator with excellent performance
- **Language**: TypeScript
- **Styling**: Vanilla CSS with CSS custom properties
- **Deployment**: GitHub Pages & Cloudflare Pages
- **CI/CD**: GitHub Actions

## 📂 Project Structure

```
/
├── .env.example          # Example environment variables
├── .github/              # GitHub Actions workflows
│   └── workflows/
│       ├── deploy.yml       # Main deployment to GitHub Pages & Cloudflare
│       ├── dev-deploy.yml   # Deployment for development branches
│       └── update-badge.yml # Workflow to update status badges
├── .husky/               # Git hooks for pre-commit checks
│   └── pre-commit
├── .vscode/              # VSCode editor settings
│   ├── extensions.json
│   ├── launch.json
│   └── settings.json
├── public/               # Static assets (images, favicon, etc.)
│   ├── andrew-headshot.jpeg
│   └── favicon.svg
├── scripts/              # Utility and automation scripts
│   ├── capture-*.ts       # Various screenshot capture scripts
│   ├── test-*.ts          # Scripts for specific test scenarios
│   ├── package.json       # Scripts-specific package config
│   └── tsconfig.json      # TypeScript config for scripts
├── src/                  # Main source code
│   ├── components/       # Reusable Astro components (UI building blocks)
│   │   ├── Footer.astro
│   │   ├── HeroCard.astro
│   │   ├── LastUpdated.astro
│   │   ├── LoadingSpinner.astro
│   │   ├── OptimisedImage.astro
│   │   ├── ProjectCard.astro
│   │   └── SkeletonCard.astro
│   ├── content/          # Markdown content collections
│   │   └── writing/      # Blog posts
│   │       └── .gitkeep  # Placeholder, add your .md files here
│   ├── layouts/          # Page layouts (structure for pages)
│   │   └── BaseLayout.astro
│   ├── lib/              # Core library functions
│   │   ├── content.ts    # Content fetching and processing
│   │   └── github.ts     # GitHub API integration logic
│   ├── pages/            # Astro pages (website routes)
│   │   ├── index.astro   # Homepage
│   │   ├── ...           # Other site pages
│   │   └── contact_me.astro
│   ├── utils/            # Helper utilities
│   │   ├── globalData.ts # Global data and constants
│   │   └── tagAggregator.ts # Logic for aggregating tags
│   └── content.config.ts # Astro content collection schemas
├── tests/                # Playwright end-to-end tests
│   ├── *.spec.ts         # Test specifications for various features
├── .gitignore            # Files and folders ignored by Git
├── .lintstagedrc.json    # Lint-staged config for pre-commit checks
├── .prettierignore       # Files ignored by Prettier formatter
├── .prettierrc.json      # Prettier code formatting rules
├── Makefile              # Common development commands
├── README.md             # You are here!
├── astro.config.mjs      # Astro framework configuration
├── compare-screenshots.ts # Script for visual regression testing
├── eslint.config.ts      # ESLint linting rules
├── mobile-improvements-summary.ts # Script for mobile improvements
├── package-lock.json     # Exact dependency versions
├── package.json          # Project metadata and dependencies
├── playwright.config.ts  # Playwright test runner configuration
└── tsconfig.json         # TypeScript compiler options
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
| `npm run lint` | Lint code using ESLint |
| `npm run format` | Format code using Prettier |
| `npm run validate` | Run type checking, linting, and formatting checks |
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

#### Preview Deployments
- **On Pull Request**: When a Pull Request is opened targeting the `main` branch (or when new commits are pushed to such a PR), a preview deployment is automatically made to GitHub Pages.
- A comment containing a link to this preview deployment is added to the Pull Request, allowing for easy review of changes.

### Environment Variables in CI/CD
The GitHub Actions workflow automatically provides:
- `GITHUB_TOKEN`: Automatically available in Actions for API access. This is used for fetching data from your GitHub profile and repositories during the build process.
- No additional manual token configuration is needed for the core deployment functionality.

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
- Subtle colour palette with high contrast
- No unnecessary visual elements
- Focus on content and user experience

## Contributing

While this is a personal website, suggestions and bug reports are welcome. Please open an issue for discussion.

## 🙏 A Special Thanks

A big thanks to Google Jules and Claude Code for doing the heavy lifting. Couldn't have done it without you, your tireless contributions, bug-hunting prowess, and unconstrained MCP tool use. Cheers, digital comrades! 🤖

## License

This project is licensed under the MIT License. Content (blog posts, project descriptions) remains copyright of Andrew Ginns.

## 💬 Get in Touch

I'm always open to connecting with fellow developers, data enthusiasts, and potential collaborators!

*   **LinkedIn**: [linkedin.com/in/andrewginns](https://www.linkedin.com/in/andrewginns/)
*   **GitHub**: You're already here! Feel free to open an issue or explore my other projects.

Thanks for visiting!