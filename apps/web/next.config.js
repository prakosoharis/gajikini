const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ewa/shared'],
  experimental: {
    // Monorepo pnpm: trace dependency dari root repo agar deploy prebuilt Vercel lengkap.
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
};

module.exports = nextConfig;
