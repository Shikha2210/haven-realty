import axios from 'axios';

// Same-origin in dev (Vite proxy) and in production behind a reverse proxy; override with VITE_API_URL.
const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` });

const TOKEN_KEY = 'haven_token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t, remember) => {
    try {
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
    } catch { /* storage unavailable */ }
  },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* noop */ } },
};

api.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && tokenStore.get() && !err.config.url.startsWith('/auth/')) onUnauthorized();
  return Promise.reject(err);
});

export const errorMessage = (err) =>
  err?.response?.data?.message || (err?.response ? 'Something went wrong.' : 'Cannot reach the server. Is the backend running?');
export const fieldErrors = (err) => err?.response?.data?.fields || {};

// Private files need the bearer token, so they are fetched as blobs instead of being linked directly.
export async function openPrivateFile(url) {
  const res = await api.get(url.replace(/^\/api/, ''), { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(res.data);
  window.open(objectUrl, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export default api;
