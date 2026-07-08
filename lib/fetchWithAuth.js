import { getAuth } from "firebase/auth";
import { withBasePath } from "./apiPath";

// Attaches the signed-in user's Firebase ID token (if any) as a Bearer
// Authorization header and applies the app's basePath to the URL.
export async function fetchWithAuth(url, opts = {}) {
  const auth = getAuth();
  const user = auth.currentUser;
  const headers = { ...(opts.headers || {}) };
  if (user) {
    const token = await user.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(withBasePath(url), {
    ...opts,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
