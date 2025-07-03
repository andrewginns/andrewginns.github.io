import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

interface ScriptOrStyle {
  content: string;
  hash: string;
}

interface CSPData {
  scriptHashes: string[];
  styleHashes: string[];
  generatedAt: string;
}

// Function to calculate SHA256 hash
function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('base64');
}

// Function to extract inline scripts from HTML
function extractInlineScripts(html: string): ScriptOrStyle[] {
  const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts: ScriptOrStyle[] = [];
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptContent = match[1].trim();
    if (scriptContent) {
      scripts.push({
        content: scriptContent,
        hash: calculateHash(scriptContent),
      });
    }
  }

  return scripts;
}

// Function to extract inline styles from HTML
function extractInlineStyles(html: string): ScriptOrStyle[] {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styles: ScriptOrStyle[] = [];
  let match: RegExpExecArray | null;

  while ((match = styleRegex.exec(html)) !== null) {
    const styleContent = match[1].trim();
    if (styleContent) {
      styles.push({
        content: styleContent,
        hash: calculateHash(styleContent),
      });
    }
  }

  return styles;
}

// Function to recursively find all HTML files
function findHtmlFiles(dir: string): string[] {
  const htmlFiles: string[] = [];
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      htmlFiles.push(...findHtmlFiles(filePath));
    } else if (path.extname(file) === '.html') {
      htmlFiles.push(filePath);
    }
  });

  return htmlFiles;
}

// Main function
function extractCSPHashes(): void {
  if (!fs.existsSync(distDir)) {
    console.error('Error: dist directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  console.log('Scanning dist directory for HTML files...\n');

  const htmlFiles = findHtmlFiles(distDir);
  const allScriptHashes = new Set<string>();
  const allStyleHashes = new Set<string>();

  console.log(`Found ${htmlFiles.length} HTML files to analyze.\n`);

  htmlFiles.forEach((file) => {
    const relativePath = path.relative(distDir, file);
    const content = fs.readFileSync(file, 'utf8');
    const scripts = extractInlineScripts(content);
    const styles = extractInlineStyles(content);

    if (scripts.length > 0 || styles.length > 0) {
      console.log(`📄 ${relativePath}`);
      if (scripts.length > 0) {
        console.log(`   - ${scripts.length} inline script(s)`);
      }
      if (styles.length > 0) {
        console.log(`   - ${styles.length} inline style(s)`);
      }
    }

    scripts.forEach((script) => allScriptHashes.add(script.hash));
    styles.forEach((style) => allStyleHashes.add(style.hash));
  });

  console.log('\n=== CSP Hashes Extracted ===\n');

  if (allScriptHashes.size > 0) {
    console.log(`Script-src hashes (${allScriptHashes.size} unique):`);
    Array.from(allScriptHashes).forEach((hash) => {
      console.log(`  'sha256-${hash}'`);
    });
    console.log();
  }

  if (allStyleHashes.size > 0) {
    console.log(`Style-src hashes (${allStyleHashes.size} unique):`);
    Array.from(allStyleHashes).forEach((hash) => {
      console.log(`  'sha256-${hash}'`);
    });
    console.log();
  }

  // Generate CSP header recommendations
  console.log('=== Recommended CSP Directives ===\n');

  const scriptSrc =
    allScriptHashes.size > 0
      ? `script-src 'self' ${Array.from(allScriptHashes)
          .map((h) => `'sha256-${h}'`)
          .join(' ')};`
      : "script-src 'self';";

  const styleSrc =
    allStyleHashes.size > 0
      ? `style-src 'self' ${Array.from(allStyleHashes)
          .map((h) => `'sha256-${h}'`)
          .join(' ')} https://fonts.googleapis.com;`
      : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;";

  console.log('For strict CSP (requires updating after each build):');
  console.log(scriptSrc);
  console.log(styleSrc);

  console.log('\nCurrent approach (maintainable):');
  console.log("script-src 'self' 'unsafe-inline';");
  console.log("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;");

  // Save to a file for reference
  const cspData: CSPData = {
    scriptHashes: Array.from(allScriptHashes),
    styleHashes: Array.from(allStyleHashes),
    generatedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, '..', 'csp-hashes.json');
  fs.writeFileSync(outputPath, JSON.stringify(cspData, null, 2));

  console.log(`\n✅ Hashes saved to ${path.relative(process.cwd(), outputPath)}`);
  console.log(
    "\n⚠️  Note: These hashes change with every build. Using 'unsafe-inline' is recommended for maintainability."
  );
}

// Run the extraction
extractCSPHashes();
