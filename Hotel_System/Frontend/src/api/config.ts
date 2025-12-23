// API Configuration
// To switch between local development and production:
// 1. For local development: set IS_PRODUCTION = false
// 2. For production: set IS_PRODUCTION = true
//
// This will automatically select the correct API URL

export const API_CONFIG = {
  // Local development API (when running .NET API locally)
  // Check launchSettings.json for the correct port
  // Usually: https://localhost:5001 (HTTPS) or http://localhost:5171 (HTTP)
  LOCAL: "",

  // Railway production API
  RAILWAY: "https://hotelsystem-net-and-reactjs-production.up.railway.app",

  // Environment flag - CHANGE THIS TO SWITCH ENVIRONMENTS
  // Set to `false` for local development (use `LOCAL`).
  // NOTE: switching this to false will make `API_CONFIG.CURRENT` point to your
  // local .NET backend (e.g. `https://localhost:5001`).
  IS_PRODUCTION: false,

  // Current active API - automatically selected based on IS_PRODUCTION
  get CURRENT() {
    return this.IS_PRODUCTION ? this.RAILWAY : this.LOCAL;
  },
};
