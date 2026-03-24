/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/plataforma", permanent: false },
      { source: "/admin/:path*", destination: "/plataforma/:path*", permanent: false },
    ]
  },
}

export default nextConfig
