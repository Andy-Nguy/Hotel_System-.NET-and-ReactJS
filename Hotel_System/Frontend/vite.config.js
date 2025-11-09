import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    },
  },
  // Build output goes directly into the backend wwwroot so the .NET app can serve it
  build: {
    outDir: "../Backend/Hotel_System.API/wwwroot",
    emptyOutDir: true,
  },
});
