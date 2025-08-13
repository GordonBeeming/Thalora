import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');
  
  // Wait a moment for servers to stabilize
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('✅ Global test setup completed');
}

export default globalSetup;