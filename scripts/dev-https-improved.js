const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Function to create self-signed certificates using OpenSSL
function createSelfSignedCert() {
  const certDir = path.join(__dirname, '..', 'certs');
  const keyPath = path.join(certDir, 'server.key');
  const certPath = path.join(certDir, 'server.crt');
  
  // Create certs directory if it doesn't exist
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  
  // Check if certificates already exist
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('✅ Using existing SSL certificates');
    return { keyPath, certPath };
  }
  
  console.log('🔐 Creating self-signed SSL certificates...');
  
  // Generate private key and certificate using OpenSSL
  const { execSync } = require('child_process');
  
  try {
    // Create private key
    execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'ignore' });
    
    // Create certificate signing request and certificate
    execSync(`openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:10.203.22.76"`, { stdio: 'ignore' });
    
    console.log('✅ SSL certificates created successfully');
    return { keyPath, certPath };
  } catch (error) {
    console.error('❌ Failed to create SSL certificates with OpenSSL');
    console.error('Please install OpenSSL or use the ngrok solution instead');
    return null;
  }
}

// Start the HTTPS development server
function startHttpsServer() {
  const certs = createSelfSignedCert();
  if (!certs) {
    console.log('🔄 Falling back to HTTP server...');
    console.log('📱 For mobile testing, use ngrok: npm run dev-mobile');
    
    // Fall back to regular HTTP server
    const nextProcess = spawn('npm', ['run', 'dev-http'], {
      stdio: 'inherit',
      shell: true
    });
    
    return nextProcess;
  }
  
  // Start Next.js on HTTP first, then proxy through HTTPS
  console.log('🔒 Starting HTTPS development server...');
  console.log('📱 Mobile devices can now access the camera!');
  console.log('🌐 Local HTTPS: https://localhost:3000');
  console.log('📱 Mobile HTTPS: https://10.203.22.76:3000');
  console.log('⚠️  You may need to accept the self-signed certificate warning');
  
  const nextProcess = spawn('npm', ['run', 'dev-http', '--', '--port', '3001'], {
    stdio: 'pipe',
    shell: true
  });
  
  nextProcess.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  
  nextProcess.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  
  // Create HTTPS proxy after Next.js starts
  setTimeout(() => {
    try {
      const privateKey = fs.readFileSync(certs.keyPath, 'utf8');
      const certificate = fs.readFileSync(certs.certPath, 'utf8');
      const credentials = { key: privateKey, cert: certificate };
      
      const proxy = createProxyMiddleware({
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for hot reload
      });
      
      const server = https.createServer(credentials, proxy);
      server.listen(3000, '0.0.0.0', () => {
        console.log('✅ HTTPS proxy server running on port 3000');
      });
      
    } catch (error) {
      console.error('❌ Failed to start HTTPS proxy:', error.message);
    }
  }, 3000);
  
  return nextProcess;
}

const nextProcess = startHttpsServer();

nextProcess.on('close', (code) => {
  console.log(`Development server exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down HTTPS development server...');
  nextProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  nextProcess.kill('SIGTERM');
});