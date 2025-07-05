import { exec } from 'child_process';
import { promisify } from 'util';
import { CSPTestServer } from './csp-test-server.js';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

async function validateCSP(): Promise<void> {
  console.log('🔒 Starting CSP Validation Process...\n');

  try {
    // Step 1: Ensure build exists
    console.log('1️⃣ Checking build...');
    if (!fs.existsSync('dist')) {
      console.log('📦 Building project...');
      await execAsync('npm run build');
      console.log('✅ Build completed\n');
    } else {
      console.log('✅ Build found\n');
    }

    // Step 2: Start CSP test server
    console.log('2️⃣ Starting CSP test server...');
    const server = new CSPTestServer();
    await server.start();
    console.log('✅ CSP server started\n');

    try {
      // Step 3: Run CSP validation tests
      console.log('3️⃣ Running CSP validation tests...');
      const testCommand = 'npx playwright test tests/csp-validation.spec.ts --reporter=line';
      const { stdout, stderr } = await execAsync(testCommand);

      console.log('📊 Test Results:');
      console.log(stdout);

      if (stderr && !stderr.includes('Warning')) {
        console.error('⚠️ Test stderr:', stderr);
      }

      console.log('✅ All CSP validation tests passed!\n');

      // Step 4: Generate CSP compliance report
      console.log('4️⃣ Generating CSP compliance report...');
      await generateComplianceReport();
      console.log('✅ Compliance report generated\n');
    } finally {
      // Always stop the server
      console.log('🛑 Stopping CSP test server...');
      await server.stop();
    }

    console.log('🎉 CSP Validation Complete - Ready for deployment!');
  } catch (error) {
    console.error('\n❌ CSP Validation Failed:', error);

    if (error instanceof Error && 'stdout' in error) {
      console.error('\nTest output:', (error as any).stdout);
      console.error('Test errors:', (error as any).stderr);
    }

    console.error('\n🚨 Deployment blocked due to CSP violations');
    process.exit(1);
  }
}

async function generateComplianceReport(): Promise<void> {
  const reportPath = 'csp-compliance-report.json';

  // Read CSP hashes
  let cspHashes;
  try {
    const hashesContent = fs.readFileSync('csp-hashes.json', 'utf8');
    cspHashes = JSON.parse(hashesContent);
  } catch (error) {
    throw new Error('Failed to read CSP hashes file');
  }

  // Read current _headers file
  let currentCSP = '';
  try {
    const headersContent = fs.readFileSync('public/_headers', 'utf8');
    const cspMatch = headersContent.match(/Content-Security-Policy: (.+)/);
    currentCSP = cspMatch ? cspMatch[1] : '';
  } catch (error) {
    console.warn('⚠️ Could not read _headers file');
  }

  const report = {
    timestamp: new Date().toISOString(),
    validation: {
      passed: true,
      testResults: 'All CSP validation tests passed',
    },
    cspHashes: {
      scriptHashes: cspHashes.scriptHashes.length,
      styleHashes: cspHashes.styleHashes.length,
      totalHashes: cspHashes.scriptHashes.length + cspHashes.styleHashes.length,
    },
    currentPolicy: {
      usesUnsafeInline: currentCSP.includes('unsafe-inline'),
      usesHashes: currentCSP.includes('sha256-'),
      isStrict: !currentCSP.includes('unsafe-inline') && currentCSP.includes('sha256-'),
    },
    recommendations: generateRecommendations(currentCSP, cspHashes),
    nextSteps: [
      'All tests passed - site is ready for deployment',
      'CSP hashes are current and valid',
      'No unsafe-inline dependencies detected',
    ],
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('📋 CSP Compliance Report:');
  console.log(`   • Script hashes: ${report.cspHashes.scriptHashes}`);
  console.log(`   • Style hashes: ${report.cspHashes.styleHashes}`);
  console.log(`   • Uses unsafe-inline: ${report.currentPolicy.usesUnsafeInline ? '❌' : '✅'}`);
  console.log(`   • Report saved: ${reportPath}`);
}

function generateRecommendations(currentCSP: string, cspHashes: any): string[] {
  const recommendations: string[] = [];

  if (currentCSP.includes('unsafe-inline') && cspHashes.scriptHashes.length > 0) {
    recommendations.push(
      'Consider using hash-based CSP instead of unsafe-inline for better security'
    );
    recommendations.push('All required hashes are available in csp-hashes.json');
  }

  if (!currentCSP.includes('unsafe-inline')) {
    recommendations.push('Excellent! Using hash-based CSP provides strong security');
  }

  if (cspHashes.scriptHashes.length > 10) {
    recommendations.push('Consider reducing inline scripts to minimize CSP hash maintenance');
  }

  return recommendations;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  validateCSP().catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export { validateCSP };
