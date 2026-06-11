"use client";
import { useEffect, useState } from "react";
import { withBasePath } from "../../lib/apiPath";

export default function Page() {
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        if (!token) {
          setError("Activation token missing.");
          return;
        }

        const res = await fetch(withBasePath(`/api/auth/activate?token=${encodeURIComponent(token)}`));

        // If the server redirected (successful activation), follow it
        if (res.redirected) {
          window.location.href = res.url;
          return;
        }

        // Otherwise expect JSON with an error message
        const data = await res.json().catch(() => null);
        setError((data && data.error) || `Activation failed (status ${res.status})`);
      } catch (err) {
        setError(err?.message || String(err));
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="text-center">
        {error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="text-slate-700">Activating account, please wait...</div>
        )}
      </div>
    </div>
  );
}
