import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

console.log('🚀 Starting Vercel build process...');

// Create necessary directories
const dirs = ['uploads', 'uploads/materials'];
dirs.forEach(dir => {
  const dirPath = join(process.cwd(), dir);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Build client
console.log('📦 Building client...');
try {
  execSync('cd client && npm run build', { stdio: 'inherit' });
  console.log('✅ Client build completed');
} catch (error) {
  console.error('❌ Client build failed:', error);
  process.exit(1);
}

// Install server dependencies
console.log('📦 Installing server dependencies...');
try {
  execSync('cd server && npm install --production', { stdio: 'inherit' });
  console.log('✅ Server dependencies installed');
} catch (error) {
  console.error('❌ Server dependencies installation failed:', error);
  process.exit(1);
}

console.log('🎉 Build process completed successfully!');
