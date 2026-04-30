import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: false,
});

// Attach bearer token if stored (fallback for cross-site cookies)
api.interceptors.request.use((cfg) => {
  const tok = localStorage.getItem("sentinel_token");
  if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
  return cfg;
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}
