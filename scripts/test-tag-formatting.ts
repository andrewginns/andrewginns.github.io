import { formatTagForDisplay, formatTagForFloatingElement } from '../src/utils/tagAggregator';

// Test cases for tag formatting
const testTags: string[] = [
  'machine-learning',
  'artificial-intelligence',
  'deep-learning',
  'computer-vision',
  'natural-language-processing',
  'generative-ai',
  'continuous-integration',
  'continuous-deployment',
  'infrastructure-as-code',
  'edge-computing',
  'data-science',
  'data-engineering',
  'devops',
  'mlops',
  'python',
  'tensorflow',
  'pytorch',
  'kubernetes',
  'docker',
  'very-long-tag-name-that-should-be-truncated',
];

console.log('Tag Formatting Test Results');
console.log('===========================\n');

console.log('Original Tag -> Display Format -> Floating Element Format');
console.log('----------------------------------------------------------');

testTags.forEach((tag: string) => {
  const displayFormat = formatTagForDisplay(tag);
  const floatingFormat = formatTagForFloatingElement(tag);

  console.log(`${tag.padEnd(35)} -> ${displayFormat.padEnd(25)} -> ${floatingFormat}`);
});

console.log('\nFloating Element Format Lengths:');
console.log('--------------------------------');
testTags.forEach((tag: string) => {
  const floatingFormat = formatTagForFloatingElement(tag);
  console.log(`${tag.padEnd(35)} -> ${floatingFormat.padEnd(15)} (${floatingFormat.length} chars)`);
});
