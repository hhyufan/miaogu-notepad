# Tauri 后端 API 文档

## 概述

本文档详细介绍了喵咕记事本Tauri后端的所有Rust API接口，包括文件操作、系统集成、文件监控等功能模块。

## 数据结构定义

### FileInfo - 文件信息结构

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileInfo {
    pub name: String,        // 文件名
    pub path: String,        // 完整路径
    pub size: u64,          // 文件大小（字节）
    pub is_file: bool,      // 是否为文件
    pub is_dir: bool,       // 是否为目录
    pub modified: u64,      // 最后修改时间（时间戳）
}
```

### FileOperationResult - 文件操作结果

```rust
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
```

### FileChangeEvent - 文件变化事件

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileChangeEvent {
    pub file_path: String,    // 文件路径
    pub event_type: String,   // 事件类型: "modified", "created", "deleted"
    pub timestamp: u64,       // 事件时间戳
}
```

---

## 文件操作 API

### read_file_content - 读取文件内容

读取指定文件的内容，自动检测文件编码和行尾格式。

#### 函数签名

```rust
#[tauri::command]
async fn read_file_content(path: String) -> Result<FileOperationResult, String>
```

#### 参数

| 参数     | 类型       | 必需 | 描述       |
|--------|----------|----|----------|
| `path` | `String` | ✅  | 要读取的文件路径 |

#### 返回值

| 字段            | 类型        | 描述       |
|---------------|-----------|----------|
| `success`     | `boolean` | 操作是否成功   |
| `message`     | `string`  | 操作结果消息   |
| `content`     | `string?` | 文件内容     |
| `file_path`   | `string?` | 文件完整路径   |
| `file_name`   | `string?` | 文件名      |
| `encoding`    | `string?` | 检测到的文件编码 |
| `line_ending` | `string?` | 检测到的行尾格式 |

#### 支持的编码格式

| 编码           | 描述         |
|--------------|------------|
| `UTF-8`      | UTF-8编码    |
| `UTF-16LE`   | UTF-16小端编码 |
| `UTF-16BE`   | UTF-16大端编码 |
| `GBK`        | GBK中文编码    |
| `GB2312`     | GB2312中文编码 |
| `Big5`       | Big5繁体中文编码 |
| `ISO-8859-1` | Latin-1编码  |

#### 支持的行尾格式

| 格式     | 描述     | 系统               |
|--------|--------|------------------|
| `LF`   | `\n`   | Unix/Linux/macOS |
| `CRLF` | `\r\n` | Windows          |
| `CR`   | `\r`   | 经典Mac OS         |

#### 前端调用示例

```javascript
import { invoke } from '@tauri-apps/api/core';

async function readFile(filePath) {
  try {
    const result = await invoke('read_file_content', { path: filePath });
    
    if (result.success) {
      console.log('文件读取成功');
      console.log('内容:', result.content);
      console.log('编码:', result.encoding);
      console.log('行尾:', result.line_ending);
      return result;
    } else {
      console.error('读取失败:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('调用失败:', error);
    throw error;
  }
}

// 使用示例
readFile('C:\\Users\\Documents\\example.txt')
  .then(result => {
    // 处理文件内容
    displayFileContent(result.content);
  })
  .catch(error => {
    // 处理错误
    showErrorMessage(error.message);
  });
```

---

### write_file_content - 写入文件内容

将内容写入指定文件。

#### 函数签名

```rust
#[tauri::command]
async fn write_file_content(path: String, content: String) -> Result<(), String>
```

#### 参数

| 参数        | 类型       | 必需 | 描述     |
|-----------|----------|----|--------|
| `path`    | `String` | ✅  | 目标文件路径 |
| `content` | `String` | ✅  | 要写入的内容 |

#### 前端调用示例

```javascript
async function writeFile(filePath, content) {
  try {
    await invoke('write_file_content', { 
      path: filePath, 
      content: content 
    });
    console.log('文件写入成功');
  } catch (error) {
    console.error('写入失败:', error);
    throw error;
  }
}

// 使用示例
const content = 'Hello, World!\nThis is a test file.';
writeFile('C:\\Users\\Documents\\test.txt', content);
```

---

### save_file - 保存文件（带编码支持）

保存文件内容，支持指定编码格式。

#### 函数签名

```rust
#[tauri::command]
async fn save_file(
    file_path: String, 
    content: String, 
    encoding: Option<String>
) -> Result<FileOperationResult, String>
```

#### 参数

| 参数          | 类型               | 必需 | 描述            |
|-------------|------------------|----|---------------|
| `file_path` | `String`         | ✅  | 文件路径          |
| `content`   | `String`         | ✅  | 文件内容          |
| `encoding`  | `Option<String>` | ❌  | 编码格式（默认UTF-8） |

#### 前端调用示例

```javascript
async function saveFileWithEncoding(filePath, content, encoding = 'UTF-8') {
  try {
    const result = await invoke('save_file', {
      file_path: filePath,
      content: content,
      encoding: encoding
    });
    
    if (result.success) {
      console.log('保存成功:', result.message);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('保存失败:', error);
    throw error;
  }
}

// 使用示例
saveFileWithEncoding('test.txt', '测试内容', 'GBK');
```

---

### check_file_exists - 检查文件是否存在

检查指定路径的文件或目录是否存在。

#### 函数签名

```rust
#[tauri::command]
async fn check_file_exists(path: String) -> bool
```

#### 参数

| 参数     | 类型       | 必需 | 描述     |
|--------|----------|----|--------|
| `path` | `String` | ✅  | 要检查的路径 |

#### 前端调用示例

```javascript
async function checkFileExists(filePath) {
  try {
    const exists = await invoke('check_file_exists', { path: filePath });
    return exists;
  } catch (error) {
    console.error('检查文件存在性失败:', error);
    return false;
  }
}

// 使用示例
if (await checkFileExists('C:\\Users\\Documents\\config.json')) {
  console.log('配置文件存在');
} else {
  console.log('配置文件不存在，将创建默认配置');
}
```

---

### get_file_info - 获取文件信息

获取文件或目录的详细信息。

#### 函数签名

```rust
#[tauri::command]
async fn get_file_info(path: String) -> Result<FileInfo, String>
```

#### 参数

| 参数     | 类型       | 必需 | 描述      |
|--------|----------|----|---------|
| `path` | `String` | ✅  | 文件或目录路径 |

#### 前端调用示例

```javascript
async function getFileInfo(filePath) {
  try {
    const info = await invoke('get_file_info', { path: filePath });
    return {
      name: info.name,
      path: info.path,
      size: info.size,
      isFile: info.is_file,
      isDirectory: info.is_dir,
      lastModified: new Date(info.modified * 1000)
    };
  } catch (error) {
    console.error('获取文件信息失败:', error);
    throw error;
  }
}

// 使用示例
getFileInfo('C:\\Users\\Documents\\example.txt')
  .then(info => {
    console.log('文件名:', info.name);
    console.log('大小:', info.size, '字节');
    console.log('最后修改:', info.lastModified.toLocaleString());
  });
```

---

### get_directory_contents - 获取目录内容

获取指定目录下的所有文件和子目录信息。

#### 函数签名

```rust
#[tauri::command]
async fn get_directory_contents(dir_path: String) -> Result<Vec<FileInfo>, String>
```

#### 参数

| 参数         | 类型       | 必需 | 描述   |
|------------|----------|----|------|
| `dir_path` | `String` | ✅  | 目录路径 |

#### 前端调用示例

```javascript
async function getDirectoryContents(dirPath) {
  try {
    const contents = await invoke('get_directory_contents', { 
      dir_path: dirPath 
    });
    
    return contents.map(item => ({
      name: item.name,
      path: item.path,
      size: item.size,
      isFile: item.is_file,
      isDirectory: item.is_dir,
      lastModified: new Date(item.modified * 1000)
    }));
  } catch (error) {
    console.error('获取目录内容失败:', error);
    throw error;
  }
}

// 使用示例
getDirectoryContents('C:\\Users\\Documents')
  .then(contents => {
    console.log('目录内容:');
    contents.forEach(item => {
      const type = item.isFile ? '文件' : '目录';
      console.log(`${type}: ${item.name} (${item.size} 字节)`);
    });
  });
```

---

### rename_file - 重命名文件

重命名文件或目录。

#### 函数签名

```rust
#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<FileOperationResult, String>
```

#### 参数

| 参数         | 类型       | 必需 | 描述    |
|------------|----------|----|-------|
| `old_path` | `String` | ✅  | 原文件路径 |
| `new_path` | `String` | ✅  | 新文件路径 |

#### 前端调用示例

```javascript
async function renameFile(oldPath, newPath) {
  try {
    const result = await invoke('rename_file', {
      old_path: oldPath,
      new_path: newPath
    });
    
    if (result.success) {
      console.log('重命名成功:', result.message);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('重命名失败:', error);
    throw error;
  }
}

// 使用示例
renameFile('old_name.txt', 'new_name.txt');
```

---

### update_file_line_ending - 更新文件行尾格式

更新文件的行尾格式。

#### 函数签名

```rust
#[tauri::command]
async fn update_file_line_ending(
    file_path: String, 
    line_ending: String
) -> Result<FileOperationResult, String>
```

#### 参数

| 参数            | 类型       | 必需 | 描述                          |
|---------------|----------|----|-----------------------------|
| `file_path`   | `String` | ✅  | 文件路径                        |
| `line_ending` | `String` | ✅  | 目标行尾格式 (`LF`, `CRLF`, `CR`) |

#### 前端调用示例

```javascript
async function updateLineEnding(filePath, lineEnding) {
  try {
    const result = await invoke('update_file_line_ending', {
      file_path: filePath,
      line_ending: lineEnding
    });
    
    if (result.success) {
      console.log('行尾格式更新成功');
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('更新行尾格式失败:', error);
    throw error;
  }
}

// 使用示例
updateLineEnding('example.txt', 'LF'); // 转换为Unix格式
```

---

## 系统集成 API

### execute_file - 执行文件

使用系统默认程序执行文件。

#### 函数签名

```rust
#[tauri::command]
async fn execute_file(file_path: String) -> Result<String, String>
```

#### 参数

| 参数          | 类型       | 必需 | 描述       |
|-------------|----------|----|----------|
| `file_path` | `String` | ✅  | 要执行的文件路径 |

#### 前端调用示例

```javascript
async function executeFile(filePath) {
  try {
    const result = await invoke('execute_file', { file_path: filePath });
    console.log('执行结果:', result);
  } catch (error) {
    console.error('执行文件失败:', error);
    throw error;
  }
}

// 使用示例
executeFile('C:\\Users\\Documents\\script.bat');
```

---

### open_in_terminal - 在终端中打开

在系统终端中打开指定路径。

#### 函数签名

```rust
#[tauri::command]
async fn open_in_terminal(path: String) -> Result<String, String>
```

#### 参数

| 参数     | 类型       | 必需 | 描述         |
|--------|----------|----|------------|
| `path` | `String` | ✅  | 要在终端中打开的路径 |

#### 支持的终端

| 系统      | 终端程序            |
|---------|-----------------|
| Windows | PowerShell, CMD |
| macOS   | Terminal        |
| Linux   | 系统默认终端          |

#### 前端调用示例

```javascript
async function openInTerminal(path) {
  try {
    const result = await invoke('open_in_terminal', { path: path });
    console.log('终端打开成功:', result);
  } catch (error) {
    console.error('打开终端失败:', error);
    throw error;
  }
}

// 使用示例
openInTerminal('C:\\Users\\Documents\\project');
```

---

### show_in_explorer - 在文件管理器中显示

在系统文件管理器中显示指定文件或目录。

#### 函数签名

```rust
#[tauri::command]
async fn show_in_explorer(path: String) -> Result<String, String>
```

#### 参数

| 参数     | 类型       | 必需 | 描述          |
|--------|----------|----|-------------|
| `path` | `String` | ✅  | 要显示的文件或目录路径 |

#### 支持的文件管理器

| 系统      | 文件管理器     |
|---------|-----------|
| Windows | Explorer  |
| macOS   | Finder    |
| Linux   | 系统默认文件管理器 |

#### 前端调用示例

```javascript
async function showInExplorer(path) {
  try {
    const result = await invoke('show_in_explorer', { path: path });
    console.log('文件管理器打开成功:', result);
  } catch (error) {
    console.error('打开文件管理器失败:', error);
    throw error;
  }
}

// 使用示例
showInExplorer('C:\\Users\\Documents\\important.txt');
```

---

### open_url - 打开URL

使用系统默认浏览器打开URL。

#### 函数签名

```rust
#[tauri::command]
async fn open_url(url: String) -> Result<(), String>
```

#### 参数

| 参数    | 类型       | 必需 | 描述        |
|-------|----------|----|-----------|
| `url` | `String` | ✅  | 要打开的URL地址 |

#### 前端调用示例

```javascript
async function openUrl(url) {
  try {
    await invoke('open_url', { url: url });
    console.log('URL打开成功');
  } catch (error) {
    console.error('打开URL失败:', error);
    throw error;
  }
}

// 使用示例
openUrl('https://github.com/miaogu-notepad/miaogu-notepad');
```

---

## 文件监控 API

### start_file_watching - 开始文件监控

开始监控指定文件的变化。

#### 函数签名

```rust
#[tauri::command]
async fn start_file_watching(
    app_handle: AppHandle, 
    file_path: String
) -> Result<bool, String>
```

#### 参数

| 参数           | 类型          | 必需 | 描述              |
|--------------|-------------|----|-----------------|
| `app_handle` | `AppHandle` | ✅  | Tauri应用句柄（自动传入） |
| `file_path`  | `String`    | ✅  | 要监控的文件路径        |

#### 前端调用示例

```javascript
import { listen } from '@tauri-apps/api/event';

async function startFileWatching(filePath) {
  try {
    // 开始监控
    const success = await invoke('start_file_watching', { 
      file_path: filePath 
    });
    
    if (success) {
      console.log('文件监控已启动');
      
      // 监听文件变化事件
      const unlisten = await listen('file-changed', (event) => {
        const changeEvent = event.payload;
        console.log('文件发生变化:', changeEvent);
        
        handleFileChange(changeEvent);
      });
      
      return unlisten; // 返回取消监听函数
    } else {
      throw new Error('启动文件监控失败');
    }
  } catch (error) {
    console.error('启动文件监控失败:', error);
    throw error;
  }
}

function handleFileChange(changeEvent) {
  const { file_path, event_type, timestamp } = changeEvent;
  
  switch (event_type) {
    case 'modified':
      console.log(`文件已修改: ${file_path}`);
      // 提示用户文件已被外部修改
      showFileModifiedDialog(file_path);
      break;
    case 'deleted':
      console.log(`文件已删除: ${file_path}`);
      // 提示用户文件已被删除
      showFileDeletedDialog(file_path);
      break;
    case 'created':
      console.log(`文件已创建: ${file_path}`);
      break;
  }
}

// 使用示例
startFileWatching('C:\\Users\\Documents\\watched_file.txt')
  .then(unlisten => {
    // 保存取消监听函数，在需要时调用
    window.fileWatchUnlisten = unlisten;
  });
```

---

### stop_file_watching - 停止文件监控

停止监控指定文件。

#### 函数签名

```rust
#[tauri::command]
async fn stop_file_watching(file_path: String) -> Result<bool, String>
```

#### 参数

| 参数          | 类型       | 必需 | 描述         |
|-------------|----------|----|------------|
| `file_path` | `String` | ✅  | 要停止监控的文件路径 |

#### 前端调用示例

```javascript
async function stopFileWatching(filePath) {
  try {
    const success = await invoke('stop_file_watching', { 
      file_path: filePath 
    });
    
    if (success) {
      console.log('文件监控已停止');
      
      // 取消事件监听
      if (window.fileWatchUnlisten) {
        window.fileWatchUnlisten();
        window.fileWatchUnlisten = null;
      }
    } else {
      console.warn('停止文件监控失败');
    }
  } catch (error) {
    console.error('停止文件监控失败:', error);
    throw error;
  }
}

// 使用示例
stopFileWatching('C:\\Users\\Documents\\watched_file.txt');
```

---

### check_file_external_changes - 检查文件外部变化

检查文件是否有外部变化。

#### 函数签名

```rust
#[tauri::command]
async fn check_file_external_changes(
    file_path: String
) -> Result<Option<FileChangeEvent>, String>
```

#### 参数

| 参数          | 类型       | 必需 | 描述       |
|-------------|----------|----|----------|
| `file_path` | `String` | ✅  | 要检查的文件路径 |

#### 返回值

返回 `Option<FileChangeEvent>`，如果有变化则返回变化事件，否则返回 `null`。

#### 前端调用示例

```javascript
async function checkFileExternalChanges(filePath) {
  try {
    const changeEvent = await invoke('check_file_external_changes', {
      file_path: filePath
    });
    
    if (changeEvent) {
      console.log('检测到文件变化:', changeEvent);
      return {
        filePath: changeEvent.file_path,
        eventType: changeEvent.event_type,
        timestamp: new Date(changeEvent.timestamp * 1000)
      };
    } else {
      console.log('文件无变化');
      return null;
    }
  } catch (error) {
    console.error('检查文件变化失败:', error);
    throw error;
  }
}

// 使用示例 - 定期检查文件变化
setInterval(async () => {
  const change = await checkFileExternalChanges('current_file.txt');
  if (change) {
    handleFileExternalChange(change);
  }
}, 5000); // 每5秒检查一次
```

---

## 系统功能 API

### enable_prevent_sleep - 启用防止系统休眠

防止系统进入休眠状态。

#### 函数签名

```rust
#[tauri::command]
async fn enable_prevent_sleep() -> Result<String, String>
```

#### 前端调用示例

```javascript
async function enablePreventSleep() {
  try {
    const result = await invoke('enable_prevent_sleep');
    console.log('防休眠已启用:', result);
  } catch (error) {
    console.error('启用防休眠失败:', error);
    throw error;
  }
}

// 使用示例 - 在长时间操作前启用
enablePreventSleep();
```

---

### disable_prevent_sleep - 禁用防止系统休眠

允许系统正常休眠。

#### 函数签名

```rust
#[tauri::command]
async fn disable_prevent_sleep() -> Result<String, String>
```

#### 前端调用示例

```javascript
async function disablePreventSleep() {
  try {
    const result = await invoke('disable_prevent_sleep');
    console.log('防休眠已禁用:', result);
  } catch (error) {
    console.error('禁用防休眠失败:', error);
    throw error;
  }
}

// 使用示例 - 在操作完成后禁用
disablePreventSleep();
```

---

### get_prevent_sleep_status - 获取防休眠状态

获取当前防休眠功能的状态。

#### 函数签名

```rust
#[tauri::command]
async fn get_prevent_sleep_status() -> Result<bool, String>
```

#### 前端调用示例

```javascript
async function getPreventSleepStatus() {
  try {
    const isEnabled = await invoke('get_prevent_sleep_status');
    console.log('防休眠状态:', isEnabled ? '已启用' : '已禁用');
    return isEnabled;
  } catch (error) {
    console.error('获取防休眠状态失败:', error);
    return false;
  }
}

// 使用示例
const sleepStatus = await getPreventSleepStatus();
if (sleepStatus) {
  showStatusIndicator('防休眠已启用');
}
```

---

### greet - 问候函数

示例问候函数。

#### 函数签名

```rust
#[tauri::command]
fn greet(name: &str) -> String
```

#### 参数

| 参数     | 类型     | 必需 | 描述     |
|--------|--------|----|--------|
| `name` | `&str` | ✅  | 要问候的名字 |

#### 前端调用示例

```javascript
async function greet(name) {
    try {
        const greeting = await invoke('greet', {name: name});
        console.log(greeting);
        return greeting;
    } catch (error) {
        console.error('问候失败:', error);
        throw error;
    }
}

// 使用示例
greet('世界').then(message => {
    console.log(message); // "Hello, 世界! You've been greeted from Rust!"
});
```

---

### get_cli_args - 获取命令行参数

获取应用启动时的命令行参数。

#### 函数签名

```rust
#[tauri::command]
async fn get_cli_args() -> Result<Vec<String>, String>
```

#### 前端调用示例

```javascript
async function getCliArgs() {
    try {
        const args = await invoke('get_cli_args');
        console.log('命令行参数:', args);
        return args;
    } catch (error) {
        console.error('获取命令行参数失败:', error);
        return [];
    }
}

// 使用示例 - 应用启动时检查命令行参数
getCliArgs().then(args => {
    if (args.length > 0) {
        console.log('启动参数:', args);
        // 处理启动参数，如自动打开文件
        args.forEach(arg => {
            if (arg.endsWith('.txt') || arg.endsWith('.md')) {
                openFile(arg);
            }
        });
    }
});
```

---

## 错误处理

### 常见错误类型

| 错误类型               | 描述     | 处理建议            |
|--------------------|--------|-----------------|
| `FileNotFound`     | 文件不存在  | 检查文件路径是否正确      |
| `PermissionDenied` | 权限不足   | 检查文件权限或以管理员身份运行 |
| `InvalidPath`      | 无效路径   | 验证路径格式是否正确      |
| `EncodingError`    | 编码错误   | 尝试其他编码格式        |
| `IOError`          | IO操作失败 | 检查磁盘空间和文件系统状态   |

### 错误处理最佳实践

```javascript
// 统一错误处理函数
async function safeInvoke(command, args = {}) {
    try {
        return await invoke(command, args);
    } catch (error) {
        console.error(`调用 ${command} 失败:`, error);

        // 根据错误类型进行不同处理
        if (error.includes('FileNotFound')) {
            showError('文件不存在，请检查路径是否正确');
        } else if (error.includes('PermissionDenied')) {
            showError('权限不足，请检查文件权限');
        } else {
            showError(`操作失败: ${error}`);
        }

        throw error;
    }
}

// 使用示例
async function safeReadFile(filePath) {
    return await safeInvoke('read_file_content', {path: filePath});
}
```

## 性能优化建议

### 1. 批量操作

```javascript
// 批量读取多个文件
async function readMultipleFiles(filePaths) {
    const promises = filePaths.map(path =>
        invoke('read_file_content', {path})
    );

    try {
        const results = await Promise.all(promises);
        return results;
    } catch (error) {
        console.error('批量读取失败:', error);
        throw error;
    }
}
```

### 2. 缓存机制

```javascript
// 文件信息缓存
const fileInfoCache = new Map();

async function getCachedFileInfo(filePath) {
    if (fileInfoCache.has(filePath)) {
        return fileInfoCache.get(filePath);
    }

    const info = await invoke('get_file_info', {path: filePath});
    fileInfoCache.set(filePath, info);
    return info;
}
```

### 3. 防抖处理

```javascript
// 文件保存防抖
let saveTimeout;

function debouncedSave(filePath, content) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        invoke('write_file_content', {path: filePath, content});
    }, 1000); // 1秒后保存
}
```

## 注意事项

1. **路径格式**: Windows使用反斜杠，Unix系统使用正斜杠
2. **文件权限**: 确保应用有足够权限访问目标文件
3. **编码处理**: 自动检测编码可能不准确，建议提供手动选择选项
4. **内存管理**: 大文件操作时注意内存使用
5. **异步操作**: 所有文件操作都是异步的，需要正确处理Promise
6. **错误恢复**: 实现适当的错误恢复机制
7. **用户体验**: 长时间操作应显示进度指示器

---

*本文档基于 miaogu-notepad v1.4.0 版本编写*
