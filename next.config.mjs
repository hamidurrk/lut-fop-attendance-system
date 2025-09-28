import fs from 'fs';
import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		optimizeCss: false,
	},
	serverExternalPackages: ["googleapis", "xlsx", "pdf-lib"],
	webpack: (config) => {
		config.cache = false;
		return config;
	},
	// HTTPS configuration
	...(process.env.HTTPS === 'true' && {
		server: (function() {
			const certDir = path.join(process.cwd(), '.cert');
			const certPath = path.join(certDir, 'cert.pem');
			const keyPath = path.join(certDir, 'key.pem');
			
			if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
				return {
					https: {
						cert: fs.readFileSync(certPath),
						key: fs.readFileSync(keyPath),
					}
				};
			}
			return {};
		})()
	})
};

export default nextConfig;
