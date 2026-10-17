import axios from 'axios';

// Development: leave VITE_API_URL empty — Vite proxies /api, /uploads and /socket.io to the API (same origin, cookies just work).
// Production (e.g. Vercel + Render): set VITE_API_URL to the API origin, e.g. https://sahyog-api.onrender.com
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const SOCKET_URL = ((import.meta.env.VITE_SOCKET_URL || API_ORIGIN) || '').replace(/\/$/, '') || undefined;

const http = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
  withCredentials: true,
  timeout: 20000,
  // The API rejects state-changing requests without this header (CSRF defence for cookie auth).
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = String(err.config?.url || '');
    if (err.response?.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('sahyog:unauthorized'));
    return Promise.reject(err);
  }
);

const clean = (params) => {
  if (!params) return undefined;
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
};

// Every API response is { success, data, meta? } — callers get { data, meta }.
const unwrap = (p) => p.then((r) => ({ data: r.data.data, meta: r.data.meta }));

export const api = {
  get: (url, params) => unwrap(http.get(url, { params: clean(params) })),
  post: (url, body, cfg) => unwrap(http.post(url, body, cfg)),
  patch: (url, body, cfg) => unwrap(http.patch(url, body, cfg)),
  delete: (url) => unwrap(http.delete(url)),
};

export function errMsg(e, fallback = 'Something went wrong. Please try again.') {
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ERR_NETWORK') return 'Cannot reach the Sahyog server. Make sure the API is running.';
  if (e?.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  return e?.message || fallback;
}

/** Build multipart form data. Empty values are skipped so optional fields stay unset on the server. */
export function toFormData(fields = {}, files = [], fileField = 'images') {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) { v.forEach((item) => fd.append(k, String(item))); return; }
    fd.append(k, v instanceof Date ? v.toISOString() : String(v));
  });
  files.forEach((f) => fd.append(fileField, f));
  return fd;
}
