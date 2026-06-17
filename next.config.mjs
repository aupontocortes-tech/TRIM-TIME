/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [100, 75],
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/plataforma", permanent: false },
      { source: "/admin/:path*", destination: "/plataforma/:path*", permanent: false },
      { source: "/favicon.ico", destination: "/icon.png", permanent: false },
    ]
  },
}

export default nextConfig
