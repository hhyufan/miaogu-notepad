import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

/**
 * Vite 配置文件
 * @see https://vite.dev/config/
 */
export default defineConfig(async () => ({
  plugins: [react()],
  
  define: {
    global: 'globalThis',
  },
  
  build: {
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

  clearScreen: false, // 防止 Vite 遮盖 Rust 错误
  server: {
    port: 1420, // Tauri 需要固定端口
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
      ignored: ["**/src-tauri/**"], // 忽略 src-tauri 目录监听
    },
  },
}));
