#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load and validate the Playwright configuration
const configPath = path.join(__dirname, '../thalora-frontend/playwright.config.ts');

console.log('🔍 Validating Playwright configuration...');

try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  // Check for performance optimizations
  const optimizations = [
    { name: 'CI Browser Limitation', check: /projects:\s*process\.env\.CI\s*\?/m },
    { name: 'Worker Configuration', check: /workers:\s*process\.env\.CI\s*\?\s*2/ },
    { name: 'Timeout Configuration', check: /timeout:\s*process\.env\.CI\s*\?/ },
    { name: 'Video Optimization', check: /video:\s*process\.env\.CI\s*\?\s*['"]off['"]/ },
    { name: 'Reporter Optimization', check: /reporter:\s*process\.env\.CI\s*\?\s*['"]github['"]/ },
  ];
  
  let passCount = 0;
  let totalChecks = optimizations.length;
  
  optimizations.forEach(opt => {
    if (opt.check.test(configContent)) {
      console.log(`✅ ${opt.name}: OPTIMIZED`);
      passCount++;
    } else {
      console.log(`❌ ${opt.name}: NOT OPTIMIZED`);
    }
  });
  
  console.log(`\n📊 Configuration Score: ${passCount}/${totalChecks}`);
  
  if (passCount === totalChecks) {
    console.log('🎉 All performance optimizations are in place!');
    
    // Calculate expected test counts
    const testDir = path.join(__dirname, '../thalora-frontend/tests/e2e');
    const testFiles = fs.readdirSync(testDir).filter(file => file.endsWith('.spec.ts'));
    
    let totalTests = 0;
    testFiles.forEach(file => {
      const filePath = path.join(testDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const testCount = (content.match(/test\(/g) || []).length;
        console.log(`📝 ${file}: ${testCount} tests`);
        totalTests += testCount;
      }
    });
    
    console.log(`\n📈 Expected Test Performance:`);
    console.log(`   - Local: ${totalTests} tests × 3 browsers = ${totalTests * 3} total tests`);
    console.log(`   - CI: ${totalTests} tests × 1 browser = ${totalTests} total tests (66% reduction)`);
    console.log(`   - Parallel Workers: 2 (vs 1 sequential)`);
    console.log(`   - Video Recording: Disabled in CI`);
    console.log(`   - Estimated CI Runtime: 5-10 minutes (vs 30+ minutes)`);
    
    console.log(`\n🚀 Run Commands:`);
    console.log(`   - Fast CI mode: npm run test:e2e:ci`);
    console.log(`   - Local with UI: npm run test:e2e:ui`);
    console.log(`   - Debug mode: npm run test:e2e:headed`);
    
  } else {
    console.log('⚠️  Some optimizations are missing. Review the configuration.');
  }
  
} catch (error) {
  console.error('❌ Error validating configuration:', error.message);
  process.exit(1);
}