# 前端架构设计

## 概述

喵咕记事本的前端采用现代化的React架构，基于组件化开发模式，使用Redux进行状态管理，集成了Monaco Editor、Ant
Design等优秀的第三方库。整体架构注重模块化、可维护性和性能优化。

## 技术栈详解

### 核心框架与库

| 技术                 | 版本     | 职责            | 选择理由             |
|--------------------|--------|---------------|------------------|
| **React**          | 18.3.1 | UI框架          | 组件化开发、虚拟DOM、生态丰富 |
| **Redux Toolkit**  | 2.0.1  | 状态管理          | 简化Redux使用、内置最佳实践 |
| **React Redux**    | 9.0.4  | React-Redux绑定 | 官方推荐的React状态绑定库  |
| **Redux Persist**  | 6.0.0  | 状态持久化         | 自动保存和恢复应用状态      |
| **Ant Design**     | 5.10.0 | UI组件库         | 企业级设计语言、组件丰富     |
| **Monaco Editor**  | 0.52.2 | 代码编辑器         | VS Code同款编辑器内核   |
| **React Markdown** | 10.1.0 | Markdown渲染    | 支持扩展语法和自定义组件     |

### 开发工具链

| 工具          | 版本      | 用途      | 配置特点          |
|-------------|---------|---------|---------------|
| **Vite**    | 6.2.4   | 构建工具    | 快速热更新、ES模块支持  |
| **Sass**    | 1.86.1  | CSS预处理器 | 变量、嵌套、混入等高级功能 |
| **i18next** | 25.4.2  | 国际化     | 多语言支持、动态切换    |
| **Lodash**  | 4.17.21 | 工具库     | 函数式编程工具集      |

## 架构层次设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        视图层 (View Layer)                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   React 组件    │  │   Ant Design    │  │  Monaco Editor  │ │
│  │   (Components)  │  │   (UI Library)  │  │  (Code Editor)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      逻辑层 (Logic Layer)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Custom Hooks   │  │  Event Handlers │  │  Business Logic │ │
│  │  (业务逻辑封装)  │  │  (事件处理)     │  │  (业务规则)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      状态层 (State Layer)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Redux Store   │  │  Redux Persist  │  │   Local State   │ │
│  │   (全局状态)    │  │   (状态持久化)  │  │   (组件状态)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      服务层 (Service Layer)                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Tauri API     │  │   HTTP Client   │  │   Utilities     │ │
│  │   (系统调用)    │  │   (网络请求)    │  │   (工具函数)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 层次职责说明

#### 1. 视图层 (View Layer)

- **React 组件**: 负责UI渲染和用户交互
- **Ant Design**: 提供统一的设计系统和组件库
- **Monaco Editor**: 专业的代码编辑功能

#### 2. 逻辑层 (Logic Layer)

- **Custom Hooks**: 封装可复用的业务逻辑
- **Event Handlers**: 处理用户交互事件
- **Business Logic**: 实现核心业务规则

#### 3. 状态层 (State Layer)

- **Redux Store**: 全局状态管理中心
- **Redux Persist**: 状态持久化机制
- **Local State**: 组件内部状态

#### 4. 服务层 (Service Layer)

- **Tauri API**: 与后端系统的通信接口
- **HTTP Client**: 网络请求处理
- **Utilities**: 通用工具函数

## 组件架构设计

### 组件层次结构

```
App (根组件)
├── ConfigProvider (Ant Design配置)
├── Provider (Redux状态提供者)
├── PersistGate (持久化状态加载)
└── MainApp (主应用组件)
    ├── Layout (布局组件)
    │   ├── AppHeader (应用头部)
    │   │   ├── MenuBar (菜单栏)
    │   │   ├── WindowControls (窗口控制)
    │   │   └── ThemeToggle (主题切换)
    │   ├── Content (内容区域)
    │   │   ├── TabBar (标签页管理)
    │   │   ├── EditorContainer (编辑器容器)
    │   │   │   ├── CodeEditor (代码编辑器)
    │   │   │   ├── MarkdownViewer (Markdown预览)
    │   │   │   └── TreeEditor (树形编辑器)
    │   │   └── WelcomeScreen (欢迎页面)
    │   └── EditorStatusBar (状态栏)
    └── GlobalComponents (全局组件)
        ├── SettingsModal (设置弹窗)
        ├── LoadingComponent (加载组件)
        └── DragOverlay (拖拽覆盖层)
```

### 核心组件详解

#### 1. App.jsx - 根组件

**职责**:

- 应用初始化和配置
- 全局状态提供
- 主题配置和切换
- 拖拽文件处理

**关键特性**:

```jsx
// 编辑器模式枚举
const EDITOR_MODES = {
    MONACO: 'monaco',      // 代码编辑模式
    MARKDOWN: 'markdown',  // Markdown预览模式
    MGTREE: 'mgtree'      // 树形编辑模式
};

// 主题配置
const themeConfig = {
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
        colorPrimary: primaryColor,
        fontSize: fontSize,
        fontFamily: fontFamily,
    }
};
```

#### 2. AppHeader.jsx - 应用头部

**职责**:

- 文件操作菜单 (新建、打开、保存)
- 窗口控制 (最小化、最大化、关闭)
- 主题切换和设置

**Props接口**:

```typescript
interface AppHeaderProps {
    fileManager: FileManagerInstance;
    hasOpenFiles: boolean;
}
```

#### 3. CodeEditor.jsx - 代码编辑器

**职责**:

- Monaco Editor集成
- 语法高亮和智能提示
- 代码折叠和搜索
- 多语言支持

**核心配置**:

```jsx
const editorOptions = {
    theme: isDarkMode ? 'vs-dark' : 'vs-light',
    fontSize: fontSize,
    fontFamily: fontFamily,
    wordWrap: 'on',
    minimap: {enabled: true},
    scrollBeyondLastLine: false,
    automaticLayout: true
};
```

#### 4. MarkdownViewer.jsx - Markdown预览

**职责**:

- Markdown内容渲染
- 代码块语法高亮
- Mermaid图表支持
- 树形结构可视化

**插件配置**:

```jsx
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeRaw, rehypeSanitize, rehypeHighlight];
```

#### 5. TreeEditor.jsx - 树形编辑器

**职责**:

- 树形数据编辑
- 节点增删改查
- 拖拽排序
- 缩放控制

**功能特性**:

- 支持多种节点类型 (文件夹、文件、代码)
- 可视化编辑界面
- 实时预览更新
- 导出多种格式

## 状态管理架构

### Redux Store 结构

```javascript
// Store 结构
{
    theme: {           // 主题状态
        mode: 'light',   // 主题模式
            primaryColor
    :
        '#1890ff',
            fontSize
    :
        14,
            fontFamily
    :
        'Monaco',
            backgroundImage
    :
        null,
            backgroundEnabled
    :
        false
    }
,
    editor: {          // 编辑器状态
        currentFile: null,
            openFiles
    :
        [],
            recentFiles
    :
        [],
            editorSettings
    :
        {
        }
    ,
        treeData: null,
            selectedKeys
    :
        [],
            expandedSections
    :
        []
    }
,
    file: {            // 文件状态
        currentPath: '',
            fileTree
    :
        null,
            watchedFiles
    :
        [],
            unsavedChanges
    :
        {
        }
    }
}
```

### State Slices 设计

#### 1. themeSlice.js - 主题状态

**状态结构**:

```javascript
interface
ThemeState
{
    mode: 'light' | 'dark' | 'auto';
    primaryColor: string;
    fontSize: number;
    fontFamily: string;
    backgroundImage: string | null;
    backgroundEnabled: boolean;
    backgroundTransparency: {
        light: number;
        dark: number;
    }
    ;
}
```

**主要Actions**:

- `setTheme(mode)` - 设置主题模式
- `setFontSize(size)` - 设置字体大小
- `setFontFamily(family)` - 设置字体族
- `setBackgroundImage(image)` - 设置背景图片
- `resetTheme()` - 重置主题设置

#### 2. editorSlice.js - 编辑器状态

**状态结构**:

```javascript
interface
EditorState
{
    currentFile: FileInfo | null;
    openFiles: FileInfo[];
    recentFiles: FileInfo[];
    editorSettings: EditorConfig;
    treeData: TreeNode[] | null;
    selectedKeys: string[];
    expandedSections: string[];
    unsavedContent: Record < string, string >;
}
```

**主要Actions**:

- `openFile(fileInfo)` - 打开文件
- `closeFile(filePath)` - 关闭文件
- `updateFileContent(path, content)` - 更新文件内容
- `setCurrentFile(fileInfo)` - 设置当前文件
- `addRecentFile(fileInfo)` - 添加最近文件

#### 3. fileSlice.js - 文件系统状态

**状态结构**:

```javascript
interface
FileState
{
    currentPath: string;
    fileTree: TreeNode | null;
    watchedFiles: string[];
    unsavedChanges: Record < string, boolean >;
}
```

### 持久化策略

**配置**:

```javascript
const persistConfig = {
    key: 'miaogu-ide',
    storage,
    whitelist: ['theme', 'editor', 'file'],
    transforms: [
        // 排除大文件数据
        {
            in: (state, key) => {
                if (key === 'theme' && state.backgroundImage) {
                    const {backgroundImage, ...rest} = state;
                    return rest;
                }
                return state;
            }
        }
    ]
};
```

## 自定义Hooks架构

### Hook分类和职责

#### 1. 状态管理Hooks

**redux.js**:

```javascript
// 类型安全的Redux Hooks
export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

// 主题管理Hook
export const useTheme = () => {
    const theme = useAppSelector(state => state.theme);
    const dispatch = useAppDispatch();

    return {
        ...theme,
        setTheme: (value) => dispatch(setTheme(value)),
        setFontSize: (value) => dispatch(setFontSize(value)),
        // ... 其他主题操作
    };
};
```

#### 2. 业务逻辑Hooks

**useFileManager.js**:

```javascript
export const useFileManager = () => {
    // 文件操作逻辑
    const openFile = useCallback(async (filePath) => {
        // 文件打开逻辑
    }, []);

    const saveFile = useCallback(async (filePath, content) => {
        // 文件保存逻辑
    }, []);

    return {
        openFile,
        saveFile,
        closeFile,
        // ... 其他文件操作
    };
};
```

**useSessionRestore.js**:

```javascript
export const useSessionRestore = () => {
    // 会话恢复逻辑
    const restoreSession = useCallback(() => {
        // 恢复上次会话状态
    }, []);

    const saveSession = useCallback(() => {
        // 保存当前会话状态
    }, []);

    return {
        restoreSession,
        saveSession
    };
};
```

#### 3. 工具类Hooks

**useI18n.js**:

```javascript
export const useI18n = () => {
    const {t, i18n} = useTranslation();

    const changeLanguage = useCallback((lng) => {
        i18n.changeLanguage(lng);
    }, [i18n]);

    return {
        t,
        changeLanguage,
        currentLanguage: i18n.language
    };
};
```

## 性能优化策略

### 1. 组件优化

#### React.memo 使用

```javascript
// 防止不必要的重渲染
const CodeEditor = React.memo(({content, language, onChange}) => {
    // 组件实现
}, (prevProps, nextProps) => {
    // 自定义比较逻辑
    return prevProps.content === nextProps.content &&
        prevProps.language === nextProps.language;
});
```

#### useMemo 缓存计算

```javascript
const processedTreeData = useMemo(() => {
  return parseTreeText(treeContent);
}, [treeContent]);
```

#### useCallback 缓存函数

```javascript
const handleFileChange = useCallback((newContent) => {
  dispatch(updateFileContent(currentFile.path, newContent));
}, [currentFile.path, dispatch]);
```

### 2. 状态优化

#### 状态规范化

```javascript
// 避免深层嵌套，使用扁平化结构
const normalizedState = {
    files: {
        byId: {
            'file1': {id: 'file1', name: 'test.js', content: '...'},
            'file2': {id: 'file2', name: 'app.js', content: '...'}
        },
        allIds: ['file1', 'file2']
    }
};
```

#### 选择性订阅

```javascript
// 只订阅需要的状态片段
const currentFile = useAppSelector(state => state.editor.currentFile);
const theme = useAppSelector(state => state.theme.mode);
```

### 3. 渲染优化

#### 虚拟滚动

```javascript
import { FixedSizeList as List } from 'react-window';

const VirtualizedFileList = ({ files }) => (
  <List
    height={600}
    itemCount={files.length}
    itemSize={35}
    itemData={files}
  >
    {FileItem}
  </List>
);
```

#### 懒加载组件

```javascript
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const TreeEditor = lazy(() => import('./components/TreeEditor'));

// 使用Suspense包装
<Suspense fallback={<LoadingComponent/>}>
    <SettingsModal/>
</Suspense>
```

## 错误处理架构

### 1. 错误边界

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    
    return this.props.children;
  }
}
```

### 2. 异步错误处理

```javascript
const useAsyncError = () => {
    const dispatch = useAppDispatch();

    return useCallback((error) => {
        console.error('Async error:', error);
        message.error(error.message || '操作失败');
        dispatch(setError(error));
    }, [dispatch]);
};
```

### 3. 全局错误处理

```javascript
// 在Redux中间件中处理错误
const errorMiddleware = (store) => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux error:', error);
    store.dispatch(setGlobalError(error));
    return error;
  }
};
```

## 测试架构

### 1. 组件测试

```javascript
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import {store} from '../store';
import CodeEditor from '../components/CodeEditor';

describe('CodeEditor', () => {
    test('renders with initial content', () => {
        render(
            <Provider store={store}>
                <CodeEditor content="console.log('test')" language="javascript"/>
            </Provider>
        );

        expect(screen.getByText('console.log')).toBeInTheDocument();
    });
});
```

### 2. Hook测试

```javascript
import {renderHook, act} from '@testing-library/react';
import {useFileManager} from '../hooks/useFileManager';

describe('useFileManager', () => {
    test('opens file correctly', async () => {
        const {result} = renderHook(() => useFileManager());

        await act(async () => {
            await result.current.openFile('/path/to/file.js');
        });

        expect(result.current.currentFile).toBeDefined();
    });
});
```

### 3. Redux测试

```javascript
import { configureStore } from '@reduxjs/toolkit';
import themeReducer, { setTheme } from '../store/slices/themeSlice';

describe('themeSlice', () => {
  test('should handle theme change', () => {
    const store = configureStore({
      reducer: { theme: themeReducer }
    });
    
    store.dispatch(setTheme('dark'));
    
    expect(store.getState().theme.mode).toBe('dark');
  });
});
```

## 构建和部署

### 1. Vite配置

```javascript
// vite.config.js
export default defineConfig({
    plugins: [react()],
    build: {
        target: 'esnext',
        minify: 'terser',
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    antd: ['antd'],
                    monaco: ['monaco-editor']
                }
            }
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `@import "src/styles/variables.scss";`
            }
        }
    }
});
```

### 2. 代码分割策略

```javascript
// 路由级别分割
const routes = [
    {
        path: '/editor',
        component: lazy(() => import('./pages/Editor'))
    },
    {
        path: '/settings',
        component: lazy(() => import('./pages/Settings'))
    }
];

// 功能模块分割
const MonacoEditor = lazy(() => import('./components/MonacoEditor'));
const MarkdownViewer = lazy(() => import('./components/MarkdownViewer'));
```

## 总结

喵咕记事本的前端架构采用了现代化的React开发模式，具有以下特点：

### 架构优势

1. **模块化设计**: 清晰的组件层次和职责分离
2. **状态管理**: 集中式Redux状态管理，支持持久化
3. **性能优化**: 多层次的性能优化策略
4. **类型安全**: TypeScript类型定义和检查
5. **可测试性**: 完善的测试架构和策略
6. **可维护性**: 良好的代码组织和文档

### 技术特色

1. **编辑器集成**: 深度集成Monaco Editor
2. **多模式支持**: 代码、Markdown、树形三种编辑模式
3. **主题系统**: 完整的主题切换和自定义
4. **国际化**: 多语言支持和动态切换
5. **拖拽支持**: 文件拖拽和树形节点拖拽
6. **实时预览**: Markdown和树形结构实时预览

### 扩展性

1. **插件化**: 支持编辑器插件和功能扩展
2. **主题扩展**: 支持自定义主题和样式
3. **语言扩展**: 易于添加新的编程语言支持
4. **组件复用**: 高度可复用的组件设计

这种架构设计为应用的长期发展和功能扩展提供了坚实的基础，同时保证了良好的用户体验和开发体验。
