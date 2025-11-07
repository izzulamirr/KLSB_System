import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };
    
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
