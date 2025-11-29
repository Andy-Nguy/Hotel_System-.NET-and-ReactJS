import axios from "axios";
import { API_CONFIG } from "./config";

// Use centralized API configuration
const API_BASE = `${API_CONFIG.CURRENT}/api`;

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
