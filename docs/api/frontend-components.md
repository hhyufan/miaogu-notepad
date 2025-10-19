# 前端组件 API 文档

## 概述

本文档详细介绍了喵咕记事本前端的所有React组件，包括核心组件和工具组件的API接口、Props参数、使用方法等。

## 核心组件

### App.jsx - 主应用组件

主应用组件，负责整体布局和编辑器模式管理。

#### 编辑器模式常量

| 常量                      | 值            | 描述            |
|-------------------------|--------------|---------------|
| `EDITOR_MODES.MONACO`   | `'monaco'`   | Monaco代码编辑器模式 |
| `EDITOR_MODES.MARKDOWN` | `'markdown'` | Markdown预览模式  |
| `EDITOR_MODES.MGTREE`   | `'mgtree'`   | 树形结构编辑模式      |

#### 使用示例

```jsx
import App from './App';
import {EDITOR_MODES} from './App';

// 应用入口
function Main() {
    return <App/>;
}

// 获取编辑器模式
const currentMode = EDITOR_MODES.MONACO;
```

---

### AppHeader.jsx - 应用头部组件

应用头部组件，提供文件操作菜单和窗口控制功能。

#### Props 参数

| 参数             | 类型        | 必需 | 默认值 | 描述       |
|----------------|-----------|----|-----|----------|
| `fileManager`  | `Object`  | ✅  | -   | 文件管理器实例  |
| `hasOpenFiles` | `boolean` | ✅  | -   | 是否有打开的文件 |

#### 主要功能

| 功能   | 方法                        | 描述           |
|------|---------------------------|--------------|
| 新建文件 | `handleNewFile()`         | 创建新的空白文件     |
| 打开文件 | `handleOpenFile()`        | 打开文件选择对话框    |
| 保存文件 | `handleSaveFile()`        | 保存当前文件       |
| 另存为  | `handleSaveAsFile()`      | 另存为新文件       |
| 窗口控制 | `minimize/maximize/close` | 窗口最小化/最大化/关闭 |

#### 使用示例

```jsx
import AppHeader from './components/AppHeader';
import {useFileManager} from './hooks/useFileManager';

function App() {
    const fileManager = useFileManager();
    const hasOpenFiles = fileManager.openedFiles.length > 0;

    return (
        <div className="app">
            <AppHeader
                fileManager={fileManager}
                hasOpenFiles={hasOpenFiles}
            />
            {/* 其他内容 */}
        </div>
    );
}
```

---

### CodeEditor.jsx - 代码编辑器组件

基于Monaco Editor的代码编辑器组件，支持语法高亮和智能补全。

#### Props 参数

| 参数         | 类型         | 必需 | 默认值         | 描述       |
|------------|------------|----|-------------|----------|
| `content`  | `string`   | ✅  | -           | 编辑器内容    |
| `language` | `string`   | ✅  | -           | 编程语言标识   |
| `onChange` | `function` | ✅  | -           | 内容变化回调函数 |
| `onSave`   | `function` | ✅  | -           | 保存操作回调函数 |
| `readOnly` | `boolean`  | ❌  | `false`     | 是否只读模式   |
| `theme`    | `string`   | ❌  | `'vs-dark'` | 编辑器主题    |

#### 回调函数签名

```typescript
// onChange 回调
onChange: (value: string, event: monaco.editor.IModelContentChangedEvent) => void

// onSave 回调
onSave: () => void
```

#### 支持的编程语言

| 语言         | 标识符          | 语言     | 标识符      |
|------------|--------------|--------|----------|
| JavaScript | `javascript` | Python | `python` |
| TypeScript | `typescript` | Java   | `java`   |
| HTML       | `html`       | C++    | `cpp`    |
| CSS        | `css`        | C#     | `csharp` |
| JSON       | `json`       | Go     | `go`     |
| Markdown   | `markdown`   | Rust   | `rust`   |

#### 使用示例

```jsx
import CodeEditor from './components/CodeEditor';
import {useState} from 'react';

function EditorContainer() {
    const [content, setContent] = useState('console.log("Hello World");');
    const [language, setLanguage] = useState('javascript');

    const handleContentChange = (newContent) => {
        setContent(newContent);
    };

    const handleSave = () => {
        // 保存逻辑
        console.log('保存文件:', content);
    };

    return (
        <CodeEditor
            content={content}
            language={language}
            onChange={handleContentChange}
            onSave={handleSave}
            theme="vs-dark"
            readOnly={false}
        />
    );
}
```

---

### MarkdownViewer.jsx - Markdown预览组件

Markdown文档预览组件，支持扩展语法和图表渲染。

#### Props 参数

| 参数                | 类型         | 必需 | 默认值     | 描述         |
|-------------------|------------|----|---------|------------|
| `content`         | `string`   | ✅  | -       | Markdown内容 |
| `currentFileName` | `string`   | ❌  | `''`    | 当前文件名      |
| `currentFolder`   | `string`   | ❌  | `''`    | 当前文件夹路径    |
| `isDarkMode`      | `boolean`  | ❌  | `false` | 是否暗色主题     |
| `openFile`        | `function` | ❌  | -       | 打开文件回调函数   |

#### 支持的扩展功能

| 功能        | 语法              | 描述         |
|-----------|-----------------|------------|
| 代码高亮      | ` ```language ` | 支持60+种编程语言 |
| Mermaid图表 | ` ```mermaid `  | 流程图、时序图等   |
| 树形结构      | ` ```tree `     | 自定义树形结构可视化 |
| 脚注        | `[^1]`          | 脚注引用和定义    |
| 任务列表      | `- [x] 任务`      | 可勾选的任务列表   |
| 表格        | `               | 列1         | 列2 |` | GitHub风格表格 |

#### 使用示例

```jsx
import MarkdownViewer from './components/MarkdownViewer';

function MarkdownContainer() {
    const markdownContent = `
# 标题
这是一个**粗体**文本和*斜体*文本。

## 代码示例
\`\`\`javascript
function hello() {
  console.log("Hello World!");
}
\`\`\`

## Mermaid图表
\`\`\`mermaid
graph TD
    A[开始] --> B[处理]
    B --> C[结束]
\`\`\`
  `;

    const handleOpenFile = (filePath) => {
        console.log('打开文件:', filePath);
    };

    return (
        <MarkdownViewer
            content={markdownContent}
            currentFileName="README.md"
            currentFolder="/project"
            isDarkMode={true}
            openFile={handleOpenFile}
        />
    );
}
```

---

### TreeEditor.jsx - 树形结构编辑器

树形结构编辑器组件，支持节点的增删改查和拖拽操作。

#### Props 参数

| 参数         | 类型         | 必需 | 默认值     | 描述       |
|------------|------------|----|---------|----------|
| `content`  | `string`   | ✅  | -       | 树形数据文本   |
| `onChange` | `function` | ✅  | -       | 数据变化回调函数 |
| `onSave`   | `function` | ✅  | -       | 保存操作回调函数 |
| `readOnly` | `boolean`  | ❌  | `false` | 是否只读模式   |

#### 节点操作功能

| 操作     | 快捷键      | 描述           |
|--------|----------|--------------|
| 添加子节点  | `Tab`    | 在当前节点下添加子节点  |
| 添加兄弟节点 | `Enter`  | 在当前节点后添加兄弟节点 |
| 删除节点   | `Delete` | 删除当前选中节点     |
| 编辑节点   | `F2`     | 编辑节点文本       |
| 拖拽移动   | 鼠标拖拽     | 拖拽节点改变层级关系   |
| 折叠/展开  | `Space`  | 折叠或展开节点      |

#### 缩放控制

| 功能   | 快捷键        | 描述        |
|------|------------|-----------|
| 放大   | `Ctrl + +` | 放大视图      |
| 缩小   | `Ctrl + -` | 缩小视图      |
| 重置缩放 | `Ctrl + 0` | 重置为100%缩放 |
| 适应窗口 | `Ctrl + F` | 自动适应窗口大小  |

#### 树形数据格式

```
根节点
    子节点1
        子子节点1
        子子节点2
    子节点2
        子子节点3
            深层节点
    子节点3
```

#### 使用示例

```jsx
import TreeEditor from './components/TreeEditor';
import {useState} from 'react';

function TreeContainer() {
    const [treeData, setTreeData] = useState(`
项目规划
    前端开发
        React组件
        样式设计
    后端开发
        API接口
        数据库设计
    测试
        单元测试
        集成测试
  `);

    const handleTreeChange = (newData) => {
        setTreeData(newData);
    };

    const handleSave = () => {
        console.log('保存树形数据:', treeData);
    };

    return (
        <TreeEditor
            content={treeData}
            onChange={handleTreeChange}
            onSave={handleSave}
            readOnly={false}
        />
    );
}
```

---

### TabBar.jsx - 标签页管理组件

标签页管理组件，支持多文件切换和标签操作。

#### Props 参数

| 参数            | 类型       | 必需 | 默认值 | 描述      |
|---------------|----------|----|-----|---------|
| `fileManager` | `Object` | ✅  | -   | 文件管理器实例 |

#### 标签操作功能

| 操作        | 触发方式   | 描述          |
|-----------|--------|-------------|
| 切换标签      | 点击标签   | 切换到对应文件     |
| 关闭标签      | 点击关闭按钮 | 关闭当前标签      |
| 关闭其他      | 右键菜单   | 关闭除当前外的所有标签 |
| 关闭所有      | 右键菜单   | 关闭所有标签      |
| 重命名       | 右键菜单   | 重命名文件       |
| 在资源管理器中显示 | 右键菜单   | 在文件管理器中显示文件 |

#### 标签状态指示

| 状态  | 图标   | 描述         |
|-----|------|------------|
| 已修改 | `●`  | 文件内容已修改未保存 |
| 已保存 | 无    | 文件已保存      |
| 只读  | `🔒` | 文件为只读状态    |

#### 使用示例

```jsx
import TabBar from './components/TabBar';
import {useFileManager} from './hooks/useFileManager';

function App() {
    const fileManager = useFileManager();

    return (
        <div className="app">
            <TabBar fileManager={fileManager}/>
            {/* 其他内容 */}
        </div>
    );
}
```

---

### SettingsModal.jsx - 设置弹窗组件

应用设置弹窗组件，提供各种配置选项。

#### Props 参数

| 参数        | 类型         | 必需 | 默认值 | 描述       |
|-----------|------------|----|-----|----------|
| `visible` | `boolean`  | ✅  | -   | 弹窗可见性    |
| `onClose` | `function` | ✅  | -   | 关闭弹窗回调函数 |

#### 设置分类

| 分类        | 设置项   | 类型   | 描述        |
|-----------|-------|------|-----------|
| **通用设置**  | 语言    | 选择   | 界面语言选择    |
|           | 主题    | 选择   | 应用主题选择    |
| **编辑器设置** | 字体族   | 选择   | 编辑器字体     |
|           | 字体大小  | 滑块   | 字体大小调节    |
|           | 行高    | 滑块   | 行高调节      |
|           | 自动换行  | 开关   | 是否自动换行    |
|           | 显示行号  | 开关   | 是否显示行号    |
|           | 显示小地图 | 开关   | 是否显示代码小地图 |
| **外观设置**  | 背景图片  | 文件选择 | 自定义背景图片   |
|           | 背景透明度 | 滑块   | 背景透明度调节   |
|           | 启用背景  | 开关   | 是否启用背景图片  |

#### 使用示例

```jsx
import SettingsModal from './components/SettingsModal';
import {useState} from 'react';

function App() {
    const [settingsVisible, setSettingsVisible] = useState(false);

    const handleOpenSettings = () => {
        setSettingsVisible(true);
    };

    const handleCloseSettings = () => {
        setSettingsVisible(false);
    };

    return (
        <div className="app">
            <button onClick={handleOpenSettings}>打开设置</button>

            <SettingsModal
                visible={settingsVisible}
                onClose={handleCloseSettings}
            />
        </div>
    );
}
```

## 工具组件

### EditorStatusBar.jsx - 编辑器状态栏

显示编辑器状态信息的底部状态栏组件。

#### 显示信息

| 信息类型 | 格式            | 描述          |
|------|---------------|-------------|
| 文件路径 | 面包屑导航         | 显示当前文件的完整路径 |
| 文件编码 | `UTF-8`       | 当前文件的字符编码   |
| 行尾格式 | `LF` / `CRLF` | 行尾符格式       |
| 光标位置 | `行:列`         | 当前光标所在位置    |
| 选中字符 | `已选择 N 个字符`   | 选中的字符数量     |
| 文件大小 | `1.2 KB`      | 文件大小信息      |

#### 使用示例

```jsx
import EditorStatusBar from './components/EditorStatusBar';

function EditorContainer() {
    return (
        <div className="editor-container">
            {/* 编辑器内容 */}
            <EditorStatusBar/>
        </div>
    );
}
```

---

### WelcomeScreen.jsx - 欢迎界面

在没有打开文件时显示的欢迎界面组件。

#### 功能按钮

| 按钮   | 功能       | 描述          |
|------|----------|-------------|
| 新建文件 | 创建空白文件   | 创建新的文本文件    |
| 打开文件 | 打开文件对话框  | 选择并打开现有文件   |
| 最近文件 | 显示最近文件列表 | 快速访问最近使用的文件 |

#### 使用示例

```jsx
import WelcomeScreen from './components/WelcomeScreen';

function App() {
    const hasOpenFiles = false; // 假设没有打开的文件

    return (
        <div className="app">
            {hasOpenFiles ? (
                <div>编辑器内容</div>
            ) : (
                <WelcomeScreen/>
            )}
        </div>
    );
}
```

---

### TreeViewer.jsx - 树形视图组件

用于显示和管理树形数据的只读视图组件。

#### Props 参数

| 参数            | 类型         | 必需 | 默认值     | 描述       |
|---------------|------------|----|---------|----------|
| `treeData`    | `string`   | ✅  | -       | 树形数据文本   |
| `onNodeClick` | `function` | ❌  | -       | 节点点击回调   |
| `expandAll`   | `boolean`  | ❌  | `false` | 是否展开所有节点 |

#### 使用示例

```jsx
import TreeViewer from './components/TreeViewer';

function DocumentViewer() {
    const treeData = `
文档结构
    第一章
        1.1 概述
        1.2 安装
    第二章
        2.1 快速开始
        2.2 配置
  `;

    const handleNodeClick = (nodeData) => {
        console.log('点击节点:', nodeData);
    };

    return (
        <TreeViewer
            treeData={treeData}
            onNodeClick={handleNodeClick}
            expandAll={true}
        />
    );
}
```

---

### MermaidRenderer.jsx - Mermaid图表渲染组件

专门用于渲染Mermaid图表的组件。

#### Props 参数

| 参数      | 类型       | 必需 | 默认值         | 描述          |
|---------|----------|----|-------------|-------------|
| `chart` | `string` | ✅  | -           | Mermaid图表代码 |
| `theme` | `string` | ❌  | `'default'` | 图表主题        |

#### 支持的图表类型

| 类型  | 语法开头                  | 描述      |
|-----|-----------------------|---------|
| 流程图 | `graph` / `flowchart` | 流程图和决策图 |
| 时序图 | `sequenceDiagram`     | 时序交互图   |
| 甘特图 | `gantt`               | 项目进度图   |
| 类图  | `classDiagram`        | UML类图   |
| 状态图 | `stateDiagram`        | 状态转换图   |
| 饼图  | `pie`                 | 饼状图     |

#### 使用示例

```jsx
import MermaidRenderer from './components/MermaidRenderer';

function ChartContainer() {
    const chartCode = `
graph TD
    A[开始] --> B{是否登录?}
    B -->|是| C[显示主页]
    B -->|否| D[显示登录页]
    C --> E[结束]
    D --> E
  `;

    return (
        <MermaidRenderer
            chart={chartCode}
            theme="dark"
        />
    );
}
```

---

### LoadingComponent.jsx - 加载组件

显示加载状态的通用组件。

#### Props 参数

| 参数        | 类型       | 必需 | 默认值         | 描述     |
|-----------|----------|----|-------------|--------|
| `message` | `string` | ❌  | `'加载中...'`  | 加载提示文本 |
| `size`    | `string` | ❌  | `'default'` | 加载图标大小 |

#### 使用示例

```jsx
import LoadingComponent from './components/LoadingComponent';

function DataContainer() {
  const [loading, setLoading] = useState(true);

  return (
    <div>
      {loading ? (
        <LoadingComponent 
          message="正在加载文件..."
          size="large"
        />
      ) : (
        <div>文件内容</div>
      )}
    </div>
  );
}
```

## 组件样式类名

### 通用样式类

| 类名                  | 描述     |
|---------------------|--------|
| `.app`              | 主应用容器  |
| `.app-header`       | 应用头部   |
| `.app-content`      | 应用主内容区 |
| `.editor-container` | 编辑器容器  |
| `.status-bar`       | 状态栏    |

### 主题相关类

| 类名             | 描述   |
|----------------|------|
| `.theme-light` | 浅色主题 |
| `.theme-dark`  | 深色主题 |
| `.theme-auto`  | 自动主题 |

## 注意事项

1. **性能优化**: 大文件编辑时建议启用虚拟滚动
2. **内存管理**: 及时清理不需要的文件监听器
3. **主题适配**: 确保自定义样式支持多主题切换
4. **国际化**: 所有用户可见文本都应支持多语言
5. **无障碍**: 组件应支持键盘导航和屏幕阅读器

---

*本文档基于 miaogu-notepad v1.4.0 版本编写*
