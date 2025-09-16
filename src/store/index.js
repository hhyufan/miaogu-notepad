/**
 * @fileoverview Redux Store配置 - 应用的状态管理中心
 * 配置Redux store，包含持久化、中间件等功能
 * @author hhyufan
 * @version 1.2.0
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import themeReducer from './slices/themeSlice';
import editorReducer from './slices/editorSlice';
import fileReducer from './slices/fileSlice';
import persistenceMiddleware from './middleware/persistenceMiddleware';

const persistConfig = {
  key: 'miaogu-ide',
  storage,
  whitelist: ['theme', 'editor', 'file'], // 只持久化主题、编辑器设置和文件状态
  blacklist: ['ui'], // UI状态不持久化（如窗口大小等）
};

const rootReducer = combineReducers({
  theme: themeReducer,
  editor: editorReducer,
  file: fileReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(persistenceMiddleware),
});

export const persistor = persistStore(store);

