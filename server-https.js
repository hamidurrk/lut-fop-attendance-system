const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const CERT_DIR = path.join(__dirname, '..', '.cert');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'key.pem');

function generateCertificate() {
  console.log('🔐 Generating HTTPS certificate...');
  
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const opts = {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: '*.localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '10.203.22.76' },
          { type: 7, ip: '0.0.0.0' }
        ]
      }
    ]
  };

  const pems = selfsigned.generate(attrs, opts);
  
  fs.writeFileSync(KEY_FILE, pems.private);
  fs.writeFileSync(CERT_FILE, pems.cert);
  
  console.log('✅ Certificate generated!');
  return { cert: pems.cert, key: pems.private };
}

function getCertificate() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    return {
      cert: fs.readFileSync(CERT_FILE),
      key: fs.readFileSync(KEY_FILE)
    };
  }
  return generateCertificate();
}

app.prepare().then(() => {
  const { cert, key } = getCertificate();
  
  const server = createServer({ cert, key }, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log('');
    console.log('🔒 HTTPS development server ready!');
    console.log('');
    console.log(`  ➜ Local:    https://localhost:${port}`);
    console.log(`  ➜ Network:  https://10.203.22.76:${port}`);
    console.log('');
    console.log('📱 For mobile testing:');
    console.log('   • Open https://10.203.22.76:3000 on your mobile device');
    console.log('   • Accept the security warning (certificate is self-signed)');
    console.log('   • Camera should now work!');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
});