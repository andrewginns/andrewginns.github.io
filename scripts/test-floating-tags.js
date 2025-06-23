/* eslint-disable no-undef */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the built index.html file
const htmlPath = path.join(__dirname, '../dist/index.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// Extract floating elements
const floatingElementsRegex =
  /<div class="floating-element floating-element-\d+"[^>]*>([^<]+)<\/div>/g;
const matches = [...html.matchAll(floatingElementsRegex)];

console.log('Found floating elements with dynamic tags:');
console.log('==========================================');

matches.forEach((match, index) => {
  const tag = match[1].trim();
  console.log(`Element ${index + 1}: ${tag}`);
});

console.log('\nTotal floating elements found:', matches.length);

// Verify that tags are not the old hardcoded values
const oldHardcodedTags = ['MLOps', 'GenAI', 'Python', 'CI/CD', 'Data', 'Edge ML', 'AI'];
const foundTags = matches.map((m) => m[1].trim());

// Check if we have the expected number of tags (10)
if (matches.length !== 10) {
  console.log(`\n⚠️ Expected 10 floating elements, but found ${matches.length}`);
}

const hasOldTags = foundTags.slice(0, 7).every((tag, i) => tag === oldHardcodedTags[i]);

if (hasOldTags) {
  console.log('\n❌ WARNING: Tags appear to still be hardcoded!');
} else {
  console.log('\n✅ Success: Tags appear to be dynamically generated from GitHub data!');
}
