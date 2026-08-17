// Plain JS (not .ts) on purpose: Next loads this config at runtime, and a
// TypeScript config requires the `typescript` package to be installed in
// production. Keeping it as .mjs means the deployed app needs no dev deps.

const NEXT_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/klsb-portal' : '');

const nextConfig = {
  ...(NEXT_BASE_PATH ? { basePath: NEXT_BASE_PATH } : {}),

  // The /_next/image optimizer returns 400 behind Passenger's basePath mount,
  // and it needs sharp resident in memory - which this 1GB host cannot spare.
  // Serving the originals is fine here: the only images are a logo and an icon.
  // Note: unoptimized images do NOT get basePath applied automatically, so
  // every src must go through withBasePath() from lib/apiPath.
  images: { unoptimized: true },
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

  webpack: (config, { isServer, dev }) => {
    // The app writes JSON backups into data/ on every request (finance,
    // manpower, etc). Without this, webpack's dev watcher treats those
    // writes as source changes and triggers a recompile mid-request,
    // which is what produces "module not found in React Client Manifest".
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.git/**', '**/data/**'],
      };
    }

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
