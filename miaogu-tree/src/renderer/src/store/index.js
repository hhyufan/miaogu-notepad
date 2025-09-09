import { configureStore } from '@reduxjs/toolkit';
import editorReducer from './slices/editorSlice';

// 配置store
export const store = configureStore({
  reducer: {
    editor: editorReducer
  }
});

// 导出类型（在hooks.js中定义）