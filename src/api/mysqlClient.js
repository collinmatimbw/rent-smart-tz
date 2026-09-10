// @ts-nocheck
const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV
    ? "/rent-smart-tz/api/index.php"
    : `${import.meta.env.BASE_URL}api/index.php`);
const TOKEN_KEY = "rent_smart_token";
const BASE_PATH = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");

function appPath(path = "/") {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}` || "/";
}

function buildUrl(route, params = {}) {
  const url = new URL(API_URL, window.location.origin);
  url.searchParams.set("route", route);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  });
  return url.toString();
}

async function request(route, { method = "GET", data, params } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(buildUrl(route, params), {
    method,
    headers: {
      Accept: "application/json",
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = payload;
    throw error;
  }
  return payload;
}

function notify(entity) {
  window.dispatchEvent(new CustomEvent(`mysql:${entity}`));
}

function entityClient(entity) {
  return {
    list: (sort = "-created_date", limit = 500) =>
      request(`entities/${entity}`, { params: { sort, limit } }),
    filter: (filter = {}, sort = "-created_date", limit = 500) =>
      request(`entities/${entity}`, { params: { filter, sort, limit } }),
    get: (id) => request(`entities/${entity}/get/${encodeURIComponent(id)}`),
    create: async (data) => {
      const result = await request(`entities/${entity}/create`, { method: "POST", data });
      notify(entity);
      return result;
    },
    bulkCreate: async (items) => {
      const result = await request(`entities/${entity}/bulk`, { method: "POST", data: items });
      notify(entity);
      return result;
    },
    update: async (id, data) => {
      const result = await request(`entities/${entity}/update/${encodeURIComponent(id)}`, { method: "PUT", data });
      notify(entity);
      return result;
    },
    delete: async (id) => {
      const result = await request(`entities/${entity}/delete/${encodeURIComponent(id)}`, { method: "DELETE" });
      notify(entity);
      return result;
    },
    deleteMany: async (filter = {}) => {
      const result = await request(`entities/${entity}/delete-many`, { method: "POST", data: filter });
      notify(entity);
      return result;
    },
    subscribe: (callback) => {
      const event = `mysql:${entity}`;
      window.addEventListener(event, callback);
      return () => window.removeEventListener(event, callback);
    },
  };
}

/** @type {any} */
const entities = new Proxy({}, {
  get: (_, entity) => entityClient(String(entity)),
});

/** @type {any} */
export const mysql = {
  entities,
  auth: {
    me: () => request("auth/me"),
    register: (data) => request("auth/register", { method: "POST", data }),
    verifyOtp: async (data) => {
      const result = await request("auth/verify-otp", { method: "POST", data });
      if (result.access_token) localStorage.setItem(TOKEN_KEY, result.access_token);
      return result;
    },
    resendOtp: (email) => request("auth/resend-otp", { method: "POST", data: { email } }),
    loginViaEmailPassword: async (email, password) => {
      const result = await request("auth/login", { method: "POST", data: { email, password } });
      localStorage.setItem(TOKEN_KEY, result.access_token);
      return result;
    },
    resetPasswordRequest: (email) => request("auth/reset-request", { method: "POST", data: { email } }),
    resetPassword: (data) => request("auth/reset", { method: "POST", data }),
    setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
    logout: (returnTo) => {
      request("auth/logout", { method: "POST" }).catch(() => {});
      localStorage.removeItem(TOKEN_KEY);
      if (returnTo) window.location.href = appPath("/login");
    },
    redirectToLogin: (returnTo = window.location.href) => {
      const target = new URL(returnTo, window.location.origin);
      const safe = target.origin === window.location.origin ? target.pathname + target.search : "/";
      window.location.href = `${appPath("/login")}?returnTo=${encodeURIComponent(safe)}`;
    },
    loginWithProvider: () => {
      throw new Error("Google login is not configured for the MySQL backend. Use email and password.");
    },
    hasToken: () => Boolean(localStorage.getItem(TOKEN_KEY)),
  },
  users: {
    inviteUser: (email, role) => request("users/invite", { method: "POST", data: { email, role } }),
    updateUser: (data) => request("users/update", { method: "POST", data }),
    setPassword: (id, password) => request("users/set-password", { method: "POST", data: { id, password } }),
    blockUser: (id, blocked) => request("users/block", { method: "POST", data: { id, blocked } }),
    deleteUser: (id) => request("users/delete", { method: "POST", data: { id } }),
  },
  functions: {
    invoke: (name, data = {}) => request(`functions/${name}`, { method: "POST", data }),
  },
  integrations: {
    Core: {
      InvokeLLM: (data) => request("integrations/llm", { method: "POST", data }),
    },
  },
};
