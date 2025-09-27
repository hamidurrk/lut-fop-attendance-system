/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		optimizeCss: false,
	},
	webpack: (config) => {
		config.cache = false;
		return config;
	},
};

export default nextConfig;
