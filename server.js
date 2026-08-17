const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Define the port, defaulting to cPanel's assigned port
const port = process.env.PORT || 3000;

// Must match the basePath next.config.ts applies in production. Passenger
// mounts the app at this path and strips it from req.url before Node sees it,
// but Next expects incoming URLs to still contain basePath - so without this
// every route 404s. Prepending is a no-op if the prefix is already present.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (dev ? '' : '/klsb-portal');

app.prepare().then(() => {
  createServer((req, res) => {
    if (basePath && !(req.url === basePath || req.url.startsWith(basePath + '/'))) {
      req.url = basePath + req.url;
    }

    if (process.env.DEBUG_URL) {
      console.log('> incoming:', req.url);
    }

    const parsedUrl = parse(req.url, true);

    // Let Next.js handle all the routing and redirects automatically
    handle(req, res, parsedUrl);

  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}).catch((err) => {
  // Without this, a missing .next build fails as an unhandled rejection
  // and Passenger reports a bare 503 with no explanation in the logs.
  console.error('> Failed to start Next.js server:', err);
  process.exit(1);
});