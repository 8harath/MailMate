/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle for container/self-host deploys.
  // Vercel ignores this and uses its own output.
  output: 'standalone',
  experimental: {
    webpackBuildWorker: false,
    workerThreads: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
