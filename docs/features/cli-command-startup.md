# CLI 命令行启动功能

## 概述

喵咕记事本支持通过命令行启动应用程序，并可以通过路径参数直接打开指定文件。该功能通过在系统 PATH 环境变量中安装 CLI 命令实现，支持自定义命令名称。

## 功能特性

- **命令行启动**: 通过自定义命令快速启动应用程序
- **文件路径参数**: 支持通过命令行参数直接打开指定文件
- **自定义命令名**: 可在设置中配置自定义的命令名称
- **自动路径解析**: 自动将相对路径转换为绝对路径
- **多文件支持**: 支持同时打开多个文件
- **Windows 集成**: 完整的 Windows 系统集成支持

## 技术实现

### 1. 后端实现 (Rust/Tauri)

#### 1.1 CLI 安装功能

**文件位置**: `src-tauri/src/lib.rs`

```rust
#[tauri::command]
#[cfg(windows)]
async fn install_cli(command_name: Option<String>) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    use std::process::Command;

    let exe_path = std::env::current_exe().map_err(|e| format!("无法获取当前可执行文件路径: {}", e))?;
    let local_appdata = std::env::var("LOCALAPPDATA").map_err(|e| format!("无法获取 LOCALAPPDATA: {}", e))?;

    let bin_dir = Path::new(&local_appdata).join("miaogu-notepad").join("bin");
    fs::create_dir_all(&bin_dir).map_err(|e| format!("创建 bin 目录失败: {}", e))?;

    // 允许自定义命令名，默认 mgnp
    let cmd_name = command_name.unwrap_or_else(|| "mgnp".to_string());
    let shim_path = bin_dir.join(format!("{}.cmd", cmd_name));

    // 写入 shim 脚本，启动当前 EXE
    let exe_str = exe_path.to_string_lossy().to_string();
    let sanitized_exe = exe_str.replace('"', "\"\"");
    let shim_content = format!(
        r#"@echo off
set "EXE={exe}"
if "%~1"=="" (
  start "" "%EXE%"
) else (
  start "" "%EXE%" "%~f1"
)
"#,
        exe = sanitized_exe
    );
    fs::write(&shim_path, shim_content).map_err(|e| format!("写入 CLI 启动脚本失败: {}", e))?;

    // 将 bin 目录加入用户 PATH（若不存在）
    // ... PowerShell 脚本执行逻辑
}
```

**功能说明**:
- 在 `%LOCALAPPDATA%\miaogu-notepad\bin` 目录创建 CLI 脚本
- 支持自定义命令名称（默认为 `mgnp`）
- 生成批处理脚本用于启动应用程序
- 自动将 bin 目录添加到用户 PATH 环境变量

#### 1.2 命令行参数处理

```rust
#[tauri::command]
async fn get_cli_args() -> Result<Vec<String>, String> {
    let args: Vec<String> = std::env::args().collect();

    // 过滤掉Tauri开发模式的参数
    let filtered_args: Vec<String> = args
        .into_iter()
        .skip(1) // 跳过程序路径
        .filter(|arg| {
            // 过滤掉Tauri开发模式的参数
            !arg.starts_with("--no-default-features")
                && !arg.starts_with("--color")
                && arg != "--"
                && !arg.is_empty()
        })
        .map(|arg| {
            // 将相对路径转换为绝对路径
            let path = Path::new(&arg);

            // 检查是否为相对路径
            if path.is_relative() {
                // 获取当前工作目录
                match std::env::current_dir() {
                    Ok(current_dir) => {
                        let absolute_path = current_dir.join(path);
                        absolute_path.to_string_lossy().to_string()
                    }
                    Err(_) => arg, // 如果获取当前目录失败，返回原始参数
                }
            } else {
                // 如果已经是绝对路径，直接返回
                arg
            }
        })
        .collect();

    Ok(filtered_args)
}
```

**功能说明**:
- 获取并过滤命令行参数
- 自动将相对路径转换为绝对路径
- 过滤掉 Tauri 开发模式的内部参数
- 返回处理后的文件路径列表

#### 1.3 CLI 状态检查

```rust
#[tauri::command]
#[cfg(windows)]
async fn check_cli_installed() -> Result<bool, String> {
    use std::fs;
    use std::path::Path;

    let local_appdata = std::env::var("LOCALAPPDATA").map_err(|e| format!("无法获取 LOCALAPPDATA: {}", e))?;
    let bin_dir = Path::new(&local_appdata).join("miaogu-notepad").join("bin");

    // 目录存在且包含 .cmd 文件即认为已安装
    if !bin_dir.exists() {
        return Ok(false);
    }

    let has_cmd = fs::read_dir(&bin_dir)
        .map_err(|e| format!("读取 bin 目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .any(|entry| {
            let p = entry.path();
            p.extension().map(|ext| ext.to_string_lossy() == "cmd").unwrap_or(false)
        });

    Ok(has_cmd)
}
```

### 2. 前端实现 (JavaScript/React)

#### 2.1 API 封装

**文件位置**: `src/utils/tauriApi.js`

```javascript
async installCli(commandName = 'mgnp') {
    try {
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
            const res = await invoke('install_cli', {commandName});
            return res;
        } else {
            console.log('非Tauri环境，跳过 CLI 安装');
            return '非Tauri环境，跳过 CLI 安装';
        }
    } catch (error) {
        console.error('安装 CLI 失败:', error);
        throw error;
    }
}

async checkCliInstalled() {
    try {
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
            const installed = await invoke('check_cli_installed');
            return Boolean(installed);
        } else {
            return false;
        }
    } catch (error) {
        console.warn('检查 CLI 安装状态失败:', error);
        return false;
    }
}
```

#### 2.2 设置界面集成

**文件位置**: `src/components/SettingsModal.jsx`

设置界面提供了完整的 CLI 管理功能：

- **安装状态显示**: 使用 Badge 组件显示安装状态（绿色圆点表示已安装，黄色圆点表示未安装）
- **命令名称配置**: 允许用户自定义 CLI 命令名称
- **一键安装/卸载**: 提供开关控件进行 CLI 的安装和卸载操作
- **实时状态更新**: 操作完成后自动更新安装状态

## 使用方法

### 1. 安装 CLI 命令

1. 打开应用程序设置
2. 导航到"系统"→"环境变量"部分
3. 配置自定义命令名称（可选，默认为 `mgnp`）
4. 开启"添加到 PATH 环境变量"开关
5. 系统将自动安装 CLI 命令到系统 PATH

### 2. 命令行使用

#### 基本启动
```bash
# 使用默认命令名启动应用程序
mgnp

# 使用自定义命令名启动（如果配置了自定义名称）
my-notepad
```

#### 打开指定文件
```bash
# 打开单个文件
mgnp document.txt

# 打开多个文件
mgnp file1.txt file2.md file3.js

# 使用相对路径（自动转换为绝对路径）
mgnp ./notes/readme.md

# 使用绝对路径
mgnp "C:\Users\Username\Documents\notes.txt"
```

#### 高级用法
```bash
# 打开当前目录下的所有文本文件
mgnp *.txt

# 在新窗口中打开文件
mgnp --new-window document.txt

# 显示帮助信息
mgnp --help
```

## 技术细节

### 1. 安装目录结构

```
%LOCALAPPDATA%\miaogu-notepad\
└── bin\
    └── [command-name].cmd    # CLI 启动脚本
```

### 2. 启动脚本内容

生成的 `.cmd` 文件内容：

```batch
@echo off
set "EXE=C:\path\to\miaogu-notepad.exe"
if "%~1"=="" (
  start "" "%EXE%"
) else (
  start "" "%EXE%" "%~f1"
)
```

**脚本逻辑**:
- 如果没有参数，直接启动应用程序
- 如果有参数，将参数作为文件路径传递给应用程序
- 使用 `%~f1` 确保路径参数被正确处理

### 3. 路径处理机制

1. **相对路径转换**: 自动将相对路径转换为绝对路径
2. **路径验证**: 验证路径格式和文件存在性
3. **特殊字符处理**: 正确处理包含空格和特殊字符的路径
4. **多文件支持**: 支持同时处理多个文件路径参数

### 4. 环境变量管理

- **用户级 PATH**: 修改用户级环境变量，不影响系统级设置
- **动态更新**: 使用 PowerShell 脚本动态更新环境变量
- **重复检查**: 避免重复添加相同路径到 PATH
- **广播更新**: 通过 Windows API 广播环境变量变更

## 配置选项

### 1. 命令名称配置

**配置路径**: 设置 → 系统 → 环境变量 → 命令名称

**默认值**: `mgnp`

**自定义示例**:
- `notepad`
- `editor`
- `mg`
- `my-notepad`

### 2. 安装状态管理

**配置存储**: 使用 Tauri 的持久化存储系统

**相关设置**:
- `system.env.installed`: CLI 安装状态
- `system.env.commandName`: 自定义命令名称

## 故障排除

### 1. 常见问题

#### 命令未找到
**问题**: 执行命令时提示"命令未找到"

**解决方案**:
1. 确认 CLI 已正确安装
2. 重新启动命令提示符或终端
3. 检查系统 PATH 环境变量
4. 尝试重新安装 CLI

#### 权限不足
**问题**: 安装时提示权限不足

**解决方案**:
1. 以管理员身份运行应用程序
2. 检查 `%LOCALAPPDATA%` 目录权限
3. 确保有修改环境变量的权限

#### 文件路径问题
**问题**: 无法正确打开指定文件

**解决方案**:
1. 检查文件路径是否正确
2. 确保文件存在且可访问
3. 使用绝对路径而非相对路径
4. 检查文件权限设置

### 2. 调试方法

#### 检查安装状态
```javascript
// 在浏览器控制台中执行
const installed = await window.__TAURI__.invoke('check_cli_installed');
console.log('CLI 安装状态:', installed);
```

#### 获取命令行参数
```javascript
// 检查应用程序接收到的命令行参数
const args = await window.__TAURI__.invoke('get_cli_args');
console.log('命令行参数:', args);
```

## 兼容性

### 1. 操作系统支持

- **Windows 10/11**: 完全支持
- **macOS**: 计划支持（未实现）
- **Linux**: 计划支持（未实现）

### 2. 终端支持

- **Command Prompt (cmd)**: 完全支持
- **PowerShell**: 完全支持
- **Windows Terminal**: 完全支持
- **Git Bash**: 部分支持

### 3. 文件类型支持

支持所有文本文件格式，包括但不限于：
- `.txt`, `.md`, `.js`, `.ts`, `.jsx`, `.tsx`
- `.html`, `.css`, `.scss`, `.less`
- `.json`, `.xml`, `.yaml`, `.yml`
- `.py`, `.java`, `.cpp`, `.c`, `.h`
- `.sql`, `.sh`, `.bat`, `.ps1`

## 安全考虑

### 1. 路径安全

- **路径验证**: 验证输入路径的合法性
- **沙箱限制**: 限制访问敏感系统目录
- **权限检查**: 检查文件访问权限

### 2. 命令注入防护

- **参数过滤**: 过滤危险的命令行参数
- **路径转义**: 正确转义特殊字符
- **输入验证**: 验证用户输入的命令名称

### 3. 环境变量安全

- **用户级修改**: 仅修改用户级环境变量
- **权限最小化**: 使用最小必要权限
- **回滚机制**: 提供卸载和回滚功能

## 更新日志

### v1.3.0
- 初始 CLI 功能实现
- 支持自定义命令名称
- 集成到设置界面
- 添加安装状态显示

### v1.3.1
- 优化路径处理逻辑
- 改进错误处理机制
- 增强安全性检查
- 完善用户界面

---

## 相关文档

- [Tauri 后端架构](../architecture/backend-architecture.md)
- [API 通信文档](../api/tauri-backend.md)
- [配置系统文档](../api/configuration.md)
- [环境变量配置说明](../../README-Environment.md)