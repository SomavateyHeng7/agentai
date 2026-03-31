import type { NextConfig } from 'next';

const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${apiBase}/health`,
      },
      {
        source: '/metrics',
        destination: `${apiBase}/metrics`,
      },
    ];
  },
};

export default nextConfig;
