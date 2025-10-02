# 后端架构设计

## 概述

喵咕记事本的后端基于Tauri框架，使用Rust语言开发，提供高性能的系统级服务。后端架构采用模块化设计，通过Tauri的IPC机制与前端通信，实现文件操作、系统集成、文件监控等核心功能。

## 技术栈详解

### 核心框架与库

| 技术 | 版本 | 职责 | 选择理由 |
|------|------|------|----------|
| **Tauri** | 2.1.1 | 应用框架 | 轻量级、安全、跨平台桌面应用框架 |
| **Rust** | 1.70+ | 系统编程语言 | 内存安全、高性能、零成本抽象 |
| **Serde** | 1.0 | 序列化框架 | JSON序列化/反序列化，类型安全 |
| **Tokio** | 1.0 | 异步运行时 | 高性能异步I/O处理 |
| **Notify** | 6.1 | 文件监控 | 跨平台文件系统事件监控 |
| **Encoding RS** | 0.8 | 字符编码 | Mozilla的字符编码检测和转换库 |
| **Once Cell** | 1.19 | 全局状态 | 线程安全的全局状态管理 |

### Tauri插件生态

| 插件 | 版本 | 功能 | 用途 |
|------|------|------|------|
| **tauri-plugin-opener** | 2.0 | 文件打开 | 使用系统默认程序打开文件 |
| **tauri-plugin-fs** | 2.0 | 文件系统 | 文件读写、目录操作 |
| **tauri-plugin-dialog** | 2.0 | 系统对话框 | 文件选择、保存对话框 |
| **tauri-plugin-store** | 2.0 | 数据存储 | 应用配置和状态持久化 |
| **tauri-plugin-shell** | 2.0 | 系统命令 | 执行系统命令和脚本 |
| **tauri-plugin-http** | 2.0 | HTTP客户端 | 网络请求和API调用 |

## 架构设计模式

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 (React/WebView)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   UI Components │  │   State Manager │  │   Event Handler │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼ IPC (JSON-RPC)
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Core (Rust)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Command Router │  │  Plugin Manager │  │  Event Emitter  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    业务逻辑层 (Business Layer)               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  File Commands  │  │  System Commands│  │  Watch Commands │ │
│  │  (文件操作)     │  │  (系统集成)     │  │  (文件监控)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    服务层 (Service Layer)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  File Service   │  │  Encoding Svc   │  │  Monitor Svc    │ │
│  │  (文件服务)     │  │  (编码服务)     │  │  (监控服务)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    系统层 (System Layer)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   File System   │  │   Process Mgmt  │  │   OS APIs       │ │
│  │   (文件系统)    │  │   (进程管理)    │  │   (系统API)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 层次职责说明

#### 1. Tauri Core Layer
- **Command Router**: 路由前端命令到对应的处理函数
- **Plugin Manager**: 管理Tauri插件的生命周期
- **Event Emitter**: 向前端发送事件和通知

#### 2. Business Logic Layer
- **File Commands**: 文件读写、重命名、删除等操作
- **System Commands**: 系统集成功能，如打开终端、文件管理器
- **Watch Commands**: 文件监控和变化通知

#### 3. Service Layer
- **File Service**: 文件操作的核心业务逻辑
- **Encoding Service**: 字符编码检测和转换
- **Monitor Service**: 文件系统监控服务

#### 4. System Layer
- **File System**: 操作系统文件系统接口
- **Process Management**: 进程创建和管理
- **OS APIs**: 操作系统特定的API调用

## 核心模块设计

### 1. 应用入口 (main.rs)

**职责**: 应用程序启动入口

```rust
/*!
 * @fileoverview Tauri应用程序入口点
 * 喵咕记事本 - 基于Tauri的跨平台文本编辑器
 */

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    miaogu_notepad_lib::run()
}
```

**特性**:
- 生产环境隐藏控制台窗口
- 委托给库模块处理应用逻辑
- 简洁的入口点设计

### 2. 核心库 (lib.rs)

**职责**: 应用核心逻辑和命令处理

#### 2.1 数据结构定义

```rust
/// 文件信息结构体
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileInfo {
    pub name: String,        // 文件名
    pub path: String,        // 完整路径
    pub size: u64,          // 文件大小（字节）
    pub is_file: bool,      // 是否为文件
    pub is_dir: bool,       // 是否为目录
    pub modified: u64,      // 最后修改时间（时间戳）
}

/// 文件操作结果
#[derive(Serialize, Deserialize, Debug)]
pub struct FileOperationResult {
    pub success: bool,              // 操作是否成功
    pub message: String,            // 结果消息
    pub content: Option<String>,    // 文件内容（可选）
    pub file_path: Option<String>,  // 文件路径（可选）
    pub file_name: Option<String>,  // 文件名（可选）
    pub encoding: Option<String>,   // 文件编码（可选）
    pub line_ending: Option<String>, // 行尾格式（可选）
}

/// 文件变化事件
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileChangeEvent {
    pub file_path: String,    // 文件路径
    pub event_type: String,   // 事件类型
    pub timestamp: u64,       // 事件时间戳
}
```

#### 2.2 全局状态管理

```rust
use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

// 文件监控器全局状态
static FILE_WATCHERS: Lazy<Arc<Mutex<HashMap<String, notify::RecommendedWatcher>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// 防休眠状态
static PREVENT_SLEEP_ENABLED: Lazy<Arc<Mutex<bool>>> = 
    Lazy::new(|| Arc::new(Mutex::new(false)));

// 文件变化缓存
static FILE_CHANGE_CACHE: Lazy<Arc<Mutex<HashMap<String, u64>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));
```

**设计特点**:
- 使用`once_cell::sync::Lazy`实现线程安全的全局状态
- `Arc<Mutex<T>>`提供多线程安全的共享状态
- 分离不同功能的状态管理

### 3. 文件操作模块

#### 3.1 文件读取 (read_file_content)

**功能**: 读取文件内容并自动检测编码

```rust
#[tauri::command]
async fn read_file_content(path: String) -> Result<FileOperationResult, String> {
    // 1. 读取文件字节数据
    let bytes = fs::read(&path).map_err(|e| format!("读取文件失败: {}", e))?;
    
    // 2. 检测文件编码
    let (encoding, content, _) = encoding_rs::Encoding::for_bom(&bytes)
        .unwrap_or((encoding_rs::UTF_8, &bytes[..]))
        .0.decode(&bytes);
    
    // 3. 检测行尾格式
    let line_ending = detect_line_ending(&content);
    
    // 4. 构建返回结果
    Ok(FileOperationResult {
        success: true,
        message: "文件读取成功".to_string(),
        content: Some(content.to_string()),
        file_path: Some(path.clone()),
        file_name: Some(Path::new(&path).file_name()
            .unwrap_or_default().to_string_lossy().to_string()),
        encoding: Some(encoding.name().to_string()),
        line_ending: Some(line_ending),
    })
}
```

**核心特性**:
- **自动编码检测**: 支持UTF-8、UTF-16、GBK、GB2312等多种编码
- **BOM处理**: 正确处理字节顺序标记
- **行尾检测**: 自动识别LF、CRLF、CR行尾格式
- **错误处理**: 详细的错误信息和异常处理

#### 3.2 文件写入 (write_file_content)

**功能**: 写入文件内容并保持编码格式

```rust
#[tauri::command]
async fn write_file_content(
    path: String, 
    content: String, 
    encoding: Option<String>
) -> Result<FileOperationResult, String> {
    // 1. 确定目标编码
    let target_encoding = encoding.as_deref().unwrap_or("UTF-8");
    
    // 2. 编码转换
    let encoded_bytes = match target_encoding {
        "UTF-8" => content.as_bytes().to_vec(),
        "UTF-16LE" => encoding_rs::UTF_16LE.encode(&content).0.to_vec(),
        "GBK" => encoding_rs::GBK.encode(&content).0.to_vec(),
        _ => content.as_bytes().to_vec(),
    };
    
    // 3. 写入文件
    fs::write(&path, encoded_bytes)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    
    Ok(FileOperationResult {
        success: true,
        message: "文件保存成功".to_string(),
        file_path: Some(path),
        encoding: Some(target_encoding.to_string()),
        ..Default::default()
    })
}
```

#### 3.3 目录操作 (get_directory_contents)

**功能**: 获取目录内容列表

```rust
#[tauri::command]
async fn get_directory_contents(path: String) -> Result<Vec<FileInfo>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("读取目录失败: {}", e))?;
    
    let mut file_infos = Vec::new();
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let metadata = entry.metadata()
            .map_err(|e| format!("获取文件信息失败: {}", e))?;
        
        let file_info = FileInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            size: metadata.len(),
            is_file: metadata.is_file(),
            is_dir: metadata.is_dir(),
            modified: metadata.modified()
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };
        
        file_infos.push(file_info);
    }
    
    // 排序：目录在前，文件在后，同类型按名称排序
    file_infos.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });
    
    Ok(file_infos)
}
```

### 4. 系统集成模块

#### 4.1 文件执行 (execute_file)

**功能**: 使用系统默认程序打开文件

```rust
#[tauri::command]
async fn execute_file(file_path: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &file_path])
            .spawn()
            .map_err(|e| format!("执行文件失败: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("执行文件失败: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("执行文件失败: {}", e))?;
    }
    
    Ok("文件执行成功".to_string())
}
```

#### 4.2 终端打开 (open_in_terminal)

**功能**: 在系统终端中打开指定路径

```rust
#[tauri::command]
async fn open_in_terminal(path: String) -> Result<String, String> {
    let dir_path = if Path::new(&path).is_file() {
        Path::new(&path).parent()
            .ok_or("无法获取父目录")?
            .to_string_lossy()
            .to_string()
    } else {
        path
    };
    
    #[cfg(target_os = "windows")]
    {
        Command::new("powershell")
            .args(["-Command", &format!("cd '{}'; powershell", dir_path)])
            .spawn()
            .map_err(|e| format!("打开终端失败: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Terminal", &dir_path])
            .spawn()
            .map_err(|e| format!("打开终端失败: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("gnome-terminal")
            .args(["--working-directory", &dir_path])
            .spawn()
            .map_err(|e| format!("打开终端失败: {}", e))?;
    }
    
    Ok("终端打开成功".to_string())
}
```

#### 4.3 文件管理器打开 (show_in_explorer)

**功能**: 在文件管理器中显示文件

```rust
#[tauri::command]
async fn show_in_explorer(path: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("打开Finder失败: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        let dir_path = if Path::new(&path).is_file() {
            Path::new(&path).parent().unwrap_or(Path::new("/"))
        } else {
            Path::new(&path)
        };
        
        Command::new("nautilus")
            .arg(dir_path)
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {}", e))?;
    }
    
    Ok("文件管理器打开成功".to_string())
}
```

### 5. 文件监控模块

#### 5.1 开始监控 (start_file_watching)

**功能**: 开始监控文件变化

```rust
#[tauri::command]
async fn start_file_watching(
    app_handle: AppHandle, 
    file_path: String
) -> Result<bool, String> {
    use notify::{Watcher, RecursiveMode, Event, EventKind};
    
    let path_clone = file_path.clone();
    let app_handle_clone = app_handle.clone();
    
    // 创建文件监控器
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                if let EventKind::Modify(_) = event.kind {
                    for path in event.paths {
                        if path.to_string_lossy() == path_clone {
                            let change_event = FileChangeEvent {
                                file_path: path_clone.clone(),
                                event_type: "modified".to_string(),
                                timestamp: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                            };
                            
                            // 发送事件到前端
                            let _ = app_handle_clone.emit("file-changed", &change_event);
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("文件监控错误: {:?}", e);
            }
        }
    }).map_err(|e| format!("创建文件监控器失败: {}", e))?;
    
    // 开始监控文件
    watcher.watch(Path::new(&file_path), RecursiveMode::NonRecursive)
        .map_err(|e| format!("开始文件监控失败: {}", e))?;
    
    // 存储监控器到全局状态
    {
        let mut watchers = FILE_WATCHERS.lock().unwrap();
        watchers.insert(file_path, watcher);
    }
    
    Ok(true)
}
```

#### 5.2 停止监控 (stop_file_watching)

**功能**: 停止文件监控

```rust
#[tauri::command]
async fn stop_file_watching(file_path: String) -> Result<bool, String> {
    let mut watchers = FILE_WATCHERS.lock().unwrap();
    
    if watchers.remove(&file_path).is_some() {
        Ok(true)
    } else {
        Err("未找到对应的文件监控器".to_string())
    }
}
```

### 6. 系统电源管理

#### 6.1 防休眠功能

**功能**: 防止系统进入休眠状态

```rust
#[cfg(windows)]
use windows_sys::Win32::System::Power::{
    SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
};

#[tauri::command]
async fn enable_prevent_sleep() -> Result<bool, String> {
    #[cfg(windows)]
    {
        unsafe {
            let result = SetThreadExecutionState(
                ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED
            );
            
            if result != 0 {
                let mut enabled = PREVENT_SLEEP_ENABLED.lock().unwrap();
                *enabled = true;
                Ok(true)
            } else {
                Err("启用防休眠失败".to_string())
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        // 其他平台的实现
        Ok(true)
    }
}

#[tauri::command]
async fn disable_prevent_sleep() -> Result<bool, String> {
    #[cfg(windows)]
    {
        unsafe {
            let result = SetThreadExecutionState(ES_CONTINUOUS);
            
            if result != 0 {
                let mut enabled = PREVENT_SLEEP_ENABLED.lock().unwrap();
                *enabled = false;
                Ok(true)
            } else {
                Err("禁用防休眠失败".to_string())
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        Ok(true)
    }
}
```

### 7. 命令行参数处理

#### 7.1 获取命令行参数 (get_cli_args)

**功能**: 获取并处理命令行参数

```rust
#[tauri::command]
async fn get_cli_args() -> Result<Vec<String>, String> {
    let args: Vec<String> = std::env::args().collect();
    
    // 过滤掉Tauri开发模式的参数
    let filtered_args: Vec<String> = args.into_iter()
        .skip(1) // 跳过程序路径
        .filter(|arg| {
            // 过滤掉Tauri开发模式的参数
            !arg.starts_with("--no-default-features") &&
            !arg.starts_with("--color") &&
            arg != "--" &&
            !arg.is_empty()
        })
        .map(|arg| {
            // 将相对路径转换为绝对路径
            let path = Path::new(&arg);
            
            if path.is_relative() {
                match std::env::current_dir() {
                    Ok(current_dir) => {
                        let absolute_path = current_dir.join(path);
                        absolute_path.to_string_lossy().to_string()
                    },
                    Err(_) => arg
                }
            } else {
                arg
            }
        })
        .collect();
    
    Ok(filtered_args)
}
```

## Tauri配置架构

### 1. 应用配置 (tauri.conf.json)

#### 1.1 基本信息配置

```json
{
  "productName": "喵咕记事本",
  "version": "1.3.0",
  "identifier": "com.miaogu.notepad",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  }
}
```

#### 1.2 窗口配置

```json
{
  "app": {
    "windows": [
      {
        "title": "喵咕记事本",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "maximizable": true,
        "minimizable": true,
        "closable": true,
        "transparent": false,
        "alwaysOnTop": false,
        "decorations": true,
        "dragDropEnabled": true,
        "devtools": true
      }
    ]
  }
}
```

#### 1.3 安全配置

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      }
    }
  }
}
```

#### 1.4 文件关联配置

```json
{
  "bundle": {
    "fileAssociations": [
      {
        "ext": ["txt", "md", "js", "json", "html", "css", "py", "xml", "log", "cfg", "ini"],
        "name": "Text File",
        "description": "Text file supported by 喵咕记事本"
      }
    ]
  }
}
```

### 2. 插件配置

#### 2.1 文件系统插件

```json
{
  "plugins": {
    "fs": {
      "scope": ["**"]
    }
  }
}
```

#### 2.2 对话框插件

```json
{
  "plugins": {
    "dialog": {
      "open": true,
      "save": true,
      "message": true,
      "ask": true,
      "confirm": true
    }
  }
}
```

#### 2.3 Shell插件

```json
{
  "plugins": {
    "shell": {
      "open": true,
      "scope": [
        {
          "name": "open-file",
          "cmd": "open",
          "args": ["$FILE"]
        }
      ]
    }
  }
}
```

## IPC通信架构

### 1. 命令调用模式

#### 1.1 前端调用后端

```javascript
// 前端代码
import { invoke } from '@tauri-apps/api/core';

// 调用后端命令
const result = await invoke('read_file_content', {
  path: '/path/to/file.txt'
});
```

#### 1.2 后端命令定义

```rust
// 后端代码
#[tauri::command]
async fn read_file_content(path: String) -> Result<FileOperationResult, String> {
    // 命令实现
}
```

### 2. 事件发送模式

#### 2.1 后端发送事件

```rust
// 后端发送事件到前端
let change_event = FileChangeEvent {
    file_path: path.clone(),
    event_type: "modified".to_string(),
    timestamp: SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs(),
};

app_handle.emit("file-changed", &change_event)?;
```

#### 2.2 前端监听事件

```javascript
// 前端监听后端事件
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen('file-changed', (event) => {
  console.log('文件已变化:', event.payload);
});
```

### 3. 数据序列化

#### 3.1 Serde序列化

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}
```

#### 3.2 JSON通信协议

```json
{
  "success": true,
  "data": {
    "content": "文件内容",
    "encoding": "UTF-8",
    "line_ending": "LF"
  },
  "error": null
}
```

## 错误处理架构

### 1. 错误类型定义

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("文件操作错误: {0}")]
    FileError(#[from] std::io::Error),
    
    #[error("编码转换错误: {0}")]
    EncodingError(String),
    
    #[error("系统调用错误: {0}")]
    SystemError(String),
    
    #[error("配置错误: {0}")]
    ConfigError(String),
}
```

### 2. 错误传播机制

```rust
#[tauri::command]
async fn safe_file_operation(path: String) -> Result<String, String> {
    // 使用 ? 操作符进行错误传播
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    // 业务逻辑处理
    process_content(&content)
        .map_err(|e| format!("处理内容失败: {}", e))?;
    
    Ok("操作成功".to_string())
}
```

### 3. 全局错误处理

```rust
// 在应用初始化时设置全局错误处理
pub fn run() {
    std::panic::set_hook(Box::new(|panic_info| {
        eprintln!("应用崩溃: {:?}", panic_info);
        // 可以在这里添加崩溃报告逻辑
    }));
    
    let builder = tauri::Builder::default();
    // ... 其他配置
}
```

## 性能优化策略

### 1. 异步处理

#### 1.1 Tokio异步运行时

```rust
#[tauri::command]
async fn async_file_operation(path: String) -> Result<String, String> {
    // 使用tokio进行异步文件操作
    let content = tokio::fs::read_to_string(&path).await
        .map_err(|e| format!("异步读取失败: {}", e))?;
    
    // 异步处理
    let processed = tokio::task::spawn_blocking(move || {
        // CPU密集型任务在独立线程中执行
        heavy_computation(&content)
    }).await
    .map_err(|e| format!("任务执行失败: {}", e))?;
    
    Ok(processed)
}
```

#### 1.2 并发文件操作

```rust
use tokio::task::JoinSet;

#[tauri::command]
async fn batch_file_operation(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut join_set = JoinSet::new();
    
    // 并发处理多个文件
    for path in paths {
        join_set.spawn(async move {
            tokio::fs::read_to_string(&path).await
        });
    }
    
    let mut results = Vec::new();
    while let Some(result) = join_set.join_next().await {
        match result {
            Ok(Ok(content)) => results.push(content),
            Ok(Err(e)) => return Err(format!("文件读取失败: {}", e)),
            Err(e) => return Err(format!("任务执行失败: {}", e)),
        }
    }
    
    Ok(results)
}
```

### 2. 内存优化

#### 2.1 流式文件处理

```rust
use tokio::io::{AsyncBufReadExt, BufReader};

#[tauri::command]
async fn stream_large_file(path: String) -> Result<String, String> {
    let file = tokio::fs::File::open(&path).await
        .map_err(|e| format!("打开文件失败: {}", e))?;
    
    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    let mut line_count = 0;
    
    // 流式处理，不将整个文件加载到内存
    while let Some(line) = lines.next_line().await
        .map_err(|e| format!("读取行失败: {}", e))? {
        line_count += 1;
        
        // 处理每一行
        if line_count % 1000 == 0 {
            // 定期让出控制权
            tokio::task::yield_now().await;
        }
    }
    
    Ok(format!("处理了 {} 行", line_count))
}
```

#### 2.2 缓存机制

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// 文件内容缓存
static FILE_CACHE: Lazy<Arc<RwLock<HashMap<String, (String, u64)>>>> = 
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

#[tauri::command]
async fn cached_read_file(path: String) -> Result<String, String> {
    // 获取文件修改时间
    let metadata = tokio::fs::metadata(&path).await
        .map_err(|e| format!("获取文件信息失败: {}", e))?;
    
    let modified = metadata.modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    // 检查缓存
    {
        let cache = FILE_CACHE.read().await;
        if let Some((content, cached_time)) = cache.get(&path) {
            if *cached_time >= modified {
                return Ok(content.clone());
            }
        }
    }
    
    // 读取文件并更新缓存
    let content = tokio::fs::read_to_string(&path).await
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    {
        let mut cache = FILE_CACHE.write().await;
        cache.insert(path, (content.clone(), modified));
    }
    
    Ok(content)
}
```

### 3. 系统资源优化

#### 3.1 文件句柄管理

```rust
use std::sync::atomic::{AtomicUsize, Ordering};

// 跟踪打开的文件句柄数量
static OPEN_FILE_COUNT: AtomicUsize = AtomicUsize::new(0);

struct ManagedFile {
    file: tokio::fs::File,
}

impl ManagedFile {
    async fn open(path: &str) -> Result<Self, std::io::Error> {
        let current_count = OPEN_FILE_COUNT.load(Ordering::Relaxed);
        if current_count > 100 {  // 限制最大文件句柄数
            return Err(std::io::Error::new(
                std::io::ErrorKind::ResourceBusy,
                "Too many open files"
            ));
        }
        
        let file = tokio::fs::File::open(path).await?;
        OPEN_FILE_COUNT.fetch_add(1, Ordering::Relaxed);
        
        Ok(ManagedFile { file })
    }
}

impl Drop for ManagedFile {
    fn drop(&mut self) {
        OPEN_FILE_COUNT.fetch_sub(1, Ordering::Relaxed);
    }
}
```

## 安全架构

### 1. 内存安全

**Rust语言特性**:
- **所有权系统**: 编译时防止内存泄漏和悬垂指针
- **借用检查**: 防止数据竞争和并发访问问题
- **类型安全**: 强类型系统防止类型混淆攻击

```rust
// 安全的字符串处理
fn safe_string_operation(input: &str) -> String {
    // Rust自动管理内存，无需手动释放
    let mut result = String::with_capacity(input.len());
    
    for ch in input.chars() {
        if ch.is_alphanumeric() {
            result.push(ch);
        }
    }
    
    result  // 自动移动所有权，无内存泄漏
}
```

### 2. 文件系统安全

#### 2.1 路径验证

```rust
use std::path::{Path, PathBuf};

fn validate_file_path(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path);
    
    // 防止路径遍历攻击
    if path.components().any(|comp| {
        matches!(comp, std::path::Component::ParentDir)
    }) {
        return Err("不允许使用相对路径".to_string());
    }
    
    // 规范化路径
    let canonical = path.canonicalize()
        .map_err(|_| "无效的文件路径".to_string())?;
    
    Ok(canonical)
}
```

#### 2.2 权限检查

```rust
#[tauri::command]
async fn secure_file_access(path: String) -> Result<String, String> {
    let validated_path = validate_file_path(&path)?;
    
    // 检查文件权限
    let metadata = tokio::fs::metadata(&validated_path).await
        .map_err(|e| format!("无法访问文件: {}", e))?;
    
    if metadata.permissions().readonly() {
        return Err("文件为只读，无法修改".to_string());
    }
    
    // 安全的文件操作
    let content = tokio::fs::read_to_string(&validated_path).await
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    Ok(content)
}
```

### 3. IPC安全

#### 3.1 命令验证

```rust
use serde::de::DeserializeOwned;

fn validate_command_input<T: DeserializeOwned>(input: &str) -> Result<T, String> {
    // 限制输入大小
    if input.len() > 1024 * 1024 {  // 1MB限制
        return Err("输入数据过大".to_string());
    }
    
    // 安全的JSON反序列化
    serde_json::from_str(input)
        .map_err(|e| format!("无效的输入格式: {}", e))
}
```

#### 3.2 CSP配置

```json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; object-src 'none';"
  }
}
```

## 测试架构

### 1. 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tokio::test;
    
    #[test]
    async fn test_file_reading() {
        let temp_file = create_temp_file("test content").await;
        
        let result = read_file_content(temp_file.path().to_string_lossy().to_string()).await;
        
        assert!(result.is_ok());
        let file_result = result.unwrap();
        assert_eq!(file_result.content.unwrap(), "test content");
    }
    
    #[test]
    fn test_path_validation() {
        assert!(validate_file_path("../../../etc/passwd").is_err());
        assert!(validate_file_path("/valid/path/file.txt").is_ok());
    }
}
```

### 2. 集成测试

```rust
#[cfg(test)]
mod integration_tests {
    use tauri::test::{mock_app, mock_context};
    
    #[tokio::test]
    async fn test_file_operations() {
        let app = mock_app();
        let context = mock_context();
        
        // 测试文件读取命令
        let result = app.invoke_handler(
            "read_file_content",
            serde_json::json!({ "path": "test.txt" })
        ).await;
        
        assert!(result.is_ok());
    }
}
```

### 3. 性能测试

```rust
#[cfg(test)]
mod performance_tests {
    use std::time::Instant;
    
    #[tokio::test]
    async fn benchmark_file_reading() {
        let large_file = create_large_test_file(1024 * 1024).await; // 1MB
        
        let start = Instant::now();
        let _ = read_file_content(large_file.path().to_string_lossy().to_string()).await;
        let duration = start.elapsed();
        
        assert!(duration.as_millis() < 100); // 应在100ms内完成
    }
}
```

## 部署和分发

### 1. 构建配置

#### 1.1 Cargo.toml优化

```toml
[profile.release]
opt-level = 3           # 最高优化级别
lto = true             # 链接时优化
codegen-units = 1      # 单个代码生成单元
panic = "abort"        # 崩溃时直接退出
strip = true           # 移除调试符号
```

#### 1.2 构建脚本

```bash
#!/bin/bash
# build.sh

# 清理之前的构建
cargo clean

# 构建发布版本
cargo build --release

# 使用Tauri构建应用
npm run tauri build

# 生成安装包
echo "构建完成，安装包位于: src-tauri/target/release/bundle/"
```

### 2. 平台特定优化

#### 2.1 Windows优化

```toml
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.52", features = [
    "Win32_System_Power",
    "Win32_UI_Shell",
    "Win32_Storage_FileSystem"
]}
```

#### 2.2 macOS优化

```toml
[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.24"
objc = "0.2"
```

#### 2.3 Linux优化

```toml
[target.'cfg(target_os = "linux")'.dependencies]
gtk = "0.15"
glib = "0.15"
```

## 总结

喵咕记事本的后端架构基于Tauri框架和Rust语言，具有以下特点：

### 架构优势

1. **高性能**: Rust的零成本抽象和系统级性能
2. **内存安全**: 编译时内存安全保证，无运行时开销
3. **跨平台**: 一套代码支持Windows、macOS、Linux
4. **轻量级**: 相比Electron显著减少资源占用
5. **安全性**: 强类型系统和所有权模型提供安全保障

### 技术特色

1. **异步架构**: 基于Tokio的高性能异步I/O
2. **模块化设计**: 清晰的功能模块划分
3. **插件生态**: 丰富的Tauri插件支持
4. **IPC通信**: 高效的前后端通信机制
5. **系统集成**: 深度的操作系统集成功能

### 性能特点

1. **启动速度**: 快速的应用启动时间
2. **内存占用**: 相比传统Electron应用显著降低
3. **文件处理**: 高效的大文件处理能力
4. **并发处理**: 优秀的多任务并发性能
5. **资源管理**: 智能的系统资源管理

### 安全保障

1. **内存安全**: Rust语言级别的内存安全
2. **类型安全**: 强类型系统防止类型错误
3. **路径安全**: 严格的文件路径验证
4. **权限控制**: 细粒度的文件系统权限管理
5. **进程隔离**: Tauri提供的进程安全隔离

这种后端架构为喵咕记事本提供了坚实的技术基础，确保了应用的高性能、安全性和可维护性，同时为未来的功能扩展预留了充分的空间。