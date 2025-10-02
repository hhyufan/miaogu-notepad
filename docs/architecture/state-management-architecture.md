# 状态管理架构设计文档

## 概述

本文档详细介绍喵咕记事本的状态管理架构设计，基于Redux Toolkit构建的现代化状态管理系统。该架构采用模块化设计，支持状态持久化、异步操作、中间件扩展等高级特性，为应用提供了稳定、高效、可维护的状态管理基础。

### 核心特性

- **模块化状态设计**: 基于Slice的状态模块划分
- **类型安全**: TypeScript支持的类型化状态管理
- **状态持久化**: 自动保存和恢复应用状态
- **异步状态管理**: 支持复杂的异步操作流程
- **中间件扩展**: 灵活的中间件系统
- **性能优化**: 防抖、批量更新、选择器优化
- **错误处理**: 完善的错误传播和恢复机制

## Redux Store架构

### 1. Store结构设计

#### 1.1 根状态结构

```javascript
// 应用根状态结构
const RootState = {
  theme: {
    // 主题相关状态
    theme: 'light',                    // 当前主题
    fontSize: 14,                      // 字体大小
    fontFamily: 'Consolas',            // 字体族
    lineHeight: 1.5,                   // 行高
    backgroundImage: null,             // 背景图片
    backgroundEnabled: false,          // 背景启用状态
    backgroundTransparency: {}         // 背景透明度配置
  },
  editor: {
    // 编辑器相关状态
    currentFile: null,                 // 当前文件
    openFiles: [],                     // 打开的文件列表
    editorSettings: {                  // 编辑器配置
      wordWrap: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      tabSize: 2,
      insertSpaces: true
    },
    cursorPosition: { line: 0, column: 0 }, // 光标位置
    searchQuery: '',                   // 搜索查询
    editorMode: 'normal'               // 编辑器模式
  },
  file: {
    // 文件系统相关状态
    currentFile: {                     // 当前文件详情
      id: null,
      name: '',
      path: '',
      content: '',
      language: 'plaintext',
      encoding: 'utf-8',
      lastModified: null,
      isUnsaved: false
    },
    openedFiles: [],                   // 已打开文件列表
    editorContent: '',                 // 编辑器内容
    treeData: [],                      // 文件树数据
    selectedKeys: [],                  // 选中的文件节点
    expandedKeys: [],                  // 展开的文件夹节点
    recentFiles: [],                   // 最近文件
    unsavedContent: {},                // 未保存内容
    fileWatchers: new Map(),           // 文件监听器
    rootPath: null,                    // 根路径
    isLoading: false,                  // 加载状态
    error: null                        // 错误信息
  },
  ui: {
    // 界面状态
    sidebarVisible: true,              // 侧边栏可见性
    tabBarVisible: true,               // 标签栏可见性
    statusBarVisible: true,            // 状态栏可见性
    loading: false,                    // 全局加载状态
    globalError: null                  // 全局错误
  }
}
```

#### 1.2 Store配置

```javascript
// src/store/index.js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, createTransform } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { 
  FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER 
} from 'redux-persist';

import themeReducer from './slices/themeSlice';
import editorReducer from './slices/editorSlice';
import fileReducer from './slices/fileSlice';
import persistenceMiddleware from './middleware/persistenceMiddleware';

// 持久化配置
const persistConfig = {
  key: 'miaogu-ide',
  storage,
  whitelist: ['theme', 'editor', 'file'], // 需要持久化的状态
  transforms: [
    // 排除backgroundImage字段的持久化
    createTransform(
      (inboundState) => {
        const { backgroundImage, ...rest } = inboundState;
        return rest;
      },
      (outboundState) => outboundState,
      { whitelist: ['theme'] }
    )
  ]
};

// 根Reducer组合
const rootReducer = combineReducers({
  theme: themeReducer,
  editor: editorReducer,
  file: fileReducer
});

// 持久化Reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Store配置
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(persistenceMiddleware),
  devTools: process.env.NODE_ENV !== 'production'
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 2. Slice设计模式

#### 2.1 Theme Slice

```javascript
// src/store/slices/themeSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  theme: 'light',
  fontSize: 14,
  fontFamily: 'Consolas',
  lineHeight: 1.5,
  backgroundImage: null,
  backgroundEnabled: false,
  backgroundTransparency: {
    light: 0.8,
    dark: 0.7
  }
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    // 设置主题
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    
    // 设置字体大小
    setFontSize: (state, action) => {
      state.fontSize = action.payload;
    },
    
    // 设置字体族
    setFontFamily: (state, action) => {
      state.fontFamily = action.payload;
    },
    
    // 设置行高
    setLineHeight: (state, action) => {
      state.lineHeight = action.payload;
    },
    
    // 设置背景图片
    setBackgroundImage: (state, action) => {
      state.backgroundImage = action.payload;
    },
    
    // 启用/禁用背景
    setBackgroundEnabled: (state, action) => {
      state.backgroundEnabled = action.payload;
    },
    
    // 设置背景透明度
    setBackgroundTransparency: (state, action) => {
      const { theme, value } = action.payload;
      state.backgroundTransparency[theme] = value;
    },
    
    // 重置主题设置
    resetTheme: (state) => {
      return { ...initialState };
    }
  }
});

export const {
  setTheme,
  setFontSize,
  setFontFamily,
  setLineHeight,
  setBackgroundImage,
  setBackgroundEnabled,
  setBackgroundTransparency,
  resetTheme
} = themeSlice.actions;

export default themeSlice.reducer;

// 选择器
export const selectTheme = (state) => state.theme.theme;
export const selectFontSize = (state) => state.theme.fontSize;
export const selectBackgroundConfig = (state) => ({
  image: state.theme.backgroundImage,
  enabled: state.theme.backgroundEnabled,
  transparency: state.theme.backgroundTransparency[state.theme.theme]
});
```

#### 2.2 File Slice

```javascript
// src/store/slices/fileSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 异步Thunk - 打开文件
export const openFileAsync = createAsyncThunk(
  'file/openFile',
  async (filePath, { dispatch, getState, rejectWithValue }) => {
    try {
      // 调用Tauri API读取文件
      const result = await window.__TAURI__.fs.readTextFile(filePath);
      
      // 检测文件语言
      const language = detectLanguageFromPath(filePath);
      
      // 获取文件信息
      const fileInfo = await window.__TAURI__.fs.metadata(filePath);
      
      return {
        id: generateFileId(),
        name: getFileName(filePath),
        path: filePath,
        content: result,
        language,
        encoding: 'utf-8',
        lastModified: fileInfo.modifiedAt,
        isUnsaved: false
      };
    } catch (error) {
      return rejectWithValue({
        code: 'FILE_READ_ERROR',
        message: error.message,
        path: filePath
      });
    }
  }
);

// 异步Thunk - 保存文件
export const saveFileAsync = createAsyncThunk(
  'file/saveFile',
  async ({ filePath, content }, { dispatch, rejectWithValue }) => {
    try {
      await window.__TAURI__.fs.writeTextFile(filePath, content);
      
      const fileInfo = await window.__TAURI__.fs.metadata(filePath);
      
      return {
        path: filePath,
        content,
        lastModified: fileInfo.modifiedAt,
        isUnsaved: false
      };
    } catch (error) {
      return rejectWithValue({
        code: 'FILE_SAVE_ERROR',
        message: error.message,
        path: filePath
      });
    }
  }
);

const initialState = {
  currentFile: {
    id: null,
    name: '',
    path: '',
    content: '',
    language: 'plaintext',
    encoding: 'utf-8',
    lastModified: null,
    isUnsaved: false
  },
  openedFiles: [],
  editorContent: '',
  isLoading: false,
  error: null
};

const fileSlice = createSlice({
  name: 'file',
  initialState,
  reducers: {
    // 创建新文件
    createFile: (state, action) => {
      const newFile = {
        id: generateFileId(),
        name: action.payload.name || 'Untitled',
        path: '',
        content: '',
        language: action.payload.language || 'plaintext',
        encoding: 'utf-8',
        lastModified: null,
        isUnsaved: true
      };
      
      state.currentFile = newFile;
      state.editorContent = '';
      
      // 添加到已打开文件列表
      const existingIndex = state.openedFiles.findIndex(f => f.id === newFile.id);
      if (existingIndex === -1) {
        state.openedFiles.push(newFile);
      }
    },
    
    // 更新编辑器内容
    updateEditorContent: (state, action) => {
      state.editorContent = action.payload;
      if (state.currentFile.id) {
        state.currentFile.isUnsaved = state.currentFile.content !== action.payload;
      }
    },
    
    // 关闭文件
    closeFile: (state, action) => {
      const fileId = action.payload;
      state.openedFiles = state.openedFiles.filter(f => f.id !== fileId);
      
      // 如果关闭的是当前文件，切换到其他文件
      if (state.currentFile.id === fileId) {
        state.currentFile = state.openedFiles.length > 0 
          ? state.openedFiles[0] 
          : initialState.currentFile;
        state.editorContent = state.currentFile.content;
      }
    },
    
    // 切换文件
    switchFile: (state, action) => {
      const fileId = action.payload;
      const file = state.openedFiles.find(f => f.id === fileId);
      if (file) {
        state.currentFile = file;
        state.editorContent = file.content;
      }
    },
    
    // 清除错误
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // 打开文件
      .addCase(openFileAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(openFileAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        const file = action.payload;
        
        // 检查文件是否已打开
        const existingIndex = state.openedFiles.findIndex(f => f.path === file.path);
        if (existingIndex !== -1) {
          // 更新已存在的文件
          state.openedFiles[existingIndex] = file;
        } else {
          // 添加新文件
          state.openedFiles.push(file);
        }
        
        state.currentFile = file;
        state.editorContent = file.content;
      })
      .addCase(openFileAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // 保存文件
      .addCase(saveFileAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(saveFileAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        const { path, content, lastModified } = action.payload;
        
        // 更新当前文件
        if (state.currentFile.path === path) {
          state.currentFile.content = content;
          state.currentFile.lastModified = lastModified;
          state.currentFile.isUnsaved = false;
        }
        
        // 更新已打开文件列表
        const fileIndex = state.openedFiles.findIndex(f => f.path === path);
        if (fileIndex !== -1) {
          state.openedFiles[fileIndex].content = content;
          state.openedFiles[fileIndex].lastModified = lastModified;
          state.openedFiles[fileIndex].isUnsaved = false;
        }
      })
      .addCase(saveFileAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  }
});

export const {
  createFile,
  updateEditorContent,
  closeFile,
  switchFile,
  clearError
} = fileSlice.actions;

export default fileSlice.reducer;

// 选择器
export const selectCurrentFile = (state) => state.file.currentFile;
export const selectOpenedFiles = (state) => state.file.openedFiles;
export const selectEditorContent = (state) => state.file.editorContent;
export const selectFileLoading = (state) => state.file.isLoading;
export const selectFileError = (state) => state.file.error;
export const selectUnsavedFiles = (state) => 
  state.file.openedFiles.filter(file => file.isUnsaved);
```

## 中间件架构

### 1. 持久化中间件

```javascript
// src/store/middleware/persistenceMiddleware.js
import { persistenceManager } from '../../utils/persistenceManager';

/**
 * 持久化中间件
 * 监听Redux状态变化并自动保存到Tauri Store
 */
const persistenceMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  const state = store.getState();

  // 需要持久化的Action类型
  const persistableActions = [
    // 主题相关
    'theme/setTheme',
    'theme/setFontFamily',
    'theme/setLineHeight',
    'theme/setBackgroundImage',
    'theme/setBackgroundEnabled',
    'theme/setBackgroundTransparency',
    
    // 编辑器相关
    'editor/setLanguage',
    'editor/setWordWrap',
    'editor/setMinimap',
    'editor/updateEditorSettings',
    
    // 文件相关
    'file/openFile',
    'file/createFile',
    'file/saveFile',
    'file/closeFile',
    'file/switchFile',
    'file/updateFileContent'
  ];

  // 异步持久化，避免阻塞主线程
  if (persistableActions.includes(action.type)) {
    setTimeout(() => {
      persistenceManager.saveAppState(state).catch(error => {
        console.warn('状态持久化失败:', error);
      });
    }, 0);
  }

  return result;
};

export default persistenceMiddleware;
```

### 2. 错误处理中间件

```javascript
// src/store/middleware/errorMiddleware.js
const errorMiddleware = (store) => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux Action执行错误:', {
      action: action.type,
      payload: action.payload,
      error: error.message,
      stack: error.stack
    });
    
    // 分发全局错误Action
    store.dispatch({
      type: 'ui/setGlobalError',
      payload: {
        code: 'REDUX_ERROR',
        message: error.message,
        action: action.type,
        timestamp: Date.now()
      }
    });
    
    return error;
  }
};

export default errorMiddleware;
```

### 3. 日志中间件

```javascript
// src/store/middleware/loggerMiddleware.js
const loggerMiddleware = (store) => (next) => (action) => {
  if (process.env.NODE_ENV === 'development') {
    const prevState = store.getState();
    const result = next(action);
    const nextState = store.getState();
    
    console.group(`Action: ${action.type}`);
    console.log('Payload:', action.payload);
    console.log('Previous State:', prevState);
    console.log('Next State:', nextState);
    console.groupEnd();
    
    return result;
  }
  
  return next(action);
};

export default loggerMiddleware;
```

## 自定义Hooks架构

### 1. 基础Redux Hooks

```javascript
// src/hooks/redux.js
import { useDispatch, useSelector } from 'react-redux';
import { useMemo } from 'react';
import { 
  setTheme, 
  setFontFamily, 
  setLineHeight, 
  setBackgroundImage,
  setBackgroundEnabled,
  setBackgroundTransparency,
  resetTheme 
} from '../store/slices/themeSlice';

/**
 * 类型化的dispatch hook
 */
export const useAppDispatch = () => useDispatch();

/**
 * 类型化的selector hook
 */
export const useAppSelector = useSelector;

/**
 * 主题相关的hook
 */
export const useTheme = () => {
  const theme = useAppSelector((state) => state.theme);
  const dispatch = useAppDispatch();

  const actions = useMemo(() => ({
    setTheme: (value) => dispatch(setTheme(value)),
    setFontFamily: (value) => dispatch(setFontFamily(value)),
    setLineHeight: (value) => dispatch(setLineHeight(value)),
    setBackgroundImage: (value) => dispatch(setBackgroundImage(value)),
    setBackgroundEnabled: (value) => dispatch(setBackgroundEnabled(value)),
    setBackgroundTransparency: (theme, value) => 
      dispatch(setBackgroundTransparency({ theme, value })),
    resetTheme: () => dispatch(resetTheme())
  }), [dispatch]);

  return {
    ...theme,
    actions
  };
};

/**
 * 编辑器相关的Hook
 */
export const useEditor = () => {
  const editor = useAppSelector((state) => state.editor);
  const dispatch = useAppDispatch();

  return {
    ...editor,
    dispatch
  };
};

/**
 * 文件系统相关的Hook
 */
export const useFileSystem = () => {
  const file = useAppSelector((state) => state.file);
  const dispatch = useAppDispatch();

  const actions = useMemo(() => ({
    openFile: (filePath) => dispatch(openFileAsync(filePath)),
    saveFile: (filePath, content) => dispatch(saveFileAsync({ filePath, content })),
    createFile: (options) => dispatch(createFile(options)),
    closeFile: (fileId) => dispatch(closeFile(fileId)),
    switchFile: (fileId) => dispatch(switchFile(fileId)),
    updateContent: (content) => dispatch(updateEditorContent(content)),
    clearError: () => dispatch(clearError())
  }), [dispatch]);

  return {
    ...file,
    actions
  };
};
```

### 2. 业务逻辑Hooks

```javascript
// src/hooks/useFileManager.js
import { useCallback, useEffect } from 'react';
import { useFileSystem } from './redux';
import { message } from 'antd';

export const useFileManager = () => {
  const { 
    currentFile, 
    openedFiles, 
    editorContent, 
    isLoading, 
    error, 
    actions 
  } = useFileSystem();

  // 打开文件
  const openFile = useCallback(async (filePath) => {
    try {
      await actions.openFile(filePath);
      message.success('文件打开成功');
    } catch (error) {
      message.error(`文件打开失败: ${error.message}`);
    }
  }, [actions]);

  // 保存文件
  const saveFile = useCallback(async (filePath, content) => {
    try {
      await actions.saveFile(filePath, content);
      message.success('文件保存成功');
    } catch (error) {
      message.error(`文件保存失败: ${error.message}`);
    }
  }, [actions]);

  // 保存当前文件
  const saveCurrentFile = useCallback(async () => {
    if (!currentFile.path) {
      message.warning('请先选择保存位置');
      return;
    }
    
    await saveFile(currentFile.path, editorContent);
  }, [currentFile.path, editorContent, saveFile]);

  // 创建新文件
  const createNewFile = useCallback((options = {}) => {
    actions.createFile({
      name: options.name || 'Untitled',
      language: options.language || 'plaintext'
    });
  }, [actions]);

  // 关闭文件
  const closeFile = useCallback((fileId) => {
    const file = openedFiles.find(f => f.id === fileId);
    if (file && file.isUnsaved) {
      // 提示保存未保存的文件
      const confirmed = window.confirm(`文件 "${file.name}" 有未保存的更改，是否保存？`);
      if (confirmed) {
        saveFile(file.path, file.content);
      }
    }
    actions.closeFile(fileId);
  }, [openedFiles, actions, saveFile]);

  // 错误处理
  useEffect(() => {
    if (error) {
      message.error(error.message);
      actions.clearError();
    }
  }, [error, actions]);

  return {
    // 状态
    currentFile,
    openedFiles,
    editorContent,
    isLoading,
    
    // 操作
    openFile,
    saveFile,
    saveCurrentFile,
    createNewFile,
    closeFile,
    updateContent: actions.updateContent,
    switchFile: actions.switchFile
  };
};
```

## 状态持久化架构

### 1. 持久化管理器

```javascript
// src/utils/persistenceManager.js
import { Store } from '@tauri-apps/plugin-store';

class PersistenceManager {
  constructor() {
    this.store = null;
    this.isInitialized = false;
    this.saveTimeout = null;
  }

  /**
   * 初始化持久化存储
   */
  async initialize() {
    try {
      this.store = new Store('app-state.json');
      this.isInitialized = true;
      console.log('持久化管理器初始化成功');
    } catch (error) {
      console.error('持久化管理器初始化失败:', error);
    }
  }

  /**
   * 保存应用状态
   */
  async saveAppState(state) {
    if (!this.isInitialized) return;

    try {
      this.debouncedSave(state);
    } catch (error) {
      console.error('状态保存失败:', error);
    }
  }

  /**
   * 防抖保存函数 - 避免频繁写入
   */
  debouncedSave(state) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      await this.performSave(state);
    }, 500);
  }

  /**
   * 执行实际的保存操作
   */
  async performSave(state) {
    try {
      // 过滤敏感数据
      const sanitizedState = this.sanitizeState(state);
      
      await this.store.set('app-state', sanitizedState);
      await this.store.save();
      
      console.log('应用状态保存成功');
    } catch (error) {
      console.error('状态保存执行失败:', error);
    }
  }

  /**
   * 加载应用状态
   */
  async loadAppState() {
    if (!this.isInitialized) return null;

    try {
      const state = await this.store.get('app-state');
      console.log('应用状态加载成功');
      return state;
    } catch (error) {
      console.error('状态加载失败:', error);
      return null;
    }
  }

  /**
   * 清理敏感数据
   */
  sanitizeState(state) {
    const sanitized = { ...state };
    
    // 移除不需要持久化的字段
    if (sanitized.theme) {
      delete sanitized.theme.backgroundImage;
    }
    
    if (sanitized.file) {
      delete sanitized.file.fileWatchers;
      delete sanitized.file.isLoading;
      delete sanitized.file.error;
    }
    
    return sanitized;
  }

  /**
   * 清除持久化数据
   */
  async clearAppState() {
    if (!this.isInitialized) return;

    try {
      await this.store.delete('app-state');
      await this.store.save();
      console.log('应用状态清除成功');
    } catch (error) {
      console.error('状态清除失败:', error);
    }
  }
}

export const persistenceManager = new PersistenceManager();
```

### 2. 状态恢复机制

```javascript
// src/utils/stateRestore.js
import { persistenceManager } from './persistenceManager';
import { store } from '../store';

/**
 * 应用状态恢复
 */
export const restoreAppState = async () => {
  try {
    const savedState = await persistenceManager.loadAppState();
    
    if (savedState) {
      // 验证状态结构
      const validatedState = validateState(savedState);
      
      if (validatedState) {
        // 恢复状态到Redux Store
        store.dispatch({
          type: 'RESTORE_STATE',
          payload: validatedState
        });
        
        console.log('应用状态恢复成功');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('状态恢复失败:', error);
    return false;
  }
};

/**
 * 验证状态结构
 */
const validateState = (state) => {
  try {
    // 基本结构验证
    if (!state || typeof state !== 'object') {
      return null;
    }
    
    // 主题状态验证
    if (state.theme) {
      state.theme = validateThemeState(state.theme);
    }
    
    // 编辑器状态验证
    if (state.editor) {
      state.editor = validateEditorState(state.editor);
    }
    
    // 文件状态验证
    if (state.file) {
      state.file = validateFileState(state.file);
    }
    
    return state;
  } catch (error) {
    console.error('状态验证失败:', error);
    return null;
  }
};

/**
 * 验证主题状态
 */
const validateThemeState = (themeState) => {
  const defaultTheme = {
    theme: 'light',
    fontSize: 14,
    fontFamily: 'Consolas',
    lineHeight: 1.5,
    backgroundEnabled: false,
    backgroundTransparency: { light: 0.8, dark: 0.7 }
  };
  
  return {
    ...defaultTheme,
    ...themeState,
    fontSize: Math.max(8, Math.min(72, themeState.fontSize || 14)),
    lineHeight: Math.max(1.0, Math.min(3.0, themeState.lineHeight || 1.5))
  };
};

/**
 * 验证编辑器状态
 */
const validateEditorState = (editorState) => {
  const defaultEditor = {
    currentFile: null,
    openFiles: [],
    editorSettings: {
      wordWrap: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      tabSize: 2,
      insertSpaces: true
    }
  };
  
  return {
    ...defaultEditor,
    ...editorState,
    openFiles: Array.isArray(editorState.openFiles) ? editorState.openFiles : []
  };
};

/**
 * 验证文件状态
 */
const validateFileState = (fileState) => {
  const defaultFile = {
    currentFile: {
      id: null,
      name: '',
      path: '',
      content: '',
      language: 'plaintext',
      isUnsaved: false
    },
    openedFiles: [],
    editorContent: ''
  };
  
  return {
    ...defaultFile,
    ...fileState,
    openedFiles: Array.isArray(fileState.openedFiles) ? fileState.openedFiles : [],
    // 重置运行时状态
    isLoading: false,
    error: null
  };
};
```

## 异步状态管理

### 1. 异步Thunk设计

```javascript
// src/store/thunks/fileThunks.js
import { createAsyncThunk } from '@reduxjs/toolkit';
import { tauriApi } from '../../utils/tauriApi';

/**
 * 批量打开文件
 */
export const openMultipleFilesAsync = createAsyncThunk(
  'file/openMultipleFiles',
  async (filePaths, { dispatch, rejectWithValue }) => {
    try {
      const results = await Promise.allSettled(
        filePaths.map(async (filePath) => {
          const content = await tauriApi.readFile(filePath);
          return {
            path: filePath,
            content,
            language: detectLanguageFromPath(filePath)
          };
        })
      );
      
      const successful = [];
      const failed = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            path: filePaths[index],
            error: result.reason.message
          });
        }
      });
      
      return { successful, failed };
    } catch (error) {
      return rejectWithValue({
        code: 'BATCH_OPEN_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * 自动保存文件
 */
export const autoSaveFileAsync = createAsyncThunk(
  'file/autoSave',
  async ({ filePath, content }, { dispatch, getState, rejectWithValue }) => {
    try {
      // 检查文件是否有变化
      const state = getState();
      const currentFile = state.file.currentFile;
      
      if (currentFile.content === content) {
        return { skipped: true, reason: 'No changes' };
      }
      
      // 创建备份
      const backupPath = `${filePath}.backup`;
      await tauriApi.writeFile(backupPath, currentFile.content);
      
      // 保存文件
      await tauriApi.writeFile(filePath, content);
      
      // 删除备份
      await tauriApi.deleteFile(backupPath);
      
      return {
        path: filePath,
        content,
        timestamp: Date.now(),
        autoSaved: true
      };
    } catch (error) {
      return rejectWithValue({
        code: 'AUTO_SAVE_ERROR',
        message: error.message,
        path: filePath
      });
    }
  }
);

/**
 * 搜索文件内容
 */
export const searchInFilesAsync = createAsyncThunk(
  'file/searchInFiles',
  async ({ query, paths, options = {} }, { dispatch, rejectWithValue }) => {
    try {
      const searchResults = [];
      
      for (const filePath of paths) {
        try {
          const content = await tauriApi.readFile(filePath);
          const lines = content.split('\n');
          const matches = [];
          
          lines.forEach((line, lineNumber) => {
            if (options.caseSensitive) {
              if (line.includes(query)) {
                matches.push({
                  line: lineNumber + 1,
                  content: line,
                  startIndex: line.indexOf(query),
                  endIndex: line.indexOf(query) + query.length
                });
              }
            } else {
              const lowerLine = line.toLowerCase();
              const lowerQuery = query.toLowerCase();
              if (lowerLine.includes(lowerQuery)) {
                matches.push({
                  line: lineNumber + 1,
                  content: line,
                  startIndex: lowerLine.indexOf(lowerQuery),
                  endIndex: lowerLine.indexOf(lowerQuery) + query.length
                });
              }
            }
          });
          
          if (matches.length > 0) {
            searchResults.push({
              filePath,
              matches,
              totalMatches: matches.length
            });
          }
        } catch (fileError) {
          console.warn(`搜索文件失败: ${filePath}`, fileError);
        }
      }
      
      return {
        query,
        results: searchResults,
        totalFiles: searchResults.length,
        totalMatches: searchResults.reduce((sum, file) => sum + file.totalMatches, 0)
      };
    } catch (error) {
      return rejectWithValue({
        code: 'SEARCH_ERROR',
        message: error.message,
        query
      });
    }
  }
);
```

### 2. 错误处理策略

```javascript
// src/store/slices/errorSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  globalError: null,
  fileErrors: {},
  networkErrors: [],
  validationErrors: {}
};

const errorSlice = createSlice({
  name: 'error',
  initialState,
  reducers: {
    setGlobalError: (state, action) => {
      state.globalError = {
        ...action.payload,
        timestamp: Date.now(),
        id: generateErrorId()
      };
    },
    
    clearGlobalError: (state) => {
      state.globalError = null;
    },
    
    setFileError: (state, action) => {
      const { filePath, error } = action.payload;
      state.fileErrors[filePath] = {
        ...error,
        timestamp: Date.now()
      };
    },
    
    clearFileError: (state, action) => {
      const filePath = action.payload;
      delete state.fileErrors[filePath];
    },
    
    addNetworkError: (state, action) => {
      state.networkErrors.push({
        ...action.payload,
        timestamp: Date.now(),
        id: generateErrorId()
      });
      
      // 保持最近的10个网络错误
      if (state.networkErrors.length > 10) {
        state.networkErrors = state.networkErrors.slice(-10);
      }
    },
    
    clearNetworkErrors: (state) => {
      state.networkErrors = [];
    }
  }
});

export const {
  setGlobalError,
  clearGlobalError,
  setFileError,
  clearFileError,
  addNetworkError,
  clearNetworkErrors
} = errorSlice.actions;

export default errorSlice.reducer;

// 错误处理工具函数
export const handleAsyncError = (error, dispatch) => {
  const errorInfo = {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || '未知错误',
    details: error.details || null,
    stack: error.stack
  };
  
  // 根据错误类型分发不同的Action
  if (error.code === 'FILE_ERROR') {
    dispatch(setFileError({
      filePath: error.filePath,
      error: errorInfo
    }));
  } else if (error.code === 'NETWORK_ERROR') {
    dispatch(addNetworkError(errorInfo));
  } else {
    dispatch(setGlobalError(errorInfo));
  }
  
  // 记录错误日志
  console.error('异步操作错误:', errorInfo);
};
```

## 性能优化策略

### 1. 选择器优化

```javascript
// src/store/selectors/index.js
import { createSelector } from '@reduxjs/toolkit';

// 基础选择器
const selectThemeState = (state) => state.theme;
const selectFileState = (state) => state.file;
const selectEditorState = (state) => state.editor;

// 记忆化选择器 - 主题配置
export const selectThemeConfig = createSelector(
  [selectThemeState],
  (theme) => ({
    theme: theme.theme,
    fontSize: theme.fontSize,
    fontFamily: theme.fontFamily,
    lineHeight: theme.lineHeight
  })
);

// 记忆化选择器 - 背景配置
export const selectBackgroundConfig = createSelector(
  [selectThemeState],
  (theme) => ({
    image: theme.backgroundImage,
    enabled: theme.backgroundEnabled,
    transparency: theme.backgroundTransparency[theme.theme] || 0.8
  })
);

// 记忆化选择器 - 当前文件信息
export const selectCurrentFileInfo = createSelector(
  [selectFileState],
  (file) => ({
    id: file.currentFile.id,
    name: file.currentFile.name,
    path: file.currentFile.path,
    language: file.currentFile.language,
    isUnsaved: file.currentFile.isUnsaved
  })
);

// 记忆化选择器 - 未保存文件列表
export const selectUnsavedFiles = createSelector(
  [selectFileState],
  (file) => file.openedFiles.filter(f => f.isUnsaved)
);

// 记忆化选择器 - 编辑器配置
export const selectEditorConfig = createSelector(
  [selectEditorState, selectThemeState],
  (editor, theme) => ({
    ...editor.editorSettings,
    theme: theme.theme,
    fontSize: theme.fontSize,
    fontFamily: theme.fontFamily,
    lineHeight: theme.lineHeight
  })
);

// 记忆化选择器 - 文件标签数据
export const selectFileTabsData = createSelector(
  [selectFileState],
  (file) => file.openedFiles.map(f => ({
    id: f.id,
    name: f.name,
    path: f.path,
    isUnsaved: f.isUnsaved,
    isActive: f.id === file.currentFile.id
  }))
);
```

### 2. 防抖和节流优化

```javascript
// src/hooks/useDebounce.js
import { useCallback, useRef } from 'react';

export const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// src/hooks/useThrottle.js
import { useCallback, useRef } from 'react';

export const useThrottle = (callback, delay) => {
  const lastCallRef = useRef(0);
  
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    }
  }, [callback, delay]);
};

// 使用示例
const FileEditor = () => {
  const { actions } = useFileSystem();
  
  // 防抖自动保存
  const debouncedAutoSave = useDebounce((content) => {
    actions.autoSave(currentFile.path, content);
  }, 2000);
  
  // 节流状态更新
  const throttledUpdateContent = useThrottle((content) => {
    actions.updateContent(content);
  }, 100);
  
  const handleContentChange = (content) => {
    throttledUpdateContent(content);
    debouncedAutoSave(content);
  };
  
  return (
    <Editor
      value={editorContent}
      onChange={handleContentChange}
    />
  );
};
```

### 3. 批量更新优化

```javascript
// src/store/middleware/batchMiddleware.js
import { batch } from 'react-redux';

const batchMiddleware = (store) => (next) => (action) => {
  // 批量处理相关的actions
  if (action.type === 'BATCH_ACTIONS') {
    batch(() => {
      action.payload.forEach(subAction => {
        next(subAction);
      });
    });
    return;
  }
  
  return next(action);
};

export default batchMiddleware;

// 批量操作工具函数
export const batchActions = (actions) => ({
  type: 'BATCH_ACTIONS',
  payload: actions
});

// 使用示例
const handleMultipleFileOperations = () => {
  const actions = [
    openFileAsync('/path/to/file1.js'),
    openFileAsync('/path/to/file2.js'),
    openFileAsync('/path/to/file3.js')
  ];
  
  dispatch(batchActions(actions));
};
```

## 最佳实践

### 1. 状态设计原则

- **单一数据源**: 所有状态集中在Redux Store中管理
- **状态扁平化**: 避免深层嵌套的状态结构
- **不可变性**: 使用Immer确保状态不可变
- **最小化状态**: 只存储必要的状态，派生数据通过选择器计算
- **状态归一化**: 复杂数据结构使用归一化存储

### 2. 性能优化建议

- **选择器记忆化**: 使用createSelector避免不必要的重计算
- **组件记忆化**: 配合React.memo优化组件渲染
- **防抖节流**: 对频繁操作进行防抖和节流处理
- **批量更新**: 合并相关的状态更新操作
- **懒加载**: 按需加载大型数据和组件

### 3. 错误处理策略

- **统一错误格式**: 标准化错误信息结构
- **错误边界**: 在组件层面捕获和处理错误
- **用户友好提示**: 提供清晰的错误信息和解决建议
- **错误恢复**: 实现自动重试和状态恢复机制
- **错误日志**: 记录详细的错误信息用于调试

### 4. 代码质量保证

- **TypeScript支持**: 提供完整的类型定义
- **单元测试**: 为Reducer和选择器编写测试
- **集成测试**: 测试完整的状态管理流程
- **代码规范**: 遵循一致的命名和结构规范
- **文档完善**: 维护详细的API文档和使用示例

## 总结

喵咕记事本的状态管理架构基于Redux Toolkit构建，采用现代化的状态管理模式，具有以下特点：

### 架构优势

1. **模块化设计**: 清晰的Slice划分和功能模块
2. **类型安全**: 完整的TypeScript支持
3. **状态持久化**: 自动保存和恢复应用状态
4. **异步处理**: 完善的异步操作管理
5. **性能优化**: 多层次的性能优化策略
6. **错误处理**: 健壮的错误处理和恢复机制

### 技术特色

1. **Redux Toolkit**: 现代化的Redux开发体验
2. **中间件系统**: 灵活的功能扩展机制
3. **自定义Hooks**: 封装业务逻辑的便捷接口
4. **选择器优化**: 高效的状态选择和计算
5. **持久化管理**: 智能的状态保存和恢复

### 可维护性保证

1. **代码标准**: 统一的开发规范和最佳实践
2. **文档完善**: 详细的架构文档和API说明
3. **测试覆盖**: 全面的单元测试和集成测试
4. **错误处理**: 完善的错误边界和用户反馈
5. **性能监控**: 状态管理性能的监控和优化

这种状态管理架构为喵咕记事本提供了稳定、高效、可扩展的状态管理基础，确保了应用在复杂业务场景下的稳定性和用户体验。