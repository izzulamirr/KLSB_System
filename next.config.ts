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
    }
    
    return config;
  },
};

export default nextConfig;
