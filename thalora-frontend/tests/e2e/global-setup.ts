import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');
  
  // Reduced wait time for faster test startup
  const waitTime = process.env.CI ? 10000 : 3000; // 10s in CI, 3s locally
  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  console.log('✅ Global test setup completed');
}

export default globalSetup;