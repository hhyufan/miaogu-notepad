import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

/**
 * Vite 配置文件
 * @see https:
 */
export default defineConfig(async () => ({
  plugins: [react()],
  
  define: {
    global: 'globalThis',
  },
  
  build: {
    target: 'esnext', // 支持最新的 JavaScript 特性，包括 top-level await
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false,
      },
    },
  },
  
  optimizeDeps: {
    include: ['monaco-editor'],
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
