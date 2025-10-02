# 数据流架构设计

## 概述

喵咕记事本采用单向数据流架构，基于Redux状态管理模式，结合Tauri的IPC通信机制，实现了前端状态管理与后端系统服务的无缝集成。数据流架构确保了应用状态的可预测性、可调试性和可维护性。

## 数据流架构图

### 整体数据流向

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层 (User Interaction)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   UI Components │  │   Event Handler │  │   User Actions  │  │   Keyboard  │ │
│  │   (按钮、输入框) │  │   (点击、输入)   │  │   (保存、打开)   │  │   (快捷键)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ Actions
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Action层 (Action Layer)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Theme Actions │  │   Editor Actions│  │   File Actions  │  │   UI Actions│ │
│  │   (主题切换)     │  │   (编辑器操作)   │  │   (文件操作)     │  │   (界面状态) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ Dispatch
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Redux Store (状态管理中心)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Theme Slice   │  │   Editor Slice  │  │   File Slice    │  │   UI Slice  │ │
│  │   (主题状态)     │  │   (编辑器状态)   │  │   (文件状态)     │  │   (界面状态) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                        Redux Persist (状态持久化)                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │  │
│  │  │   Local Storage │  │   Session Store │  │   Transform     │          │  │
│  │  │   (本地存储)     │  │   (会话存储)     │  │   (数据转换)     │          │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ State Changes
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Selector层 (数据选择)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   useTheme      │  │   useEditor     │  │   useFileState  │  │   useUI     │ │
│  │   (主题选择器)   │  │   (编辑器选择器) │  │   (文件选择器)   │  │   (UI选择器) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ Props/State
┌─────────────────────────────────────────────────────────────────────────────┐
│                              组件层 (Component Layer)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   App Component │  │   Editor Comp   │  │   File Tree     │  │   Tab Bar   │ │
│  │   (主应用组件)   │  │   (编辑器组件)   │  │   (文件树组件)   │  │   (标签组件) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ IPC Calls
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Tauri IPC层 (系统通信)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   File Commands │  │   System Cmds   │  │   Watch Events  │  │   Config    │ │
│  │   (文件命令)     │  │   (系统命令)     │  │   (监控事件)     │  │   (配置)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ System Calls
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Rust后端层 (Backend Services)                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   File Service  │  │   System Svc    │  │   Monitor Svc   │  │   Config    │ │
│  │   (文件服务)     │  │   (系统服务)     │  │   (监控服务)     │  │   (配置)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Redux状态管理架构

### 1. Store结构设计

#### 1.1 根状态结构

```javascript
// src/store/index.js
const rootState = {
    theme: {
        // 主题相关状态
        currentTheme: 'light',
        customThemes: [],
        themeSettings: {}
    },
    editor: {
        // 编辑器相关状态
        currentFile: null,
        openFiles: [],
        editorSettings: {},
        cursorPosition: {line: 0, column: 0}
    },
    file: {
        // 文件系统相关状态
        treeData: [],
        selectedKeys: [],
        expandedKeys: [],
        recentFiles: [],
        unsavedContent: {}
    },
    ui: {
        // 界面状态
        sidebarVisible: true,
        tabBarVisible: true,
        statusBarVisible: true,
        loading: false
    }
}
```

#### 1.2 Store配置

```javascript
// src/store/index.js
import {configureStore} from '@reduxjs/toolkit'
import {persistStore, persistReducer} from 'redux-persist'
import storage from 'redux-persist/lib/storage'

// 持久化配置
const persistConfig = {
    key: 'root',
    storage,
    whitelist: ['theme', 'editor', 'file'], // 需要持久化的状态
    transforms: [
        // 排除不需要持久化的字段
        createTransform(
            (inboundState) => {
                const {backgroundImage, ...rest} = inboundState
                return rest
            },
            (outboundState) => outboundState,
            {whitelist: ['theme']}
        )
    ]
}

// 根Reducer
const rootReducer = combineReducers({
    theme: themeReducer,
    editor: editorReducer,
    file: fileReducer,
    ui: uiReducer
})

// 持久化Reducer
const persistedReducer = persistReducer(persistConfig, rootReducer)

// 配置Store
export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
    devTools: process.env.NODE_ENV !== 'production'
})

export const persistor = persistStore(store)
```

### 2. Slice设计模式

#### 2.1 Theme Slice

```javascript
// src/store/slices/themeSlice.js
import {createSlice} from '@reduxjs/toolkit'

const initialState = {
    currentTheme: 'light',
    customThemes: [],
    themeSettings: {
        fontSize: 14,
        fontFamily: 'Monaco, Consolas, monospace',
        lineHeight: 1.5,
        tabSize: 2
    },
    backgroundImage: null,
    loading: false,
    error: null
}

const themeSlice = createSlice({
    name: 'theme',
    initialState,
    reducers: {
        // 切换主题
        setTheme: (state, action) => {
            state.currentTheme = action.payload
            state.error = null
        },

        // 更新主题设置
        updateThemeSettings: (state, action) => {
            state.themeSettings = {
                ...state.themeSettings,
                ...action.payload
            }
        },

        // 添加自定义主题
        addCustomTheme: (state, action) => {
            const {name, config} = action.payload
            const existingIndex = state.customThemes.findIndex(theme => theme.name === name)

            if (existingIndex >= 0) {
                state.customThemes[existingIndex] = {name, config}
            } else {
                state.customThemes.push({name, config})
            }
        },

        // 删除自定义主题
        removeCustomTheme: (state, action) => {
            state.customThemes = state.customThemes.filter(
                theme => theme.name !== action.payload
            )
        },

        // 设置背景图片
        setBackgroundImage: (state, action) => {
            state.backgroundImage = action.payload
        },

        // 设置加载状态
        setThemeLoading: (state, action) => {
            state.loading = action.payload
        },

        // 设置错误状态
        setThemeError: (state, action) => {
            state.error = action.payload
            state.loading = false
        }
    }
})

export const {
    setTheme,
    updateThemeSettings,
    addCustomTheme,
    removeCustomTheme,
    setBackgroundImage,
    setThemeLoading,
    setThemeError
} = themeSlice.actions

export default themeSlice.reducer
```

#### 2.2 Editor Slice

```javascript
// src/store/slices/editorSlice.js
import {createSlice} from '@reduxjs/toolkit'

const initialState = {
    currentFile: null,
    openFiles: [],
    editorSettings: {
        wordWrap: true,
        showLineNumbers: true,
        showMinimap: true,
        autoSave: true,
        autoSaveDelay: 1000
    },
    cursorPosition: {line: 1, column: 1},
    selection: null,
    searchQuery: '',
    replaceQuery: '',
    findResults: [],
    currentFindIndex: -1,
    editorMode: 'monaco', // 'monaco' | 'markdown' | 'tree'
    loading: false,
    error: null
}

const editorSlice = createSlice({
    name: 'editor',
    initialState,
    reducers: {
        // 设置当前文件
        setCurrentFile: (state, action) => {
            state.currentFile = action.payload
            state.error = null
        },

        // 添加打开的文件
        addOpenFile: (state, action) => {
            const file = action.payload
            const existingIndex = state.openFiles.findIndex(f => f.path === file.path)

            if (existingIndex === -1) {
                state.openFiles.push(file)
            } else {
                state.openFiles[existingIndex] = file
            }
        },

        // 关闭文件
        closeFile: (state, action) => {
            const filePath = action.payload
            state.openFiles = state.openFiles.filter(file => file.path !== filePath)

            if (state.currentFile?.path === filePath) {
                state.currentFile = state.openFiles.length > 0 ? state.openFiles[0] : null
            }
        },

        // 更新编辑器设置
        updateEditorSettings: (state, action) => {
            state.editorSettings = {
                ...state.editorSettings,
                ...action.payload
            }
        },

        // 更新光标位置
        updateCursorPosition: (state, action) => {
            state.cursorPosition = action.payload
        },

        // 更新选择区域
        updateSelection: (state, action) => {
            state.selection = action.payload
        },

        // 设置搜索查询
        setSearchQuery: (state, action) => {
            state.searchQuery = action.payload
        },

        // 设置替换查询
        setReplaceQuery: (state, action) => {
            state.replaceQuery = action.payload
        },

        // 设置查找结果
        setFindResults: (state, action) => {
            state.findResults = action.payload
            state.currentFindIndex = action.payload.length > 0 ? 0 : -1
        },

        // 切换编辑器模式
        setEditorMode: (state, action) => {
            state.editorMode = action.payload
        },

        // 设置加载状态
        setEditorLoading: (state, action) => {
            state.loading = action.payload
        },

        // 设置错误状态
        setEditorError: (state, action) => {
            state.error = action.payload
            state.loading = false
        }
    }
})

export const {
    setCurrentFile,
    addOpenFile,
    closeFile,
    updateEditorSettings,
    updateCursorPosition,
    updateSelection,
    setSearchQuery,
    setReplaceQuery,
    setFindResults,
    setEditorMode,
    setEditorLoading,
    setEditorError
} = editorSlice.actions

export default editorSlice.reducer
```

#### 2.3 File Slice

```javascript
// src/store/slices/fileSlice.js
import {createSlice} from '@reduxjs/toolkit'

const initialState = {
    treeData: [],
    selectedKeys: [],
    expandedKeys: [],
    recentFiles: [],
    unsavedContent: {},
    fileWatchers: {},
    rootPath: null,
    loading: false,
    error: null
}

const fileSlice = createSlice({
    name: 'file',
    initialState,
    reducers: {
        // 设置文件树数据
        setTreeData: (state, action) => {
            state.treeData = action.payload
            state.error = null
        },

        // 更新文件树节点
        updateTreeNode: (state, action) => {
            const {path, data} = action.payload
            // 递归更新树节点
            const updateNode = (nodes) => {
                return nodes.map(node => {
                    if (node.path === path) {
                        return {...node, ...data}
                    }
                    if (node.children) {
                        return {...node, children: updateNode(node.children)}
                    }
                    return node
                })
            }
            state.treeData = updateNode(state.treeData)
        },

        // 设置选中的文件
        setSelectedKeys: (state, action) => {
            state.selectedKeys = action.payload
        },

        // 设置展开的目录
        setExpandedKeys: (state, action) => {
            state.expandedKeys = action.payload
        },

        // 添加最近文件
        addRecentFile: (state, action) => {
            const file = action.payload
            const existingIndex = state.recentFiles.findIndex(f => f.path === file.path)

            if (existingIndex >= 0) {
                state.recentFiles.splice(existingIndex, 1)
            }

            state.recentFiles.unshift(file)

            // 限制最近文件数量
            if (state.recentFiles.length > 20) {
                state.recentFiles = state.recentFiles.slice(0, 20)
            }
        },

        // 移除最近文件
        removeRecentFile: (state, action) => {
            const filePath = action.payload
            state.recentFiles = state.recentFiles.filter(file => file.path !== filePath)
        },

        // 设置未保存内容
        setUnsavedContent: (state, action) => {
            const {filePath, content, hasChanges} = action.payload

            if (hasChanges) {
                state.unsavedContent[filePath] = content
            } else {
                delete state.unsavedContent[filePath]
            }
        },

        // 清除未保存内容
        clearUnsavedContent: (state, action) => {
            const filePath = action.payload
            if (filePath) {
                delete state.unsavedContent[filePath]
            } else {
                state.unsavedContent = {}
            }
        },

        // 添加文件监控器
        addFileWatcher: (state, action) => {
            const {filePath, watcherId} = action.payload
            state.fileWatchers[filePath] = watcherId
        },

        // 移除文件监控器
        removeFileWatcher: (state, action) => {
            const filePath = action.payload
            delete state.fileWatchers[filePath]
        },

        // 设置根路径
        setRootPath: (state, action) => {
            state.rootPath = action.payload
        },

        // 设置加载状态
        setFileLoading: (state, action) => {
            state.loading = action.payload
        },

        // 设置错误状态
        setFileError: (state, action) => {
            state.error = action.payload
            state.loading = false
        }
    }
})

export const {
    setTreeData,
    updateTreeNode,
    setSelectedKeys,
    setExpandedKeys,
    addRecentFile,
    removeRecentFile,
    setUnsavedContent,
    clearUnsavedContent,
    addFileWatcher,
    removeFileWatcher,
    setRootPath,
    setFileLoading,
    setFileError
} = fileSlice.actions

export default fileSlice.reducer
```

### 3. 自定义Hooks架构

#### 3.1 基础Redux Hooks

```javascript
// src/hooks/redux.js
import {useDispatch, useSelector} from 'react-redux'
import {useMemo} from 'react'

// 类型化的dispatch hook
export const useAppDispatch = () => useDispatch()

// 类型化的selector hook
export const useAppSelector = (selector) => useSelector(selector)

// 主题相关hooks
export const useTheme = () => {
    const dispatch = useAppDispatch()

    const themeState = useAppSelector(state => state.theme)

    const actions = useMemo(() => ({
        setTheme: (theme) => dispatch(setTheme(theme)),
        updateSettings: (settings) => dispatch(updateThemeSettings(settings)),
        addCustomTheme: (name, config) => dispatch(addCustomTheme({name, config})),
        removeCustomTheme: (name) => dispatch(removeCustomTheme(name)),
        setBackgroundImage: (image) => dispatch(setBackgroundImage(image))
    }), [dispatch])

    return {
        ...themeState,
        actions
    }
}

// 编辑器相关hooks
export const useEditor = () => {
    const dispatch = useAppDispatch()

    const editorState = useAppSelector(state => state.editor)

    const actions = useMemo(() => ({
        setCurrentFile: (file) => dispatch(setCurrentFile(file)),
        addOpenFile: (file) => dispatch(addOpenFile(file)),
        closeFile: (filePath) => dispatch(closeFile(filePath)),
        updateSettings: (settings) => dispatch(updateEditorSettings(settings)),
        updateCursorPosition: (position) => dispatch(updateCursorPosition(position)),
        updateSelection: (selection) => dispatch(updateSelection(selection)),
        setSearchQuery: (query) => dispatch(setSearchQuery(query)),
        setReplaceQuery: (query) => dispatch(setReplaceQuery(query)),
        setFindResults: (results) => dispatch(setFindResults(results)),
        setEditorMode: (mode) => dispatch(setEditorMode(mode))
    }), [dispatch])

    return {
        ...editorState,
        actions
    }
}

// 文件系统相关hooks
export const useFileSystem = () => {
    const dispatch = useAppDispatch()

    const fileState = useAppSelector(state => state.file)

    const actions = useMemo(() => ({
        setTreeData: (data) => dispatch(setTreeData(data)),
        updateTreeNode: (path, data) => dispatch(updateTreeNode({path, data})),
        setSelectedKeys: (keys) => dispatch(setSelectedKeys(keys)),
        setExpandedKeys: (keys) => dispatch(setExpandedKeys(keys)),
        addRecentFile: (file) => dispatch(addRecentFile(file)),
        removeRecentFile: (filePath) => dispatch(removeRecentFile(filePath)),
        setUnsavedContent: (filePath, content, hasChanges) =>
            dispatch(setUnsavedContent({filePath, content, hasChanges})),
        clearUnsavedContent: (filePath) => dispatch(clearUnsavedContent(filePath)),
        addFileWatcher: (filePath, watcherId) =>
            dispatch(addFileWatcher({filePath, watcherId})),
        removeFileWatcher: (filePath) => dispatch(removeFileWatcher(filePath)),
        setRootPath: (path) => dispatch(setRootPath(path))
    }), [dispatch])

    return {
        ...fileState,
        actions
    }
}

// 聚合状态hook
export const useAppState = () => {
    const theme = useTheme()
    const editor = useEditor()
    const fileSystem = useFileSystem()

    return {
        theme,
        editor,
        fileSystem
    }
}
```

#### 3.2 业务逻辑Hooks

```javascript
// src/hooks/useFileOperations.js
import {useCallback} from 'react'
import {invoke} from '@tauri-apps/api/core'
import {useEditor, useFileSystem} from './redux'
import {message} from 'antd'

export const useFileOperations = () => {
    const {actions: editorActions} = useEditor()
    const {actions: fileActions} = useFileSystem()

    // 打开文件
    const openFile = useCallback(async (filePath) => {
        try {
            fileActions.setFileLoading(true)

            const result = await invoke('read_file_content', {path: filePath})

            if (result.success) {
                const fileInfo = {
                    path: filePath,
                    name: result.file_name,
                    content: result.content,
                    encoding: result.encoding,
                    lineEnding: result.line_ending,
                    modified: false
                }

                editorActions.setCurrentFile(fileInfo)
                editorActions.addOpenFile(fileInfo)
                fileActions.addRecentFile(fileInfo)

                message.success('文件打开成功')
            } else {
                throw new Error(result.message)
            }
        } catch (error) {
            message.error(`打开文件失败: ${error.message}`)
            fileActions.setFileError(error.message)
        } finally {
            fileActions.setFileLoading(false)
        }
    }, [editorActions, fileActions])

    // 保存文件
    const saveFile = useCallback(async (filePath, content, encoding = 'UTF-8') => {
        try {
            fileActions.setFileLoading(true)

            const result = await invoke('write_file_content', {
                path: filePath,
                content,
                encoding
            })

            if (result.success) {
                fileActions.clearUnsavedContent(filePath)
                message.success('文件保存成功')
                return true
            } else {
                throw new Error(result.message)
            }
        } catch (error) {
            message.error(`保存文件失败: ${error.message}`)
            fileActions.setFileError(error.message)
            return false
        } finally {
            fileActions.setFileLoading(false)
        }
    }, [fileActions])

    // 获取目录内容
    const getDirectoryContents = useCallback(async (dirPath) => {
        try {
            fileActions.setFileLoading(true)

            const contents = await invoke('get_directory_contents', {path: dirPath})

            // 转换为树形结构
            const treeData = contents.map(item => ({
                key: item.path,
                title: item.name,
                path: item.path,
                isLeaf: item.is_file,
                size: item.size,
                modified: item.modified,
                children: item.is_dir ? [] : undefined
            }))

            return treeData
        } catch (error) {
            message.error(`读取目录失败: ${error.message}`)
            fileActions.setFileError(error.message)
            return []
        } finally {
            fileActions.setFileLoading(false)
        }
    }, [fileActions])

    return {
        openFile,
        saveFile,
        getDirectoryContents
    }
}
```

#### 3.3 文件监控Hooks

```javascript
// src/hooks/useFileWatcher.js
import {useEffect, useCallback} from 'react'
import {listen} from '@tauri-apps/api/event'
import {invoke} from '@tauri-apps/api/core'
import {useFileSystem, useEditor} from './redux'
import {message} from 'antd'

export const useFileWatcher = () => {
    const {fileWatchers, actions: fileActions} = useFileSystem()
    const {currentFile, actions: editorActions} = useEditor()

    // 开始监控文件
    const startWatching = useCallback(async (filePath) => {
        try {
            if (fileWatchers[filePath]) {
                return // 已经在监控中
            }

            const success = await invoke('start_file_watching', {filePath})

            if (success) {
                fileActions.addFileWatcher(filePath, Date.now())
            }
        } catch (error) {
            console.error('启动文件监控失败:', error)
        }
    }, [fileWatchers, fileActions])

    // 停止监控文件
    const stopWatching = useCallback(async (filePath) => {
        try {
            if (!fileWatchers[filePath]) {
                return // 没有在监控中
            }

            const success = await invoke('stop_file_watching', {filePath})

            if (success) {
                fileActions.removeFileWatcher(filePath)
            }
        } catch (error) {
            console.error('停止文件监控失败:', error)
        }
    }, [fileWatchers, fileActions])

    // 监听文件变化事件
    useEffect(() => {
        let unlisten

        const setupListener = async () => {
            unlisten = await listen('file-changed', (event) => {
                const {file_path, event_type, timestamp} = event.payload

                // 如果变化的是当前打开的文件
                if (currentFile && currentFile.path === file_path) {
                    if (event_type === 'modified') {
                        message.warning({
                            content: '文件已被外部程序修改，是否重新加载？',
                            duration: 0,
                            key: 'file-changed',
                            btn: (
                                <div>
                                    <button onClick={() => {
                                        // 重新加载文件
                                        reloadCurrentFile()
                                        message.destroy('file-changed')
                                    }}>
                                        重新加载
                                    </button>
                                    <button onClick={() => message.destroy('file-changed')}>
                                        忽略
                                    </button>
                                </div>
                            )
                        })
                    }
                }
            })
        }

        setupListener()

        return () => {
            if (unlisten) {
                unlisten()
            }
        }
    }, [currentFile])

    // 重新加载当前文件
    const reloadCurrentFile = useCallback(async () => {
        if (!currentFile) return

        try {
            const result = await invoke('read_file_content', {path: currentFile.path})

            if (result.success) {
                const updatedFile = {
                    ...currentFile,
                    content: result.content,
                    encoding: result.encoding,
                    lineEnding: result.line_ending,
                    modified: false
                }

                editorActions.setCurrentFile(updatedFile)
                editorActions.addOpenFile(updatedFile)

                message.success('文件重新加载成功')
            }
        } catch (error) {
            message.error(`重新加载文件失败: ${error.message}`)
        }
    }, [currentFile, editorActions])

    return {
        startWatching,
        stopWatching,
        reloadCurrentFile
    }
}
```

## IPC通信数据流

### 1. 前端到后端的数据流

#### 1.1 命令调用流程

```javascript
// 1. 用户操作触发Action
const handleOpenFile = async (filePath) => {
    // 2. 分发Action到Redux Store
    dispatch(setFileLoading(true))

    try {
        // 3. 调用Tauri命令
        const result = await invoke('read_file_content', {
            path: filePath
        })

        // 4. 处理返回结果
        if (result.success) {
            // 5. 更新Redux状态
            dispatch(setCurrentFile({
                path: filePath,
                content: result.content,
                encoding: result.encoding,
                lineEnding: result.line_ending
            }))

            dispatch(addRecentFile({
                path: filePath,
                name: result.file_name,
                modified: Date.now()
            }))
        } else {
            // 6. 处理错误
            dispatch(setFileError(result.message))
        }
    } catch (error) {
        dispatch(setFileError(error.message))
    } finally {
        // 7. 清除加载状态
        dispatch(setFileLoading(false))
    }
}
```

#### 1.2 数据序列化

```javascript
// 前端数据结构
const fileRequest = {
    path: '/path/to/file.txt',
    encoding: 'UTF-8'
}

// JSON序列化后发送到后端
// {"path": "/path/to/file.txt", "encoding": "UTF-8"}
```

### 2. 后端到前端的数据流

#### 2.1 命令响应流程

```rust
// 1. 后端接收命令
#[tauri::command]
async fn read_file_content(path: String) -> Result<FileOperationResult, String> {
    // 2. 执行业务逻辑
    let content = fs::read_to_string(&path)?;
    
    // 3. 构建响应数据
    let result = FileOperationResult {
        success: true,
        message: "文件读取成功".to_string(),
        content: Some(content),
        file_path: Some(path.clone()),
        file_name: Some(extract_filename(&path)),
        encoding: Some("UTF-8".to_string()),
        line_ending: Some("LF".to_string()),
    };
    
    // 4. 序列化并返回
    Ok(result)
}
```

#### 2.2 事件推送流程

```rust
// 1. 后端检测到文件变化
let change_event = FileChangeEvent {
    file_path: path.clone(),
    event_type: "modified".to_string(),
    timestamp: SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs(),
};

// 2. 推送事件到前端
app_handle.emit("file-changed", &change_event)?;
```

```javascript
// 3. 前端监听事件
const unlisten = await listen('file-changed', (event) => {
    const {file_path, event_type, timestamp} = event.payload

    // 4. 更新Redux状态
    dispatch(updateFileStatus({
        path: file_path,
        status: event_type,
        timestamp
    }))
})
```

### 3. 错误处理数据流

#### 3.1 错误传播机制

```javascript
// 1. 后端错误
const handleError = (error) => {
    // 2. 错误信息标准化
    const errorInfo = {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || '未知错误',
        details: error.details || null,
        timestamp: Date.now()
    }

    // 3. 分发错误Action
    dispatch(setGlobalError(errorInfo))

    // 4. 显示用户友好的错误信息
    message.error(errorInfo.message)

    // 5. 记录错误日志
    console.error('操作失败:', errorInfo)
}
```

#### 3.2 错误恢复流程

```javascript
// 错误恢复策略
const errorRecoveryStrategies = {
    FILE_NOT_FOUND: () => {
        // 文件不存在 - 从最近文件列表中移除
        dispatch(removeRecentFile(filePath))
        message.warning('文件不存在，已从最近文件中移除')
    },

    PERMISSION_DENIED: () => {
        // 权限不足 - 提示用户
        message.error('权限不足，请检查文件权限')
    },

    ENCODING_ERROR: () => {
        // 编码错误 - 尝试其他编码
        message.warning('文件编码检测失败，尝试使用UTF-8编码打开')
        // 重试逻辑
    },

    NETWORK_ERROR: () => {
        // 网络错误 - 重试机制
        message.error('网络连接失败，请检查网络设置')
    }
}
```

## 状态持久化架构

### 1. Redux Persist配置

#### 1.1 持久化策略

```javascript
// src/store/persist.js
import {createTransform} from 'redux-persist'

// 主题状态转换器
const themeTransform = createTransform(
    // 存储时的转换
    (inboundState) => {
        // 排除不需要持久化的字段
        const {backgroundImage, loading, error, ...persistState} = inboundState
        return persistState
    },
    // 恢复时的转换
    (outboundState) => {
        // 添加默认值
        return {
            ...outboundState,
            backgroundImage: null,
            loading: false,
            error: null
        }
    },
    {whitelist: ['theme']}
)

// 编辑器状态转换器
const editorTransform = createTransform(
    (inboundState) => {
        // 只持久化设置，不持久化临时状态
        const {editorSettings, editorMode} = inboundState
        return {editorSettings, editorMode}
    },
    (outboundState) => {
        // 恢复时合并默认状态
        return {
            ...initialEditorState,
            ...outboundState
        }
    },
    {whitelist: ['editor']}
)

// 文件状态转换器
const fileTransform = createTransform(
    (inboundState) => {
        // 持久化最近文件和展开状态
        const {recentFiles, expandedKeys, rootPath} = inboundState
        return {recentFiles, expandedKeys, rootPath}
    },
    (outboundState) => {
        return {
            ...initialFileState,
            ...outboundState
        }
    },
    {whitelist: ['file']}
)

export const persistConfig = {
    key: 'miaogu-notepad',
    storage,
    whitelist: ['theme', 'editor', 'file'],
    transforms: [themeTransform, editorTransform, fileTransform],
    version: 1,
    migrate: createMigrate({
        // 版本迁移逻辑
        1: (state) => {
            // 从版本0迁移到版本1
            return {
                ...state,
                // 迁移逻辑
            }
        }
    })
}
```

#### 1.2 存储策略

```javascript
// src/utils/storage.js
import {Storage} from '@tauri-apps/plugin-store'

// 创建存储实例
const store = new Storage('settings.json')

// 自定义存储引擎
const tauriStorage = {
    getItem: async (key) => {
        try {
            const value = await store.get(key)
            return value ? JSON.stringify(value) : null
        } catch (error) {
            console.error('读取存储失败:', error)
            return null
        }
    },

    setItem: async (key, value) => {
        try {
            const parsedValue = JSON.parse(value)
            await store.set(key, parsedValue)
            await store.save()
        } catch (error) {
            console.error('写入存储失败:', error)
        }
    },

    removeItem: async (key) => {
        try {
            await store.delete(key)
            await store.save()
        } catch (error) {
            console.error('删除存储失败:', error)
        }
    }
}

export default tauriStorage
```

### 2. 状态恢复机制

#### 2.1 应用启动时的状态恢复

```javascript
// src/App.jsx
import {PersistGate} from 'redux-persist/integration/react'
import {persistor} from './store'

function App() {
    return (
        <Provider store={store}>
            <PersistGate
                loading={<LoadingComponent/>}
                persistor={persistor}
                onBeforeLift={() => {
                    // 状态恢复前的处理
                    console.log('正在恢复应用状态...')
                }}
            >
                <AppContent/>
            </PersistGate>
        </Provider>
    )
}
```

#### 2.2 状态验证和修复

```javascript
// src/store/stateValidator.js
export const validateAndRepairState = (state) => {
    const repairedState = {...state}

    // 验证主题状态
    if (!repairedState.theme || typeof repairedState.theme.currentTheme !== 'string') {
        repairedState.theme = {
            ...initialThemeState,
            ...repairedState.theme
        }
    }

    // 验证编辑器状态
    if (!repairedState.editor || !repairedState.editor.editorSettings) {
        repairedState.editor = {
            ...initialEditorState,
            ...repairedState.editor
        }
    }

    // 验证文件状态
    if (!repairedState.file || !Array.isArray(repairedState.file.recentFiles)) {
        repairedState.file = {
            ...initialFileState,
            ...repairedState.file,
            recentFiles: []
        }
    }

    return repairedState
}
```

## 性能优化的数据流

### 1. 选择器优化

#### 1.1 Memoized Selectors

```javascript
// src/store/selectors.js
import {createSelector} from '@reduxjs/toolkit'

// 基础选择器
const selectTheme = (state) => state.theme
const selectEditor = (state) => state.editor
const selectFile = (state) => state.file

// 计算选择器 - 自动缓存结果
export const selectCurrentThemeConfig = createSelector(
    [selectTheme],
    (theme) => {
        const {currentTheme, customThemes, themeSettings} = theme

        // 复杂的主题配置计算
        const baseTheme = getBaseTheme(currentTheme)
        const customTheme = customThemes.find(t => t.name === currentTheme)

        return {
            ...baseTheme,
            ...customTheme?.config,
            ...themeSettings
        }
    }
)

export const selectOpenFilesByType = createSelector(
    [selectEditor],
    (editor) => {
        const {openFiles} = editor

        // 按文件类型分组
        return openFiles.reduce((acc, file) => {
            const ext = getFileExtension(file.path)
            if (!acc[ext]) acc[ext] = []
            acc[ext].push(file)
            return acc
        }, {})
    }
)

export const selectUnsavedFilesCount = createSelector(
    [selectFile],
    (file) => {
        return Object.keys(file.unsavedContent).length
    }
)
```

#### 1.2 组件级别的选择器优化

```javascript
// src/components/FileTree.jsx
import {useMemo} from 'react'
import {useAppSelector} from '../hooks/redux'

const FileTree = () => {
    // 使用精确的选择器，避免不必要的重渲染
    const treeData = useAppSelector(state => state.file.treeData)
    const selectedKeys = useAppSelector(state => state.file.selectedKeys)
    const expandedKeys = useAppSelector(state => state.file.expandedKeys)

    // 计算派生状态
    const processedTreeData = useMemo(() => {
        return treeData.map(node => ({
            ...node,
            icon: getFileIcon(node.path),
            disabled: !hasPermission(node.path)
        }))
    }, [treeData])

    return (
        <Tree
            treeData={processedTreeData}
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            // ... 其他props
        />
    )
}
```

### 2. 异步数据流优化

#### 2.1 防抖和节流

```javascript
// src/hooks/useDebounce.js
import {useCallback, useRef} from 'react'

export const useDebounce = (callback, delay) => {
    const timeoutRef = useRef(null)

    return useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
            callback(...args)
        }, delay)
    }, [callback, delay])
}

// 使用示例
const FileEditor = () => {
    const {actions} = useFileSystem()

    // 防抖保存
    const debouncedSave = useDebounce((content) => {
        actions.setUnsavedContent(currentFile.path, content, true)
    }, 500)

    const handleContentChange = (content) => {
        debouncedSave(content)
    }

    return (
        <Editor
            value={currentFile.content}
            onChange={handleContentChange}
        />
    )
}
```

#### 2.2 批量更新优化

```javascript
// src/store/middleware/batchMiddleware.js
import {batch} from 'react-redux'

const batchMiddleware = (store) => (next) => (action) => {
    // 批量处理相关的actions
    if (action.type.startsWith('file/batch')) {
        batch(() => {
            action.payload.forEach(subAction => {
                next(subAction)
            })
        })
    } else {
        return next(action)
    }
}

export default batchMiddleware
```

### 3. 内存管理优化

#### 3.1 大文件处理

```javascript
// src/hooks/useLargeFileHandler.js
import {useCallback, useRef} from 'react'

export const useLargeFileHandler = () => {
    const chunkSize = 1024 * 1024 // 1MB chunks
    const processedChunks = useRef(new Map())

    const processLargeFile = useCallback(async (filePath) => {
        try {
            // 分块读取大文件
            const fileSize = await invoke('get_file_size', {path: filePath})
            const totalChunks = Math.ceil(fileSize / chunkSize)

            for (let i = 0; i < totalChunks; i++) {
                const chunk = await invoke('read_file_chunk', {
                    path: filePath,
                    offset: i * chunkSize,
                    size: chunkSize
                })

                // 处理chunk
                processedChunks.current.set(i, processChunk(chunk))

                // 定期让出控制权
                if (i % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0))
                }
            }

            return combineChunks(processedChunks.current)
        } catch (error) {
            console.error('处理大文件失败:', error)
            throw error
        }
    }, [])

    return {processLargeFile}
}
```

#### 3.2 缓存管理

```javascript
// src/utils/cache.js
class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize
        this.cache = new Map()
    }

    get(key) {
        if (this.cache.has(key)) {
            // 移到最前面
            const value = this.cache.get(key)
            this.cache.delete(key)
            this.cache.set(key, value)
            return value
        }
        return null
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key)
        } else if (this.cache.size >= this.maxSize) {
            // 删除最久未使用的项
            const firstKey = this.cache.keys().next().value
            this.cache.delete(firstKey)
        }

        this.cache.set(key, value)
    }

    clear() {
        this.cache.clear()
    }
}

// 文件内容缓存
export const fileContentCache = new LRUCache(50)

// 语法高亮缓存
export const syntaxHighlightCache = new LRUCache(20)
```

## 总结

喵咕记事本的数据流架构具有以下特点：

### 架构优势

1. **单向数据流**: 确保数据流向的可预测性和可调试性
2. **状态集中管理**: Redux提供统一的状态管理中心
3. **类型安全**: TypeScript和严格的数据结构定义
4. **持久化支持**: 自动保存和恢复应用状态
5. **性能优化**: 选择器缓存、防抖节流、批量更新

### 技术特色

1. **Redux Toolkit**: 现代化的Redux状态管理
2. **自定义Hooks**: 封装业务逻辑，提高代码复用性
3. **IPC通信**: 高效的前后端数据交换
4. **错误处理**: 完善的错误传播和恢复机制
5. **缓存策略**: 智能的数据缓存和内存管理

### 性能特点

1. **选择器优化**: 避免不必要的组件重渲染
2. **异步处理**: 防抖节流优化用户体验
3. **内存管理**: LRU缓存和大文件分块处理
4. **批量更新**: 减少状态更新的性能开销
5. **懒加载**: 按需加载数据和组件

### 可维护性

1. **模块化设计**: 清晰的功能模块划分
2. **标准化接口**: 统一的数据结构和API设计
3. **错误边界**: 完善的错误处理和用户反馈
4. **状态验证**: 自动修复和验证应用状态
5. **开发工具**: Redux DevTools支持调试

这种数据流架构为喵咕记事本提供了稳定、高效、可维护的状态管理基础，确保了应用在复杂交互场景下的稳定性和性能表现。
