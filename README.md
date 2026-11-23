# Andrew Ginns

Source for [andrew.ginns.uk](https://andrew.ginns.uk): a professional profile, selected projects, writing, and the interactive Merbench benchmark.

Built with Astro, TypeScript, and CSS. Pages are generated as static HTML; JavaScript is reserved for navigation, theme preference, floating interests, and benchmark interactions. No application server or database is required.

## Development

Use Node.js 24 LTS (the version in `.nvmrc`) and npm.

```sh
nvm use
npm ci
npm run dev
```

The development server runs at `http://localhost:4321`.

| Command           | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `npm run check`   | Check Astro templates and TypeScript              |
| `npm run build`   | Check and generate the production site in `dist/` |
| `npm run preview` | Serve the production build locally                |
| `npm test`        | Run browser checks against the production build   |
| `npm run lint`    | Check code quality                                |
| `npm run format`  | Format source, tests, and configuration           |

Before running browser tests for the first time, run `npx playwright install chromium`. Run `npm run build` before `npm test`; Playwright starts the preview server automatically.

## Content

- Profile facts and interest links live in `src/data/profile.ts`; navigation is in `src/layouts/BaseLayout.astro`.
- Projects are fetched from GitHub at build time: pinned repositories when a token is available, otherwise top starred owned repositories. Curated projects in `src/data/projects.ts` provide an offline fallback. An optional `GITHUB_TOKEN` improves API limits and enables pinned repository access; keep it in your shell environment or an ignored `.env` file.
- Writing combines Medium articles with local Markdown in `src/content/writing/`. Local posts use the schema in `src/content.config.ts`:

  ```yaml
  ---
  title: An article title
  description: A short summary
  date: 2026-11-10
  tags: [ai, engineering]
  draft: false
  ---
  ```

  Draft posts are excluded from both the listing and generated routes.

- The benchmark dataset is `src/data/merbench_data.json`. Merbench is a legacy, saturated benchmark and is no longer maintained. Keep its archived snapshot and methodology intact; the other local datasets are not automatically published.
- Assets belong in `public/`; the canonical URL is configured in `astro.config.ts`.

## Deployment

The production workflow builds and tests the site, then uploads the tested build to the Cloudflare Pages project serving [andrew.ginns.uk](https://andrew.ginns.uk/). It runs on pushes to main, weekly for external content refreshes, and manual dispatch. The Cloudflare publish job requires main and uses the production environment. Before uploading, it checks the Cloudflare project's production branch and domain.

[The GitHub Pages dev site](https://andrewginns.github.io/) serves the full tested build of the single open same-repository PR targeting main. Draft PRs count. Pull requests run validation and upload a downloadable build. **Publish website dev site** publishes that artifact after successful validation for the current PR revision. It keeps the last published build during validation failures or when multiple eligible PRs are open. When the last eligible PR closes, it publishes a dev status page.

Use **Publish website dev site** in Actions with the main branch to refresh manually. If the validation artifact has expired, rerun the PR validation to generate a new one. The Pages publisher uses the existing main-only github-pages environment.

Cloudflare Pages applies `public/_headers` to the canonical site's responses, including security headers and immutable caching for hashed `/_astro/` assets. GitHub Pages does not apply those response rules. Keep the canonical hostname connected to Cloudflare Pages in its domain settings and DNS; setting `site` in Astro only sets generated URLs. Verify the actual public hostname, content, and HTTP headers after each release.

Merbench keeps the full leaderboard and chart data tables in static HTML. Its hashed snapshot asset is fetched only when filters or nearby charts need it; Plotly and each chart are loaded as the chart approaches the viewport. The archive's source data and calculation methods are unchanged.

## Maintenance

Use `npm outdated` and `npm audit` when updating dependencies. Commit `package-lock.json` with package changes. Keep the runtime declared in `.nvmrc` and `package.json` compatible with Astro. Check the site at desktop and mobile widths, in both themes, and with reduced motion enabled before publishing design changes.
