/** @type {import('next').NextConfig} */
const nextConfig = {
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
