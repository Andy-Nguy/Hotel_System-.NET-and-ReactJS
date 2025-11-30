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
  LOCAL: "https://localhost:5001",

  // Railway production API
  RAILWAY: "https://hotelsystem-net-and-reactjs-production.up.railway.app",

  // Environment flag - CHANGE THIS TO SWITCH ENVIRONMENTS
  IS_PRODUCTION: true, // Set to true for production deployment

  // Current active API - automatically selected based on IS_PRODUCTION
  get CURRENT() {
    return this.IS_PRODUCTION ? this.RAILWAY : this.LOCAL;
  },
};
