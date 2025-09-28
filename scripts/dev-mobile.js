const { spawn } = require('child_process');
const { exec } = require('child_process');

console.log('🚀 Starting development server for mobile testing...');
console.log('📱 This will create an HTTPS tunnel accessible from mobile devices');

// Start Next.js development server on HTTP first
console.log('🔄 Starting Next.js development server...');
const nextProcess = spawn('npm', ['run', 'dev-http'], {
  stdio: 'pipe',
  shell: true
});

// Wait for Next.js to be ready, then start ngrok
nextProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  // Look for the "Ready" message indicating Next.js is running
  if (output.includes('Ready in') || output.includes('ready')) {
    console.log('✅ Next.js is ready, starting ngrok tunnel...');
    
    // Start ngrok to create HTTPS tunnel
    const ngrokProcess = spawn('ngrok', ['http', '3000'], {
      stdio: 'inherit',
      shell: true
    });
    
    console.log('🌐 Ngrok tunnel started!');
    console.log('📋 Check the ngrok dashboard at: http://localhost:4040');
    console.log('📱 Use the HTTPS URL from ngrok to test on mobile devices');
    
    ngrokProcess.on('close', (code) => {
      console.log(`Ngrok process exited with code ${code}`);
    });
  }
});

nextProcess.stderr.on('data', (data) => {
  console.error(data.toString());
});

nextProcess.on('close', (code) => {
  console.log(`Next.js process exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down development server and tunnel...');
  nextProcess.kill('SIGINT');
  process.exit();
});

process.on('SIGTERM', () => {
  nextProcess.kill('SIGTERM');
  process.exit();
});