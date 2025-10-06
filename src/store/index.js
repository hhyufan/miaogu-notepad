/**
 * @fileoverview Redux Store配置 - 应用的状态管理中心
 * 配置Redux store，包含持久化、中间件等功能
 * @author hhyufan
 * @version 1.3.1
 */

import {combineReducers, configureStore} from '@reduxjs/toolkit';
import {FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
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
                if (key === 'theme' && inboundState && typeof inboundState === 'object') {
                    const {backgroundImage, ...rest} = inboundState;


                    return rest;
                }
                return inboundState;
            },
            out: (outboundState, key) => {
                if (key === 'theme' && outboundState && typeof outboundState === 'object') {
                    const result = {
                        ...outboundState,
                        backgroundImage: outboundState.backgroundImage || '' // 保持原有值或设为空字符串
                    };


                    return result;
                }
                return outboundState;
            }
        }
    ],
    // 确保主题设置能够正确持久化
    debug: process.env.NODE_ENV === 'development'
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

