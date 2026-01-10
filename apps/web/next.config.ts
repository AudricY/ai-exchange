import type { NextConfig } from 'next';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root
config({ path: resolve(__dirname, '../../.env') });

const nextConfig: NextConfig = {
  transpilePackages: [
    '@ai-exchange/types',
    '@ai-exchange/db',
    '@ai-exchange/simulation',
    // Note: @ai-exchange/forensics is NOT transpiled because it uses @napi-rs/canvas
    // which has native bindings that can't be bundled by webpack
  ],
  serverExternalPackages: [
    'better-sqlite3',
    '@ai-exchange/forensics',
    '@napi-rs/canvas',
    '@napi-rs/canvas-darwin-arm64',
    '@napi-rs/canvas-linux-x64-gnu',
    '@napi-rs/canvas-linux-x64-musl',
    '@napi-rs/canvas-win32-x64-msvc',
    'chart.js',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent bundling of native modules on server
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('@napi-rs/canvas');
      }
    }
    return config;
  },
};

export default nextConfig;
