import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import themeReducer from './slices/themeSlice';
import editorReducer from './slices/editorSlice';
import fileReducer from './slices/fileSlice';
import persistenceMiddleware from './middleware/persistenceMiddleware';

// 持久化配置
const persistConfig = {
  key: 'miaogu-ide',
  storage,
  whitelist: ['theme', 'editor', 'file'], // 只持久化主题、编辑器设置和文件状态
  blacklist: ['ui'], // UI状态不持久化（如窗口大小等）
};

// 合并所有reducer
const rootReducer = combineReducers({
  theme: themeReducer,
  editor: editorReducer,
  file: fileReducer,
});

// 创建持久化的reducer
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

// 创建persistor
export const persistor = persistStore(store);

// TypeScript types would be defined in a .ts file
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;
