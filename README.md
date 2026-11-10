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

The production workflow builds and tests the site, then deploys to GitHub Pages at `https://andrewginns.github.io/`. It runs on pushes to `main`, weekly for external content refreshes, and manual dispatch. Set the repository’s **Settings → Pages → Source** to **GitHub Actions**. Deployment uses the built-in GitHub token and the `github-pages` environment; no hosting API secrets are needed. The canonical URL remains `https://andrew.ginns.uk`.

Pull requests build and test the site and upload `dist/` as a downloadable Actions artifact. They do not deploy over a shared GitHub Pages URL. For a local preview, download the artifact and serve it with any static HTTP server.

## Maintenance

Use `npm outdated` and `npm audit` when updating dependencies. Commit `package-lock.json` with package changes. Keep the runtime declared in `.nvmrc` and `package.json` compatible with Astro. Check the site at desktop and mobile widths, in both themes, and with reduced motion enabled before publishing design changes.
