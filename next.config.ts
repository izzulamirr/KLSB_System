import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tells Next.js that the app is served under the /klsb-portal sub-path
  basePath: '/klsb-portal', 

  // Redirect the root path to the login page automatically
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: true, // Uses a 308 redirect, which is good for SEO and caching
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Externalize pdf-parse for server-side only
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pdf-parse');

      // Ensure pdfjs-dist can be imported properly on server
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      };
    }

    // Suppress critical dependency warnings for pdfjs-dist
    config.module = config.module || {};
    config.module.exprContextCritical = false;

    return config;
  },
};

export default nextConfig;