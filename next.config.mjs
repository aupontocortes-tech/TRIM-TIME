/** @type {import('next').NextConfig} */
const nextConfig = {
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
