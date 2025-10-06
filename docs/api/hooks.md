# 自定义 Hooks API 文档

## 概述

本文档详细介绍了喵咕记事本中所有自定义React Hooks的API接口、参数、返回值和使用方法。

## 文件管理 Hooks

### useFileManager.jsx - 文件管理核心Hook

文件管理的核心Hook，提供完整的文件操作功能。

#### 返回值结构

| 属性                  | 类型                   | 描述        |
|---------------------|----------------------|-----------|
| `openedFiles`       | `Array<FileObject>`  | 已打开的文件列表  |
| `currentFileId`     | `string \| null`     | 当前活动文件的ID |
| `currentFile`       | `FileObject \| null` | 当前活动文件对象  |
| `hasUnsavedChanges` | `boolean`            | 是否有未保存的更改 |

#### 文件操作方法

| 方法              | 参数                                  | 返回值             | 描述           |
|-----------------|-------------------------------------|-----------------|--------------|
| `openFile`      | `(filePath: string)`                | `Promise<void>` | 打开指定路径的文件    |
| `saveFile`      | `(fileId?: string)`                 | `Promise<void>` | 保存文件（默认当前文件） |
| `saveAsFile`    | `(fileId: string, newPath: string)` | `Promise<void>` | 另存为新文件       |
| `closeFile`     | `(fileId: string)`                  | `void`          | 关闭指定文件       |
| `closeAllFiles` | `()`                                | `void`          | 关闭所有文件       |
| `createNewFile` | `(fileName?: string)`               | `string`        | 创建新文件，返回文件ID |
| `renameFile`    | `(fileId: string, newName: string)` | `Promise<void>` | 重命名文件        |

#### 内容操作方法

| 方法                  | 参数                                  | 返回值      | 描述       |
|---------------------|-------------------------------------|----------|----------|
| `updateFileContent` | `(fileId: string, content: string)` | `void`   | 更新文件内容   |
| `getFileContent`    | `(fileId: string)`                  | `string` | 获取文件内容   |
| `setCurrentFile`    | `(fileId: string)`                  | `void`   | 设置当前活动文件 |

#### 会话管理方法

| 方法               | 参数   | 返回值             | 描述       |
|------------------|------|-----------------|----------|
| `saveSession`    | `()` | `void`          | 保存当前会话状态 |
| `restoreSession` | `()` | `Promise<void>` | 恢复上次会话状态 |
| `clearSession`   | `()` | `void`          | 清除会话数据   |

#### FileObject 数据结构

```typescript
interface FileObject {
    id: string;           // 文件唯一标识
    name: string;         // 文件名
    path: string;         // 文件完整路径
    content: string;      // 文件内容
    language: string;     // 编程语言标识
    encoding: string;     // 文件编码
    lineEnding: string;   // 行尾格式
    isModified: boolean;  // 是否已修改
    isNew: boolean;       // 是否为新文件
    lastModified: number; // 最后修改时间戳
    size: number;         // 文件大小（字节）
}
```

#### 使用示例

```jsx
import {useFileManager} from '../hooks/useFileManager';
import {useEffect} from 'react';

function FileManagerExample() {
    const fileManager = useFileManager();

    useEffect(() => {
        // 恢复上次会话
        fileManager.restoreSession();
    }, []);

    const handleOpenFile = async () => {
        try {
            await fileManager.openFile('/path/to/file.js');
            console.log('文件打开成功');
        } catch (error) {
            console.error('打开文件失败:', error);
        }
    };

    const handleSaveFile = async () => {
        try {
            await fileManager.saveFile();
            console.log('文件保存成功');
        } catch (error) {
            console.error('保存文件失败:', error);
        }
    };

    const handleCreateNewFile = () => {
        const fileId = fileManager.createNewFile('新建文件.txt');
        fileManager.setCurrentFile(fileId);
    };

    return (
        <div>
            <button onClick={handleOpenFile}>打开文件</button>
            <button onClick={handleSaveFile}>保存文件</button>
            <button onClick={handleCreateNewFile}>新建文件</button>

            <div>
                <h3>已打开文件 ({fileManager.openedFiles.length})</h3>
                {fileManager.openedFiles.map(file => (
                    <div key={file.id}>
                        {file.name} {file.isModified && '*'}
                    </div>
                ))}
            </div>
        </div>
    );
}
```

#### 辅助 Hooks

##### useCurrentFile

获取当前活动文件的Hook。

```jsx
import {useCurrentFile} from '../hooks/useFileManager';

function CurrentFileInfo() {
    const fileManager = useFileManager();
    const currentFile = useCurrentFile(fileManager);

    if (!currentFile) {
        return <div>没有打开的文件</div>;
    }

    return (
        <div>
            <h3>当前文件: {currentFile.name}</h3>
            <p>路径: {currentFile.path}</p>
            <p>语言: {currentFile.language}</p>
            <p>大小: {currentFile.size} 字节</p>
            <p>状态: {currentFile.isModified ? '已修改' : '已保存'}</p>
        </div>
    );
}
```

##### useOpenedFiles

获取已打开文件列表的Hook。

```jsx
import {useOpenedFiles} from '../hooks/useFileManager';

function FileList() {
    const fileManager = useFileManager();
    const openedFiles = useOpenedFiles(fileManager);

    return (
        <ul>
            {openedFiles.map(file => (
                <li key={file.id}>
                    {file.name}
                    {file.isModified && <span> (已修改)</span>}
                </li>
            ))}
        </ul>
    );
}
```

##### useFileActions

获取文件操作方法的Hook。

```jsx
import {useFileActions} from '../hooks/useFileManager';

function FileActions() {
    const fileManager = useFileManager();
    const {openFile, saveFile, closeFile} = useFileActions(fileManager);

    return (
        <div>
            <button onClick={() => openFile('/path/to/file')}>打开</button>
            <button onClick={() => saveFile()}>保存</button>
            <button onClick={() => closeFile('file-id')}>关闭</button>
        </div>
    );
}
```

---

## 状态管理 Hooks

### redux.js - Redux状态管理Hooks

提供类型安全的Redux状态管理Hooks。

#### useAppDispatch

获取类型安全的dispatch函数。

```jsx
import {useAppDispatch} from '../hooks/redux';
import {setTheme} from '../store/slices/themeSlice';

function ThemeSelector() {
    const dispatch = useAppDispatch();

    const handleThemeChange = (theme) => {
        dispatch(setTheme(theme));
    };

    return (
        <select onChange={(e) => handleThemeChange(e.target.value)}>
            <option value="light">浅色主题</option>
            <option value="dark">深色主题</option>
        </select>
    );
}
```

#### useAppSelector

获取类型安全的状态选择器。

```jsx
import {useAppSelector} from '../hooks/redux';

function ThemeDisplay() {
    const theme = useAppSelector(state => state.theme.theme);
    const fontSize = useAppSelector(state => state.theme.fontSize);

    return (
        <div>
            <p>当前主题: {theme}</p>
            <p>字体大小: {fontSize}px</p>
        </div>
    );
}
```

### useTheme - 主题管理Hook

专门用于主题相关状态管理的Hook。

#### 返回值结构

| 属性                       | 类型        | 描述      |
|--------------------------|-----------|---------|
| `theme`                  | `string`  | 当前主题名称  |
| `fontSize`               | `number`  | 字体大小    |
| `fontFamily`             | `string`  | 字体族     |
| `lineHeight`             | `number`  | 行高      |
| `backgroundImage`        | `string`  | 背景图片路径  |
| `backgroundEnabled`      | `boolean` | 是否启用背景  |
| `backgroundTransparency` | `object`  | 背景透明度设置 |

#### 操作方法

| 方法                          | 参数                       | 描述       |
|-----------------------------|--------------------------|----------|
| `setTheme`                  | `(theme: string)`        | 设置主题     |
| `setFontSize`               | `(size: number)`         | 设置字体大小   |
| `setFontFamily`             | `(family: string)`       | 设置字体族    |
| `setLineHeight`             | `(height: number)`       | 设置行高     |
| `setBackgroundImage`        | `(path: string)`         | 设置背景图片   |
| `setBackgroundEnabled`      | `(enabled: boolean)`     | 启用/禁用背景  |
| `setBackgroundTransparency` | `(transparency: object)` | 设置背景透明度  |
| `resetTheme`                | `()`                     | 重置主题为默认值 |

#### 使用示例

```jsx
import {useTheme} from '../hooks/redux';

function ThemeSettings() {
    const {
        theme,
        fontSize,
        fontFamily,
        lineHeight,
        backgroundEnabled,
        setTheme,
        setFontSize,
        setFontFamily,
        setLineHeight,
        setBackgroundEnabled,
        resetTheme
    } = useTheme();

    return (
        <div className="theme-settings">
            <div>
                <label>主题:</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="light">浅色</option>
                    <option value="dark">深色</option>
                    <option value="auto">自动</option>
                </select>
            </div>

            <div>
                <label>字体大小: {fontSize}px</label>
                <input
                    type="range"
                    min="12"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                />
            </div>

            <div>
                <label>字体族:</label>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                    <option value="'Consolas', monospace">Consolas</option>
                    <option value="'Monaco', monospace">Monaco</option>
                    <option value="'Fira Code', monospace">Fira Code</option>
                </select>
            </div>

            <div>
                <label>行高: {lineHeight}</label>
                <input
                    type="range"
                    min="1.0"
                    max="2.0"
                    step="0.1"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(Number(e.target.value))}
                />
            </div>

            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={backgroundEnabled}
                        onChange={(e) => setBackgroundEnabled(e.target.checked)}
                    />
                    启用背景图片
                </label>
            </div>

            <button onClick={resetTheme}>重置主题</button>
        </div>
    );
}
```

### useEditor - 编辑器设置Hook

专门用于编辑器相关设置的Hook。

#### 返回值结构

| 属性             | 类型        | 描述         |
|----------------|-----------|------------|
| `wordWrap`     | `boolean` | 是否自动换行     |
| `minimap`      | `boolean` | 是否显示小地图    |
| `lineNumbers`  | `boolean` | 是否显示行号     |
| `tabSize`      | `number`  | Tab缩进大小    |
| `insertSpaces` | `boolean` | 是否用空格替代Tab |

#### 操作方法

| 方法                | 参数                   | 描述        |
|-------------------|----------------------|-----------|
| `setWordWrap`     | `(enabled: boolean)` | 设置自动换行    |
| `setMinimap`      | `(enabled: boolean)` | 设置小地图显示   |
| `setLineNumbers`  | `(enabled: boolean)` | 设置行号显示    |
| `setTabSize`      | `(size: number)`     | 设置Tab大小   |
| `setInsertSpaces` | `(enabled: boolean)` | 设置空格替代Tab |

#### 使用示例

```jsx
import {useEditor} from '../hooks/redux';

function EditorSettings() {
    const {
        wordWrap,
        minimap,
        lineNumbers,
        tabSize,
        insertSpaces,
        setWordWrap,
        setMinimap,
        setLineNumbers,
        setTabSize,
        setInsertSpaces
    } = useEditor();

    return (
        <div className="editor-settings">
            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={wordWrap}
                        onChange={(e) => setWordWrap(e.target.checked)}
                    />
                    自动换行
                </label>
            </div>

            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={minimap}
                        onChange={(e) => setMinimap(e.target.checked)}
                    />
                    显示小地图
                </label>
            </div>

            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={lineNumbers}
                        onChange={(e) => setLineNumbers(e.target.checked)}
                    />
                    显示行号
                </label>
            </div>

            <div>
                <label>Tab大小:</label>
                <select value={tabSize} onChange={(e) => setTabSize(Number(e.target.value))}>
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                </select>
            </div>

            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={insertSpaces}
                        onChange={(e) => setInsertSpaces(e.target.checked)}
                    />
                    用空格替代Tab
                </label>
            </div>
        </div>
    );
}
```

---

## 国际化 Hook

### useI18n.js - 国际化Hook

提供多语言支持的Hook。

#### 返回值结构

| 属性                   | 类型              | 描述       |
|----------------------|-----------------|----------|
| `t`                  | `function`      | 翻译函数     |
| `changeLanguage`     | `function`      | 切换语言函数   |
| `currentLanguage`    | `string`        | 当前语言代码   |
| `supportedLanguages` | `Array<string>` | 支持的语言列表  |
| `isReady`            | `boolean`       | 是否已初始化完成 |

#### 方法详情

| 方法                       | 参数                                | 返回值             | 描述       |
|--------------------------|-----------------------------------|-----------------|----------|
| `t`                      | `(key: string, options?: object)` | `string`        | 获取翻译文本   |
| `changeLanguage`         | `(language: string)`              | `Promise<void>` | 切换界面语言   |
| `getCurrentLanguageInfo` | `()`                              | `object`        | 获取当前语言信息 |

#### 支持的语言

| 语言代码    | 语言名称    | 本地化名称   |
|---------|---------|---------|
| `zh-CN` | 简体中文    | 简体中文    |
| `en-US` | English | English |

#### 翻译键值结构

```javascript
// 翻译键值示例
const translationKeys = {
    // 通用
    'common.save': '保存',
    'common.open': '打开',
    'common.close': '关闭',
    'common.cancel': '取消',
    'common.confirm': '确认',

    // 文件操作
    'file.new': '新建文件',
    'file.open': '打开文件',
    'file.save': '保存文件',
    'file.saveAs': '另存为',
    'file.close': '关闭文件',

    // 编辑器
    'editor.fontSize': '字体大小',
    'editor.theme': '主题',
    'editor.wordWrap': '自动换行',

    // 设置
    'settings.general': '通用设置',
    'settings.editor': '编辑器设置',
    'settings.appearance': '外观设置'
};
```

#### 使用示例

```jsx
import {useI18n} from '../hooks/useI18n';

function LanguageExample() {
    const {t, changeLanguage, currentLanguage, supportedLanguages, isReady} = useI18n();

    if (!isReady) {
        return <div>Loading...</div>;
    }

    const handleLanguageChange = async (language) => {
        try {
            await changeLanguage(language);
            console.log('语言切换成功');
        } catch (error) {
            console.error('语言切换失败:', error);
        }
    };

    return (
        <div>
            <h1>{t('app.title')}</h1>

            <div>
                <label>{t('settings.language')}:</label>
                <select
                    value={currentLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                >
                    {supportedLanguages.map(lang => (
                        <option key={lang} value={lang}>
                            {t(`language.${lang}`)}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <button>{t('common.save')}</button>
                <button>{t('common.open')}</button>
                <button>{t('common.close')}</button>
            </div>

            <p>{t('file.currentFile', {fileName: 'example.txt'})}</p>
        </div>
    );
}
```

#### 带参数的翻译

```jsx
// 翻译文件中的定义
{
    "file.saveSuccess"
:
    "文件 {{fileName}} 保存成功",
        "file.openError"
:
    "打开文件失败: {{error}}",
        "editor.lineCount"
:
    "共 {{count}} 行"
}

// 使用示例
function FileStatus() {
    const {t} = useI18n();

    return (
        <div>
            <p>{t('file.saveSuccess', {fileName: 'document.txt'})}</p>
            <p>{t('file.openError', {error: '文件不存在'})}</p>
            <p>{t('editor.lineCount', {count: 150})}</p>
        </div>
    );
}
```

---

## 其他 Hooks

### useSessionRestore.js - 会话恢复Hook

用于自动保存和恢复编辑会话的Hook。

#### 返回值结构

| 属性            | 类型        | 描述        |
|---------------|-----------|-----------|
| `isRestoring` | `boolean` | 是否正在恢复会话  |
| `hasSession`  | `boolean` | 是否存在保存的会话 |

#### 方法

| 方法               | 参数                      | 返回值               | 描述     |
|------------------|-------------------------|-------------------|--------|
| `saveSession`    | `(sessionData: object)` | `void`            | 保存会话数据 |
| `restoreSession` | `()`                    | `Promise<object>` | 恢复会话数据 |
| `clearSession`   | `()`                    | `void`            | 清除会话数据 |

#### 使用示例

```jsx
import {useSessionRestore} from '../hooks/useSessionRestore';
import {useEffect} from 'react';

function SessionManager() {
    const {isRestoring, hasSession, saveSession, restoreSession, clearSession} = useSessionRestore();

    useEffect(() => {
        // 应用启动时自动恢复会话
        if (hasSession) {
            restoreSession().then(sessionData => {
                console.log('会话恢复成功:', sessionData);
            });
        }
    }, []);

    const handleSaveSession = () => {
        const sessionData = {
            openFiles: ['file1.txt', 'file2.js'],
            currentFile: 'file1.txt',
            timestamp: Date.now()
        };
        saveSession(sessionData);
    };

    return (
        <div>
            {isRestoring && <div>正在恢复会话...</div>}

            <button onClick={handleSaveSession}>保存会话</button>
            <button onClick={clearSession}>清除会话</button>

            {hasSession && <p>存在保存的会话</p>}
        </div>
    );
}
```

### useTheme.js - 主题Hook（独立版本）

独立的主题管理Hook，不依赖Redux。

#### 返回值结构

| 属性            | 类型         | 描述       |
|---------------|------------|----------|
| `theme`       | `string`   | 当前主题     |
| `isDarkMode`  | `boolean`  | 是否为深色模式  |
| `toggleTheme` | `function` | 切换主题函数   |
| `setTheme`    | `function` | 设置特定主题函数 |

#### 使用示例

```jsx
import {useTheme} from '../hooks/useTheme';

function ThemeToggle() {
    const {theme, isDarkMode, toggleTheme, setTheme} = useTheme();

    return (
        <div>
            <p>当前主题: {theme}</p>
            <p>深色模式: {isDarkMode ? '是' : '否'}</p>

            <button onClick={toggleTheme}>
                切换到{isDarkMode ? '浅色' : '深色'}主题
            </button>

            <div>
                <button onClick={() => setTheme('light')}>浅色主题</button>
                <button onClick={() => setTheme('dark')}>深色主题</button>
                <button onClick={() => setTheme('auto')}>自动主题</button>
            </div>
        </div>
    );
}
```

## Hook 使用最佳实践

### 1. 性能优化

```jsx
// 使用 useMemo 优化计算
import {useMemo} from 'react';

function OptimizedComponent() {
    const fileManager = useFileManager();

    const fileStats = useMemo(() => {
        return {
            totalFiles: fileManager.openedFiles.length,
            modifiedFiles: fileManager.openedFiles.filter(f => f.isModified).length,
            totalSize: fileManager.openedFiles.reduce((sum, f) => sum + f.size, 0)
        };
    }, [fileManager.openedFiles]);

    return <div>统计信息: {JSON.stringify(fileStats)}</div>;
}
```

### 2. 错误处理

```jsx
// 使用 try-catch 处理异步操作
function SafeFileOperations() {
    const fileManager = useFileManager();
    const {t} = useI18n();

    const handleOpenFile = async (filePath) => {
        try {
            await fileManager.openFile(filePath);
            // 成功提示
        } catch (error) {
            console.error(t('error.openFileFailed'), error);
            // 错误提示
        }
    };

    return <button onClick={() => handleOpenFile('/path/to/file')}>打开文件</button>;
}
```

### 3. 条件渲染

```jsx
// 根据Hook状态进行条件渲染
function ConditionalRender() {
    const {isReady} = useI18n();
    const fileManager = useFileManager();

    if (!isReady) {
        return <div>正在初始化...</div>;
    }

    if (fileManager.openedFiles.length === 0) {
        return <WelcomeScreen/>;
    }

    return <EditorContent/>;
}
```

## 注意事项

1. **Hook规则**: 始终在组件顶层调用Hooks，不要在循环、条件或嵌套函数中调用
2. **依赖数组**: 正确设置useEffect的依赖数组，避免无限循环
3. **内存泄漏**: 及时清理事件监听器和定时器
4. **状态同步**: 确保多个组件间的状态同步
5. **错误边界**: 使用错误边界组件捕获Hook中的错误

---

*本文档基于 miaogu-notepad v1.3.1 版本编写*
