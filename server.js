const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Define the port, defaulting to cPanel's assigned port
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  createServer((req, res) => {
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