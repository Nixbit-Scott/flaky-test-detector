/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbopack: true,
  },
  transpilePackages: ["@repo/ui", "shared"],
  typescript: {
    // Temporarily ignore build errors during initial setup
    ignoreBuildErrors: true,
  },
  eslint: {
    // Temporarily ignore lint errors during initial setup  
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/:path*',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
