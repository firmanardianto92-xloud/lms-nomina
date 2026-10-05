import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    rollupOptions: { output: { manualChunks: { charts: ["recharts"], vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"] } } },
  },
  server: {
    port: 5173,
    host: true,
    // Frontend selalu memanggil path relatif /api → diteruskan ke FastAPI.
    proxy: { "/api": { target: process.env.API_URL || "http://localhost:8000", changeOrigin: true } },
  },
});
