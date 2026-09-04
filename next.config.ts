import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.SKILLD_STANDALONE === 'true' ? 'standalone' : undefined,
  poweredByHeader: false,
};

export default nextConfig;
