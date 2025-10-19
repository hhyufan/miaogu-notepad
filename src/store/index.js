/**
 * @fileoverview Redux Store配置 - 应用的状态管理中心
 * 配置Redux store，包含持久化、中间件等功能
 * @author hhyufan
 * @version 1.4.0
 */

import {combineReducers, configureStore} from '@reduxjs/toolkit';
import {FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import themeReducer from './slices/themeSlice';
import editorReducer from './slices/editorSlice';
import fileReducer from './slices/fileSlice';
import updateReducer from './slices/updateSlice';
import persistenceMiddleware from './middleware/persistenceMiddleware';

const persistConfig = {
    key: 'miaogu-ide',
    storage,
    whitelist: ['theme', 'editor', 'file', 'update'],
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
    debug: process.env.NODE_ENV === 'development',
    // 添加状态迁移配置，确保新字段能正确初始化
    migrate: (state) => {
        // 创建状态的深拷贝以避免直接修改原状态
        const migratedState = JSON.parse(JSON.stringify(state || {}));
        
        if (migratedState.update) {
            // 确保autoShowUpdateLog有默认值
            if (migratedState.update.autoShowUpdateLog === undefined) {
                migratedState.update.autoShowUpdateLog = true;
            }
            // 重置updateLogShown状态，允许重新自动打开
            migratedState.update.updateLogShown = false;
            migratedState.update.lastShownVersion = null;
        }
        
        // Redux persist的migrate函数必须返回Promise
        return Promise.resolve(migratedState);
    }
};

const rootReducer = combineReducers({
    theme: themeReducer,
    editor: editorReducer,
    file: fileReducer,
    update: updateReducer,
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

