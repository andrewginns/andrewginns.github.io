import { chromium, type Browser, type Page } from 'playwright';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const currentDir = process.cwd();

interface PageInfo {
  name: string;
  url: string;
  waitFor?: string; // CSS selector to wait for
  description: string;
}

interface Viewport {
  name: string;
  width: number;
  height: number;
}

class DarkModeEvaluator {
  private browser: Browser | null = null;
  private outputDir: string;

  constructor() {
    this.outputDir = join(currentDir, 'dark-mode-screenshots');
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor'],
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
    // Set the theme by executing the same logic as our theme toggle
    await page.evaluate((selectedTheme) => {
      document.documentElement.setAttribute('data-theme', selectedTheme);
      localStorage.setItem('theme', selectedTheme);
    }, theme);

    // Wait a moment for any CSS transitions
    await page.waitForTimeout(300);
  }

  private async capturePageInBothThemes(
    page: Page,
    pageInfo: PageInfo,
    viewport: Viewport
  ): Promise<void> {
    console.log(`📸 Capturing ${pageInfo.name} (${viewport.name})`);

    // Navigate to page
    await page.goto(`http://localhost:4321${pageInfo.url}`);
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
    await this.setTheme(page, 'light');
    await page.screenshot({
      path: join(this.outputDir, `${pageInfo.name}-${viewport.name}-light.png`),
      fullPage: true,
    });

    // Dark mode screenshot
    await this.setTheme(page, 'dark');
    await page.screenshot({
      path: join(this.outputDir, `${pageInfo.name}-${viewport.name}-dark.png`),
      fullPage: true,
    });

    console.log(`   ✅ Captured both themes for ${pageInfo.name} (${viewport.name})`);
  }

  async captureAllPages(): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

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

    console.log('🚀 Starting dark mode evaluation screenshot capture...\n');

    for (const viewport of viewports) {
      console.log(`📱 Processing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);

      const context = await this.browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2, // Retina display for better quality
      });

      const page = await context.newPage();

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

      for (const pageInfo of pages) {
        try {
          await this.capturePageInBothThemes(page, pageInfo, viewport);
        } catch (error) {
          console.error(`   ❌ Failed to capture ${pageInfo.name}: ${error}`);
        }
      }

      await context.close();
      console.log(`✅ Completed ${viewport.name} viewport\n`);
    }

    console.log('🎉 Screenshot capture completed!');
    console.log(`📁 Screenshots saved to: ${this.outputDir}`);
  }

  async generateEvaluationReport(): Promise<void> {
    const reportPath = join(this.outputDir, 'evaluation-report.md');

    const report = `# Dark Mode Color Palette Evaluation Report

Generated: ${new Date().toISOString()}

## Overview
This report contains screenshots of all major pages in both light and dark modes across different viewport sizes. Use these screenshots to evaluate:

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

##### Floating Elements
- [ ] Background opacity provides good contrast
- [ ] Text remains readable over various backgrounds
- [ ] Hover states work well in dark mode

##### Navigation
- [ ] Sidebar maintains proper hierarchy
- [ ] Active states are clearly visible
- [ ] Mobile menu works well in dark theme
- [ ] Theme toggle is intuitive and accessible

##### Merbench Dashboard
- [ ] Charts are readable with appropriate colors
- [ ] Leaderboard table maintains data clarity
- [ ] Progress bars use appropriate color coding
- [ ] Filter controls remain usable

##### Cards and Content Areas
- [ ] Project cards have good contrast
- [ ] Content sections are well-defined
- [ ] Borders and separators are visible but not harsh

## Screenshot Files

### Desktop (1440x900)
${['home', 'experience', 'projects', 'merbench', 'writing', 'about', 'contact']
  .map((page) => `- **${page}**: ${page}-desktop-light.png | ${page}-desktop-dark.png`)
  .join('\n')}

### Tablet (768x1024)
${['home', 'experience', 'projects', 'merbench', 'writing', 'about', 'contact']
  .map((page) => `- **${page}**: ${page}-tablet-light.png | ${page}-tablet-dark.png`)
  .join('\n')}

### Mobile (375x812)
${['home', 'experience', 'projects', 'merbench', 'writing', 'about', 'contact']
  .map((page) => `- **${page}**: ${page}-mobile-light.png | ${page}-mobile-dark.png`)
  .join('\n')}

## Color Palette Used

### Light Mode
- **Primary Text**: #2c3e50
- **Secondary Text**: #7f8c8d
- **Background**: #ffffff
- **Accent**: #e74c3c

### Dark Mode
- **Primary Text**: #e8eaed
- **Secondary Text**: #9aa0a6
- **Background**: #121212
- **Accent**: #f28b82

## Recommendations

Based on visual inspection of the screenshots, note any issues or improvements needed:

### Issues Found
- [ ] List any contrast issues
- [ ] Note any readability problems
- [ ] Document any visual hierarchy issues

### Suggested Improvements
- [ ] Color adjustments needed
- [ ] Component-specific fixes
- [ ] Accessibility enhancements

---

*This evaluation should be reviewed by both developers and designers to ensure the dark mode implementation meets quality and accessibility standards.*
`;

    writeFileSync(reportPath, report, 'utf8');
    console.log(`📋 Evaluation report generated: ${reportPath}`);
  }
}

async function main() {
  const evaluator = new DarkModeEvaluator();

  try {
    await evaluator.initialize();
    await evaluator.captureAllPages();
    await evaluator.generateEvaluationReport();
  } catch (error) {
    console.error('❌ Error during evaluation:', error);
    process.exit(1);
  } finally {
    await evaluator.close();
  }
}

// Run the evaluation if this script is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}

export { DarkModeEvaluator };
