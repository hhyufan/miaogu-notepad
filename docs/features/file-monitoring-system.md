# 文件监控系统文档

## 概述

Miaogu NotePad 的文件监控系统是一个全面的文件状态管理解决方案，提供实时文件变化检测、自动保存、外部修改冲突处理、文件状态同步等核心功能。系统采用多层架构设计，确保在不同环境下都能提供可靠的文件监控服务。

## 核心架构

### 技术栈
- **后端监控**: Rust + notify 库 (文件系统事件监听)
- **前端处理**: React + Tauri Event System
- **状态管理**: Redux Toolkit + React Hooks
- **防抖优化**: Lodash debounce/throttle
- **冲突解决**: Ant Design Modal + 自定义对话框
- **持久化**: Tauri Store API

### 系统层次
```
┌─────────────────────────────────────────┐
│              用户界面层                    │
│  (冲突对话框、状态指示器、保存提示)          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│              业务逻辑层                    │
│  (文件管理器、冲突处理、状态同步)           │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│              事件处理层                    │
│  (Tauri事件监听、防抖处理、错误恢复)        │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│              系统监控层                    │
│  (Rust文件监听器、系统事件、文件状态)       │
└─────────────────────────────────────────┘
```

## 文件监控核心功能

### 1. 实时文件变化检测

#### 1.1 Rust 后端实现
**位置**: `src-tauri/src/lib.rs`

```rust
/// 文件变更事件结构体
#[derive(Serialize, Deserialize, Debug, Clone)]
struct FileChangeEvent {
    file_path: String,
    event_type: String, // "modified", "created", "deleted"
    timestamp: u64,
}

/// 文件监控状态结构体
struct FileWatcherState {
    watchers: HashMap<String, Box<dyn Watcher + Send>>,
    watched_files: HashMap<String, u64>, // 文件路径 -> 最后修改时间
}

/// 全局文件监控器状态
static FILE_WATCHER_STATE: Lazy<Arc<Mutex<FileWatcherState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(FileWatcherState {
        watchers: HashMap::new(),
        watched_files: HashMap::new(),
    }))
});

/// 开始监听文件变更
#[tauri::command]
async fn start_file_watching(app_handle: AppHandle, file_path: String) -> Result<bool, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    let app_handle_clone = app_handle.clone();
    let file_path_clone = file_path.clone();

    // 获取文件的初始修改时间
    let initial_modified = match fs::metadata(&file_path) {
        Ok(metadata) => metadata.modified()
            .map(|time| time.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
            .unwrap_or(0),
        Err(_) => 0,
    };

    // 创建文件监听器
    let mut watcher = match notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            match event.kind {
                // 只监听文件内容修改事件，忽略文件名变化（重命名）事件
                EventKind::Modify(_) => {
                    for path in event.paths {
                        if path.to_string_lossy() == file_path_clone {
                            let event_type = "modified";
                            let timestamp = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();

                            // 检查是否需要发送事件（去重处理）
                            let should_emit = {
                                let mut state = FILE_WATCHER_STATE.lock().unwrap();
                                if let Some(&last_modified) = state.watched_files.get(&file_path_clone) {
                                    if timestamp > last_modified {
                                        state.watched_files.insert(file_path_clone.clone(), timestamp);
                                        true
                                    } else {
                                        false // 重复事件，不发送
                                    }
                                } else {
                                    true // 文件不在监听列表中，发送事件
                                }
                            };

                            if should_emit {
                                let change_event = FileChangeEvent {
                                    file_path: path.to_string_lossy().to_string(),
                                    event_type: event_type.to_string(),
                                    timestamp,
                                };

                                // 发送事件到前端
                                let _ = app_handle_clone.emit("file-changed", &change_event);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }) {
        Ok(watcher) => watcher,
        Err(e) => return Err(format!("创建文件监听器失败: {}", e)),
    };

    // 监听文件所在的目录
    if let Some(parent_dir) = path.parent() {
        if let Err(e) = watcher.watch(parent_dir, RecursiveMode::NonRecursive) {
            return Err(format!("开始监听文件失败: {}", e));
        }
    } else {
        return Err("无法获取文件所在目录".to_string());
    }

    // 保存监听器状态
    {
        let mut state = FILE_WATCHER_STATE.lock().unwrap();
        state.watchers.insert(file_path.clone(), Box::new(watcher));
        state.watched_files.insert(file_path.clone(), initial_modified);
    }

    Ok(true)
}

/// 停止监听文件变更
#[tauri::command]
async fn stop_file_watching(file_path: String) -> Result<bool, String> {
    let mut state = FILE_WATCHER_STATE.lock().unwrap();

    if state.watchers.remove(&file_path).is_some() {
        state.watched_files.remove(&file_path);
        Ok(true)
    } else {
        Ok(false)
    }
}

/// 检查文件是否被外部修改
#[tauri::command]
async fn check_file_external_changes(file_path: String) -> Result<Option<FileChangeEvent>, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Ok(Some(FileChangeEvent {
            file_path: file_path.clone(),
            event_type: "deleted".to_string(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }));
    }

    let current_modified = match fs::metadata(&file_path) {
        Ok(metadata) => metadata.modified()
            .map(|time| time.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
            .unwrap_or(0),
        Err(_) => return Err("无法获取文件信息".to_string()),
    };

    let state = FILE_WATCHER_STATE.lock().unwrap();
    if let Some(&last_modified) = state.watched_files.get(&file_path) {
        if current_modified > last_modified {
            return Ok(Some(FileChangeEvent {
                file_path: file_path.clone(),
                event_type: "modified".to_string(),
                timestamp: current_modified,
            }));
        }
    }

    Ok(None)
}
```

#### 1.2 前端事件监听
**位置**: `src/hooks/useFileManager.jsx`

```javascript
// 监听文件变更事件
useEffect(() => {
    let unlisten = null

    const setupListener = async () => {
        try {
            unlisten = await listen('file-changed', (event) => {
                const { file_path } = event.payload
                if (file_path) {
                    handleExternalFileChangeRef.current(file_path)
                } else {
                    console.warn('File change event missing file_path:', event.payload)
                }
            })
        } catch (error) {
            console.warn('Failed to setup file change listener:', error)
        }
    }

    setupListener().then()

    return () => {
        if (unlisten) {
            unlisten()
        }
    }
}, [])
```

### 2. 自动保存机制

#### 2.1 防抖自动保存
**位置**: `src/hooks/useFileManager.jsx`

```javascript
// 防抖自动保存实现
const debouncedAutoSave = useMemo(
    () => debounce(async (filePath, content) => {
        if (fileApi?.writeFileContent && filePath && !filePath.startsWith('temp://')) {
            try {
                await fileApi.writeFileContent(filePath, content)
            } catch (error) {
                console.error('Auto save failed:', error)
            }
        }
    }, 500), // 500ms 防抖延迟
    []
)

// 编辑器内容变化时触发自动保存
useEffect(() => {
    const currentFile = openedFilesMap.get(currentFilePath)
    if (!currentFile) return

    // 更新文件内容和修改状态
    setOpenedFiles(prev => {
        const targetIndex = prev.findIndex(f => f.path === currentFilePath)
        if (targetIndex === -1) return prev

        const targetFile = prev[targetIndex]
        const newCode = editorCode

        // 计算是否修改
        const isModified = targetFile.originalContent !== undefined
            ? targetFile.originalContent !== newCode
            : targetFile.content !== newCode

        // 如果内容和修改状态都没有变化，直接返回
        if (targetFile.content === newCode && targetFile.isModified === isModified) {
            return prev
        }

        const newFiles = [...prev]
        newFiles[targetIndex] = {
            ...targetFile,
            content: newCode,
            isModified
        }

        return newFiles
    })

    // 临时文件自动保存
    if (currentFile && currentFile['isTemporary'] && currentFilePath) {
        debouncedAutoSave(currentFilePath, editorCode)
    }
}, [editorCode, currentFilePath, currentFile, debouncedAutoSave])
```

#### 2.2 设置持久化自动保存
**位置**: `src/utils/tauriApi.js`

```javascript
// Tauri Store 自动保存配置
store = await load('settings.json', { autoSave: true });

// 对于 Tauri Store，由于使用了 autoSave，不需要手动调用 save()
```

#### 2.3 状态管理自动保存
**位置**: `src/utils/persistenceManager.js`

```javascript
class PersistenceManager {
    constructor() {
        this.debouncedSave = debounce(this.saveState.bind(this), 1000);
    }

    // 防抖保存状态
    debouncedSave(state) {
        this.saveState(state);
    }

    async saveState(state) {
        try {
            // 保存应用状态到本地存储
            await this.storage.setItem('app-state', JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }
}
```

### 3. 文件冲突处理

#### 3.1 冲突检测机制
**位置**: `src/hooks/useFileManager.jsx`

```javascript
// 处理外部文件变更
const handleExternalFileChange = useCallback(async (filePath) => {
    try {
        // 防止重复处理同一个文件的变更
        if (processingExternalChanges.current.has(filePath)) {
            return
        }

        processingExternalChanges.current.add(filePath)

        const currentFile = openedFilesMap.get(filePath)

        if (!currentFile) {
            processingExternalChanges.current.delete(filePath)
            return
        }

        // 检查文件是否有未保存的修改
        if (currentFile['isModified']) {
            // 如果用户正在主动保存该文件，跳过冲突检查
            if (userSavingFiles.current.has(filePath)) {
                processingExternalChanges.current.delete(filePath)
                return
            }

            // 显示冲突解决对话框
            try {
                const userChoice = await showFileConflictDialog(filePath)

                if (userChoice === 'external') {
                    // 用户选择使用外部版本
                    await refreshFileContent(filePath)
                } else if (userChoice === 'current') {
                    // 用户选择保留当前版本，直接保存当前修改
                    try {
                        // 如果是当前文件，保存当前编辑器内容
                        if (filePath === currentFilePath) {
                            const saveResult = await saveFile(false)
                            if (saveResult.success) {
                                console.log('Current modifications saved successfully')
                            } else {
                                console.error('Failed to save current modifications:', saveResult)
                            }
                        } else {
                            // 如果不是当前文件，保存该文件的内容
                            const fileEncoding = currentFile['encoding'] || 'UTF-8'
                            const saveResult = await fileApi.saveFile(filePath, currentFile['content'], fileEncoding)
                            if (saveResult.success) {
                                // 更新文件状态
                                setOpenedFiles((prev) =>
                                    prev.map((f) =>
                                        f.path === filePath
                                            ? {
                                                ...f,
                                                originalContent: f.content,
                                                isModified: false,
                                                encoding: saveResult.encoding || fileEncoding,
                                                lineEnding: saveResult['line_ending'] || f.lineEnding || 'LF'
                                            }
                                            : f
                                    )
                                )
                            } else {
                                console.error('Failed to save file modifications:', saveResult)
                            }
                        }
                    } catch (error) {
                        console.error('Error saving file modifications:', error)
                    }
                }
            } catch (dialogError) {
                console.error('Error in conflict dialog:', dialogError)
            }
        } else {
            // 文件未修改，直接同步外部变更
            await refreshFileContent(filePath)
        }
    } catch (error) {
        console.error('Failed to handle external file change:', error)
    } finally {
        // 清除处理标记
        processingExternalChanges.current.delete(filePath)
    }
}, [openedFilesMap, refreshFileContent, showFileConflictDialog])
```

#### 3.2 冲突对话框实现
**位置**: `src/hooks/useFileManager.jsx`

```javascript
// 显示文件冲突解决对话框
const showFileConflictDialog = useCallback(async (filePath) => {
    // 如果该文件已经有冲突modal在显示，直接返回
    if (activeConflictModals.current.has(filePath)) {
        return 'current' // 默认保留当前版本
    }

    // 标记该文件的冲突modal正在显示
    activeConflictModals.current.add(filePath)

    return new Promise((resolve) => {
        const fileName = filePath.split(/\//).pop()

        try {
            Modal.confirm({
                title: t('dialog.confirm.title'),
                content: (
                    <div>
                        <p>{t('fileConflict.fileConflictMessage', { fileName })}</p>
                        <p style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
                            {t('fileConflict.chooseVersion')}
                        </p>
                    </div>
                ),
                okText: t('fileConflict.useExternal'),
                cancelText: t('fileConflict.keepCurrent'),
                onOk: () => {
                    // 移除标记
                    activeConflictModals.current.delete(filePath)
                    resolve('external')
                },
                onCancel: () => {
                    // 移除标记
                    activeConflictModals.current.delete(filePath)
                    resolve('current')
                },
                width: 480,
                centered: true
            })

        } catch (error) {
            console.error('Error calling Modal.confirm:', error)
            // 移除标记
            activeConflictModals.current.delete(filePath)
            resolve('current') // 默认保留当前版本
        }
    })
}, [t])
```

#### 3.3 国际化支持
**位置**: `src/i18n/locales/zh-CN.json` 和 `src/i18n/locales/en-US.json`

```json
// 中文
"fileConflict": {
  "fileConflictMessage": "文件 {{fileName}} 已被外部程序修改",
  "fileConflictOptions": "点击确定使用外部修改版本，点击取消保留当前版本",
  "chooseVersion": "请选择要保留的版本：",
  "useExternal": "使用外部版本",
  "keepCurrent": "保留当前版本"
}

// 英文
"fileConflict": {
  "fileConflictMessage": "File {{fileName}} has been modified by an external program",
  "fileConflictOptions": "Click OK to use the external version, or Cancel to keep the current version",
  "chooseVersion": "Please choose which version to keep:",
  "useExternal": "Use External Version",
  "keepCurrent": "Keep Current Version"
}
```

### 4. 文件状态管理

#### 4.1 文件修改状态跟踪
**位置**: `src/store/slices/fileSlice.js`

```javascript
// Redux 文件状态管理
const fileSlice = createSlice({
  name: 'file',
  initialState: {
    currentFile: {
      path: '',
      name: '',
      content: '',
      originalContent: '',
      isModified: false,
      encoding: 'UTF-8',
      lineEnding: 'LF'
    },
    openedFiles: []
  },
  reducers: {
    // 更新文件内容
    updateFileContent: (state, action) => {
      const { content } = action.payload;
      state.currentFile.content = content;
      state.currentFile.isModified = content !== state.currentFile.originalContent;
      
      // 同步更新打开文件列表中的状态
      const fileIndex = state.openedFiles.findIndex(f => f.path === state.currentFile.path);
      if (fileIndex !== -1) {
        state.openedFiles[fileIndex].content = content;
        state.openedFiles[fileIndex].isModified = content !== state.openedFiles[fileIndex].originalContent;
      }
    },

    // 保存文件后重置修改状态
    saveFileSuccess: (state, action) => {
      const { filePath } = action.payload;
      state.currentFile.isModified = false;
      state.currentFile.originalContent = state.currentFile.content;
      
      const fileIndex = state.openedFiles.findIndex(f => f.path === filePath);
      if (fileIndex !== -1) {
        state.openedFiles[fileIndex].isModified = false;
        state.openedFiles[fileIndex].originalContent = state.openedFiles[fileIndex].content;
      }
    },

    // 获取未保存文件
    getUnsavedFiles: (state) => {
      return state.openedFiles.filter(file => file.isModified);
    }
  }
});
```

#### 4.2 未保存文件检测
**位置**: `src/hooks/useFileManager.jsx`

```javascript
// 获取未保存文件列表
const getUnsavedFiles = useCallback(() => {
    const unsavedFiles = openedFiles.filter((file) => file.isTemporary || file.isModified)
    
    // 如果只有一个文件且是空的临时文件，不算作未保存
    if (unsavedFiles.length === 1 && openedFiles.length === 1) {
        const singleFile = unsavedFiles[0]
        if (singleFile.isTemporary && (!singleFile.content || singleFile.content.trim() === '')) {
            return []
        }
    }
    return unsavedFiles
}, [openedFiles])

// 检查是否有未保存的更改
const hasUnsavedChanges = useMemo(() => {
    return currentFile && (currentFile['isTemporary'] || currentFile['isModified'])
}, [currentFile])
```

#### 4.3 视觉状态指示
**位置**: `src/components/TabBar.jsx`

```javascript
// 标签页显示修改状态
{file.isModified ? (
  <span className="modified-indicator">●</span>
) : null}

// CSS 样式
.modified-indicator {
  color: #ff4d4f;
  margin-left: 4px;
  font-size: 12px;
}
```

### 5. 监控生命周期管理

#### 5.1 文件打开时启动监控
**位置**: `src/hooks/useFileManager.jsx`

```javascript
const setOpenFile = useCallback(async (filePath, content, options = {}) => {
    try {
        // ... 文件打开逻辑 ...

        // 启动文件监控
        if (fileApi && fileApi.startFileWatching && !filePath.startsWith('temp://')) {
            try {
                await fileApi.startFileWatching(filePath)
            } catch (error) {
                console.warn('Failed to start file watching:', error)
            }
        }

        // ... 其他逻辑 ...
    } catch (error) {
        handleError('openFileFailed', error)
    }
}, [/* dependencies */])
```

#### 5.2 文件关闭时停止监控
**位置**: `src/hooks/useFileManager.jsx`

```javascript
const closeFile = useCallback((key) => {
    // 清理文件缓存
    fileCache.delete(`file_${key}`)

    // 停止文件监控
    if (!key.startsWith('temp://')) {
        try {
            fileApi.stopFileWatching(key).then()
        } catch (error) {
            console.warn('Failed to stop file watching:', error)
        }
    }

    // ... 其他关闭逻辑 ...
}, [/* dependencies */])
```

#### 5.3 组件卸载时清理
**位置**: `src/hooks/useFileManager.jsx`

```javascript
useEffect(() => {
    return () => {
        // 清理所有文件监听器
        fileWatchers.forEach(watcher => {
            if (watcher && typeof watcher.unwatch === 'function') {
                watcher.unwatch()
            }
        })
    }
}, [])
```

## 性能优化策略

### 1. 事件防抖和节流

#### 1.1 自动保存防抖
```javascript
// 500ms 防抖，避免频繁保存
const debouncedAutoSave = useMemo(
    () => debounce(async (filePath, content) => {
        // 自动保存逻辑
    }, 500),
    []
)
```

#### 1.2 编辑器更新节流
```javascript
// 100ms 节流，优化编辑器性能
const throttledEditorUpdate = useMemo(
    () => throttle((content) => {
        setEditorCode(content)
    }, 100),
    []
)
```

#### 1.3 文件变更事件去重
```rust
// Rust 后端去重处理
let should_emit = {
    let mut state = FILE_WATCHER_STATE.lock().unwrap();
    if let Some(&last_modified) = state.watched_files.get(&file_path_clone) {
        if timestamp > last_modified {
            state.watched_files.insert(file_path_clone.clone(), timestamp);
            true
        } else {
            false // 重复事件，不发送
        }
    } else {
        true // 文件不在监听列表中，发送事件
    }
};
```

### 2. 内存管理

#### 2.1 文件缓存管理
```javascript
// 文件内容缓存
const fileCache = new Map()

// 关闭文件时清理缓存
const closeFile = useCallback((key) => {
    fileCache.delete(`file_${key}`)
    // ... 其他逻辑
}, [])
```

#### 2.2 监听器状态管理
```rust
// Rust 后端状态管理
struct FileWatcherState {
    watchers: HashMap<String, Box<dyn Watcher + Send>>,
    watched_files: HashMap<String, u64>,
}

// 停止监听时清理状态
async fn stop_file_watching(file_path: String) -> Result<bool, String> {
    let mut state = FILE_WATCHER_STATE.lock().unwrap();
    
    if state.watchers.remove(&file_path).is_some() {
        state.watched_files.remove(&file_path);
        Ok(true)
    } else {
        Ok(false)
    }
}
```

### 3. 冲突处理优化

#### 3.1 重复处理防护
```javascript
// 防止重复处理外部文件变更
const processingExternalChanges = useRef(new Set())

// 防止重复显示冲突modal
const activeConflictModals = useRef(new Set())

const handleExternalFileChange = useCallback(async (filePath) => {
    // 防止重复处理同一个文件的变更
    if (processingExternalChanges.current.has(filePath)) {
        return
    }

    processingExternalChanges.current.add(filePath)
    
    try {
        // 处理逻辑...
    } finally {
        // 清除处理标记
        processingExternalChanges.current.delete(filePath)
    }
}, [])
```

#### 3.2 用户操作冲突避免
```javascript
// 用户主动保存时的冲突避免
const userSavingFiles = useRef(new Set())

const updateFileLineEnding = useCallback(async (filePath, lineEnding) => {
    try {
        // 标记文件正在被用户主动修改，避免外部文件变更冲突
        userSavingFiles.current.add(filePath)

        // 暂时停止文件监听，避免监听到自己的修改
        if (fileApi && fileApi.stopFileWatching) {
            try {
                await fileApi.stopFileWatching(filePath)
            } catch (error) {
                console.warn('停止文件监听失败:', error)
            }
        }

        // 执行修改操作...

    } finally {
        // 重新启动文件监听
        if (fileApi && fileApi.startFileWatching) {
            try {
                await fileApi.startFileWatching(filePath)
            } catch (error) {
                console.warn('恢复文件监听失败:', error)
            }
        }

        // 延迟移除标记，给文件系统更多时间来处理变更
        setTimeout(() => {
            userSavingFiles.current.delete(filePath)
        }, 1000)
    }
}, [])
```

## 错误处理和恢复

### 1. 监听器错误处理

#### 1.1 创建监听器失败
```rust
let mut watcher = match notify::recommended_watcher(/* callback */) {
    Ok(watcher) => watcher,
    Err(e) => return Err(format!("创建文件监听器失败: {}", e)),
};
```

#### 1.2 监听启动失败
```rust
if let Err(e) = watcher.watch(parent_dir, RecursiveMode::NonRecursive) {
    return Err(format!("开始监听文件失败: {}", e));
}
```

#### 1.3 前端监听器设置失败
```javascript
const setupListener = async () => {
    try {
        unlisten = await listen('file-changed', (event) => {
            // 处理事件
        })
    } catch (error) {
        console.warn('Failed to setup file change listener:', error)
    }
}
```

### 2. 文件操作错误处理

#### 2.1 文件不存在处理
```rust
async fn check_file_external_changes(file_path: String) -> Result<Option<FileChangeEvent>, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Ok(Some(FileChangeEvent {
            file_path: file_path.clone(),
            event_type: "deleted".to_string(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }));
    }
    // ... 其他逻辑
}
```

#### 2.2 权限错误处理
```javascript
const handleFileError = (error, filePath) => {
    if (error.message.includes('permission')) {
        message.error(t('error.permissionDenied'))
    } else if (error.message.includes('not found')) {
        message.error(t('error.fileNotFound'))
    } else {
        message.error(t('error.unknownError'))
    }
}
```

### 3. 自动恢复机制

#### 3.1 监听器自动重启
```javascript
const restartFileWatching = async (filePath) => {
    try {
        // 停止现有监听
        await fileApi.stopFileWatching(filePath)
        
        // 等待一段时间后重新启动
        setTimeout(async () => {
            try {
                await fileApi.startFileWatching(filePath)
            } catch (error) {
                console.warn('Failed to restart file watching:', error)
            }
        }, 1000)
    } catch (error) {
        console.warn('Failed to restart file watching:', error)
    }
}
```

#### 3.2 状态同步恢复
```javascript
const syncFileState = async (filePath) => {
    try {
        // 检查文件外部变化
        const changes = await fileApi.checkFileExternalChanges(filePath)
        
        if (changes && changes.event_type === 'modified') {
            // 处理文件变化
            await handleExternalFileChange(filePath)
        }
    } catch (error) {
        console.warn('Failed to sync file state:', error)
    }
}
```

## 用户体验优化

### 1. 视觉反馈

#### 1.1 文件状态指示
```scss
// 修改状态指示器
.tab-item {
  &.modified {
    .tab-title::after {
      content: '●';
      color: #ff4d4f;
      margin-left: 4px;
    }
  }
  
  &.saving {
    .tab-title {
      opacity: 0.7;
    }
    
    &::before {
      content: '';
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid #1890ff;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 1s linear infinite;
      margin-right: 4px;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

#### 1.2 冲突对话框样式
```scss
.file-conflict-modal {
  .ant-modal-content {
    border-radius: 8px;
    overflow: hidden;
  }
  
  .conflict-message {
    padding: 16px 0;
    
    .file-name {
      font-weight: 600;
      color: #1890ff;
    }
    
    .version-choice {
      margin-top: 12px;
      font-size: 14px;
      color: #666;
    }
  }
  
  .ant-modal-footer {
    .ant-btn-primary {
      background-color: #ff4d4f;
      border-color: #ff4d4f;
      
      &:hover {
        background-color: #ff7875;
        border-color: #ff7875;
      }
    }
  }
}
```

### 2. 操作提示

#### 2.1 自动保存提示
```javascript
const showAutoSaveNotification = (filePath) => {
    const fileName = filePath.split(/[/\\]/).pop()
    
    notification.success({
        message: t('notification.autoSaveSuccess'),
        description: t('notification.autoSaveDescription', { fileName }),
        duration: 2,
        placement: 'bottomRight'
    })
}
```

#### 2.2 冲突解决提示
```javascript
const showConflictResolvedNotification = (filePath, choice) => {
    const fileName = filePath.split(/[/\\]/).pop()
    const message = choice === 'external' 
        ? t('notification.externalVersionUsed')
        : t('notification.currentVersionKept')
    
    notification.info({
        message: t('notification.conflictResolved'),
        description: t('notification.conflictResolvedDescription', { fileName, choice: message }),
        duration: 3,
        placement: 'topRight'
    })
}
```

### 3. 键盘快捷键

#### 3.1 快速保存
```javascript
// Ctrl+S 快速保存
useEffect(() => {
    const handleKeyDown = (event) => {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault()
            if (currentFile && currentFile.isModified) {
                saveFile(false)
            }
        }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
}, [currentFile, saveFile])
```

#### 3.2 刷新文件内容
```javascript
// F5 刷新当前文件
useEffect(() => {
    const handleKeyDown = (event) => {
        if (event.key === 'F5') {
            event.preventDefault()
            if (currentFile && currentFile.path) {
                refreshFileContent(currentFile.path)
            }
        }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
}, [currentFile, refreshFileContent])
```

## 扩展性设计

### 1. 插件接口

#### 1.1 文件监控插件
```javascript
// 文件监控插件接口
interface FileMonitorPlugin {
    name: string;
    version: string;
    
    // 监控事件处理
    onFileChanged(event: FileChangeEvent): Promise<void>;
    onFileConflict(filePath: string, conflictType: string): Promise<ConflictResolution>;
    
    // 自定义保存策略
    shouldAutoSave(filePath: string, content: string): boolean;
    getAutoSaveInterval(filePath: string): number;
    
    // 配置选项
    getConfigSchema(): ConfigSchema;
    updateConfig(config: any): void;
}
```

#### 1.2 冲突解决策略
```javascript
// 冲突解决策略接口
interface ConflictResolutionStrategy {
    name: string;
    description: string;
    
    // 解决冲突
    resolveConflict(
        filePath: string,
        currentContent: string,
        externalContent: string
    ): Promise<ConflictResolution>;
    
    // 预览差异
    previewDiff(
        currentContent: string,
        externalContent: string
    ): DiffPreview;
}

// 内置策略
const builtInStrategies = {
    'keep-current': new KeepCurrentStrategy(),
    'use-external': new UseExternalStrategy(),
    'merge-auto': new AutoMergeStrategy(),
    'show-diff': new ShowDiffStrategy()
}
```

### 2. 配置系统

#### 2.1 监控配置
```javascript
// 文件监控配置
const monitoringConfig = {
    // 自动保存设置
    autoSave: {
        enabled: true,
        interval: 500, // ms
        onlyForTempFiles: false
    },
    
    // 冲突处理设置
    conflictResolution: {
        strategy: 'show-dialog', // 'show-dialog', 'keep-current', 'use-external'
        autoResolveTimeout: 30000, // ms
        showDiffPreview: true
    },
    
    // 监控范围设置
    watchScope: {
        includePatterns: ['**/*'],
        excludePatterns: ['**/node_modules/**', '**/.git/**'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxWatchedFiles: 100
    },
    
    // 性能设置
    performance: {
        debounceInterval: 500, // ms
        throttleInterval: 100, // ms
        batchEventProcessing: true,
        maxEventQueueSize: 1000
    }
}
```

#### 2.2 用户自定义配置
```javascript
// 用户配置界面
const MonitoringSettings = () => {
    const [config, setConfig] = useState(monitoringConfig)
    
    return (
        <div className="monitoring-settings">
            <h3>{t('settings.fileMonitoring.title')}</h3>
            
            <Form layout="vertical">
                <Form.Item label={t('settings.autoSave.enabled')}>
                    <Switch 
                        checked={config.autoSave.enabled}
                        onChange={(checked) => updateConfig('autoSave.enabled', checked)}
                    />
                </Form.Item>
                
                <Form.Item label={t('settings.autoSave.interval')}>
                    <Slider
                        min={100}
                        max={5000}
                        step={100}
                        value={config.autoSave.interval}
                        onChange={(value) => updateConfig('autoSave.interval', value)}
                    />
                </Form.Item>
                
                <Form.Item label={t('settings.conflictResolution.strategy')}>
                    <Select
                        value={config.conflictResolution.strategy}
                        onChange={(value) => updateConfig('conflictResolution.strategy', value)}
                    >
                        <Option value="show-dialog">{t('settings.conflict.showDialog')}</Option>
                        <Option value="keep-current">{t('settings.conflict.keepCurrent')}</Option>
                        <Option value="use-external">{t('settings.conflict.useExternal')}</Option>
                    </Select>
                </Form.Item>
            </Form>
        </div>
    )
}
```

## 总结

Miaogu NotePad 的文件监控系统是一个功能完整、性能优化、用户友好的文件状态管理解决方案：

### 技术特点
- **多层架构**: Rust 后端 + React 前端的完整监控体系
- **实时响应**: 基于文件系统事件的实时变化检测
- **智能冲突处理**: 自动检测冲突并提供用户友好的解决方案
- **性能优化**: 防抖、节流、去重等多重优化策略

### 功能特点
- **全面监控**: 文件修改、创建、删除等全方位监控
- **自动保存**: 智能的防抖自动保存机制
- **冲突解决**: 完善的外部修改冲突处理流程
- **状态同步**: 实时的文件状态同步和视觉反馈

### 用户体验
- **无感知操作**: 后台自动处理，不干扰用户工作流
- **智能提示**: 适时的状态提示和操作反馈
- **灵活配置**: 丰富的配置选项满足不同需求
- **国际化支持**: 完整的多语言界面支持

### 扩展性
- **插件系统**: 支持自定义监控插件和冲突解决策略
- **配置系统**: 灵活的配置管理和用户自定义选项
- **API 接口**: 完整的编程接口支持第三方扩展

这个文件监控系统确保了应用在复杂的多文件编辑场景下能够提供可靠、高效、用户友好的文件管理体验。