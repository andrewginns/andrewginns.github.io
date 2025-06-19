const { chromium } = require('playwright');

async function captureViewports() {
  const browser = await chromium.launch();
  
  const viewports = [
    { name: 'mobile-small', width: 375, height: 667 }, // iPhone SE
    { name: 'mobile-medium', width: 390, height: 844 }, // iPhone 12/13
    { name: 'tablet-portrait', width: 768, height: 1024 }, // iPad portrait
    { name: 'tablet-landscape', width: 1024, height: 768 }, // iPad landscape
    { name: 'desktop-small', width: 1366, height: 768 }, // Small laptop
    { name: 'desktop-large', width: 1920, height: 1080 }, // Full HD
    { name: 'desktop-ultrawide', width: 2560, height: 1440 } // 2K
  ];
  
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    
    console.log(`Capturing ${viewport.name} (${viewport.width}x${viewport.height})...`);
    await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
    await page.screenshot({ 
      path: `./screenshots/viewport-${viewport.name}.png`,
      fullPage: false 
    });
    
    await context.close();
  }
  
  await browser.close();
  console.log('All viewport screenshots captured successfully!');
}

captureViewports().catch(console.error);