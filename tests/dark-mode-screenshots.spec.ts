import { test } from '@playwright/test';
import type { Page, Browser } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

interface PageInfo {
  name: string;
  url: string;
  waitFor?: string;
  description: string;
}

interface Viewport {
  name: string;
  width: number;
  height: number;
}

const outputDir = join(process.cwd(), 'dark-mode-screenshots');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((selectedTheme) => {
    document.documentElement.setAttribute('data-theme', selectedTheme);
    localStorage.setItem('theme', selectedTheme);
  }, theme);
  await page.waitForTimeout(300);
}

test.describe('Dark Mode Visual Evaluation', () => {
  const pages: PageInfo[] = [
    {
      name: 'home',
      url: '/',
      description: 'Homepage with hero card and floating elements',
    },
    {
      name: 'experience',
      url: '/experience',
      description: 'Experience page with timeline and content sections',
    },
    {
      name: 'projects',
      url: '/projects_github',
      description: 'Projects page with GitHub cards and filtering',
    },
    {
      name: 'merbench',
      url: '/merbench',
      waitFor: '.leaderboard-section',
      description: 'Merbench page with charts, tables, and complex UI',
    },
    {
      name: 'writing',
      url: '/writing',
      description: 'Writing page with article listings',
    },
    {
      name: 'about',
      url: '/about_me',
      description: 'About page with personal information',
    },
    {
      name: 'contact',
      url: '/contact_me',
      description: 'Contact page with contact information',
    },
  ];

  const viewports: Viewport[] = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ];

  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `,
    });
  });

  for (const viewport of viewports) {
    for (const pageInfo of pages) {
      test(`${pageInfo.name} - ${viewport.name} - light and dark modes`, async ({
        browser,
      }: {
        browser: Browser;
      }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 2,
        });

        const page = await context.newPage();

        // Disable animations
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          `,
        });

        console.log(`📸 Capturing ${pageInfo.name} (${viewport.name})`);

        // Navigate to page
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');

        // Wait for specific element if specified
        if (pageInfo.waitFor) {
          try {
            await page.waitForSelector(pageInfo.waitFor, { timeout: 5000 });
          } catch (e) {
            console.log(`   ⚠️  Selector ${pageInfo.waitFor} not found, continuing...`);
          }
        }

        // Additional wait for animations/charts to load
        await page.waitForTimeout(2000);

        // Light mode screenshot
        await setTheme(page, 'light');
        await page.screenshot({
          path: join(outputDir, `${pageInfo.name}-${viewport.name}-light.png`),
          fullPage: true,
        });

        // Dark mode screenshot
        await setTheme(page, 'dark');
        await page.screenshot({
          path: join(outputDir, `${pageInfo.name}-${viewport.name}-dark.png`),
          fullPage: true,
        });

        console.log(`   ✅ Captured both themes for ${pageInfo.name} (${viewport.name})`);

        await context.close();
      });
    }
  }

  test('Generate evaluation report', async () => {
    const reportPath = join(outputDir, 'evaluation-report.md');

    const report = `# Dark Mode Color Palette Evaluation Report

Generated: ${new Date().toISOString()}

## Overview
This report contains screenshots of all major pages in both light and dark modes across different viewport sizes. Use these screenshots to evaluate the color palette effectiveness.

### Color Palette Assessment Criteria

#### 1. **Contrast and Readability**
- [ ] Text is clearly readable against backgrounds
- [ ] Interactive elements have sufficient contrast
- [ ] Charts and data visualizations maintain clarity
- [ ] Progress bars and indicators are visible

#### 2. **Visual Hierarchy Preservation**
- [ ] Primary content stands out appropriately
- [ ] Secondary elements are properly de-emphasized
- [ ] Navigation remains clear and usable
- [ ] Call-to-action elements are prominent

#### 3. **Brand Identity Consistency**
- [ ] Accent colors maintain brand recognition
- [ ] Color relationships feel cohesive
- [ ] Visual design language is preserved
- [ ] Overall aesthetic matches light mode quality

#### 4. **Accessibility Compliance**
- [ ] WCAG AA contrast ratios met (4.5:1 for normal text, 3:1 for large text)
- [ ] Color is not the only way to convey information
- [ ] Interactive states are clearly distinguishable
- [ ] Focus indicators are visible

#### 5. **Component-Specific Evaluation**

##### Navigation & Theme Toggle
- [ ] Sidebar maintains proper hierarchy in dark mode
- [ ] Active states are clearly visible
- [ ] Mobile menu works well in dark theme
- [ ] Theme toggle is intuitive and accessible
- [ ] Icons and text remain readable

##### Floating Elements
- [ ] Background opacity provides good contrast
- [ ] Text remains readable over various backgrounds
- [ ] Hover states work well in dark mode
- [ ] Animation effects don't interfere with readability

##### Merbench Dashboard (Complex UI)
- [ ] Charts are readable with appropriate colors
- [ ] Leaderboard table maintains data clarity
- [ ] Progress bars use appropriate color coding (green/yellow/red)
- [ ] Filter controls remain usable
- [ ] Statistics cards have good contrast

##### Cards and Content Areas
- [ ] Project cards have good contrast
- [ ] Content sections are well-defined
- [ ] Borders and separators are visible but not harsh
- [ ] Hero card maintains visual impact

## Current Color Palette

### Light Mode
- **Primary Text**: #2c3e50 (Dark Blue-Gray)
- **Secondary Text**: #7f8c8d (Medium Gray)
- **Background**: #ffffff (White)
- **Secondary Background**: #f8f9fa (Light Gray)
- **Accent Primary**: #e74c3c (Red)
- **Accent Secondary**: #3498db (Blue)

### Dark Mode
- **Primary Text**: #e8eaed (Light Gray)
- **Secondary Text**: #9aa0a6 (Medium Gray)
- **Background**: #121212 (Very Dark Gray)
- **Secondary Background**: #1e1e1e (Dark Gray)
- **Accent Primary**: #f28b82 (Light Red)
- **Accent Secondary**: #8ab4f8 (Light Blue)

## Screenshot Files

### Desktop (1440x900)
${pages
  .map(
    (page) => `- **${page.name}**: ${page.name}-desktop-light.png | ${page.name}-desktop-dark.png`
  )
  .join('\n')}

### Tablet (768x1024)
${pages
  .map((page) => `- **${page.name}**: ${page.name}-tablet-light.png | ${page.name}-tablet-dark.png`)
  .join('\n')}

### Mobile (375x812)
${pages
  .map((page) => `- **${page.name}**: ${page.name}-mobile-light.png | ${page.name}-mobile-dark.png`)
  .join('\n')}

## Evaluation Findings

### ✅ Strengths
- [ ] Good contrast ratios maintained
- [ ] Brand colors adapted well for dark backgrounds
- [ ] Interactive elements remain discoverable
- [ ] Content hierarchy preserved

### ⚠️ Areas for Review
- [ ] Chart colors - ensure data remains distinguishable
- [ ] Progress bar color coding - verify accessibility
- [ ] Floating elements - check against various backgrounds
- [ ] Mobile navigation - verify all states are visible

### 🔧 Recommended Improvements
- [ ] _List specific color adjustments if needed_
- [ ] _Component-specific fixes_
- [ ] _Accessibility enhancements_

---

**Next Steps:**
1. Review all screenshots systematically
2. Test with actual users for usability feedback
3. Run automated accessibility audits
4. Consider user preference analytics after deployment

*This evaluation should be reviewed by both developers and designers to ensure the dark mode implementation meets quality and accessibility standards.*
`;

    writeFileSync(reportPath, report, 'utf8');
    console.log(`📋 Evaluation report generated: ${reportPath}`);
    console.log(`📁 Screenshots saved to: ${outputDir}`);
  });
});
