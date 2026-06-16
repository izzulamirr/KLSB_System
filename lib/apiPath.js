export const NEXT_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === "production" ? "/klsb-portal" : "");

function normalizeBasePath(path) {
  return String(path || "").replace(/\/$/, "");
}

export function withBasePath(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;

  const basePath = normalizeBasePath(NEXT_BASE_PATH);
  if (basePath) {
    return path.startsWith("/") ? `${basePath}${path}` : `${basePath}/${path}`;
  }

  if (path.startsWith("/")) return path;
  return `/${path}`;
}