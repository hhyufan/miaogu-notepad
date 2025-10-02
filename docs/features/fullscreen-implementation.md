# 全屏实现方案

## 概述

本项目实现了基于 F11 键的全屏模式功能，提供沉浸式的编辑体验。全屏模式通过隐藏应用标题栏、进入系统全屏状态，并配合防休眠机制，为用户提供专注的工作环境。

## 核心架构

### 1. 前端组件架构

```
App.jsx (主控制器)
├── 全屏状态管理 (isHeaderVisible)
├── F11 键盘事件监听
├── Tauri API 调用
└── 样式类名控制

AppHeader.jsx (标题栏组件)
├── 条件渲染控制
└── 窗口控制按钮

App.scss (样式系统)
├── .fullscreen-mode 样式类
├── 高度补偿计算
└── 主题适配
```

### 2. 后端 API 架构

```
lib.rs (Rust 后端)
├── enable_prevent_sleep (启用防休眠)
├── disable_prevent_sleep (禁用防休眠)
├── get_prevent_sleep_status (获取状态)
└── Windows API 集成
```

## 技术实现详解

### 1. 前端全屏控制

#### 状态管理

```javascript
// App.jsx - 全屏状态管理
const [isHeaderVisible, setIsHeaderVisible] = useState(true);

// 全屏模式样式类控制
className = {`app-layout ${!isHeaderVisible ? 'fullscreen-mode' : ''}`
}
```

#### F11 键盘事件处理

```javascript
// F11键切换全屏模式
useEffect(() => {
  const handleKeyDown = async (event) => {
    if (event.key === 'F11') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const newHeaderVisible = !isHeaderVisible;
      setIsHeaderVisible(newHeaderVisible);

      // Tauri 环境检测
      if (typeof window !== 'undefined' && window['__TAURI_INTERNALS__']) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();

          if (newHeaderVisible) {
            // 退出全屏模式
            await appWindow.setFullscreen(false);
            await invoke('disable_prevent_sleep');
          } else {
            // 进入全屏模式
            await appWindow.setFullscreen(true);
            await invoke('enable_prevent_sleep');
          }
        } catch (error) {
          console.error('F11全屏切换失败:', error);
        }
      }
    }
  };

  // 使用捕获阶段监听，确保优先处理
  document.addEventListener('keydown', handleKeyDown, true);
  return () => {
    document.removeEventListener('keydown', handleKeyDown, true);
  };
}, [isHeaderVisible]);
```

#### 窗口状态监控

```javascript
// 监听窗口状态变化，自动同步 Header 显示状态
const checkWindowState = async () => {
  if (typeof window !== 'undefined' && window['__TAURI_INTERNALS__']) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      const isFullscreen = await appWindow.isFullscreen();

      // 如果窗口不是全屏状态但 Header 被隐藏，则显示 Header
      if (!isHeaderVisible && !isFullscreen) {
        setIsHeaderVisible(true);
      }
    } catch (error) {
      console.error('检查窗口状态失败:', error);
    }
  }
};

// 定期检查窗口状态（500ms 间隔）
const intervalId = setInterval(checkWindowState, 500);
```

### 2. 样式系统实现

#### 全屏模式样式

```scss
// App.scss - 全屏模式样式
.app-layout {
  &.fullscreen-mode {
    // 背景适配
    background-color: var(--editor-background) !important;

    // 主题切换时背景更新
    &[data-theme="dark"].has-background::before {
      background-color: var(--editor-background-dark) !important;
    }

    &[data-theme="light"].has-background::before {
      background-color: var(--editor-background-light) !important;
    }

    // 高度补偿 - 补偿隐藏的 AppHeader 高度
    .app-content {
      height: calc(100vh - var(--tab-bar-height)) !important;

      &.with-console {
        height: calc(100vh - var(--tab-bar-height) - var(--console-layout-height)) !important;
      }
    }

    .main-layout {
      height: calc(100vh - var(--tab-bar-height)) !important;
    }

    .code-editor-container {
      height: calc(100vh - var(--tab-bar-height) - 24px) !important;
    }
  }
}
```

#### CSS 变量定义

```scss
:root {
  --header-height: 40px;
  --tab-bar-height: 40px;
  --console-layout-height: 200px;
  --editor-background: var(--background-color);
  --editor-background-dark: rgba(30, 30, 30, 0.95);
  --editor-background-light: rgba(255, 255, 255, 0.95);
}
```

### 3. 后端防休眠实现

#### Windows API 集成

```rust
// lib.rs - Windows API 导入
#[cfg(windows)]
use windows_sys::Win32::System::Power::{
    SetThreadExecutionState, 
    ES_CONTINUOUS, 
    ES_DISPLAY_REQUIRED, 
    ES_SYSTEM_REQUIRED,
};

// 全局状态管理
static PREVENT_SLEEP_ENABLED: Lazy<Arc<Mutex<bool>>> = 
    Lazy::new(|| Arc::new(Mutex::new(false)));
```

#### 防休眠功能实现

```rust
/// 启用防休眠模式
#[tauri::command]
async fn enable_prevent_sleep() -> Result<String, String> {
    #[cfg(windows)]
    {
        unsafe {
            let result = SetThreadExecutionState(
                ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED
            );
            
            if result != 0 {
                // 更新全局状态
                if let Ok(mut enabled) = PREVENT_SLEEP_ENABLED.lock() {
                    *enabled = true;
                }
                Ok("防休眠模式已启用".to_string())
            } else {
                Err("启用防休眠模式失败".to_string())
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        Err("当前平台不支持防休眠功能".to_string())
    }
}

/// 禁用防休眠模式
#[tauri::command]
async fn disable_prevent_sleep() -> Result<String, String> {
    #[cfg(windows)]
    {
        unsafe {
            let result = SetThreadExecutionState(ES_CONTINUOUS);
            
            if result != 0 {
                if let Ok(mut enabled) = PREVENT_SLEEP_ENABLED.lock() {
                    *enabled = false;
                }
                Ok("防休眠模式已禁用".to_string())
            } else {
                Err("禁用防休眠模式失败".to_string())
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        Err("当前平台不支持防休眠功能".to_string())
    }
}

/// 获取防休眠状态
#[tauri::command]
async fn get_prevent_sleep_status() -> Result<bool, String> {
    match PREVENT_SLEEP_ENABLED.lock() {
        Ok(enabled) => Ok(*enabled),
        Err(_) => Err("获取防休眠状态失败".to_string()),
    }
}
```

### 4. Tauri 配置

#### 窗口权限配置

```json
// tauri.conf.json - 窗口配置
{
  "app": {
    "windows": [
      {
        "title": "喵咕记事本",
        "decorations": false,
        // 无边框窗口
        "transparent": true,
        // 透明窗口
        "resizable": true,
        "maximizable": true
      }
    ]
  }
}
```

#### API 权限配置

```json
// capabilities/default.json - API 权限
{
  "permissions": [
    "core:window:allow-set-fullscreen",
    "core:window:allow-is-fullscreen"
  ]
}
```

## 功能特性

### 1. 智能全屏切换

- **F11 快捷键**: 一键进入/退出全屏模式
- **状态同步**: 自动检测窗口状态变化
- **优雅降级**: 非 Tauri 环境下仍可正常工作

### 2. 界面适配

- **标题栏隐藏**: 全屏时自动隐藏 AppHeader
- **高度补偿**: 自动调整编辑器和内容区域高度
- **主题适配**: 支持明暗主题下的全屏模式

### 3. 防休眠机制

- **系统级防休眠**: 防止系统进入休眠状态
- **显示器保持**: 防止显示器自动关闭
- **状态管理**: 全局状态跟踪和管理

### 4. 性能优化

- **事件捕获**: 使用捕获阶段确保 F11 事件优先处理
- **防抖处理**: 避免频繁的状态切换
- **异步处理**: 非阻塞的 API 调用

## 错误处理

### 1. API 调用错误

```javascript
// 优雅的错误处理
try {
  await invoke('enable_prevent_sleep');
} catch (error) {
  console.warn('防止休眠失败:', error);
  // 不影响全屏功能的正常使用
}
```

### 2. 平台兼容性

```rust
// 平台特定功能
#[cfg(windows)]
{
    // Windows 特定实现
}

#[cfg(not(windows))]
{
    // 其他平台的降级处理
    Err("当前平台不支持防休眠功能".to_string())
}
```

### 3. 环境检测

```javascript
// Tauri 环境检测
if (typeof window !== 'undefined' && window['__TAURI_INTERNALS__']) {
  // Tauri 环境下的实现
} else {
  // Web 环境下的降级处理
}
```

## 扩展功能

### 1. 自定义全屏行为

```javascript
// 可扩展的全屏配置
const fullscreenConfig = {
  hideHeader: true,           // 是否隐藏标题栏
  preventSleep: true,         // 是否防止休眠
  hideTaskbar: true,          // 是否隐藏任务栏
  adjustLayout: true          // 是否调整布局
};
```

### 2. 全屏状态持久化

```javascript
// 全屏状态可以持久化存储
const saveFullscreenState = async (isFullscreen) => {
  await persistenceManager.saveSetting('fullscreenState', {
    isFullscreen,
    timestamp: Date.now()
  });
};
```

### 3. 多显示器支持

```javascript
// 未来可扩展多显示器全屏支持
const handleMultiMonitorFullscreen = async (monitorIndex) => {
  // 指定显示器全屏实现
};
```

## 最佳实践

### 1. 性能优化

- **事件监听优化**: 使用捕获阶段监听，避免事件冲突
- **状态检查频率**: 合理设置窗口状态检查间隔
- **内存管理**: 及时清理事件监听器和定时器

### 2. 用户体验

- **平滑过渡**: 全屏切换时提供视觉反馈
- **状态提示**: 显示当前全屏状态
- **快捷键提示**: 在界面中提示 F11 快捷键

### 3. 开发建议

- **环境检测**: 始终检测 Tauri 环境可用性
- **错误处理**: 提供优雅的错误降级
- **平台适配**: 考虑不同操作系统的差异

## 总结

本项目的全屏实现方案通过前后端协同，实现了完整的全屏功能：

- **前端负责**: UI 状态管理、键盘事件处理、样式适配
- **后端负责**: 系统级全屏控制、防休眠机制
- **协同工作**: 通过 Tauri API 实现前后端通信

该方案具有以下优势：

1. **功能完整**: 支持真正的系统级全屏
2. **体验优秀**: 平滑的切换动画和状态同步
3. **性能优化**: 高效的事件处理和状态管理
4. **兼容性好**: 支持多平台和环境降级
5. **扩展性强**: 易于添加新功能和自定义配置

通过这套全屏实现方案，用户可以获得专业级的沉浸式编辑体验。
