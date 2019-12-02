import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev-time proxy: forward API calls starting with /api to the .NET backend
  server: {
    proxy: {
      "/api": {
        // During local development proxy API calls to the local backend
        target: "https://localhost:5001",
        // remote production target kept here for reference:
        // target: "https://hotelsystem-net-and-reactjs-production.up.railway.app",
        changeOrigin: true,
        secure: false,
        rejectUnauthorized: false,
      },
      "/img": {
        // During development prefer the local backend so static images served from the API are available
        target: "https://localhost:5001",
        changeOrigin: true,
        secure: false,
        rejectUnauthorized: false,
      },
      "/assets": {
        // target: "https://hotelsystem-net-and-reactjs-production.up.railway.app",
        // target: "https://localhost:5001",
        // During development prefer the local backend for assets
        target: "https://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "/images": {
        // target: "https://hotelsystem-net-and-reactjs-production.up.railway.app",
        target: "https://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
    },
    // Enable SPA fallback - redirect all routes to index.html
    historyApiFallback: true,
  },
  // Build output goes directly into the backend wwwroot so the .NET app can serve it
  build: {
    outDir: "../Backend/Hotel_System.API/wwwroot",
    emptyOutDir: true,
  },
});
