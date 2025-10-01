/**
 * @fileoverview Redux Store配置 - 应用的状态管理中心
 * 配置Redux store，包含持久化、中间件等功能
 * @author hhyufan
 * @version 1.3.0
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
  whitelist: ['theme', 'editor', 'file'],
  blacklist: ['ui'],
  transforms: [
    // 排除 backgroundImage 字段，避免存储大量 base64 数据
    {
      in: (inboundState, key) => {
        if (key === 'theme' && inboundState.backgroundImage) {
          const { backgroundImage, ...rest } = inboundState;
          return rest;
        }
        return inboundState;
      },
      out: (outboundState, key) => {
        if (key === 'theme') {
          return {
            ...outboundState,
            backgroundImage: '' // 恢复时重置为空字符串
          };
        }
        return outboundState;
      }
    }
  ]
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

