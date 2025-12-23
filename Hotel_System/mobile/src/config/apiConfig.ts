// Centralized API configuration for the mobile app
// To switch between local development and production:
// 1. For local development: set IS_PRODUCTION = false
// 2. For production: set IS_PRODUCTION = true
//
// This will automatically select the correct API URL

export const API_CONFIG = {
  // Local development API (when running .NET API locally)
  // Check launchSettings.json for the correct port
  // Usually: https://localhost:5001 (HTTPS) or http://localhost:5171 (HTTP)
  LOCAL: "http://172.16.98.172:8080",

  // Railway production API
  RAILWAY: "https://hotelsystem-net-and-reactjs-production.up.railway.app",

  // Environment flag - CHANGE THIS TO SWITCH ENVIRONMENTS
  // Set to `false` for local development (use `LOCAL`).
  // NOTE: switching this to false will make `API_CONFIG.CURRENT` point to your
  // local .NET backend (e.g. `http://192.168.1.2:8080`).
  IS_PRODUCTION: false,

  // Current active API - automatically selected based on IS_PRODUCTION
  get CURRENT() {
    return this.IS_PRODUCTION ? this.RAILWAY : this.LOCAL;
  },
};

// Legacy support - keeping for backward compatibility
export const BASE_URLS: string[] = [API_CONFIG.LOCAL, API_CONFIG.RAILWAY];

export const DEFAULT_BASE_URL = API_CONFIG.CURRENT;

// Helper to build a full URL from a path
import { Platform } from "react-native";

export function buildApiUrl(path: string, base = API_CONFIG.CURRENT): string {
  if (!path) return base;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) path = "/" + path;
  // When running on Android emulator, 'localhost' refers to the device itself.
  // Map to 10.0.2.2 (Android emulator) so fetches hit the host machine.
  try {
    const host = (base || "").trim();
    // Map common hostnames to Android emulator host if needed
    if (Platform.OS === "android") {
      // If using localhost or loopback addresses on emulator, map to 10.0.2.2
      if (
        host.includes("localhost") ||
        host.includes("127.0.0.1") ||
        host.includes("0.0.0.0")
      ) {
        return (
          host.replace(/localhost|127\.0\.0\.1|0\.0\.0\.0/, "10.0.2.2") + path
        );
      }
    }
    return `${host}${path}`;
  } catch (e) {
    // ignore platform read errors in non-RN env
    return `${base}${path}`;
  }
}

export default {
  API_CONFIG,
  BASE_URLS,
  DEFAULT_BASE_URL,
  buildApiUrl,
};
