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
