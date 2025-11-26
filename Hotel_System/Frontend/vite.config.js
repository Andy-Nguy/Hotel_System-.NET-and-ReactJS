import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SPA routing middleware
function spaFallback() {
  return {
    name: 'spa-fallback',
    configResolved() {},
    transformIndexHtml: {
      order: 'pre',
      handler() {
        // This ensures index.html is served for SPA routes
      }
    },
    middlewares: [
      (req, res, next) => {
        // If request doesn't have a file extension and isn't an API/asset request
        if (!req.url.match(/\.\w+$/i) && 
            !req.url.startsWith('/api') && 
            !req.url.startsWith('/img') && 
            !req.url.startsWith('/images') &&
            !req.url.startsWith('/@')) {
          req.url = '/index.html';
        }
        next();
      }
    ]
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), spaFallback()],
  // Dev-time proxy: forward API calls starting with /api to the .NET backend
  server: {
    proxy: {
      "/api": {
        target: "https://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "/img": {
        target: "https://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "/assets": {
        target: "https://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "/admin": {
        target: "https://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "/images": {
        target: "https://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // Build output goes directly into the backend wwwroot so the .NET app can serve it
  build: {
    outDir: "../Backend/Hotel_System.API/wwwroot",
    emptyOutDir: true,
  },
});
