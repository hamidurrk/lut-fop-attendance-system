const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const CERT_DIR = path.join(__dirname, '..', '.cert');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'key.pem');

function generateCertificate() {
  console.log('🔐 Generating self-signed HTTPS certificate...');
  
  // Ensure cert directory exists
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  // Generate certificate for both localhost and local network IP
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const opts = {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 2, // DNS
            value: 'localhost'
          },
          {
            type: 2, // DNS  
            value: '*.localhost'
          },
          {
            type: 7, // IP
            ip: '127.0.0.1'
          },
          {
            type: 7, // IP
            ip: '10.203.22.76'
          },
          {
            type: 7, // IP
            ip: '0.0.0.0'
          }
        ]
      }
    ]
  };

  const pems = selfsigned.generate(attrs, opts);
  
  fs.writeFileSync(KEY_FILE, pems.private);
  fs.writeFileSync(CERT_FILE, pems.cert);
  
  console.log('✅ Certificate generated successfully!');
  console.log(`📁 Certificate files saved in: ${CERT_DIR}`);
  console.log('');
  console.log('📱 For mobile testing, you may need to:');
  console.log('   1. Accept the security warning in your mobile browser');
  console.log('   2. Or install the certificate on your mobile device');
  console.log('');
}

function startServer() {
  // Generate certificate if it doesn't exist
  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
    generateCertificate();
  }

  console.log('🚀 Starting Next.js with HTTPS...');
  console.log('');
  
  const env = {
    ...process.env,
    HTTPS: 'true',
    SSL_CRT_FILE: CERT_FILE,
    SSL_KEY_FILE: KEY_FILE
  };

  const nextProcess = spawn('npx', ['next', 'dev', '--port', '3000'], {
    env,
    stdio: 'inherit',
    shell: true
  });

  nextProcess.on('close', (code) => {
    console.log(`\n🛑 Next.js process exited with code ${code}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down HTTPS dev server...');
    nextProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down HTTPS dev server...');
    nextProcess.kill('SIGTERM');
    process.exit(0);
  });
}

startServer();