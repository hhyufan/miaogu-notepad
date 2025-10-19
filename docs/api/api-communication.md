# API 交互通讯架构文档

## 概述

本文档详细介绍了喵咕记事本的API交互通讯架构，包括前后端通讯机制、数据流向、状态管理、错误处理等核心架构设计。

---

## 🏗️ 整体架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 React 应用                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   UI 组件   │  │  自定义Hook │  │  工具函数   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │               │               │                  │
│         └───────────────┼───────────────┘                  │
│                         │                                  │
│  ┌─────────────────────────────────────────────────────────┤
│  │              Redux 状态管理层                            │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  │ themeSlice  │ │ editorSlice │ │  fileSlice  │       │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │
│  └─────────────────────────────────────────────────────────┤
│                         │                                  │
│  ┌─────────────────────────────────────────────────────────┤
│  │              Tauri API 通讯层                           │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  │  文件操作   │ │  系统集成   │ │  文件监控   │       │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │
│  └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
                         │
                    IPC 通讯协议
                         │
┌─────────────────────────────────────────────────────────────┐
│                   后端 Tauri 应用                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  文件系统   │  │  系统调用   │  │  进程管理   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │               │               │                  │
│  ┌─────────────────────────────────────────────────────────┤
│  │                Rust 核心逻辑                            │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  │  编码检测   │ │  文件监控   │ │  系统功能   │       │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │
│  └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
                         │
                    操作系统 API
                         │
┌─────────────────────────────────────────────────────────────┐
│                     操作系统                                │
│    文件系统 │ 进程管理 │ 网络 │ 硬件抽象层                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 通讯机制

### 1. 前后端通讯协议

#### IPC (Inter-Process Communication) 通讯

| 通讯方向    | 协议类型          | 数据格式 | 描述       |
|---------|---------------|------|----------|
| 前端 → 后端 | Tauri Command | JSON | 前端调用后端功能 |
| 后端 → 前端 | Tauri Event   | JSON | 后端主动推送事件 |
| 双向      | WebSocket     | JSON | 实时数据同步   |

#### 通讯流程

```javascript
// 1. 前端发起请求
const request = {
    command: 'read_file_content',
    payload: {
        file_path: '/path/to/file.txt'
    }
};

// 2. Tauri IPC 传输
const response = await invoke('read_file_content', {
    filePath: '/path/to/file.txt'
});

// 3. 后端处理并返回
{
    success: true,
        data
:
    {
        content: "文件内容",
            encoding
    :
        "utf-8",
            line_ending
    :
        "LF"
    }
,
    error: null
}
```

### 2. 数据序列化

#### 请求数据结构

```typescript
interface ApiRequest<T = any> {
    command: string;           // 命令名称
    payload: T;               // 请求参数
    requestId?: string;       // 请求ID（用于追踪）
    timestamp?: number;       // 时间戳
}
```

#### 响应数据结构

```typescript
interface ApiResponse<T = any> {
    success: boolean;         // 操作是否成功
    data?: T;                // 返回数据
    error?: {                // 错误信息
        code: string;
        message: string;
        details?: any;
    };
    requestId?: string;      // 对应的请求ID
    timestamp: number;       // 响应时间戳
}
```

---

## 📡 API 通讯层

### 1. Tauri API 封装 (tauriApi.js)

#### 核心通讯函数

```javascript
// 基础调用函数
async function invokeCommand(command, payload = {}) {
    try {
        const startTime = performance.now();

        // 添加请求日志
        console.log(`[API] 调用命令: ${command}`, payload);

        const result = await invoke(command, payload);

        const endTime = performance.now();
        console.log(`[API] 命令完成: ${command} (${endTime - startTime}ms)`);

        return {
            success: true,
            data: result,
            error: null,
            duration: endTime - startTime
        };

    } catch (error) {
        console.error(`[API] 命令失败: ${command}`, error);

        return {
            success: false,
            data: null,
            error: {
                code: error.code || 'UNKNOWN_ERROR',
                message: error.message || '未知错误',
                details: error
            }
        };
    }
}

// 带重试机制的调用
async function invokeWithRetry(command, payload, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await invokeCommand(command, payload);

            if (result.success) {
                return result;
            }

            lastError = result.error;

            // 如果是网络错误或临时错误，进行重试
            if (shouldRetry(result.error) && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 指数退避
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            break;

        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    return {
        success: false,
        data: null,
        error: lastError
    };
}

// 判断是否应该重试
function shouldRetry(error) {
    const retryableCodes = [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'TEMPORARY_ERROR',
        'FILE_LOCKED'
    ];

    return retryableCodes.includes(error.code);
}
```

#### API 分类封装

```javascript
// 文件操作 API
export const fileApi = {
    // 读取文件
    async readFile(filePath) {
        return await invokeCommand('read_file_content', {filePath});
    },

    // 写入文件
    async writeFile(filePath, content, encoding = 'utf-8') {
        return await invokeCommand('write_file_content', {
            filePath,
            content,
            encoding
        });
    },

    // 保存文件
    async saveFile(filePath, content, encoding = 'utf-8', lineEnding = 'LF') {
        return await invokeCommand('save_file', {
            filePath,
            content,
            encoding,
            lineEnding
        });
    },

    // 检查文件是否存在
    async checkExists(filePath) {
        return await invokeCommand('check_file_exists', {filePath});
    },

    // 获取文件信息
    async getFileInfo(filePath) {
        return await invokeCommand('get_file_info', {filePath});
    },

    // 获取目录内容
    async getDirectoryContents(dirPath) {
        return await invokeCommand('get_directory_contents', {dirPath});
    },

    // 重命名文件
    async renameFile(oldPath, newPath) {
        return await invokeCommand('rename_file', {oldPath, newPath});
    }
};

// 系统集成 API
export const systemApi = {
    // 执行文件
    async executeFile(filePath) {
        return await invokeCommand('execute_file', {filePath});
    },

    // 在终端中打开
    async openInTerminal(dirPath) {
        return await invokeCommand('open_in_terminal', {dirPath});
    },

    // 在资源管理器中显示
    async showInExplorer(filePath) {
        return await invokeCommand('show_in_explorer', {filePath});
    },

    // 打开URL
    async openUrl(url) {
        return await invokeCommand('open_url', {url});
    },

    // 获取CLI参数
    async getCliArgs() {
        return await invokeCommand('get_cli_args');
    }
};

// 文件监控 API
export const watchApi = {
    // 开始监控文件
    async startWatching(filePath) {
        return await invokeCommand('start_file_watching', {filePath});
    },

    // 停止监控文件
    async stopWatching(filePath) {
        return await invokeCommand('stop_file_watching', {filePath});
    },

    // 检查文件外部变化
    async checkExternalChanges(filePath) {
        return await invokeCommand('check_file_external_changes', {filePath});
    }
};
```

### 2. 事件监听机制

#### 事件监听器设置

```javascript
import {listen} from '@tauri-apps/api/event';

// 事件监听器管理
class EventManager {
    constructor() {
        this.listeners = new Map();
        this.setupEventListeners();
    }

    async setupEventListeners() {
        // 文件变化事件
        const fileChangeUnlisten = await listen('file-changed', (event) => {
            this.handleFileChange(event.payload);
        });
        this.listeners.set('file-changed', fileChangeUnlisten);

        // 系统主题变化事件
        const themeChangeUnlisten = await listen('theme-changed', (event) => {
            this.handleThemeChange(event.payload);
        });
        this.listeners.set('theme-changed', themeChangeUnlisten);

        // 应用焦点事件
        const focusUnlisten = await listen('app-focus', (event) => {
            this.handleAppFocus(event.payload);
        });
        this.listeners.set('app-focus', focusUnlisten);
    }

    handleFileChange(payload) {
        const {file_path, change_type, timestamp} = payload;

        console.log(`[Event] 文件变化: ${file_path} (${change_type})`);

        // 通知Redux状态管理
        store.dispatch(fileChanged({
            filePath: file_path,
            changeType: change_type,
            timestamp
        }));

        // 通知相关组件
        this.notifyComponents('file-changed', payload);
    }

    handleThemeChange(payload) {
        const {theme} = payload;

        console.log(`[Event] 系统主题变化: ${theme}`);

        // 如果设置为跟随系统主题
        const currentTheme = store.getState().theme;
        if (currentTheme.mode === 'auto') {
            store.dispatch(setSystemTheme(theme));
        }
    }

    handleAppFocus(payload) {
        const {focused} = payload;

        console.log(`[Event] 应用焦点变化: ${focused}`);

        if (focused) {
            // 应用获得焦点时，检查文件外部变化
            this.checkAllFilesForExternalChanges();
        }
    }

    async checkAllFilesForExternalChanges() {
        const {openedFiles} = store.getState().file;

        for (const file of openedFiles) {
            try {
                const result = await watchApi.checkExternalChanges(file.path);

                if (result.success && result.data.changed) {
                    // 文件有外部变化，提示用户
                    this.showExternalChangeDialog(file);
                }
            } catch (error) {
                console.error(`检查文件外部变化失败: ${file.path}`, error);
            }
        }
    }

    showExternalChangeDialog(file) {
        // 显示文件外部变化对话框
        const dialog = {
            title: '文件外部变化',
            message: `文件 "${file.name}" 已被外部程序修改，是否重新加载？`,
            buttons: ['重新加载', '保留当前版本', '比较差异'],
            defaultButton: 0
        };

        // 这里应该调用对话框组件
        showDialog(dialog).then((buttonIndex) => {
            switch (buttonIndex) {
                case 0: // 重新加载
                    this.reloadFile(file);
                    break;
                case 1: // 保留当前版本
                    // 不做任何操作
                    break;
                case 2: // 比较差异
                    this.showFileDiff(file);
                    break;
            }
        });
    }

    notifyComponents(eventType, payload) {
        // 通过自定义事件通知组件
        const customEvent = new CustomEvent(eventType, {
            detail: payload
        });

        window.dispatchEvent(customEvent);
    }

    // 清理事件监听器
    cleanup() {
        this.listeners.forEach((unlisten) => {
            unlisten();
        });
        this.listeners.clear();
    }
}

// 全局事件管理器实例
export const eventManager = new EventManager();
```

---

## 🔄 数据流管理

### 1. Redux 数据流

#### 数据流向图

```
用户操作 → Action Creator → Action → Reducer → Store → Component
    ↑                                                      ↓
    └─────────────── UI 更新 ← Selector ← useSelector ←────┘
```

#### 异步数据流

```javascript
// 异步 Action Creator (使用 Redux Toolkit)
export const loadFileAsync = createAsyncThunk(
    'file/loadFile',
    async (filePath, {dispatch, getState, rejectWithValue}) => {
        try {
            // 设置加载状态
            dispatch(setLoading(true));

            // 调用 Tauri API
            const result = await fileApi.readFile(filePath);

            if (!result.success) {
                return rejectWithValue(result.error);
            }

            // 检测语言类型
            const language = detectLanguage(filePath);

            // 添加到最近文件
            dispatch(addToRecentFiles({
                path: filePath,
                name: getFileName(filePath),
                lastOpened: Date.now()
            }));

            return {
                ...result.data,
                language,
                filePath
            };

        } catch (error) {
            return rejectWithValue({
                code: 'LOAD_FILE_ERROR',
                message: error.message
            });
        } finally {
            dispatch(setLoading(false));
        }
    }
);

// 在组件中使用
function FileManager() {
    const dispatch = useDispatch();
    const {isLoading, error} = useSelector(state => state.file);

    const handleLoadFile = async (filePath) => {
        try {
            const result = await dispatch(loadFileAsync(filePath));

            if (loadFileAsync.fulfilled.match(result)) {
                // 加载成功
                console.log('文件加载成功:', result.payload);
            } else {
                // 加载失败
                console.error('文件加载失败:', result.payload);
            }
        } catch (error) {
            console.error('加载文件时发生错误:', error);
        }
    };

    return (
        <div>
            {isLoading && <div>加载中...</div>}
            {error && <div>错误: {error.message}</div>}
            <button onClick={() => handleLoadFile('/path/to/file.txt')}>
                加载文件
            </button>
        </div>
    );
}
```

### 2. 状态同步机制

#### 状态持久化

```javascript
// 状态持久化配置
const persistConfig = {
    key: 'root',
    storage: storage,
    whitelist: ['theme', 'editor', 'file'],
    transforms: [
        // 主题状态转换器
        createTransform(
            // 保存时转换
            (inboundState, key) => {
                if (key === 'theme') {
                    // 不保存背景图片等临时数据
                    const {backgroundImage, ...rest} = inboundState;
                    return rest;
                }
                return inboundState;
            },
            // 加载时转换
            (outboundState, key) => {
                if (key === 'theme') {
                    return {
                        ...outboundState,
                        backgroundImage: null
                    };
                }
                return outboundState;
            }
        )
    ]
};

// 状态同步中间件
const stateSyncMiddleware = (store) => (next) => (action) => {
    const result = next(action);

    // 在特定 action 后同步状态到后端
    const syncActions = [
        'theme/setThemeMode',
        'editor/updateEditorConfig',
        'file/saveSession'
    ];

    if (syncActions.includes(action.type)) {
        // 异步同步到后端存储
        syncStateToBackend(store.getState());
    }

    return result;
};

async function syncStateToBackend(state) {
    try {
        const syncData = {
            theme: state.theme,
            editor: state.editor,
            session: state.file.sessionData
        };

        await settingsApi.saveSettings('app-state', syncData);
    } catch (error) {
        console.error('同步状态到后端失败:', error);
    }
}
```

---

## 🛡️ 错误处理机制

### 1. 错误分类

| 错误类型 | 错误代码                | 描述     | 处理策略  |
|------|---------------------|--------|-------|
| 网络错误 | `NETWORK_ERROR`     | 网络连接问题 | 重试机制  |
| 文件错误 | `FILE_NOT_FOUND`    | 文件不存在  | 用户提示  |
| 权限错误 | `PERMISSION_DENIED` | 权限不足   | 权限申请  |
| 编码错误 | `ENCODING_ERROR`    | 文件编码问题 | 编码转换  |
| 系统错误 | `SYSTEM_ERROR`      | 系统级错误  | 错误报告  |
| 超时错误 | `TIMEOUT_ERROR`     | 操作超时   | 重试或取消 |

### 2. 错误处理流程

```javascript
// 全局错误处理器
class ErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.isProcessing = false;
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // 捕获未处理的 Promise 错误
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'UNHANDLED_PROMISE',
                error: event.reason,
                context: 'global'
            });
        });

        // 捕获 JavaScript 错误
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'JAVASCRIPT_ERROR',
                error: event.error,
                context: 'global',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
    }

    async handleError(errorInfo) {
        const {type, error, context} = errorInfo;

        // 错误分类处理
        switch (type) {
            case 'API_ERROR':
                await this.handleApiError(error, context);
                break;
            case 'FILE_ERROR':
                await this.handleFileError(error, context);
                break;
            case 'SYSTEM_ERROR':
                await this.handleSystemError(error, context);
                break;
            default:
                await this.handleGenericError(error, context);
        }
    }

    async handleApiError(error, context) {
        const {code, message} = error;

        switch (code) {
            case 'NETWORK_ERROR':
                // 网络错误 - 显示重试选项
                this.showRetryDialog(message, () => {
                    // 重试逻辑
                    context.retry?.();
                });
                break;

            case 'TIMEOUT_ERROR':
                // 超时错误 - 增加超时时间或取消操作
                this.showTimeoutDialog(message, {
                    onRetry: context.retry,
                    onCancel: context.cancel
                });
                break;

            case 'PERMISSION_DENIED':
                // 权限错误 - 申请权限或提示用户
                this.showPermissionDialog(message);
                break;

            default:
                this.showErrorNotification(message);
        }
    }

    async handleFileError(error, context) {
        const {code, message, details} = error;

        switch (code) {
            case 'FILE_NOT_FOUND':
                // 文件不存在 - 提示用户选择其他文件
                this.showFileNotFoundDialog(details.filePath);
                break;

            case 'ENCODING_ERROR':
                // 编码错误 - 提供编码选择
                this.showEncodingDialog(details.filePath, details.detectedEncodings);
                break;

            case 'FILE_LOCKED':
                // 文件被锁定 - 提示稍后重试
                this.showFileLockedDialog(details.filePath);
                break;

            default:
                this.showErrorNotification(message);
        }
    }

    showRetryDialog(message, onRetry) {
        const dialog = {
            type: 'error',
            title: '网络错误',
            message: message,
            buttons: ['重试', '取消'],
            defaultButton: 0
        };

        showDialog(dialog).then((buttonIndex) => {
            if (buttonIndex === 0) {
                onRetry();
            }
        });
    }

    showErrorNotification(message) {
        // 显示错误通知
        const notification = {
            type: 'error',
            title: '操作失败',
            message: message,
            duration: 5000
        };

        showNotification(notification);
    }

    // 错误报告
    async reportError(error, context) {
        const errorReport = {
            timestamp: Date.now(),
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: getCurrentUserId() // 如果有用户系统
        };

        try {
            // 发送错误报告到后端
            await systemApi.reportError(errorReport);
        } catch (reportError) {
            console.error('发送错误报告失败:', reportError);
        }
    }
}

// 全局错误处理器实例
export const errorHandler = new ErrorHandler();
```

### 3. API 调用错误处理

```javascript
// 带错误处理的 API 调用包装器
export function withErrorHandling(apiCall, options = {}) {
    return async (...args) => {
        const {
            retries = 3,
            timeout = 10000,
            onError,
            onRetry,
            context
        } = options;

        let lastError;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // 设置超时
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('TIMEOUT_ERROR')), timeout);
                });

                const apiPromise = apiCall(...args);
                const result = await Promise.race([apiPromise, timeoutPromise]);

                if (result.success) {
                    return result;
                }

                lastError = result.error;

                // 判断是否应该重试
                if (shouldRetry(result.error) && attempt < retries) {
                    if (onRetry) {
                        onRetry(attempt, result.error);
                    }

                    // 指数退避延迟
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                break;

            } catch (error) {
                lastError = {
                    code: error.message === 'TIMEOUT_ERROR' ? 'TIMEOUT_ERROR' : 'UNKNOWN_ERROR',
                    message: error.message,
                    details: error
                };

                if (attempt < retries) {
                    if (onRetry) {
                        onRetry(attempt, lastError);
                    }

                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // 所有重试都失败了
        const finalError = {
            success: false,
            data: null,
            error: lastError
        };

        if (onError) {
            onError(finalError, context);
        } else {
            errorHandler.handleError({
                type: 'API_ERROR',
                error: lastError,
                context: context
            });
        }

        return finalError;
    };
}

// 使用示例
const safeReadFile = withErrorHandling(fileApi.readFile, {
    retries: 3,
    timeout: 5000,
    onError: (error, context) => {
        console.error('读取文件失败:', error);
        showErrorNotification(`无法读取文件: ${context.filePath}`);
    },
    onRetry: (attempt, error) => {
        console.log(`重试读取文件 (第${attempt}次):`, error);
    }
});

// 在组件中使用
async function handleOpenFile(filePath) {
    const result = await safeReadFile(filePath);

    if (result.success) {
        // 处理成功结果
        setFileContent(result.data.content);
    }
    // 错误已经被 withErrorHandling 处理了
}
```

---

## 🚀 性能优化

### 1. API 调用优化

#### 请求缓存机制

```javascript
// API 缓存管理器
class ApiCache {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    }

    // 生成缓存键
    generateKey(command, payload) {
        return `${command}:${JSON.stringify(payload)}`;
    }

    // 获取缓存
    get(command, payload) {
        const key = this.generateKey(command, payload);
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        // 缓存过期，删除
        this.cache.delete(key);
        return null;
    }

    // 设置缓存
    set(command, payload, data) {
        const key = this.generateKey(command, payload);
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // 清除缓存
    clear(pattern) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }
}

const apiCache = new ApiCache();

// 带缓存的 API 调用
async function cachedInvoke(command, payload, useCache = true) {
    if (useCache) {
        const cached = apiCache.get(command, payload);
        if (cached) {
            console.log(`[Cache] 命中缓存: ${command}`);
            return cached;
        }
    }

    const result = await invokeCommand(command, payload);

    if (result.success && useCache) {
        apiCache.set(command, payload, result);
    }

    return result;
}
```

#### 请求批处理

```javascript
// 批处理管理器
class BatchProcessor {
    constructor() {
        this.batches = new Map();
        this.batchTimeout = 100; // 100ms 批处理窗口
    }

    // 添加到批处理队列
    add(command, payload) {
        return new Promise((resolve, reject) => {
            if (!this.batches.has(command)) {
                this.batches.set(command, {
                    requests: [],
                    timer: null
                });
            }

            const batch = this.batches.get(command);
            batch.requests.push({payload, resolve, reject});

            // 设置批处理定时器
            if (!batch.timer) {
                batch.timer = setTimeout(() => {
                    this.processBatch(command);
                }, this.batchTimeout);
            }
        });
    }

    // 处理批处理
    async processBatch(command) {
        const batch = this.batches.get(command);
        if (!batch || batch.requests.length === 0) {
            return;
        }

        const requests = batch.requests.splice(0);
        clearTimeout(batch.timer);
        batch.timer = null;

        try {
            // 根据命令类型进行批处理
            switch (command) {
                case 'get_file_info':
                    await this.batchGetFileInfo(requests);
                    break;
                case 'check_file_exists':
                    await this.batchCheckFileExists(requests);
                    break;
                default:
                    // 不支持批处理的命令，逐个执行
                    for (const request of requests) {
                        try {
                            const result = await invokeCommand(command, request.payload);
                            request.resolve(result);
                        } catch (error) {
                            request.reject(error);
                        }
                    }
            }
        } catch (error) {
            // 批处理失败，拒绝所有请求
            requests.forEach(request => request.reject(error));
        }
    }

    async batchGetFileInfo(requests) {
        const filePaths = requests.map(req => req.payload.filePath);

        try {
            const result = await invokeCommand('batch_get_file_info', {filePaths});

            if (result.success) {
                // 分发结果给各个请求
                requests.forEach((request, index) => {
                    request.resolve({
                        success: true,
                        data: result.data[index]
                    });
                });
            } else {
                throw result.error;
            }
        } catch (error) {
            requests.forEach(request => request.reject(error));
        }
    }
}

const batchProcessor = new BatchProcessor();

// 批处理 API 调用
export function batchInvoke(command, payload) {
    return batchProcessor.add(command, payload);
}
```

### 2. 数据传输优化

#### 数据压缩

```javascript
// 数据压缩工具
import {compress, decompress} from 'lz-string';

// 压缩大文件内容
function compressContent(content) {
    if (content.length > 10000) { // 大于10KB的内容进行压缩
        return {
            compressed: true,
            data: compress(content)
        };
    }

    return {
        compressed: false,
        data: content
    };
}

// 解压缩内容
function decompressContent(data) {
    if (data.compressed) {
        return decompress(data.data);
    }

    return data.data;
}

// 优化的文件读取
export async function optimizedReadFile(filePath) {
    const result = await invokeCommand('read_file_content', {filePath});

    if (result.success) {
        // 解压缩内容
        result.data.content = decompressContent(result.data.content);
    }

    return result;
}
```

#### 流式传输

```javascript
// 大文件流式读取
export async function streamReadFile(filePath, chunkSize = 64 * 1024) {
    const fileInfo = await fileApi.getFileInfo(filePath);

    if (!fileInfo.success) {
        return fileInfo;
    }

    const totalSize = fileInfo.data.size;
    const chunks = Math.ceil(totalSize / chunkSize);
    let content = '';

    for (let i = 0; i < chunks; i++) {
        const offset = i * chunkSize;
        const size = Math.min(chunkSize, totalSize - offset);

        const chunkResult = await invokeCommand('read_file_chunk', {
            filePath,
            offset,
            size
        });

        if (!chunkResult.success) {
            return chunkResult;
        }

        content += chunkResult.data.content;

        // 通知进度
        const progress = ((i + 1) / chunks) * 100;
        onProgress?.(progress);
    }

    return {
        success: true,
        data: {
            content,
            encoding: fileInfo.data.encoding,
            line_ending: fileInfo.data.line_ending
        }
    };
}
```

---

## 📊 监控和调试

### 1. API 调用监控

```javascript
// API 监控器
class ApiMonitor {
    constructor() {
        this.metrics = {
            totalCalls: 0,
            successCalls: 0,
            errorCalls: 0,
            averageResponseTime: 0,
            callsByCommand: new Map(),
            errorsByType: new Map()
        };

        this.isEnabled = process.env.NODE_ENV === 'development';
    }

    // 记录 API 调用
    recordCall(command, duration, success, error) {
        if (!this.isEnabled) return;

        this.metrics.totalCalls++;

        if (success) {
            this.metrics.successCalls++;
        } else {
            this.metrics.errorCalls++;

            if (error) {
                const errorType = error.code || 'UNKNOWN';
                this.metrics.errorsByType.set(
                    errorType,
                    (this.metrics.errorsByType.get(errorType) || 0) + 1
                );
            }
        }

        // 更新平均响应时间
        this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime * (this.metrics.totalCalls - 1) + duration) /
            this.metrics.totalCalls;

        // 记录命令调用次数
        this.metrics.callsByCommand.set(
            command,
            (this.metrics.callsByCommand.get(command) || 0) + 1
        );
    }

    // 获取监控报告
    getReport() {
        return {
            ...this.metrics,
            successRate: (this.metrics.successCalls / this.metrics.totalCalls) * 100,
            errorRate: (this.metrics.errorCalls / this.metrics.totalCalls) * 100,
            callsByCommand: Object.fromEntries(this.metrics.callsByCommand),
            errorsByType: Object.fromEntries(this.metrics.errorsByType)
        };
    }

    // 重置监控数据
    reset() {
        this.metrics = {
            totalCalls: 0,
            successCalls: 0,
            errorCalls: 0,
            averageResponseTime: 0,
            callsByCommand: new Map(),
            errorsByType: new Map()
        };
    }
}

const apiMonitor = new ApiMonitor();

// 监控装饰器
function withMonitoring(originalInvoke) {
    return async function (command, payload) {
        const startTime = performance.now();

        try {
            const result = await originalInvoke(command, payload);
            const duration = performance.now() - startTime;

            apiMonitor.recordCall(command, duration, result.success, result.error);

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            apiMonitor.recordCall(command, duration, false, error);
            throw error;
        }
    };
}

// 应用监控
const monitoredInvoke = withMonitoring(invokeCommand);
```

### 2. 调试工具

```javascript
// API 调试器
class ApiDebugger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.isEnabled = process.env.NODE_ENV === 'development';
    }

    log(type, command, payload, result, duration) {
        if (!this.isEnabled) return;

        const logEntry = {
            timestamp: Date.now(),
            type,
            command,
            payload: JSON.parse(JSON.stringify(payload)), // 深拷贝
            result: JSON.parse(JSON.stringify(result)),
            duration
        };

        this.logs.push(logEntry);

        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // 控制台输出
        const style = type === 'success' ? 'color: green' : 'color: red';
        console.groupCollapsed(`%c[API] ${command} (${duration}ms)`, style);
        console.log('Payload:', payload);
        console.log('Result:', result);
        console.groupEnd();
    }

    // 获取调试日志
    getLogs(filter) {
        let logs = this.logs;

        if (filter) {
            logs = logs.filter(log => {
                if (filter.command && !log.command.includes(filter.command)) {
                    return false;
                }
                if (filter.type && log.type !== filter.type) {
                    return false;
                }
                if (filter.timeRange) {
                    const {start, end} = filter.timeRange;
                    if (log.timestamp < start || log.timestamp > end) {
                        return false;
                    }
                }
                return true;
            });
        }

        return logs;
    }

    // 导出调试日志
    exportLogs() {
        const data = JSON.stringify(this.logs, null, 2);
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `api-debug-logs-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // 清除日志
    clearLogs() {
        this.logs = [];
    }
}

const apiDebugger = new ApiDebugger();

// 调试装饰器
function withDebugging(originalInvoke) {
    return async function (command, payload) {
        const startTime = performance.now();

        try {
            const result = await originalInvoke(command, payload);
            const duration = performance.now() - startTime;

            apiDebugger.log('success', command, payload, result, duration);

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            apiDebugger.log('error', command, payload, error, duration);
            throw error;
        }
    };
}

// 开发者工具集成
if (process.env.NODE_ENV === 'development') {
    window.__MIAOGU_DEBUG__ = {
        apiMonitor,
        apiDebugger,
        getApiReport: () => apiMonitor.getReport(),
        exportApiLogs: () => apiDebugger.exportLogs(),
        clearApiLogs: () => apiDebugger.clearLogs()
    };
}
```

---

## 🔧 配置和部署

### 1. 环境配置

```javascript
// API 配置
const apiConfig = {
    development: {
        timeout: 30000,
        retries: 3,
        cacheEnabled: true,
        debugEnabled: true,
        monitoringEnabled: true
    },

    production: {
        timeout: 10000,
        retries: 2,
        cacheEnabled: true,
        debugEnabled: false,
        monitoringEnabled: false
    },

    test: {
        timeout: 5000,
        retries: 1,
        cacheEnabled: false,
        debugEnabled: true,
        monitoringEnabled: true
    }
};

// 获取当前环境配置
export function getApiConfig() {
    const env = process.env.NODE_ENV || 'development';
    return apiConfig[env] || apiConfig.development;
}
```

### 2. 构建优化

```javascript
// Vite 配置优化
export default defineConfig({
    // ... 其他配置

    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // 将 API 相关代码分离到单独的 chunk
                    'api': ['./src/utils/tauriApi.js'],
                    'store': ['./src/store/index.js'],
                    'components': ['./src/components/index.js']
                }
            }
        }
    },

    // 开发服务器配置
    server: {
        // 代理配置（如果需要）
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            }
        }
    }
});
```

---

## 📝 最佳实践

### 1. API 设计原则

1. **一致性**: 所有 API 使用统一的请求/响应格式
2. **错误处理**: 提供详细的错误信息和错误代码
3. **性能优化**: 使用缓存、批处理、压缩等技术
4. **安全性**: 验证输入参数，防止注入攻击
5. **可测试性**: 提供模拟数据和测试工具

### 2. 开发建议

1. **使用 TypeScript**: 提供类型安全和更好的开发体验
2. **错误边界**: 在组件层面处理 API 错误
3. **加载状态**: 为所有异步操作提供加载指示
4. **用户反馈**: 及时向用户反馈操作结果
5. **日志记录**: 记录重要的 API 调用和错误信息

### 3. 性能优化建议

1. **请求合并**: 合并相似的 API 请求
2. **缓存策略**: 合理使用缓存减少重复请求
3. **懒加载**: 按需加载数据和组件
4. **虚拟化**: 对大量数据使用虚拟滚动
5. **防抖节流**: 对频繁的用户操作进行防抖处理

---

## 🔍 故障排查

### 常见问题和解决方案

| 问题       | 可能原因         | 解决方案                |
|----------|--------------|---------------------|
| API 调用超时 | 网络问题或后端响应慢   | 增加超时时间，检查网络连接       |
| 文件读取失败   | 文件不存在或权限不足   | 检查文件路径和权限           |
| 编码错误     | 文件编码不支持      | 提供编码选择或自动检测         |
| 内存泄漏     | 事件监听器未清理     | 在组件卸载时清理监听器         |
| 状态不同步    | Redux 状态更新问题 | 检查 reducer 和 action |

---

*本文档基于 miaogu-notepad v1.4.0 版本编写，涵盖了完整的 API 交互通讯架构*
