/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    webpackBuildWorker: false,
    workerThreads: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
