import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained Node server and its traced runtime dependencies.
  output: 'standalone',
};

export default nextConfig;
