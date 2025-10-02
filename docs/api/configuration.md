# 配置和状态管理 API 文档

## 概述

本文档详细介绍了喵咕记事本的配置系统和状态管理架构，包括Redux状态管理、国际化配置、文件扩展名映射等核心配置模块。

---

## Redux 状态管理

### Store 配置 (src/store/index.js)

#### Store 结构

```javascript
// Store 配置
const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
});

// 根Reducer组合
const rootReducer = combineReducers({
    theme: themeReducer,
    editor: editorReducer,
    file: fileReducer,
});
```

#### 持久化配置

| 配置项          | 值                             | 描述         |
|--------------|-------------------------------|------------|
| `key`        | `'root'`                      | 持久化存储键名    |
| `storage`    | `storage`                     | 存储引擎       |
| `whitelist`  | `['theme', 'editor', 'file']` | 需要持久化的状态切片 |
| `transforms` | `[themeTransform]`            | 状态转换器      |

#### 主题转换器

```javascript
// 主题持久化转换器 - 排除背景图片
const themeTransform = createTransform(
    // 入站转换 - 保存时
    (inboundState) => {
        const {backgroundImage, ...rest} = inboundState;
        return rest; // 不保存背景图片
    },
    // 出站转换 - 加载时
    (outboundState) => {
        return {
            ...outboundState,
            backgroundImage: null // 重置背景图片
        };
    },
    {whitelist: ['theme']}
);
```

#### 使用示例

```javascript
import {store} from '@/store';
import {Provider} from 'react-redux';

// 在应用根组件中使用
function App() {
    return (
        <Provider store={store}>
            <PersistGate loading={<LoadingComponent/>} persistor={persistor}>
                <MainApp/>
            </PersistGate>
        </Provider>
    );
}

// 获取当前状态
const currentState = store.getState();
console.log('当前状态:', currentState);

// 订阅状态变化
const unsubscribe = store.subscribe(() => {
    console.log('状态已更新:', store.getState());
});

// 取消订阅
unsubscribe();
```

---

## 主题状态管理 (themeSlice.js)

### 状态结构

```javascript
interface
ThemeState
{
    mode: 'light' | 'dark' | 'auto';           // 主题模式
    primaryColor: string;                       // 主色调
    fontSize: number;                          // 字体大小
    fontFamily: string;                        // 字体族
    backgroundImage: string | null;            // 背景图片
    customColors: {                            // 自定义颜色
        background: string;
        foreground: string;
        accent: string;
    }
    ;
    animations: boolean;                       // 动画开关
    transparency: number;                      // 透明度 (0-1)
}
```

### Actions

| Action               | 参数                                  | 描述      |
|----------------------|-------------------------------------|---------|
| `setThemeMode`       | `mode: 'light' \| 'dark' \| 'auto'` | 设置主题模式  |
| `setPrimaryColor`    | `color: string`                     | 设置主色调   |
| `setFontSize`        | `size: number`                      | 设置字体大小  |
| `setFontFamily`      | `family: string`                    | 设置字体族   |
| `setBackgroundImage` | `image: string \| null`             | 设置背景图片  |
| `setCustomColors`    | `colors: CustomColors`              | 设置自定义颜色 |
| `toggleAnimations`   | -                                   | 切换动画开关  |
| `setTransparency`    | `value: number`                     | 设置透明度   |
| `resetTheme`         | -                                   | 重置为默认主题 |
| `importTheme`        | `theme: Partial<ThemeState>`        | 导入主题配置  |

### 使用示例

```javascript
import {useDispatch, useSelector} from 'react-redux';
import {
    setThemeMode,
    setPrimaryColor,
    setFontSize,
    toggleAnimations,
    resetTheme
} from '@/store/slices/themeSlice';

function ThemeSettings() {
    const dispatch = useDispatch();
    const theme = useSelector(state => state.theme);

    // 切换主题模式
    const handleThemeChange = (mode) => {
        dispatch(setThemeMode(mode));
    };

    // 更改主色调
    const handleColorChange = (color) => {
        dispatch(setPrimaryColor(color));
    };

    // 调整字体大小
    const handleFontSizeChange = (size) => {
        dispatch(setFontSize(size));
    };

    // 切换动画
    const handleToggleAnimations = () => {
        dispatch(toggleAnimations());
    };

    // 重置主题
    const handleResetTheme = () => {
        dispatch(resetTheme());
    };

    return (
        <div className="theme-settings">
            {/* 主题模式选择 */}
            <div className="setting-group">
                <label>主题模式</label>
                <select
                    value={theme.mode}
                    onChange={(e) => handleThemeChange(e.target.value)}
                >
                    <option value="light">浅色</option>
                    <option value="dark">深色</option>
                    <option value="auto">跟随系统</option>
                </select>
            </div>

            {/* 主色调选择 */}
            <div className="setting-group">
                <label>主色调</label>
                <input
                    type="color"
                    value={theme.primaryColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                />
            </div>

            {/* 字体大小 */}
            <div className="setting-group">
                <label>字体大小: {theme.fontSize}px</label>
                <input
                    type="range"
                    min="12"
                    max="24"
                    value={theme.fontSize}
                    onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                />
            </div>

            {/* 动画开关 */}
            <div className="setting-group">
                <label>
                    <input
                        type="checkbox"
                        checked={theme.animations}
                        onChange={handleToggleAnimations}
                    />
                    启用动画效果
                </label>
            </div>

            {/* 重置按钮 */}
            <button onClick={handleResetTheme}>
                重置为默认主题
            </button>
        </div>
    );
}

// 主题应用示例
function ThemedComponent() {
    const theme = useSelector(state => state.theme);

    const styles = {
        backgroundColor: theme.customColors.background,
        color: theme.customColors.foreground,
        fontSize: `${theme.fontSize}px`,
        fontFamily: theme.fontFamily,
        opacity: theme.transparency,
        transition: theme.animations ? 'all 0.3s ease' : 'none'
    };

    return (
        <div style={styles} className={`theme-${theme.mode}`}>
            主题化组件内容
        </div>
    );
}
```

### 预设主题

```javascript
// 预设主题配置
const PRESET_THEMES = {
    default: {
        mode: 'light',
        primaryColor: '#007acc',
        fontSize: 14,
        fontFamily: 'Monaco, Consolas, monospace',
        customColors: {
            background: '#ffffff',
            foreground: '#333333',
            accent: '#007acc'
        },
        animations: true,
        transparency: 1
    },

    dark: {
        mode: 'dark',
        primaryColor: '#4fc3f7',
        fontSize: 14,
        fontFamily: 'Monaco, Consolas, monospace',
        customColors: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            accent: '#4fc3f7'
        },
        animations: true,
        transparency: 1
    },

    highContrast: {
        mode: 'dark',
        primaryColor: '#ffff00',
        fontSize: 16,
        fontFamily: 'Arial, sans-serif',
        customColors: {
            background: '#000000',
            foreground: '#ffffff',
            accent: '#ffff00'
        },
        animations: false,
        transparency: 1
    }
};

// 应用预设主题
function applyPresetTheme(presetName) {
    const preset = PRESET_THEMES[presetName];
    if (preset) {
        dispatch(importTheme(preset));
    }
}
```

---

## 编辑器状态管理 (editorSlice.js)

### 状态结构

```javascript
interface
EditorState
{
    // 编辑器配置
    tabSize: number;                           // Tab大小
    insertSpaces: boolean;                     // 使用空格代替Tab
    wordWrap: boolean;                         // 自动换行
    lineNumbers: boolean;                      // 显示行号
    minimap: boolean;                          // 显示小地图
    folding: boolean;                          // 代码折叠

    // 编辑器行为
    autoSave: boolean;                         // 自动保存
    autoSaveDelay: number;                     // 自动保存延迟(ms)
    formatOnSave: boolean;                     // 保存时格式化
    trimTrailingWhitespace: boolean;           // 删除尾随空格

    // 显示设置
    renderWhitespace: 'none' | 'boundary' | 'all'; // 空白字符显示
    renderControlCharacters: boolean;          // 显示控制字符
    renderIndentGuides: boolean;               // 显示缩进参考线

    // 搜索设置
    searchCaseSensitive: boolean;              // 区分大小写
    searchWholeWord: boolean;                  // 全词匹配
    searchRegex: boolean;                      // 正则表达式

    // 其他设置
    cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid'; // 光标闪烁
    cursorStyle: 'line' | 'block' | 'underline'; // 光标样式
    scrollBeyondLastLine: boolean;             // 允许滚动到最后一行之后
}
```

### Actions

| Action                | 参数                             | 描述       |
|-----------------------|--------------------------------|----------|
| `setTabSize`          | `size: number`                 | 设置Tab大小  |
| `toggleInsertSpaces`  | -                              | 切换空格/Tab |
| `toggleWordWrap`      | -                              | 切换自动换行   |
| `toggleLineNumbers`   | -                              | 切换行号显示   |
| `toggleMinimap`       | -                              | 切换小地图    |
| `toggleAutoSave`      | -                              | 切换自动保存   |
| `setAutoSaveDelay`    | `delay: number`                | 设置自动保存延迟 |
| `toggleFormatOnSave`  | -                              | 切换保存时格式化 |
| `setRenderWhitespace` | `mode: string`                 | 设置空白字符显示 |
| `setCursorStyle`      | `style: string`                | 设置光标样式   |
| `updateEditorConfig`  | `config: Partial<EditorState>` | 批量更新配置   |
| `resetEditorConfig`   | -                              | 重置编辑器配置  |

### 使用示例

```javascript
import {useDispatch, useSelector} from 'react-redux';
import {
    setTabSize,
    toggleWordWrap,
    toggleAutoSave,
    setAutoSaveDelay,
    updateEditorConfig
} from '@/store/slices/editorSlice';

function EditorSettings() {
    const dispatch = useDispatch();
    const editor = useSelector(state => state.editor);

    // Tab设置
    const handleTabSizeChange = (size) => {
        dispatch(setTabSize(size));
    };

    // 自动保存设置
    const handleAutoSaveToggle = () => {
        dispatch(toggleAutoSave());
    };

    const handleAutoSaveDelayChange = (delay) => {
        dispatch(setAutoSaveDelay(delay));
    };

    // 批量更新配置
    const handleBatchUpdate = (newConfig) => {
        dispatch(updateEditorConfig(newConfig));
    };

    return (
        <div className="editor-settings">
            {/* Tab设置 */}
            <div className="setting-group">
                <label>Tab大小</label>
                <select
                    value={editor.tabSize}
                    onChange={(e) => handleTabSizeChange(Number(e.target.value))}
                >
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                </select>
            </div>

            {/* 自动换行 */}
            <div className="setting-group">
                <label>
                    <input
                        type="checkbox"
                        checked={editor.wordWrap}
                        onChange={() => dispatch(toggleWordWrap())}
                    />
                    自动换行
                </label>
            </div>

            {/* 自动保存 */}
            <div className="setting-group">
                <label>
                    <input
                        type="checkbox"
                        checked={editor.autoSave}
                        onChange={handleAutoSaveToggle}
                    />
                    自动保存
                </label>

                {editor.autoSave && (
                    <div className="sub-setting">
                        <label>延迟时间: {editor.autoSaveDelay}ms</label>
                        <input
                            type="range"
                            min="1000"
                            max="10000"
                            step="500"
                            value={editor.autoSaveDelay}
                            onChange={(e) => handleAutoSaveDelayChange(Number(e.target.value))}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// Monaco Editor配置应用
function createMonacoConfig(editorState) {
    return {
        tabSize: editorState.tabSize,
        insertSpaces: editorState.insertSpaces,
        wordWrap: editorState.wordWrap ? 'on' : 'off',
        lineNumbers: editorState.lineNumbers ? 'on' : 'off',
        minimap: {enabled: editorState.minimap},
        folding: editorState.folding,
        renderWhitespace: editorState.renderWhitespace,
        renderControlCharacters: editorState.renderControlCharacters,
        renderIndentGuides: editorState.renderIndentGuides,
        cursorBlinking: editorState.cursorBlinking,
        cursorStyle: editorState.cursorStyle,
        scrollBeyondLastLine: editorState.scrollBeyondLastLine,
        formatOnPaste: true,
        formatOnType: true,
        autoIndent: 'advanced',
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        tabCompletion: 'on'
    };
}

// 在编辑器组件中使用
function CodeEditor() {
    const editorConfig = useSelector(state => state.editor);
    const monacoConfig = createMonacoConfig(editorConfig);

    return (
        <MonacoEditor
            options={monacoConfig}
            // 其他props...
        />
    );
}
```

---

## 文件状态管理 (fileSlice.js)

### 状态结构

```javascript
interface
FileState
{
    // 当前文件
    currentFile: {
        path: string | null;
        content: string;
        originalContent: string;
        encoding: string;
        lineEnding: string;
        language: string;
        isModified: boolean;
        isSaved: boolean;
    }
    ;

    // 打开的文件列表
    openedFiles: Array < {
        id: string;
        path: string;
        name: string;
        content: string;
        originalContent: string;
        encoding: string;
        lineEnding: string;
        language: string;
        isModified: boolean;
        isSaved: boolean;
        lastModified: number;
    } >;

    // 最近文件
    recentFiles: Array < {
        path: string;
        name: string;
        lastOpened: number;
    } >;

    // 文件操作状态
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    // 会话恢复
    sessionData: {
        openedFiles: string[];
        currentFile: string | null;
        lastSaved: number;
    }
    ;
}
```

### Actions

| Action              | 参数                         | 描述      |
|---------------------|----------------------------|---------|
| `openFile`          | `fileData: FileData`       | 打开文件    |
| `closeFile`         | `fileId: string`           | 关闭文件    |
| `switchFile`        | `fileId: string`           | 切换当前文件  |
| `updateFileContent` | `{ fileId, content }`      | 更新文件内容  |
| `saveFile`          | `fileId: string`           | 保存文件    |
| `saveAllFiles`      | -                          | 保存所有文件  |
| `renameFile`        | `{ fileId, newPath }`      | 重命名文件   |
| `setFileEncoding`   | `{ fileId, encoding }`     | 设置文件编码  |
| `setFileLineEnding` | `{ fileId, lineEnding }`   | 设置行尾格式  |
| `addToRecentFiles`  | `fileInfo: FileInfo`       | 添加到最近文件 |
| `clearRecentFiles`  | -                          | 清空最近文件  |
| `setLoading`        | `loading: boolean`         | 设置加载状态  |
| `setSaving`         | `saving: boolean`          | 设置保存状态  |
| `setError`          | `error: string \| null`    | 设置错误信息  |
| `saveSession`       | -                          | 保存会话    |
| `restoreSession`    | `sessionData: SessionData` | 恢复会话    |

### 使用示例

```javascript
import {useDispatch, useSelector} from 'react-redux';
import {
    openFile,
    closeFile,
    switchFile,
    updateFileContent,
    saveFile,
    addToRecentFiles
} from '@/store/slices/fileSlice';

function FileManager() {
    const dispatch = useDispatch();
    const {currentFile, openedFiles, recentFiles, isLoading} = useSelector(state => state.file);

    // 打开文件
    const handleOpenFile = async (filePath) => {
        try {
            dispatch(setLoading(true));

            const fileData = await fileApi.readFile(filePath);

            if (fileData.success) {
                const fileInfo = {
                    id: generateFileId(filePath),
                    path: filePath,
                    name: getFileName(filePath),
                    content: fileData.content,
                    originalContent: fileData.content,
                    encoding: fileData.encoding,
                    lineEnding: fileData.line_ending,
                    language: detectLanguage(filePath),
                    isModified: false,
                    isSaved: true,
                    lastModified: Date.now()
                };

                dispatch(openFile(fileInfo));
                dispatch(addToRecentFiles({
                    path: filePath,
                    name: getFileName(filePath),
                    lastOpened: Date.now()
                }));
            }
        } catch (error) {
            dispatch(setError(error.message));
        } finally {
            dispatch(setLoading(false));
        }
    };

    // 关闭文件
    const handleCloseFile = (fileId) => {
        const file = openedFiles.find(f => f.id === fileId);

        if (file && file.isModified) {
            // 显示保存确认对话框
            showSaveConfirmDialog(file.name).then((result) => {
                if (result === 'save') {
                    dispatch(saveFile(fileId)).then(() => {
                        dispatch(closeFile(fileId));
                    });
                } else if (result === 'discard') {
                    dispatch(closeFile(fileId));
                }
                // 'cancel' - 不做任何操作
            });
        } else {
            dispatch(closeFile(fileId));
        }
    };

    // 切换文件
    const handleSwitchFile = (fileId) => {
        dispatch(switchFile(fileId));
    };

    // 更新文件内容
    const handleContentChange = (content) => {
        if (currentFile) {
            dispatch(updateFileContent({
                fileId: currentFile.id,
                content: content
            }));
        }
    };

    // 保存文件
    const handleSaveFile = async (fileId) => {
        try {
            dispatch(setSaving(true));
            await dispatch(saveFile(fileId));
        } catch (error) {
            dispatch(setError(error.message));
        } finally {
            dispatch(setSaving(false));
        }
    };

    return (
        <div className="file-manager">
            {/* 文件标签栏 */}
            <div className="file-tabs">
                {openedFiles.map(file => (
                    <div
                        key={file.id}
                        className={`file-tab ${currentFile?.id === file.id ? 'active' : ''}`}
                        onClick={() => handleSwitchFile(file.id)}
                    >
                        <span className="file-name">
                            {file.name}
                            {file.isModified && <span className="modified-indicator">●</span>}
                        </span>
                        <button
                            className="close-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCloseFile(file.id);
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {/* 最近文件 */}
            <div className="recent-files">
                <h3>最近文件</h3>
                {recentFiles.map(file => (
                    <div
                        key={file.path}
                        className="recent-file"
                        onClick={() => handleOpenFile(file.path)}
                    >
                        <span className="file-name">{file.name}</span>
                        <span className="file-path">{file.path}</span>
                        <span className="last-opened">
                            {new Date(file.lastOpened).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>

            {/* 加载状态 */}
            {isLoading && <div className="loading">加载中...</div>}
        </div>
    );
}

// 会话管理
function SessionManager() {
    const dispatch = useDispatch();
    const {sessionData} = useSelector(state => state.file);

    // 保存会话
    const saveCurrentSession = () => {
        dispatch(saveSession());
    };

    // 恢复会话
    const restoreLastSession = async () => {
        if (sessionData.openedFiles.length > 0) {
            // 恢复打开的文件
            for (const filePath of sessionData.openedFiles) {
                await handleOpenFile(filePath);
            }

            // 恢复当前文件
            if (sessionData.currentFile) {
                const currentFileId = generateFileId(sessionData.currentFile);
                dispatch(switchFile(currentFileId));
            }
        }
    };

    // 应用启动时自动恢复会话
    useEffect(() => {
        restoreLastSession();
    }, []);

    // 应用关闭前保存会话
    useEffect(() => {
        const handleBeforeUnload = () => {
            saveCurrentSession();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);
}
```

---

## 国际化配置 (i18n)

### 配置结构

```javascript
// i18n配置文件结构
const i18nConfig = {
    // 支持的语言
    supportedLanguages: [
        {code: 'zh-CN', name: '简体中文', flag: '🇨🇳'},
        {code: 'zh-TW', name: '繁體中文', flag: '🇹🇼'},
        {code: 'en-US', name: 'English', flag: '🇺🇸'},
        {code: 'ja-JP', name: '日本語', flag: '🇯🇵'},
        {code: 'ko-KR', name: '한국어', flag: '🇰🇷'}
    ],

    // 默认语言
    defaultLanguage: 'zh-CN',

    // 回退语言
    fallbackLanguage: 'en-US',

    // 命名空间
    namespaces: ['common', 'editor', 'menu', 'dialog', 'error'],

    // 默认命名空间
    defaultNamespace: 'common'
};
```

### 翻译文件结构

#### 中文 (zh-CN)

```javascript
// locales/zh-CN/common.json
{
    "app"
:
    {
        "name"
    :
        "喵咕记事本",
            "version"
    :
        "版本 {{version}}",
            "description"
    :
        "轻量级代码编辑器"
    }
,
    "actions"
:
    {
        "open"
    :
        "打开",
            "save"
    :
        "保存",
            "saveAs"
    :
        "另存为",
            "close"
    :
        "关闭",
            "exit"
    :
        "退出",
            "undo"
    :
        "撤销",
            "redo"
    :
        "重做",
            "cut"
    :
        "剪切",
            "copy"
    :
        "复制",
            "paste"
    :
        "粘贴",
            "selectAll"
    :
        "全选",
            "find"
    :
        "查找",
            "replace"
    :
        "替换",
            "settings"
    :
        "设置"
    }
,
    "status"
:
    {
        "ready"
    :
        "就绪",
            "loading"
    :
        "加载中...",
            "saving"
    :
        "保存中...",
            "saved"
    :
        "已保存",
            "modified"
    :
        "已修改",
            "error"
    :
        "错误"
    }
}

// locales/zh-CN/editor.json
{
    "settings"
:
    {
        "title"
    :
        "编辑器设置",
            "theme"
    :
        "主题",
            "fontSize"
    :
        "字体大小",
            "fontFamily"
    :
        "字体族",
            "tabSize"
    :
        "Tab大小",
            "wordWrap"
    :
        "自动换行",
            "lineNumbers"
    :
        "显示行号",
            "minimap"
    :
        "小地图",
            "autoSave"
    :
        "自动保存",
            "formatOnSave"
    :
        "保存时格式化"
    }
,
    "themes"
:
    {
        "light"
    :
        "浅色主题",
            "dark"
    :
        "深色主题",
            "auto"
    :
        "跟随系统"
    }
,
    "languages"
:
    {
        "javascript"
    :
        "JavaScript",
            "typescript"
    :
        "TypeScript",
            "python"
    :
        "Python",
            "java"
    :
        "Java",
            "cpp"
    :
        "C++",
            "csharp"
    :
        "C#",
            "html"
    :
        "HTML",
            "css"
    :
        "CSS",
            "json"
    :
        "JSON",
            "xml"
    :
        "XML",
            "markdown"
    :
        "Markdown",
            "plaintext"
    :
        "纯文本"
    }
}
```

#### 英文 (en-US)

```javascript
// locales/en-US/common.json
{
    "app"
:
    {
        "name"
    :
        "Miaogu Notepad",
            "version"
    :
        "Version {{version}}",
            "description"
    :
        "Lightweight Code Editor"
    }
,
    "actions"
:
    {
        "open"
    :
        "Open",
            "save"
    :
        "Save",
            "saveAs"
    :
        "Save As",
            "close"
    :
        "Close",
            "exit"
    :
        "Exit",
            "undo"
    :
        "Undo",
            "redo"
    :
        "Redo",
            "cut"
    :
        "Cut",
            "copy"
    :
        "Copy",
            "paste"
    :
        "Paste",
            "selectAll"
    :
        "Select All",
            "find"
    :
        "Find",
            "replace"
    :
        "Replace",
            "settings"
    :
        "Settings"
    }
,
    "status"
:
    {
        "ready"
    :
        "Ready",
            "loading"
    :
        "Loading...",
            "saving"
    :
        "Saving...",
            "saved"
    :
        "Saved",
            "modified"
    :
        "Modified",
            "error"
    :
        "Error"
    }
}
```

### 使用示例

```javascript
import {useTranslation} from 'react-i18next';

function MenuBar() {
    const {t} = useTranslation(['common', 'editor']);

    return (
        <div className="menu-bar">
            <div className="menu-item">
                <span>{t('common:actions.open')}</span>
            </div>
            <div className="menu-item">
                <span>{t('common:actions.save')}</span>
            </div>
            <div className="menu-item">
                <span>{t('editor:settings.title')}</span>
            </div>
        </div>
    );
}

// 带参数的翻译
function AppInfo() {
    const {t} = useTranslation('common');
    const version = '1.3.0';

    return (
        <div className="app-info">
            <h1>{t('app.name')}</h1>
            <p>{t('app.version', {version})}</p>
            <p>{t('app.description')}</p>
        </div>
    );
}

// 语言切换器
function LanguageSwitcher() {
    const {i18n} = useTranslation();
    const currentLanguage = i18n.language;

    const supportedLanguages = [
        {code: 'zh-CN', name: '简体中文'},
        {code: 'en-US', name: 'English'},
        {code: 'ja-JP', name: '日本語'}
    ];

    const handleLanguageChange = (languageCode) => {
        i18n.changeLanguage(languageCode);
    };

    return (
        <select
            value={currentLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
        >
            {supportedLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>
                    {lang.name}
                </option>
            ))}
        </select>
    );
}

// 复数形式处理
function FileCounter({count}) {
    const {t} = useTranslation('common');

    return (
        <span>
            {t('files.count', {
                count,
                defaultValue: '{{count}} file',
                defaultValue_plural: '{{count}} files'
            })}
        </span>
    );
}
```

### 动态翻译加载

```javascript
// 动态加载翻译文件
async function loadTranslations(language, namespace) {
    try {
        const translations = await import(`../locales/${language}/${namespace}.json`);
        return translations.default;
    } catch (error) {
        console.warn(`Failed to load translations for ${language}/${namespace}`);
        return {};
    }
}

// 翻译文件热重载
function setupTranslationHotReload() {
    if (process.env.NODE_ENV === 'development') {
        // 监听翻译文件变化
        const translationFiles = require.context('../locales', true, /\.json$/);

        translationFiles.keys().forEach(key => {
            const module = translationFiles(key);

            if (module.hot) {
                module.hot.accept(() => {
                    // 重新加载翻译
                    const [, language, namespace] = key.match(/\/([^/]+)\/([^/]+)\.json$/);
                    i18n.reloadResources(language, namespace);
                });
            }
        });
    }
}
```

---

## 文件扩展名配置 (file-extensions.json)

### 配置结构

```javascript
{
    // Web开发
    "html"
:
    "html",
        "htm"
:
    "html",
        "xhtml"
:
    "html",
        "css"
:
    "css",
        "scss"
:
    "scss",
        "sass"
:
    "sass",
        "less"
:
    "less",
        "js"
:
    "javascript",
        "jsx"
:
    "javascriptreact",
        "ts"
:
    "typescript",
        "tsx"
:
    "typescriptreact",
        "vue"
:
    "vue",
        "svelte"
:
    "svelte",

        // 后端语言
        "py"
:
    "python",
        "pyw"
:
    "python",
        "java"
:
    "java",
        "class"
:
    "java",
        "c"
:
    "c",
        "h"
:
    "c",
        "cpp"
:
    "cpp",
        "cxx"
:
    "cpp",
        "cc"
:
    "cpp",
        "hpp"
:
    "cpp",
        "cs"
:
    "csharp",
        "php"
:
    "php",
        "rb"
:
    "ruby",
        "go"
:
    "go",
        "rs"
:
    "rust",
        "kt"
:
    "kotlin",
        "swift"
:
    "swift",

        // 数据格式
        "json"
:
    "json",
        "xml"
:
    "xml",
        "yaml"
:
    "yaml",
        "yml"
:
    "yaml",
        "toml"
:
    "toml",
        "ini"
:
    "ini",
        "cfg"
:
    "ini",
        "conf"
:
    "ini",

        // 文档格式
        "md"
:
    "markdown",
        "markdown"
:
    "markdown",
        "txt"
:
    "plaintext",
        "log"
:
    "log",
        "rtf"
:
    "plaintext",

        // 脚本语言
        "sh"
:
    "shellscript",
        "bash"
:
    "shellscript",
        "zsh"
:
    "shellscript",
        "fish"
:
    "shellscript",
        "ps1"
:
    "powershell",
        "bat"
:
    "bat",
        "cmd"
:
    "bat",

        // 数据库
        "sql"
:
    "sql",
        "mysql"
:
    "sql",
        "pgsql"
:
    "sql",
        "sqlite"
:
    "sql",

        // 其他
        "dockerfile"
:
    "dockerfile",
        "gitignore"
:
    "ignore",
        "gitattributes"
:
    "ignore",
        "editorconfig"
:
    "editorconfig",
        "env"
:
    "dotenv"
}
```

### 使用示例

```javascript
import fileExtensions from '@/config/file-extensions.json';

// 根据文件扩展名获取语言
function getLanguageByExtension(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return fileExtensions[extension] || 'plaintext';
}

// 根据语言获取图标
function getLanguageIcon(language) {
    const iconMap = {
        'javascript': '🟨',
        'typescript': '🔷',
        'python': '🐍',
        'java': '☕',
        'html': '🌐',
        'css': '🎨',
        'json': '📋',
        'markdown': '📝',
        'plaintext': '📄'
    };

    return iconMap[language] || '📄';
}

// 文件类型分类
function categorizeFilesByType(filePaths) {
    const categories = {};

    filePaths.forEach(filePath => {
        const language = getLanguageByExtension(filePath);

        if (!categories[language]) {
            categories[language] = [];
        }

        categories[language].push(filePath);
    });

    return categories;
}

// 支持的文件类型检查
function isSupportedFileType(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return extension && fileExtensions.hasOwnProperty(extension);
}

// 文件过滤器生成
function generateFileFilters() {
    const languageGroups = {};

    // 按语言分组扩展名
    Object.entries(fileExtensions).forEach(([ext, lang]) => {
        if (!languageGroups[lang]) {
            languageGroups[lang] = [];
        }
        languageGroups[lang].push(ext);
    });

    // 生成过滤器
    const filters = Object.entries(languageGroups).map(([lang, extensions]) => ({
        name: getLanguageDisplayName(lang),
        extensions: extensions
    }));

    // 添加"所有支持的文件"过滤器
    filters.unshift({
        name: '所有支持的文件',
        extensions: Object.keys(fileExtensions)
    });

    // 添加"所有文件"过滤器
    filters.push({
        name: '所有文件',
        extensions: ['*']
    });

    return filters;
}

// 语言显示名称映射
function getLanguageDisplayName(language) {
    const displayNames = {
        'javascript': 'JavaScript',
        'typescript': 'TypeScript',
        'python': 'Python',
        'java': 'Java',
        'html': 'HTML',
        'css': 'CSS',
        'json': 'JSON',
        'markdown': 'Markdown',
        'plaintext': '纯文本'
    };

    return displayNames[language] || language;
}

// 使用示例
const filePath = 'example.js';
const language = getLanguageByExtension(filePath); // 'javascript'
const icon = getLanguageIcon(language); // '🟨'
const isSupported = isSupportedFileType(filePath); // true
const filters = generateFileFilters(); // 文件对话框过滤器
```

---

## 配置管理工具

### 配置验证器

```javascript
// 配置验证模式
const configSchemas = {
    theme: {
        mode: {type: 'string', enum: ['light', 'dark', 'auto']},
        primaryColor: {type: 'string', pattern: /^#[0-9A-Fa-f]{6}$/},
        fontSize: {type: 'number', min: 8, max: 72},
        fontFamily: {type: 'string', minLength: 1},
        transparency: {type: 'number', min: 0, max: 1}
    },

    editor: {
        tabSize: {type: 'number', enum: [2, 4, 8]},
        autoSaveDelay: {type: 'number', min: 1000, max: 60000},
        cursorStyle: {type: 'string', enum: ['line', 'block', 'underline']}
    }
};

// 配置验证函数
function validateConfig(config, schema) {
    const errors = [];

    Object.entries(schema).forEach(([key, rules]) => {
        const value = config[key];

        if (value === undefined || value === null) {
            if (rules.required) {
                errors.push(`${key} is required`);
            }
            return;
        }

        // 类型检查
        if (rules.type && typeof value !== rules.type) {
            errors.push(`${key} must be of type ${rules.type}`);
            return;
        }

        // 枚举检查
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
        }

        // 数值范围检查
        if (rules.type === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                errors.push(`${key} must be >= ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
                errors.push(`${key} must be <= ${rules.max}`);
            }
        }

        // 字符串长度检查
        if (rules.type === 'string') {
            if (rules.minLength !== undefined && value.length < rules.minLength) {
                errors.push(`${key} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                errors.push(`${key} must be at most ${rules.maxLength} characters`);
            }
        }

        // 正则表达式检查
        if (rules.pattern && !rules.pattern.test(value)) {
            errors.push(`${key} format is invalid`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}

// 使用示例
function updateThemeConfig(newConfig) {
    const validation = validateConfig(newConfig, configSchemas.theme);

    if (validation.isValid) {
        dispatch(importTheme(newConfig));
    } else {
        console.error('配置验证失败:', validation.errors);
        showErrorDialog('配置无效', validation.errors.join('\n'));
    }
}
```

### 配置导入导出

```javascript
// 配置导出
function exportConfiguration() {
    const state = store.getState();

    const config = {
        version: '1.3.0',
        timestamp: Date.now(),
        theme: state.theme,
        editor: state.editor,
        // 不导出文件状态和会话数据
    };

    return JSON.stringify(config, null, 2);
}

// 配置导入
function importConfiguration(configJson) {
    try {
        const config = JSON.parse(configJson);

        // 版本兼容性检查
        if (config.version && !isCompatibleVersion(config.version)) {
            throw new Error('配置文件版本不兼容');
        }

        // 验证配置
        if (config.theme) {
            const themeValidation = validateConfig(config.theme, configSchemas.theme);
            if (!themeValidation.isValid) {
                throw new Error('主题配置无效: ' + themeValidation.errors.join(', '));
            }
        }

        if (config.editor) {
            const editorValidation = validateConfig(config.editor, configSchemas.editor);
            if (!editorValidation.isValid) {
                throw new Error('编辑器配置无效: ' + editorValidation.errors.join(', '));
            }
        }

        // 应用配置
        if (config.theme) {
            dispatch(importTheme(config.theme));
        }

        if (config.editor) {
            dispatch(updateEditorConfig(config.editor));
        }

        return {success: true};

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 版本兼容性检查
function isCompatibleVersion(version) {
    const currentVersion = '1.3.0';
    const configVersion = version;

    // 简单的版本比较逻辑
    const [currentMajor, currentMinor] = currentVersion.split('.').map(Number);
    const [configMajor, configMinor] = configVersion.split('.').map(Number);

    // 主版本号必须相同，次版本号可以向下兼容
    return currentMajor === configMajor && currentMinor >= configMinor;
}

// 配置文件操作
async function saveConfigurationToFile() {
    try {
        const config = exportConfiguration();
        const filePath = await fileApi.saveDialog({
            defaultPath: 'miaogu-config.json',
            filters: [
                {name: '配置文件', extensions: ['json']}
            ]
        });

        if (filePath) {
            await fileApi.writeFile(filePath, config);
            showSuccessMessage('配置已导出到: ' + filePath);
        }
    } catch (error) {
        showErrorMessage('导出配置失败: ' + error.message);
    }
}

async function loadConfigurationFromFile() {
    try {
        const filePaths = await fileApi.openDialog({
            filters: [
                {name: '配置文件', extensions: ['json']}
            ]
        });

        if (filePaths && filePaths.length > 0) {
            const result = await fileApi.readFile(filePaths[0]);

            if (result.success) {
                const importResult = importConfiguration(result.content);

                if (importResult.success) {
                    showSuccessMessage('配置已成功导入');
                } else {
                    showErrorMessage('导入配置失败: ' + importResult.error);
                }
            }
        }
    } catch (error) {
        showErrorMessage('加载配置失败: ' + error.message);
    }
}
```

---

## 性能优化

### 状态选择器优化

```javascript
import {createSelector} from '@reduxjs/toolkit';

// 记忆化选择器
const selectTheme = (state) => state.theme;
const selectEditor = (state) => state.editor;
const selectFile = (state) => state.file;

// 组合选择器
const selectCurrentFileWithTheme = createSelector(
    [selectFile, selectTheme],
    (file, theme) => ({
        ...file.currentFile,
        theme: theme.mode
    })
);

const selectEditorConfig = createSelector(
    [selectEditor, selectTheme],
    (editor, theme) => ({
        ...editor,
        fontSize: theme.fontSize,
        fontFamily: theme.fontFamily
    })
);

// 在组件中使用
function OptimizedEditor() {
    const editorConfig = useSelector(selectEditorConfig);
    const currentFile = useSelector(selectCurrentFileWithTheme);

    // 组件逻辑...
}
```

### 状态更新优化

```javascript
// 使用 Immer 进行不可变更新
import {createSlice} from '@reduxjs/toolkit';

const optimizedSlice = createSlice({
    name: 'optimized',
    initialState,
    reducers: {
        // 批量更新
        batchUpdate: (state, action) => {
            Object.assign(state, action.payload);
        },

        // 深度更新
        updateNestedProperty: (state, action) => {
            const {path, value} = action.payload;
            const keys = path.split('.');

            let current = state;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
        }
    }
});
```

---

## 注意事项

1. **状态持久化**: 注意哪些状态需要持久化，避免存储敏感信息
2. **性能优化**: 使用记忆化选择器避免不必要的重新渲染
3. **类型安全**: 在TypeScript项目中定义完整的类型
4. **错误处理**: 实现完善的错误处理和恢复机制
5. **版本兼容**: 考虑配置文件的版本兼容性
6. **国际化**: 确保所有用户界面文本都支持国际化
7. **配置验证**: 对用户输入的配置进行严格验证
8. **默认值**: 为所有配置项提供合理的默认值

---

*本文档基于 miaogu-notepad v1.3.0 版本编写*
