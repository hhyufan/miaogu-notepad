/**
 * @fileoverview 应用程序主入口文件
 * 负责初始化React应用，配置Redux状态管理和持久化存储
 * @author hhyufan
 * @version 1.3.0
 */

import React from "react";
import ReactDOM from "react-dom/client";
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {persistor, store} from './store';
import App from "./App";
import LoadingComponent from './components/LoadingComponent';
import './i18n'

// 禁用默认右键菜单 - 多重保护
// 立即执行，不等待DOMContentLoaded
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
});

// 确保在DOM加载后也生效
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
    
    // 为body元素添加额外保护
    document.body.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
});

// 窗口加载完成后再次确保
window.addEventListener('load', () => {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
});

/**
 * 渲染React应用到DOM
 * 使用React.StrictMode进行开发时的额外检查
 * 通过Provider提供Redux store
 * 通过PersistGate处理持久化存储的加载状态
 */
ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <Provider store={store}>
            <PersistGate
                loading={<LoadingComponent/>}
                persistor={persistor}
                onBeforeLift={() => {
                    // 在持久化恢复完成前的回调

                }}
            >
                <App/>
            </PersistGate>
        </Provider>
    </React.StrictMode>,
);
