const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if we're on Windows
const isWindows = process.platform === 'win32';

// HTTPS options for Next.js
const httpsOptions = [
  'dev',
  '--experimental-https'
];

// Add port if specified
if (process.env.PORT) {
  httpsOptions.push('--port', process.env.PORT);
}

console.log('🔒 Starting Next.js development server with HTTPS...');
console.log('📷 This enables camera access for QR scanning');

// Spawn Next.js with HTTPS
const nextProcess = spawn(
  isWindows ? 'npm.cmd' : 'npm',
  ['run', 'dev-http', '--', ...httpsOptions.slice(1)],
  {
    stdio: 'inherit',
    shell: isWindows
  }
);

nextProcess.on('close', (code) => {
  console.log(`Next.js process exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down HTTPS dev server...');
  nextProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  nextProcess.kill('SIGTERM');
});