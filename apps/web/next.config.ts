import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@ai-exchange/types',
    '@ai-exchange/db',
    '@ai-exchange/simulation',
    '@ai-exchange/forensics',
  ],
};

export default nextConfig;
