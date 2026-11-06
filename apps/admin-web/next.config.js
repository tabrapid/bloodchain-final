/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bound build worker fan-out on the small VPS; runtime behavior is unchanged.
  experimental: { cpus: 1 },
};

module.exports = nextConfig;
