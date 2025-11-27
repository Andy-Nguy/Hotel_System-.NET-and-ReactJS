import axios from "axios";

// Resolve API base from Vite env when available (VITE_API_URL)
const _VITE_API = import.meta.env.VITE_API_URL || "";
const API_BASE = _VITE_API
  ? `${_VITE_API.replace(/\/$/, "")}/api`
  : "/api";

const axiosClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("hs_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosClient;
