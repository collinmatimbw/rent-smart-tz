// Shared by the auth pages (Login, Register, and any page that resumes a flow
// after sign-in). Keep redirect validation in one place because it is
// security-sensitive and easy to drift.

const APP_BASE = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");

export function appPath(path = "/") {
  return `${APP_BASE}${path.startsWith("/") ? path : `/${path}`}` || "/";
}

// Resolve ?returnTo= to a safe same-origin path inside this app, else app root.
export function safeReturnTo() {
  const fallback = appPath("/");
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;

    for (const p of ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"]) {
      url.searchParams.delete(p);
    }

    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
    if (APP_BASE && path !== APP_BASE && !path.startsWith(`${APP_BASE}/`)) return fallback;
    return path;
  } catch {
    return fallback;
  }
}