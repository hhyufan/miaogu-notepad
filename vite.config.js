import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

  resolve: {
    alias: {
      path: 'path-browserify',
    },
  },

  build: {
    target: 'esnext', // 支持最新的 JavaScript 特性，包括 top-level await
    minify: 'terser',
    chunkSizeWarningLimit: 5000,
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // React 相关
          'react-vendor': [
            'react',
            'react-dom',
            'react-redux',
            '@reduxjs/toolkit',
          ],

          // Ant Design 相关
          'antd-vendor': ['antd', '@ant-design/icons'],

          // Monaco Editor 相关 (单独分块)
          'monaco-vendor': ['monaco-editor'],

          // Markdown 相关
          'markdown-vendor': [
            'react-markdown',
            'remark-gfm',
            'remark-math',
            'remark-footnotes',
            'rehype-raw',
            'rehype-highlight',
            'rehype-katex',
            'rehype-sanitize',
          ],

          // 代码高亮相关
          'highlight-vendor': [
            'shiki',
            '@shikijs/monaco',
            'prismjs',
            'prism-themes',
          ],

          // 工具库
          'utils-vendor': [
            'lodash',
            'dompurify',
            'mermaid',
            'react-window',
            'react-window-infinite-loader',
          ],

          // 国际化
          'i18n-vendor': [
            'react-i18next',
            'i18next',
            'i18next-browser-languagedetector',
          ],

          // Tauri 相关
          'tauri-vendor': [
            '@tauri-apps/api',
            '@tauri-apps/plugin-fs',
            '@tauri-apps/plugin-dialog',
            '@tauri-apps/plugin-opener',
            '@tauri-apps/plugin-store',
          ],

          // 懒加载组件单独分块
          'editor-chunk': ['./src/components/CodeEditor.jsx'],
          'markdown-chunk': ['./src/components/MarkdownViewer.jsx'],
          'tree-chunk': ['./src/components/TreeEditor.jsx'],
        },
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
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}));
