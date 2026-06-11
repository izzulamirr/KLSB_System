export const NEXT_BASE_PATH = "/klsb-portal";

export function withBasePath(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path === NEXT_BASE_PATH || path.startsWith(`${NEXT_BASE_PATH}/`)) return path;
  if (path.startsWith("/")) return `${NEXT_BASE_PATH}${path}`;
  return `${NEXT_BASE_PATH}/${path}`;
}