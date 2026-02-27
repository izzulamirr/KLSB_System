This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## BD Proposal Module Setup

To enable the separate Business Development (BD) proposal tracker (`/bd`), set these environment variables:

```bash
BD_PROPOSALS_COLLECTION=bd_proposals
USER_ROLES_COLLECTION=user_roles
BD_ROLE_NAME=bd
DEFAULT_USER_ROLE=staff
BD_EMAILS=bd1@yourcompany.com,bd2@yourcompany.com
```

- `BD_PROPOSALS_COLLECTION` stores BD tracker data in its own Firestore collection.
- `USER_ROLES_COLLECTION` should contain documents keyed by Firebase `uid` with `{ role: "bd" }` for BD users.
- `BD_EMAILS` is an optional fallback list for quick role assignment.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Run locally (Windows PowerShell)

If you're using Windows PowerShell, follow these steps to install dependencies and start the dev server.

1. Install Node.js (includes npm)

- Recommended: install the latest LTS from https://nodejs.org/. During installation, keep the "Add to PATH" option checked.
- Alternative: use nvm for Windows (https://github.com/coreybutler/nvm-windows) to manage Node versions.

2. Open a new PowerShell window and verify Node/npm are available:

```powershell
node -v
npm -v
```

You should see version strings for both. If you see "The term 'node' is not recognized" or "The term 'npm' is not recognized", restart PowerShell, and if it persists, ensure the Node installation folder (for example `C:\Program Files\nodejs`) is on your PATH environment variable.

3. From the project root (`d:\klsb-portal\klsb-portal`) install dependencies and start the dev server:

```powershell
cd d:\klsb-portal\klsb-portal
npm install
npm run dev
```

4. Open http://localhost:3000 in your browser. The terminal will show the exact URL and compilation status.

Troubleshooting tips
- If `npm install` errors with incompatible Node version, install a compatible Node (Node 18+ is a safe choice for Next.js 15).
- If ports are in use, either stop the occupying process or run Next with a custom port:

```powershell
# run on port 4000
set "PORT=4000"; npm run dev
```

- If you'd rather avoid installing Node locally, you can run the app in Docker — tell me if you want a Dockerfile and instructions and I'll add them.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
