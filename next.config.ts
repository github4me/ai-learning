import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained Node server and its traced runtime dependencies.
  output: 'standalone',
  // Course metadata is local and fast. Resolve it before HTML for every client,
  // keeping descriptions and language alternates in <head>, not a streamed body.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
