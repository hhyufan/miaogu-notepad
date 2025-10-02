# 树状图实现方案

## 概述

树状图是喵咕记事本的核心功能之一，提供了强大的知识结构可视化和交互能力。本文档详细介绍树状图的技术实现方案，包括数据解析、组件架构、交互机制和性能优化等方面。

## 核心架构

### 1. 组件体系

| 组件 | 功能 | 特性 |
|------|------|------|
| **TreeViewer** | 树状图查看器 | 只读显示、代码跳转、状态持久化 |
| **TreeEditor** | 树状图编辑器 | 节点编辑、拖拽排序、实时预览 |
| **TreeNode** | 树节点组件 | 图标渲染、点击处理、样式适配 |

### 2. 数据结构

#### 树节点数据结构

```javascript
const treeNode = {
  key: 'unique-key',           // 唯一标识符
  title: '节点标题',            // 显示文本
  children: [],                // 子节点数组
  level: 0,                    // 层级深度
  isClickable: false,          // 是否可点击跳转
  jumpLanguage: null,          // 跳转语言类型
  jumpIndex: null,             // 跳转索引
  originalText: '原始文本',     // 原始文本内容
  hasCode: false,              // 是否包含代码
  nodeType: 'folder'           // 节点类型: folder/file/code
};
```

#### 跳转索引管理

```javascript
const lastJumpIndex = {
  'java': 3,
  'python': 1,
  'javascript': 2
  // 按语言类型记录最后使用的索引
};
```

## 文本解析引擎

### 1. 解析算法

#### 核心解析函数

```javascript
const parseTreeText = (text, rootTitle = 'Root') => {
  const lines = text.split('\n').filter(line => line.trim());
  const root = { key: 'root', title: rootTitle, children: [], level: -1 };
  const stack = [root];
  let keyCounter = 0;
  const lastJumpIndex = {};

  lines.forEach((line, _) => {
    // 1. 计算缩进层级
    const leadingSpaces = line.length - line.trimStart().length;
    const level = Math.floor(leadingSpaces / 2);
    
    // 2. 解析跳转语法
    const jumpInfo = parseJumpSyntax(line);
    
    // 3. 构建节点对象
    const node = createTreeNode(line, level, jumpInfo, keyCounter++);
    
    // 4. 维护层级栈
    maintainLevelStack(stack, level);
    
    // 5. 添加到父节点
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });

  return root.children;
};
```

### 2. 跳转节点解析与实现

#### 跳转节点语法系统

基于 `docs/features/跳转节点解析与工作原理.md` 的详细实现，跳转节点系统支持四种灵活的语法格式：

| 语法模式 | 正则表达式 | 功能描述 | 示例 | 索引计算 |
|----------|------------|----------|------|----------|
| **显式索引** | `/>([a-zA-Z]+)\[(\d+)]/` | 跳转到指定索引 | `>java[2]` | 直接使用指定索引 |
| **递增跳转** | `/>([a-zA-Z]+)\+\+/` | 索引自动递增 | `>java++` | `lastJumpIndex[language] + 1` |
| **跳跃增加** | `/>([a-zA-Z]+)\+=(\d+)/` | 索引跳跃增加 | `>java+=3` | `lastJumpIndex[language] + 增量` |
| **同索引复用** | `/>([a-zA-Z]+)(?![\[+])/` | 复用上次索引 | `>java` | 使用 `lastJumpIndex[language]` |

#### 解析实现详解

**文本预处理**：
```javascript
const preprocessText = (line) => {
  // 移除行尾换行符和回车符
  return line.trim().replace(/[\r\n]/g, '');
};
```

**优先级匹配系统**：
```javascript
const parseJumpSyntax = (line, lastJumpIndex = {}) => {
  const cleanLine = preprocessText(line);
  
  // 1. 显式索引模式 (最高优先级)
  const explicitMatch = cleanLine.match(/>([a-zA-Z]+)\[(\d+)]/);
  if (explicitMatch) {
    const language = explicitMatch[1];
    const index = parseInt(explicitMatch[2], 10);
    lastJumpIndex[language] = index; // 更新索引记录
    return { 
      isClickable: true, 
      jumpLanguage: language, 
      jumpIndex: index,
      syntaxType: 'explicit'
    };
  }
  
  // 2. 递增跳转模式
  const incrementMatch = cleanLine.match(/>([a-zA-Z]+)\+\+/);
  if (incrementMatch) {
    const language = incrementMatch[1];
    const currentIndex = lastJumpIndex[language] || 0;
    const newIndex = currentIndex + 1;
    lastJumpIndex[language] = newIndex;
    return { 
      isClickable: true, 
      jumpLanguage: language, 
      jumpIndex: newIndex,
      syntaxType: 'increment'
    };
  }
  
  // 3. 跳跃增加模式
  const jumpAddMatch = cleanLine.match(/>([a-zA-Z]+)\+=(\d+)/);
  if (jumpAddMatch) {
    const language = jumpAddMatch[1];
    const increment = parseInt(jumpAddMatch[2], 10);
    const currentIndex = lastJumpIndex[language] || 0;
    const newIndex = currentIndex + increment;
    lastJumpIndex[language] = newIndex;
    return { 
      isClickable: true, 
      jumpLanguage: language, 
      jumpIndex: newIndex,
      syntaxType: 'jump_add'
    };
  }
  
  // 4. 同索引复用模式 (最低优先级)
  const reuseMatch = cleanLine.match(/>([a-zA-Z]+)(?![\[+])/);
  if (reuseMatch) {
    const language = reuseMatch[1];
    const index = lastJumpIndex[language] || 1; // 默认为1
    return { 
      isClickable: true, 
      jumpLanguage: language, 
      jumpIndex: index,
      syntaxType: 'reuse'
    };
  }
  
  return { 
    isClickable: false, 
    jumpLanguage: null, 
    jumpIndex: null,
    syntaxType: null
  };
};
```

#### 索引管理机制

**智能索引计算**：
```javascript
const calculateJumpIndex = (syntaxType, language, specifiedValue, lastJumpIndex) => {
  switch (syntaxType) {
    case 'explicit':
      return specifiedValue;
    case 'increment':
      return (lastJumpIndex[language] || 0) + 1;
    case 'jump_add':
      return (lastJumpIndex[language] || 0) + specifiedValue;
    case 'reuse':
      return lastJumpIndex[language] || 1;
    default:
      return null;
  }
};
```

**标题清理处理**：
```javascript
const cleanNodeTitle = (line) => {
  // 移除跳转语法，保留纯净的节点标题
  return line
    .replace(/>([a-zA-Z]+)\[(\d+)]/, '') // 移除显式索引
    .replace(/>([a-zA-Z]+)\+\+/, '')     // 移除递增语法
    .replace(/>([a-zA-Z]+)\+=(\d+)/, '') // 移除跳跃增加
    .replace(/>([a-zA-Z]+)(?![\[+])/, '') // 移除复用语法
    .trim();
};
```

```javascript
const parseJumpSyntax = (line) => {
  const cleanLine = line.trim().replace(/[\r\n]/g, '');
  
  // 显式索引跳转
  const jumpMatchExplicit = cleanLine.match(/>([a-zA-Z]+)\[(\d+)]/);
  if (jumpMatchExplicit) {
    const language = jumpMatchExplicit[1];
    const index = parseInt(jumpMatchExplicit[2]);
    lastJumpIndex[language] = index;
    return { isClickable: true, jumpLanguage: language, jumpIndex: index };
  }
  
  // 递增跳转
  const jumpMatchIncrement = cleanLine.match(/>([a-zA-Z]+)\+\+/);
  if (jumpMatchIncrement) {
    const language = jumpMatchIncrement[1];
    const currentIndex = lastJumpIndex[language] || 0;
    const newIndex = currentIndex + 1;
    lastJumpIndex[language] = newIndex;
    return { isClickable: true, jumpLanguage: language, jumpIndex: newIndex };
  }
  
  // 跳跃增加
  const jumpMatchJump = cleanLine.match(/>([a-zA-Z]+)\+=(\d+)/);
  if (jumpMatchJump) {
    const language = jumpMatchJump[1];
    const increment = parseInt(jumpMatchJump[2]);
    const currentIndex = lastJumpIndex[language] || 0;
    const newIndex = currentIndex + increment;
    lastJumpIndex[language] = newIndex;
    return { isClickable: true, jumpLanguage: language, jumpIndex: newIndex };
  }
  
  // 同索引复用
  const jumpMatchSame = cleanLine.match(/>([a-zA-Z]+)(?![\[+])/);
  if (jumpMatchSame) {
    const language = jumpMatchSame[1];
    const index = lastJumpIndex[language] || 1;
    return { isClickable: true, jumpLanguage: language, jumpIndex: index };
  }
  
  return { isClickable: false, jumpLanguage: null, jumpIndex: null };
};
```

## 组件实现

### 1. TreeViewer组件

#### 核心特性

| 特性 | 实现方式 | 功能描述 |
|------|----------|----------|
| **状态持久化** | localStorage | 保存展开/折叠状态 |
| **主题适配** | CSS变量 | 自动适配明暗主题 |
| **代码跳转** | 回调函数 | 精确跳转到代码块 |
| **懒加载** | 异步加载 | 按需加载树文件内容 |

#### 跳转执行机制

基于 `docs/features/跳转节点解析与工作原理.md` 的跳转执行实现：

**代码块查找算法**：
```javascript
const findCodeBlockByLanguageAndIndex = (language, index) => {
  // 1. 获取编辑器内容
  const editorContent = getEditorContent();
  
  // 2. 解析代码块
  const codeBlocks = parseCodeBlocks(editorContent);
  
  // 3. 按语言筛选
  const languageBlocks = codeBlocks.filter(block => 
    block.language.toLowerCase() === language.toLowerCase()
  );
  
  // 4. 按索引查找 (1-based indexing)
  const targetBlock = languageBlocks[index - 1];
  
  if (!targetBlock) {
    throw new Error(`未找到第${index}个${language}代码块`);
  }
  
  return targetBlock;
};
```

**精确跳转实现**：
```javascript
const executeJump = (language, index) => {
  try {
    // 1. 查找目标代码块
    const targetBlock = findCodeBlockByLanguageAndIndex(language, index);
    
    // 2. 计算跳转位置
    const targetLine = targetBlock.startLine;
    
    // 3. 执行平滑滚动
    scrollToLine(targetLine, {
      behavior: 'smooth',
      block: 'center',
      duration: 300
    });
    
    // 4. 高亮显示
    highlightCodeBlock(targetBlock, {
      duration: 2000,
      fadeOut: true
    });
    
    // 5. 用户反馈
    showJumpFeedback(language, index);
    
  } catch (error) {
    // 6. 错误处理
    handleJumpError(error, language, index);
  }
};
```

**DOM操作优化**：
```javascript
const scrollToLine = (lineNumber, options = {}) => {
  const {
    behavior = 'smooth',
    block = 'center',
    duration = 300
  } = options;
  
  // 1. 查找目标行元素
  const lineElement = document.querySelector(
    `.monaco-editor .view-line[data-line-number="${lineNumber}"]`
  );
  
  if (!lineElement) {
    console.warn(`未找到行号 ${lineNumber} 对应的DOM元素`);
    return;
  }
  
  // 2. 执行滚动
  lineElement.scrollIntoView({
    behavior,
    block,
    inline: 'nearest'
  });
  
  // 3. 设置编辑器焦点
  if (window.monacoEditor) {
    window.monacoEditor.setPosition({
      lineNumber,
      column: 1
    });
    window.monacoEditor.focus();
  }
};
```

**视觉反馈系统**：
```javascript
const highlightCodeBlock = (codeBlock, options = {}) => {
  const {
    duration = 2000,
    fadeOut = true,
    highlightClass = 'jump-highlight'
  } = options;
  
  // 1. 创建高亮覆盖层
  const highlightOverlay = document.createElement('div');
  highlightOverlay.className = highlightClass;
  
  // 2. 计算位置和尺寸
  const blockElement = getCodeBlockElement(codeBlock);
  const rect = blockElement.getBoundingClientRect();
  
  // 3. 设置样式
  Object.assign(highlightOverlay.style, {
    position: 'absolute',
    top: `${rect.top + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    backgroundColor: 'rgba(0, 123, 255, 0.2)',
    border: '2px solid var(--primary-color)',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: 1000
  });
  
  // 4. 添加到DOM
  document.body.appendChild(highlightOverlay);
  
  // 5. 动画效果
  if (fadeOut) {
    setTimeout(() => {
      highlightOverlay.style.transition = 'opacity 500ms ease-out';
      highlightOverlay.style.opacity = '0';
      
      setTimeout(() => {
        document.body.removeChild(highlightOverlay);
      }, 500);
    }, duration - 500);
  }
};
```

#### 状态管理

```javascript
const TreeViewer = ({ treeFilePath, treeContent, onJumpToCode }) => {
  const [treeData, setTreeData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentFileKey, setCurrentFileKey] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  // 状态持久化
  const saveExpandedState = useCallback((keys, fileName) => {
    const storageKey = getStorageKey(fileName);
    try {
      localStorage.setItem(storageKey, JSON.stringify(keys));
    } catch (error) {
      console.warn('保存树状图展开状态失败:', error);
    }
  }, [getStorageKey]);

  const loadExpandedState = useCallback((fileName) => {
    const storageKey = getStorageKey(fileName);
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('恢复树状图展开状态失败:', error);
      return [];
    }
  }, [getStorageKey]);
  
  // 跳转处理
  const handleJumpToCode = useCallback((language, index) => {
    if (onJumpToCode) {
      onJumpToCode(language, index);
    } else {
      // 默认跳转实现
      executeJump(language, index);
    }
  }, [onJumpToCode]);
};
```
```

### 2. TreeEditor组件

#### 编辑功能

| 功能 | 实现方式 | 特性 |
|------|----------|------|
| **节点编辑** | 内联编辑 | 双击编辑、回车确认 |
| **节点增删** | 动态操作 | 添加子节点、删除节点 |
| **拖拽排序** | Ant Design Tree | 节点拖拽重排序 |
| **缩放控制** | CSS Transform | 放大缩小、适应窗口 |

#### 编辑状态管理

```javascript
const TreeEditor = ({ initialData, onSave }) => {
  const [treeData, setTreeData] = useState(initialData);
  const [expandedSections, setExpandedSections] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [scale, setScale] = useState(1);

  // 节点编辑
  const handleEdit = (key, title) => {
    setEditingKey(key);
    setEditingValue(title);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (editingKey && editingValue.trim()) {
      const newTreeData = updateNodeTitle(treeData, editingKey, editingValue.trim());
      setTreeData(newTreeData);
      onSave?.(treeToText(newTreeData));
    }
    setEditingKey(null);
    setEditingValue('');
  };
};
```

## 节点渲染系统

### 1. 节点类型识别

#### 节点分类

```javascript
const getNodeType = (node) => {
  if (node.isClickable) return 'code';
  if (node.children && node.children.length > 0) return 'folder';
  return 'file';
};
```

#### 图标映射

| 节点类型 | 图标 | 颜色 | 功能 |
|----------|------|------|------|
| **代码节点** | `<CodeOutlined />` | 渐变色 | 可点击跳转 |
| **文件夹节点** | `<FolderOutlined />` | 橙色 | 可展开折叠 |
| **文件节点** | `<FileTextOutlined />` | 绿色 | 普通显示 |

### 2. 渲染函数

```javascript
const renderTreeNode = (node, onJumpToCode, isDarkMode, expandedKeys, onToggleExpand) => {
  const isClickable = node.isClickable;
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedKeys.includes(node.key);

  // 图标选择
  const getIcon = () => {
    if (isClickable) {
      return <CodeOutlined className="code-indicator" />;
    }
    if (hasChildren) {
      return isExpanded ? <FolderOpenOutlined /> : <FolderOutlined />;
    }
    return <FileTextOutlined />;
  };

  // 点击处理
  const handleClick = () => {
    if (isClickable && onJumpToCode) {
      onJumpToCode(node.jumpLanguage, node.jumpIndex);
    }
  };

  return {
    key: node.key,
    title: (
      <div className={`tree-node-content ${isClickable ? 'tree-node-clickable' : ''}`}
           onClick={handleClick}>
        <span className="tree-icon">{getIcon()}</span>
        <span className={`tree-node-text ${node.hasCode ? 'has-code' : ''}`}>
          {node.title}
        </span>
      </div>
    ),
    children: node.children ? node.children.map(child => 
      renderTreeNode(child, onJumpToCode, isDarkMode, expandedKeys, onToggleExpand)
    ) : undefined
  };
};
```

## 交互机制

### 1. 展开/折叠控制

#### 状态管理

```javascript
// 展开所有节点
const expandAll = () => {
  const allKeys = [];
  const collectKeys = (nodes) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        allKeys.push(node.key);
        collectKeys(node.children);
      }
    });
  };
  collectKeys(treeData);
  setExpandedKeys(allKeys);
};

// 折叠所有节点
const collapseAll = () => {
  setExpandedKeys([]);
};

// 切换展开状态
const handleExpand = (expandedKeys) => {
  setExpandedKeys(expandedKeys);
  saveExpandedState(expandedKeys, currentFileName);
};
```

### 2. 代码跳转机制

#### 跳转实现

```javascript
const handleJumpToCode = (language, index) => {
  if (!onJumpToCode) return;
  
  // 调用父组件的跳转函数
  onJumpToCode(language, index);
  
  // 视觉反馈
  message.success(`跳转到第${index}个${language}代码块`);
};
```

## 样式系统与主题适配

### 1. 节点样式设计

基于 `docs/features/跳转节点解析与工作原理.md` 的样式规范：

#### 可点击节点样式

**基础样式**：
```scss
.tree-node-clickable {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 2px 6px;
  
  &:hover {
    background-color: var(--primary-color-light);
    transform: translateX(2px);
  }
  
  &:active {
    transform: translateX(1px) scale(0.98);
  }
}
```

**跳转指示器**：
```scss
.code-indicator {
  color: var(--primary-color);
  margin-right: 6px;
  font-weight: bold;
  
  // 渐变色效果
  background: linear-gradient(45deg, #1890ff, #52c41a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

#### 主题适配系统

**CSS变量定义**：
```scss
.tree-viewer {
  // 基础颜色变量
  --tree-bg-primary: var(--background-primary);
  --tree-bg-secondary: var(--background-secondary);
  --tree-text-primary: var(--text-primary);
  --tree-text-secondary: var(--text-secondary);
  --tree-border-color: var(--border-primary);
  --tree-hover-bg: var(--hover-background);
  
  // 跳转节点专用变量
  --jump-node-color: var(--primary-color);
  --jump-node-hover-bg: var(--primary-color-light);
  --jump-highlight-color: rgba(0, 123, 255, 0.2);
  --jump-border-color: var(--primary-color);
}
```

**明暗主题切换**：
```scss
// 明亮主题
.tree-viewer[data-theme="light"] {
  --tree-bg-primary: #ffffff;
  --tree-text-primary: #333333;
  --jump-node-color: #1890ff;
  --jump-highlight-color: rgba(24, 144, 255, 0.15);
}

// 深色主题
.tree-viewer[data-theme="dark"] {
  --tree-bg-primary: #1f1f1f;
  --tree-text-primary: #e6e6e6;
  --jump-node-color: #40a9ff;
  --jump-highlight-color: rgba(64, 169, 255, 0.2);
  
  .tree-node-clickable:hover {
    background-color: rgba(64, 169, 255, 0.1);
  }
}
```

### 2. 跳转高亮样式

**高亮动画效果**：
```scss
@keyframes jumpHighlight {
  0% {
    opacity: 0;
    transform: scale(0.95);
    box-shadow: 0 0 0 0 var(--jump-border-color);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
    box-shadow: 0 0 0 4px rgba(var(--jump-border-color), 0.3);
  }
  100% {
    opacity: 0.8;
    transform: scale(1);
    box-shadow: 0 0 0 2px var(--jump-border-color);
  }
}

.jump-highlight {
  animation: jumpHighlight 0.6s ease-out;
  background: var(--jump-highlight-color);
  border: 2px solid var(--jump-border-color);
  border-radius: 6px;
  pointer-events: none;
  z-index: 1000;
}
```

**渐隐效果**：
```scss
.jump-highlight.fade-out {
  transition: opacity 0.5s ease-out;
  opacity: 0;
}
```

### 3. 错误处理样式

**错误状态指示**：
```scss
.tree-node-error {
  color: var(--error-color);
  opacity: 0.6;
  
  &::after {
    content: " ⚠️";
    font-size: 0.8em;
  }
}

.tree-error-tooltip {
  background: var(--error-background);
  color: var(--error-text);
  border: 1px solid var(--error-border);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  max-width: 300px;
  word-wrap: break-word;
}
```

### 4. 性能优化样式

**虚拟滚动支持**：
```scss
.tree-container {
  height: 100%;
  overflow: auto;
  
  // 硬件加速
  transform: translateZ(0);
  will-change: scroll-position;
}

.tree-virtual-list {
  // 减少重绘
  contain: layout style paint;
}
```

**节点渲染优化**：
```scss
.tree-node-content {
  // 避免布局抖动
  min-height: 24px;
  display: flex;
  align-items: center;
  
  // 减少重排
  contain: layout;
}
```

```javascript
// 监听主题变化
useEffect(() => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        const theme = document.documentElement.getAttribute('data-theme');
        setIsDarkMode(theme === 'dark');
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  return () => observer.disconnect();
}, []);
```

### 2. 节点样式

#### 可点击节点

```scss
.tree-node-content.tree-node-clickable {
  cursor: pointer;
  color: #1890ff;
  border-radius: 6px;
  padding: 4px 8px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(24, 144, 255, 0.1);
    transform: translateX(2px);
  }
}
```

#### 代码节点特殊样式

```scss
.tree-node-text.has-code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 600;
}
```

## 性能优化与扩展性

### 1. 解析性能优化

基于 `docs/features/跳转节点解析与工作原理.md` 的性能优化策略：

#### DOM查询缓存

```javascript
// 缓存DOM查询结果
const domCache = new Map();

const getCachedElement = (selector) => {
  if (!domCache.has(selector)) {
    const element = document.querySelector(selector);
    domCache.set(selector, element);
  }
  return domCache.get(selector);
};

// 清理缓存
const clearDOMCache = () => {
  domCache.clear();
};
```

#### 平滑滚动节流

```javascript
// 节流控制，避免频繁滚动
let scrollTimeout = null;

const throttledScrollToLine = (lineNumber) => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  
  scrollTimeout = setTimeout(() => {
    const element = getCachedElement(`[data-line="${lineNumber}"]`);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, 100);
};
```

#### 高亮效果复用

```javascript
// 复用高亮元素，避免重复创建
let highlightElement = null;

const createOrReuseHighlight = (targetElement) => {
  if (!highlightElement) {
    highlightElement = document.createElement('div');
    highlightElement.className = 'jump-highlight';
    document.body.appendChild(highlightElement);
  }
  
  // 更新位置和大小
  const rect = targetElement.getBoundingClientRect();
  Object.assign(highlightElement.style, {
    position: 'fixed',
    left: `${rect.left - 4}px`,
    top: `${rect.top - 4}px`,
    width: `${rect.width + 8}px`,
    height: `${rect.height + 8}px`,
    display: 'block'
  });
  
  return highlightElement;
};
```

### 2. 渲染性能优化

#### 虚拟滚动实现

```javascript
import { FixedSizeList as List } from 'react-window';

const VirtualizedTreeViewer = ({ treeData, height = 600 }) => {
  const flattenedData = useMemo(() => {
    const flatten = (nodes, level = 0) => {
      const result = [];
      nodes.forEach(node => {
        result.push({ ...node, level });
        if (node.children && expandedKeys.includes(node.key)) {
          result.push(...flatten(node.children, level + 1));
        }
      });
      return result;
    };
    return flatten(treeData);
  }, [treeData, expandedKeys]);

  const Row = ({ index, style }) => {
    const node = flattenedData[index];
    return (
      <div style={style}>
        <TreeNodeRenderer 
          node={node} 
          level={node.level}
          onJumpToCode={handleJumpToCode}
        />
      </div>
    );
  };

  return (
    <List
      height={height}
      itemCount={flattenedData.length}
      itemSize={32}
      itemData={flattenedData}
    >
      {Row}
    </List>
  );
};
```

#### 节点懒加载策略

```javascript
const LazyTreeNode = ({ node, level, maxInitialLevel = 3 }) => {
  const [isLoaded, setIsLoaded] = useState(level <= maxInitialLevel);
  const [isVisible, setIsVisible] = useState(false);
  
  // 使用Intersection Observer检测可见性
  const nodeRef = useRef();
  
  useEffect(() => {
    if (!isLoaded) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (nodeRef.current) {
      observer.observe(nodeRef.current);
    }
    
    return () => observer.disconnect();
  }, [isLoaded]);

  const handleLoadNode = () => {
    setIsLoaded(true);
    setIsVisible(true);
  };

  if (!isLoaded) {
    return (
      <div 
        ref={nodeRef}
        className="lazy-tree-node"
        onClick={handleLoadNode}
      >
        <span className="lazy-indicator">📁 点击加载 {node.title}</span>
      </div>
    );
  }

  return isVisible ? (
    <TreeNodeComponent ref={nodeRef} node={node} level={level} />
  ) : (
    <div ref={nodeRef} className="tree-node-placeholder" />
  );
};
```

### 3. 内存优化策略

#### 智能缓存管理

```javascript
// LRU缓存实现
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

// 解析结果缓存
const parseCache = new LRUCache(50);

const getCachedParseResult = (content, fileName) => {
  const cacheKey = `${fileName}:${content.length}:${content.slice(0, 100)}`;
  
  let result = parseCache.get(cacheKey);
  if (!result) {
    result = parseTreeText(content, fileName);
    parseCache.set(cacheKey, result);
  }
  
  return result;
};
```

#### 状态优化

```javascript
// 使用useCallback避免不必要的重渲染
const handleJumpToCode = useCallback((language, index) => {
  throttledScrollToLine(findCodeBlockByLanguageAndIndex(language, index));
}, []);

// 使用useMemo缓存计算结果
const processedTreeData = useMemo(() => {
  return getCachedParseResult(treeContent, currentFileName);
}, [treeContent, currentFileName]);

// 分离状态更新，减少重渲染范围
const useTreeState = () => {
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [loadedKeys, setLoadedKeys] = useState(new Set());
  
  return {
    expandedKeys,
    selectedKeys,
    loadedKeys,
    setExpandedKeys,
    setSelectedKeys,
    setLoadedKeys
  };
};
```

### 4. 扩展性设计

#### 插件化跳转语法

```javascript
// 跳转语法插件接口
class JumpSyntaxPlugin {
  constructor(name, regex, parser) {
    this.name = name;
    this.regex = regex;
    this.parser = parser;
  }
  
  match(text) {
    return this.regex.test(text);
  }
  
  parse(text, context) {
    return this.parser(text, context);
  }
}

// 语法管理器
class SyntaxManager {
  constructor() {
    this.plugins = new Map();
    this.registerDefaultPlugins();
  }
  
  registerPlugin(plugin) {
    this.plugins.set(plugin.name, plugin);
  }
  
  parseWithPlugins(text, context) {
    for (const plugin of this.plugins.values()) {
      if (plugin.match(text)) {
        return plugin.parse(text, context);
      }
    }
    return null;
  }
  
  registerDefaultPlugins() {
    // 注册默认语法插件
    this.registerPlugin(new JumpSyntaxPlugin(
      'explicit',
      /^(.+?)\s*\[(\w+):(\d+)\]$/,
      (text, context) => {
        const match = text.match(/^(.+?)\s*\[(\w+):(\d+)\]$/);
        return {
          title: match[1].trim(),
          language: match[2],
          index: parseInt(match[3]),
          isClickable: true
        };
      }
    ));
  }
}
```

#### 自定义跳转行为

```javascript
// 跳转行为接口
class JumpBehavior {
  constructor(name, handler) {
    this.name = name;
    this.handler = handler;
  }
  
  execute(language, index, context) {
    return this.handler(language, index, context);
  }
}

// 行为管理器
class BehaviorManager {
  constructor() {
    this.behaviors = new Map();
    this.registerDefaultBehaviors();
  }
  
  registerBehavior(behavior) {
    this.behaviors.set(behavior.name, behavior);
  }
  
  executeBehavior(behaviorName, language, index, context) {
    const behavior = this.behaviors.get(behaviorName);
    if (behavior) {
      return behavior.execute(language, index, context);
    }
    throw new Error(`Unknown behavior: ${behaviorName}`);
  }
  
  registerDefaultBehaviors() {
    // 默认跳转行为
    this.registerBehavior(new JumpBehavior(
      'scroll',
      (language, index, context) => {
        const lineNumber = findCodeBlockByLanguageAndIndex(language, index);
        if (lineNumber) {
          throttledScrollToLine(lineNumber);
          return true;
        }
        return false;
      }
    ));
    
    // 高亮行为
    this.registerBehavior(new JumpBehavior(
      'highlight',
      (language, index, context) => {
        const element = getCachedElement(`[data-language="${language}"][data-index="${index}"]`);
        if (element) {
          const highlight = createOrReuseHighlight(element);
          setTimeout(() => {
            highlight.classList.add('fade-out');
          }, 2000);
          return true;
        }
        return false;
      }
    ));
  }
}
```

## 总结

### 核心特性

基于 `docs/features/跳转节点解析与工作原理.md` 的完整实现，Miaogu NotePad 的 tree-view 系统具备以下核心特性：

#### 1. 灵活的语法支持
- **四种跳转语法模式**：显式索引、递增模式、跳跃递增、同索引复用
- **智能解析引擎**：优先级匹配、自动索引计算、标题清理
- **插件化扩展**：支持自定义语法插件和解析规则

#### 2. 智能索引管理
- **lastJumpIndex 机制**：自动跟踪和计算跳转索引
- **语言分组管理**：按编程语言独立管理索引计数
- **索引重置策略**：支持显式重置和自动重置

#### 3. 精确的DOM操作
- **缓存查询系统**：避免重复DOM查询，提升性能
- **平滑滚动控制**：节流机制防止频繁滚动操作
- **高亮效果复用**：复用高亮元素，减少DOM创建开销

#### 4. 优秀的用户体验
- **视觉反馈系统**：跳转高亮、渐隐效果、错误提示
- **主题适配支持**：明暗主题切换、CSS变量系统
- **响应式设计**：适配不同屏幕尺寸和设备类型

#### 5. 高性能优化
- **虚拟滚动**：支持大数据量树结构渲染
- **懒加载策略**：按需加载节点，减少初始渲染开销
- **LRU缓存**：智能缓存解析结果，避免重复计算

#### 6. 强扩展性
- **插件化架构**：支持自定义跳转语法和行为
- **行为管理器**：可扩展的跳转行为系统
- **组件化设计**：模块化组件便于维护和扩展

### 技术特点

#### 解析引擎
- 基于正则表达式的高效文本解析
- 优先级匹配确保语法解析的准确性
- 支持嵌套结构和复杂树形数据

#### 渲染系统
- React Hooks 驱动的状态管理
- 虚拟滚动支持大数据量渲染
- Intersection Observer 实现懒加载

#### 交互机制
- 平滑滚动和视觉反馈
- 键盘快捷键支持
- 拖拽排序和编辑功能

#### 样式系统
- CSS变量驱动的主题系统
- 响应式布局和动画效果
- 无障碍访问支持

### 应用场景

1. **代码文档导航**：快速跳转到相关代码块
2. **项目结构展示**：可视化项目文件和目录结构
3. **知识库管理**：组织和导航复杂的文档结构
4. **教学演示**：代码教学中的章节跳转
5. **API文档**：接口文档的快速导航

### 未来扩展方向

1. **AI辅助解析**：集成AI模型自动生成跳转节点
2. **协作功能**：多人实时编辑和同步
3. **版本控制**：集成Git等版本控制系统
4. **插件生态**：开发更多语法和行为插件
5. **性能优化**：进一步优化大数据量处理能力

通过这套完整的 tree-view 实现系统，Miaogu NotePad 为用户提供了强大而灵活的文档导航和代码跳转功能，大大提升了开发和文档编写的效率。
  onJumpToCode?.(language, index);
}, [onJumpToCode]);
```

## 错误处理

### 1. 解析错误处理

```javascript
const parseTreeText = (text, rootTitle) => {
  try {
    // 解析逻辑
    return parsedData;
  } catch (error) {
    console.error('树状图解析失败:', error);
    return {
      key: 'error',
      title: '解析失败',
      children: [{
        key: 'error-detail',
        title: error.message,
        isError: true
      }]
    };
  }
};
```

### 2. 渲染错误边界

```javascript
class TreeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TreeViewer渲染错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="tree-error-container">
          <div className="tree-error-content">
            <p>树状图渲染失败</p>
            <p>{this.state.error?.message}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 扩展功能

### 1. 导出功能

#### PNG导出

```javascript
import { exportTreeToPNG } from '../utils/exportUtils';

const handleExportPNG = async () => {
  const treeElement = treeRef.current;
  if (!treeElement) return;

  try {
    const result = await exportTreeToPNG(treeElement, {
      backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
      scale: 2, // 高清导出
      quality: 0.9
    });
    
    if (result.success) {
      message.success('导出成功');
    } else {
      message.error(`导出失败: ${result.message}`);
    }
  } catch (error) {
    console.error('导出PNG失败:', error);
    message.error('导出失败');
  }
};
```

### 2. 搜索功能

```javascript
const useTreeSearch = (treeData) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState(treeData);

  const searchTree = useCallback((nodes, term) => {
    if (!term) return nodes;

    return nodes.filter(node => {
      const matchesSearch = node.title.toLowerCase().includes(term.toLowerCase());
      const hasMatchingChildren = node.children && 
        searchTree(node.children, term).length > 0;

      if (matchesSearch || hasMatchingChildren) {
        return {
          ...node,
          children: hasMatchingChildren ? searchTree(node.children, term) : node.children
        };
      }
      return false;
    }).filter(Boolean);
  }, []);

  useEffect(() => {
    const filtered = searchTree(treeData, searchTerm);
    setFilteredData(filtered);
  }, [treeData, searchTerm, searchTree]);

  return { searchTerm, setSearchTerm, filteredData };
};
```

## 最佳实践

### 1. 性能建议

- **数据量控制**: 单个树文件建议不超过1000个节点
- **层级限制**: 建议树深度不超过10层
- **状态持久化**: 合理使用localStorage，避免存储过大数据
- **内存管理**: 及时清理不需要的状态和监听器

### 2. 用户体验

- **加载状态**: 提供清晰的加载指示器
- **错误提示**: 友好的错误信息和恢复建议
- **键盘支持**: 支持方向键导航和快捷键操作
- **无障碍访问**: 提供适当的ARIA标签和语义化结构

### 3. 开发建议

- **组件解耦**: 保持TreeViewer和TreeEditor的独立性
- **类型安全**: 使用TypeScript或PropTypes进行类型检查
- **测试覆盖**: 编写单元测试和集成测试
- **文档维护**: 保持API文档和使用示例的更新

## 总结

树状图实现方案通过精心设计的解析引擎、组件架构和交互机制，为用户提供了强大而灵活的知识结构可视化工具。该方案具有以下优势：

1. **功能完整**: 支持查看、编辑、跳转、导出等全方位功能
2. **性能优秀**: 通过虚拟滚动、懒加载等技术保证大数据量下的流畅体验
3. **用户友好**: 直观的交互设计和丰富的视觉反馈
4. **扩展性强**: 模块化设计便于功能扩展和定制
5. **主题适配**: 完美支持明暗主题切换

这套实现方案为喵咕记事本的知识管理功能提供了坚实的技术基础。