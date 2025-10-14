/*!
 * @fileoverview Tauri后端核心库 - 提供文件操作、系统集成等功能
 *
 * 喵咕记事本后端实现，包含文件读写、编码检测、文件监控、系统集成等功能
 *
 * @author hhyufan
 * @version 1.3.0
 */

use base64::Engine;
use encoding_rs::{Encoding, UTF_8};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH, Duration};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_http::reqwest;
use reqwest as external_reqwest;
use std::io::Write;
use tokio::time::{sleep, interval};

// Windows API相关导入
#[cfg(windows)]
use windows_sys::Win32::System::Power::{
    SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
};

// 防止睡眠状态管理
static PREVENT_SLEEP_ENABLED: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));

// 更新检查状态管理
static UPDATE_CHECK_RUNNING: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| Arc::new(Mutex::new(false)));

/// 文件信息结构体
/// 用于描述文件或目录的基本信息
#[derive(Serialize, Deserialize, Debug, Clone)]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    is_file: bool,
    is_dir: bool,
    modified: u64,
}

/// 版本信息结构体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub download_url: Option<String>,
    pub release_notes: Option<String>,
    pub published_at: Option<String>,
}

/// 更新进度结构体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateProgress {
    pub stage: String, // "checking", "downloading", "installing", "completed", "error"
    pub progress: f64, // 0.0 - 1.0
    pub message: String,
    pub error: Option<String>,
}

/// 应用程序路径信息结构体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppPathInfo {
    pub current_exe_path: String,
    pub app_dir: String,
    pub app_name: String,
}

/// GitHub Release API响应结构体
#[derive(Debug, Serialize, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: String,
    body: Option<String>,
    published_at: String,
    assets: Vec<GitHubAsset>,
}

/// GitHub Asset结构体
#[derive(Debug, Serialize, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

/// 代理配置结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub enabled: bool,
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub no_proxy: Option<String>,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            http_proxy: None,
            https_proxy: None,
            no_proxy: None,
        }
    }
}

/// 图片加载结果结构体
#[derive(Debug, Serialize, Deserialize)]
pub struct ImageLoadResult {
    pub success: bool,
    pub data: Option<String>, // Base64 编码的图片数据
    pub content_type: Option<String>,
    pub error: Option<String>,
}

/// 文件操作结果结构体
/// 用于返回文件操作的结果信息，包含成功状态、消息和相关数据
#[derive(Serialize, Deserialize, Debug, Clone)]
struct FileOperationResult {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    encoding: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    line_ending: Option<String>,
}

/// 检测文件编码
/// 通过分析文件字节内容来确定文件的字符编码格式
///
/// # Arguments
/// * `bytes` - 文件的字节内容
///
/// # Returns
/// * `&'static Encoding` - 检测到的编码格式
fn detect_file_encoding(bytes: &[u8]) -> &'static Encoding {
    // 简单的编码检测逻辑
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return UTF_8;
    }

    // 检查是否为有效的UTF-8
    if std::str::from_utf8(bytes).is_ok() {
        return UTF_8;
    }

    // 默认使用UTF-8
    UTF_8
}

/// 检测行尾序列
/// 分析文本内容中的换行符类型，确定文件使用的行尾格式
///
/// # Arguments
/// * `content` - 文本内容
///
/// # Returns
/// * `String` - 行尾类型（"CRLF", "LF", "CR"）
fn detect_line_ending(content: &str) -> String {
    // 统计不同行结束符的数量
    let crlf_count = content.matches("\r\n").count();
    let lf_count = content.matches('\n').count() - crlf_count; // 减去CRLF中的LF
    let cr_count = content.matches('\r').count() - crlf_count; // 减去CRLF中的CR

    // 根据数量最多的行结束符类型来判断
    if crlf_count > 0 && crlf_count >= lf_count && crlf_count >= cr_count {
        "CRLF".to_string()
    } else if cr_count > 0 && cr_count >= lf_count {
        "CR".to_string()
    } else if lf_count > 0 {
        "LF".to_string()
    } else {
        // 如果没有换行符，默认为LF
        "LF".to_string()
    }
}

/// 文件变更事件结构体
/// 用于描述文件系统中发生的变更事件
#[derive(Serialize, Deserialize, Debug, Clone)]
struct FileChangeEvent {
    file_path: String,
    event_type: String, // "modified", "created", "deleted"
    timestamp: u64,
}

/// 文件监控状态结构体
/// 管理文件监控器和被监控文件的状态信息
struct FileWatcherState {
    watchers: HashMap<String, Box<dyn Watcher + Send>>,
    watched_files: HashMap<String, u64>, // 文件路径 -> 最后修改时间
}

/// 全局文件监控器状态
/// 使用懒加载方式初始化全局文件监控状态
static FILE_WATCHER_STATE: Lazy<Arc<Mutex<FileWatcherState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(FileWatcherState {
        watchers: HashMap::new(),
        watched_files: HashMap::new(),
    }))
});

/// 读取文件内容
/// 读取指定路径的文件，自动检测编码和行尾格式
///
/// # Arguments
/// * `path` - 文件路径
///
/// # Returns
/// * `Result<FileOperationResult, String>` - 包含文件内容和元信息的操作结果
/// 获取应用程序路径信息
#[tauri::command]
async fn get_app_path_info() -> Result<AppPathInfo, String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current exe path: {}", e))?;
    
    let app_dir = current_exe.parent()
        .ok_or("Failed to get application directory")?
        .to_string_lossy()
        .to_string();
    
    let app_name = current_exe.file_name()
        .ok_or("Failed to get application name")?
        .to_string_lossy()
        .to_string();
    
    Ok(AppPathInfo {
        current_exe_path: current_exe.to_string_lossy().to_string(),
        app_dir,
        app_name,
    })
}

#[tauri::command]
async fn read_file_content(path: String) -> Result<FileOperationResult, String> {
    match fs::read(&path) {
        Ok(bytes) => {
            let encoding = detect_file_encoding(&bytes);
            let (content, _, _) = encoding.decode(&bytes);
            let content_str = content.to_string();
            let line_ending = detect_line_ending(&content_str);

            Ok(FileOperationResult {
                success: true,
                message: "文件读取成功".to_string(),
                content: Some(content_str),
                file_path: Some(path),
                file_name: None,
                encoding: Some(encoding.name().to_string()),
                line_ending: Some(line_ending),
            })
        }
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("Failed to read file: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        }),
    }
}

/// 写入文件内容
/// 将内容写入指定路径的文件，如果目录不存在会自动创建
///
/// # Arguments
/// * `path` - 文件路径
/// * `content` - 要写入的内容
///
/// # Returns
/// * `Result<(), String>` - 操作结果
#[tauri::command]
async fn write_file_content(path: String, content: String) -> Result<(), String> {
    // 确保目录存在
    if let Some(parent) = Path::new(&path).parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return Err(format!("Failed to create directory: {}", e));
        }
    }

    match fs::write(&path, content) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to write file: {}", e)),
    }
}

/// 检查文件是否存在
/// 检查指定路径的文件或目录是否存在
///
/// # Arguments
/// * `path` - 文件或目录路径
///
/// # Returns
/// * `bool` - 文件是否存在
#[tauri::command]
async fn check_file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// 获取文件信息
/// 获取指定路径文件或目录的详细信息
///
/// # Arguments
/// * `path` - 文件或目录路径
///
/// # Returns
/// * `Result<FileInfo, String>` - 文件信息或错误消息
#[tauri::command]
async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let file_path = Path::new(&path);
    match fs::metadata(&path) {
        Ok(metadata) => {
            let file_name = file_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            Ok(FileInfo {
                name: file_name,
                path: path.clone(),
                size: metadata.len(),
                is_file: metadata.is_file(),
                is_dir: metadata.is_dir(),
                modified: metadata
                    .modified()
                    .map(|time| {
                        time.duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs()
                    })
                    .unwrap_or(0),
            })
        }
        Err(e) => Err(format!("Failed to get file info: {}", e)),
    }
}

/// 设置打开文件
/// 打开指定文件并返回文件内容和相关信息
///
/// # Arguments
/// * `file_path` - 要打开的文件路径
///
/// # Returns
/// * `Result<FileOperationResult, String>` - 包含文件内容和元信息的操作结果
#[tauri::command]
async fn set_open_file(file_path: String) -> Result<FileOperationResult, String> {
    if file_path.is_empty() {
        return Ok(FileOperationResult {
            success: false,
            message: "未提供有效的文件路径".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    let path = Path::new(&file_path);

    // 检查文件是否存在
    if !path.exists() {
        return Ok(FileOperationResult {
            success: false,
            message: "文件不存在".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    // 检查是否为目录
    if path.is_dir() {
        return Ok(FileOperationResult {
            success: false,
            message: "无法打开目录，请选择一个文件".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    // 读取文件内容
    match fs::read(&file_path) {
        Ok(bytes) => {
            let encoding = detect_file_encoding(&bytes);
            let (content, _, _) = encoding.decode(&bytes);
            let content_str = content.to_string();
            let line_ending = detect_line_ending(&content_str);
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("未知文件")
                .to_string();

            Ok(FileOperationResult {
                success: true,
                message: "文件读取成功".to_string(),
                content: Some(content_str),
                file_path: Some(file_path),
                file_name: Some(file_name),
                encoding: Some(encoding.name().to_string()),
                line_ending: Some(line_ending),
            })
        }
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("读取文件失败: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        }),
    }
}

/// 保存文件
/// 将内容保存到指定文件，支持指定编码格式
///
/// # Arguments
/// * `file_path` - 文件路径
/// * `content` - 要保存的内容
/// * `encoding` - 可选的编码格式
///
/// # Returns
/// * `Result<FileOperationResult, String>` - 保存操作结果
#[tauri::command]
async fn save_file(
    file_path: String,
    content: String,
    encoding: Option<String>,
) -> Result<FileOperationResult, String> {
    if file_path.is_empty() {
        return Ok(FileOperationResult {
            success: false,
            message: "未提供有效的文件路径".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    let path = Path::new(&file_path);

    // 确保目录存在
    if let Some(parent) = path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return Ok(FileOperationResult {
                success: false,
                message: format!("创建目录失败: {}", e),
                content: None,
                file_path: None,
                file_name: None,
                encoding: None,
                line_ending: None,
            });
        }
    }

    // 确定使用的编码
    let target_encoding = encoding.as_deref().unwrap_or("UTF-8");
    let encoding_obj = Encoding::for_label(target_encoding.as_bytes()).unwrap_or(UTF_8);

    // 将字符串编码为指定编码的字节
    let (encoded_bytes, _, _) = encoding_obj.encode(&content);

    // 写入文件
    match fs::write(&file_path, &encoded_bytes) {
        Ok(_) => {
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("未知文件")
                .to_string();

            Ok(FileOperationResult {
                success: true,
                message: "文件保存成功".to_string(),
                content: None,
                file_path: Some(file_path),
                file_name: Some(file_name),
                encoding: Some(encoding_obj.name().to_string()),
                line_ending: Some(detect_line_ending(&content)),
            })
        }
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("保存文件失败: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        }),
    }
}

// 获取目录内容
#[tauri::command]
async fn get_directory_contents(dir_path: String) -> Result<Vec<FileInfo>, String> {
    let path = Path::new(&dir_path);

    if !path.exists() {
        return Err("目录不存在".to_string());
    }

    if !path.is_dir() {
        return Err("提供的路径不是目录".to_string());
    }

    match fs::read_dir(path) {
        Ok(entries) => {
            let mut contents = Vec::new();
            for entry in entries {
                if let Ok(entry) = entry {
                    if let Ok(metadata) = entry.metadata() {
                        let file_path = entry.path();
                        let file_name = entry.file_name().to_string_lossy().to_string();
                        contents.push(FileInfo {
                            name: file_name,
                            path: file_path.to_string_lossy().to_string(),
                            size: metadata.len(),
                            is_file: metadata.is_file(),
                            is_dir: metadata.is_dir(),
                            modified: metadata
                                .modified()
                                .map(|time| {
                                    time.duration_since(UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_secs()
                                })
                                .unwrap_or(0),
                        });
                    }
                }
            }
            Ok(contents)
        }
        Err(e) => Err(format!("读取目录失败: {}", e)),
    }
}

// 重命名文件命令
#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<FileOperationResult, String> {
    if old_path.is_empty() || new_path.is_empty() {
        return Ok(FileOperationResult {
            success: false,
            message: "未提供有效的文件路径".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    let old_file_path = Path::new(&old_path);
    let new_file_path = Path::new(&new_path);

    // 检查源文件是否存在
    if !old_file_path.exists() {
        return Ok(FileOperationResult {
            success: false,
            message: "源文件不存在".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    // 检查目标文件是否已存在
    if new_file_path.exists() {
        return Ok(FileOperationResult {
            success: false,
            message: "目标文件已存在".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    // 确保目标目录存在
    if let Some(parent) = new_file_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return Ok(FileOperationResult {
                success: false,
                message: format!("创建目标目录失败: {}", e),
                content: None,
                file_path: None,
                file_name: None,
                encoding: None,
                line_ending: None,
            });
        }
    }

    // 执行重命名操作
    match fs::rename(&old_path, &new_path) {
        Ok(_) => {
            let new_file_name = new_file_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("未知文件")
                .to_string();

            Ok(FileOperationResult {
                success: true,
                message: "文件重命名成功".to_string(),
                content: None,
                file_path: Some(new_path),
                file_name: Some(new_file_name),
                encoding: None,
                line_ending: None,
            })
        }
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("文件重命名失败: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        }),
    }
}

// 更新文件行尾序列
#[tauri::command]
async fn update_file_line_ending(
    file_path: String,
    line_ending: String,
) -> Result<FileOperationResult, String> {
    if file_path.is_empty() {
        return Ok(FileOperationResult {
            success: false,
            message: "未提供有效的文件路径".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    if line_ending.is_empty() {
        return Ok(FileOperationResult {
            success: false,
            message: "未提供有效的行尾序列".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    let path = Path::new(&file_path);

    if !path.exists() {
        return Ok(FileOperationResult {
            success: false,
            message: "文件不存在".to_string(),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        });
    }

    match fs::read(&file_path) {
        Ok(bytes) => {
            let encoding = detect_file_encoding(&bytes);
            let (decoded_content, _, _) = encoding.decode(&bytes);
            let mut content = decoded_content.to_string();
            // 标准化所有行尾为LF
            content = content.replace("\r\n", "\n").replace('\r', "\n");

            // 根据指定的行尾序列重新格式化
            match line_ending.as_str() {
                "CRLF" => content = content.replace('\n', "\r\n"),
                "CR" => content = content.replace('\n', "\r"),
                "LF" => {} // LF是默认格式，无需转换
                _ => {
                    return Ok(FileOperationResult {
                        success: false,
                        message: "不支持的行尾序列格式".to_string(),
                        content: None,
                        file_path: None,
                        file_name: None,
                        encoding: None,
                        line_ending: None,
                    });
                }
            }

            // 使用原始编码重新编码内容
            let (encoded_bytes, _, _) = encoding.encode(&content);
            let encoded_bytes = encoded_bytes.into_owned();

            match fs::write(&file_path, &encoded_bytes) {
                Ok(_) => {
                    let file_name = path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("未知文件")
                        .to_string();

                    Ok(FileOperationResult {
                        success: true,
                        message: "文件行尾序列已更新".to_string(),
                        content: None,
                        file_path: Some(file_path),
                        file_name: Some(file_name),
                        encoding: Some(encoding.name().to_string()),
                        line_ending: Some(line_ending),
                    })
                }
                Err(e) => Ok(FileOperationResult {
                    success: false,
                    message: format!("写入文件失败: {}", e),
                    content: None,
                    file_path: None,
                    file_name: None,
                    encoding: None,
                    line_ending: None,
                }),
            }
        }
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("读取文件失败: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        }),
    }
}

// 执行文件命令
#[tauri::command]
async fn execute_file(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    if !path.is_file() {
        return Err("路径不是文件".to_string());
    }

    // 获取文件扩展名
    let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");

    match extension.to_lowercase().as_str() {
        "exe" | "bat" | "cmd" => {
            // 直接执行可执行文件
            match Command::new(&file_path).spawn() {
                Ok(_) => Ok(format!("成功启动文件: {}", file_path)),
                Err(e) => Err(format!("执行文件失败: {}", e)),
            }
        }
        "ps1" => {
            // PowerShell 脚本
            match Command::new("powershell")
                .args(["-ExecutionPolicy", "Bypass", "-File", &file_path])
                .spawn()
            {
                Ok(_) => Ok(format!("成功执行PowerShell脚本: {}", file_path)),
                Err(e) => Err(format!("执行PowerShell脚本失败: {}", e)),
            }
        }
        "py" => {
            // Python 脚本
            match Command::new("python").arg(&file_path).spawn() {
                Ok(_) => Ok(format!("成功执行Python脚本: {}", file_path)),
                Err(e) => Err(format!("执行Python脚本失败: {}", e)),
            }
        }
        "js" => {
            // JavaScript 文件
            match Command::new("node").arg(&file_path).spawn() {
                Ok(_) => Ok(format!("成功执行JavaScript文件: {}", file_path)),
                Err(e) => Err(format!("执行JavaScript文件失败: {}", e)),
            }
        }
        _ => {
            // 尝试使用系统默认程序打开
            #[cfg(target_os = "windows")]
            match Command::new("cmd")
                .args(["/c", "start", "", &file_path])
                .spawn()
            {
                Ok(_) => Ok(format!("成功使用默认程序打开: {}", file_path)),
                Err(e) => Err(format!("打开文件失败: {}", e)),
            }

            #[cfg(target_os = "macos")]
            match Command::new("open").arg(&file_path).spawn() {
                Ok(_) => Ok(format!("成功使用默认程序打开: {}", file_path)),
                Err(e) => Err(format!("打开文件失败: {}", e)),
            }

            #[cfg(target_os = "linux")]
            match Command::new("xdg-open").arg(&file_path).spawn() {
                Ok(_) => Ok(format!("成功使用默认程序打开: {}", file_path)),
                Err(e) => Err(format!("打开文件失败: {}", e)),
            }

            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err("当前平台不支持此操作".to_string())
            }
        }
    }
}

// 在终端中打开文件或目录
#[tauri::command]
async fn open_in_terminal(path: String) -> Result<String, String> {
    let target_path = Path::new(&path);

    if !target_path.exists() {
        return Err("路径不存在".to_string());
    }

    // 确定工作目录
    let work_dir = if target_path.is_file() {
        target_path.parent().unwrap_or(target_path)
    } else {
        target_path
    };

    #[cfg(target_os = "windows")]
    {
        // 尝试使用 Windows Terminal
        if let Ok(_) = Command::new("wt")
            .args(["-d", work_dir.to_str().unwrap_or(".")])
            .spawn()
        {
            return Ok(format!(
                "成功在Windows Terminal中打开: {}",
                work_dir.display()
            ));
        }

        // 备用方案：使用 PowerShell
        if let Ok(_) = Command::new("powershell")
            .args([
                "-NoExit",
                "-Command",
                &format!("cd '{}'", work_dir.display()),
            ])
            .spawn()
        {
            return Ok(format!("成功在PowerShell中打开: {}", work_dir.display()));
        }

        // 最后备用方案：使用 cmd
        match Command::new("cmd")
            .args(["/k", &format!("cd /d {}", work_dir.display())])
            .spawn()
        {
            Ok(_) => Ok(format!("成功在命令提示符中打开: {}", work_dir.display())),
            Err(e) => Err(format!("打开终端失败: {}", e)),
        }
    }

    #[cfg(target_os = "macos")]
    {
        match Command::new("open")
            .args(["-a", "Terminal", work_dir.to_str().unwrap_or(".")])
            .spawn()
        {
            Ok(_) => Ok(format!("成功在Terminal中打开: {}", work_dir.display())),
            Err(e) => Err(format!("打开终端失败: {}", e)),
        }
    }

    #[cfg(target_os = "linux")]
    {
        // 尝试常见的终端应用
        let terminals = ["gnome-terminal", "konsole", "xfce4-terminal", "xterm"];

        for terminal in &terminals {
            if let Ok(_) = Command::new(terminal)
                .args(["--working-directory", work_dir.to_str().unwrap_or(".")])
                .spawn()
            {
                return Ok(format!("成功在{}中打开: {}", terminal, work_dir.display()));
            }
        }

        Err("未找到可用的终端应用".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("当前平台不支持此操作".to_string())
    }
}

// 在文件资源管理器中显示文件
#[tauri::command]
async fn show_in_explorer(path: String) -> Result<String, String> {
    let target_path = Path::new(&path);

    if !target_path.exists() {
        return Err("路径不存在".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let args = if target_path.is_file() {
            vec!["/select,".to_string(), path]
        } else {
            vec![path]
        };

        match Command::new("explorer").args(&args).spawn() {
            Ok(_) => Ok("成功在资源管理器中显示".to_string()),
            Err(e) => Err(format!("打开资源管理器失败: {}", e)),
        }
    }

    #[cfg(target_os = "macos")]
    {
        let args = if target_path.is_file() {
            vec!["-R".to_string(), path]
        } else {
            vec![path]
        };

        match Command::new("open").args(&args).spawn() {
            Ok(_) => Ok("成功在Finder中显示".to_string()),
            Err(e) => Err(format!("打开Finder失败: {}", e)),
        }
    }

    #[cfg(target_os = "linux")]
    {
        // 尝试常见的文件管理器
        let file_managers = ["nautilus", "dolphin", "thunar", "pcmanfm"];

        for manager in &file_managers {
            let args = if target_path.is_file() {
                vec!["--select".to_string(), path.clone()]
            } else {
                vec![path.clone()]
            };

            if let Ok(_) = Command::new(manager).args(&args).spawn() {
                return Ok(format!("成功在{}中显示", manager));
            }
        }

        // 如果没有找到文件管理器，尝试用xdg-open打开目录
        let dir_path = if target_path.is_file() {
            target_path
                .parent()
                .unwrap_or(target_path)
                .to_string_lossy()
                .to_string()
        } else {
            path
        };

        match Command::new("xdg-open").arg(&dir_path).spawn() {
            Ok(_) => Ok("成功打开目录".to_string()),
            Err(e) => Err(format!("打开文件管理器失败: {}", e)),
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("当前平台不支持此操作".to_string())
    }
}

// 应用设置相关的命令
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to 喵咕记事本!", name)
}

// 获取命令行参数中的文件路径
#[tauri::command]
async fn get_cli_args() -> Result<Vec<String>, String> {
    let args: Vec<String> = std::env::args().collect();

    // 输出启动信息到标准错误流，确保在当前终端显示
    // eprintln!("Miaogu Notepad - Starting application...");

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
            // 输出到控制台，显示打开的路径
            // eprintln!("Miaogu Notepad - Opening file: {}", arg);
            
            // 将相对路径转换为绝对路径
            let path = Path::new(&arg);

            // 检查是否为相对路径
            if path.is_relative() {
                // 获取当前工作目录
                match std::env::current_dir() {
                    Ok(current_dir) => {
                        let absolute_path = current_dir.join(path);
                        let abs_path_str = absolute_path.to_string_lossy().to_string();
                        // eprintln!("Miaogu Notepad - Resolved absolute path: {}", abs_path_str);
                        abs_path_str
                    }
                    Err(_) => {
                        // eprintln!("Miaogu Notepad - Cannot get current directory, using original path: {}", arg);
                        arg // 如果获取当前目录失败，返回原始参数
                    }
                }
            } else {
                // 如果已经是绝对路径，直接返回
                // eprintln!("Miaogu Notepad - Using absolute path: {}", arg);
                arg
            }
        })
        .collect();

    // 输出参数总数
    if !filtered_args.is_empty() {
        // eprintln!("Miaogu Notepad - Processed {} file argument(s)", filtered_args.len());
    } else {
        // eprintln!("Miaogu Notepad - No file arguments provided, starting with welcome screen");
    }

    Ok(filtered_args)
}

// 开始监听文件变更
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
        Ok(metadata) => metadata
            .modified()
            .map(|time| {
                time.duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            })
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
                                if let Some(last_modified) =
                                    state.watched_files.get_mut(&file_path_clone)
                                {
                                    // 只有当文件修改时间发生变化时才发送事件
                                    if let Ok(metadata) = fs::metadata(&path) {
                                        if let Ok(modified_time) = metadata.modified() {
                                            let current_modified = modified_time
                                                .duration_since(UNIX_EPOCH)
                                                .unwrap_or_default()
                                                .as_secs();

                                            if current_modified != *last_modified {
                                                *last_modified = current_modified;
                                                true
                                            } else {
                                                false
                                            }
                                        } else {
                                            true // 无法获取修改时间，发送事件
                                        }
                                    } else {
                                        true // 无法获取文件元数据，发送事件
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
        state
            .watched_files
            .insert(file_path.clone(), initial_modified);
    }

    Ok(true)
}

// 停止监听文件变更
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

// 检查文件是否被外部修改
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
        Ok(metadata) => metadata
            .modified()
            .map(|time| {
                time.duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            })
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

/// 在系统默认浏览器中打开URL
/// 使用系统默认浏览器打开指定的URL链接
///
/// # Arguments
/// * `url` - 要打开的URL地址
///
/// # Returns
/// * `Result<(), String>` - 操作结果
#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    // 如果是本地文件路径，直接使用系统默认程序打开
    if Path::new(&url).exists() {
        match open::that(&url) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("无法打开文件: {}", e)),
        }
    } else {
        // 对于URL，使用系统默认浏览器打开
        match open::that(&url) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("无法打开URL: {}", e)),
        }
    }
}

/// 启用防休眠模式
/// 防止系统进入休眠状态和显示器关闭，适用于全屏模式等场景
#[tauri::command]
async fn enable_prevent_sleep() -> Result<String, String> {
    #[cfg(windows)]
    {
        let result = unsafe {
            SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED)
        };

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

    #[cfg(not(windows))]
    {
        // 非Windows平台暂不支持
        Err("当前平台不支持防休眠功能".to_string())
    }
}

/// 禁用防休眠模式
/// 恢复系统正常的电源管理行为
#[tauri::command]
async fn disable_prevent_sleep() -> Result<String, String> {
    #[cfg(windows)]
    {
        let result = unsafe { SetThreadExecutionState(ES_CONTINUOUS) };

        if result != 0 {
            // 更新全局状态
            if let Ok(mut enabled) = PREVENT_SLEEP_ENABLED.lock() {
                *enabled = false;
            }
            Ok("防休眠模式已禁用".to_string())
        } else {
            Err("禁用防休眠模式失败".to_string())
        }
    }

    #[cfg(not(windows))]
    {
        // 非Windows平台暂不支持
        Err("当前平台不支持防休眠功能".to_string())
    }
}

/// 通过代理加载图片资源
///
/// # 参数
/// * `url` - 图片URL
/// * `proxy_config` - 代理配置
///
/// # 返回值
/// 返回包含图片数据的 ImageLoadResult
#[tauri::command]
async fn load_image_with_proxy(
    url: String,
    proxy_config: Option<ProxyConfig>,
) -> Result<ImageLoadResult, String> {
    println!(
        "Loading image: {} with proxy config: {:?}",
        url, proxy_config
    );

    // 创建 HTTP 客户端
    let mut client_builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

    // 配置代理
    if let Some(config) = proxy_config {
        if config.enabled {
            // 配置 HTTP 代理
            if let Some(http_proxy) = config.http_proxy {
                if let Ok(proxy) = reqwest::Proxy::http(&http_proxy) {
                    client_builder = client_builder.proxy(proxy);
                }
            }

            // 配置 HTTPS 代理
            if let Some(ref https_proxy) = config.https_proxy {
                if let Ok(proxy) = reqwest::Proxy::https(https_proxy) {
                    client_builder = client_builder.proxy(proxy);
                }
            }

            // 配置不使用代理的地址
            if let Some(no_proxy) = config.no_proxy {
                // 如果有 HTTPS 代理配置，使用它来设置 no_proxy
                if let Some(ref https_proxy_url) = config.https_proxy {
                    if let Ok(proxy) = reqwest::Proxy::all(https_proxy_url) {
                        let proxy_with_no_proxy =
                            proxy.no_proxy(reqwest::NoProxy::from_string(&no_proxy));
                        client_builder = client_builder.proxy(proxy_with_no_proxy);
                    }
                }
            }
        }
    }

    let client = client_builder
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // 发送请求
    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                let content_type = response
                    .headers()
                    .get("content-type")
                    .and_then(|ct| ct.to_str().ok())
                    .map(|s| s.to_string());

                match response.bytes().await {
                    Ok(bytes) => {
                        // 将图片数据转换为 Base64
                        let base64_data = base64::engine::general_purpose::STANDARD.encode(&bytes);

                        Ok(ImageLoadResult {
                            success: true,
                            data: Some(base64_data),
                            content_type,
                            error: None,
                        })
                    }
                    Err(e) => Ok(ImageLoadResult {
                        success: false,
                        data: None,
                        content_type: None,
                        error: Some(format!("Failed to read response body: {}", e)),
                    }),
                }
            } else {
                Ok(ImageLoadResult {
                    success: false,
                    data: None,
                    content_type: None,
                    error: Some(format!("HTTP error: {}", response.status())),
                })
            }
        }
        Err(e) => Ok(ImageLoadResult {
            success: false,
            data: None,
            content_type: None,
            error: Some(format!("Request failed: {}", e)),
        }),
    }
}

/// 获取系统代理设置
///
/// # 返回值
/// 返回系统代理配置
#[tauri::command]
async fn get_system_proxy() -> Result<ProxyConfig, String> {
    // 尝试从环境变量获取代理设置
    let http_proxy = std::env::var("HTTP_PROXY")
        .or_else(|_| std::env::var("http_proxy"))
        .ok();

    let https_proxy = std::env::var("HTTPS_PROXY")
        .or_else(|_| std::env::var("https_proxy"))
        .ok();

    let no_proxy = std::env::var("NO_PROXY")
        .or_else(|_| std::env::var("no_proxy"))
        .ok();

    let enabled = http_proxy.is_some() || https_proxy.is_some();

    Ok(ProxyConfig {
        enabled,
        http_proxy,
        https_proxy,
        no_proxy,
    })
}

/// 设置代理配置
///
/// # 参数
/// * `config` - 代理配置
///
/// # 返回值
/// 返回操作结果
#[tauri::command]
async fn set_proxy_config(config: ProxyConfig) -> Result<(), String> {
    // 这里可以将代理配置保存到应用配置中
    // 目前只是简单返回成功
    println!("Proxy config set: {:?}", config);
    Ok(())
}

/// 获取防休眠模式状态
/// 返回当前是否启用了防休眠模式
#[tauri::command]
async fn get_prevent_sleep_status() -> Result<bool, String> {
    match PREVENT_SLEEP_ENABLED.lock() {
        Ok(enabled) => Ok(*enabled),
        Err(_) => Err("Failed to get sleep prevention status".to_string()),
    }
}

/// 显示主窗口 - 由前端在加载完成后调用
#[tauri::command]
async fn show_main_window(app: AppHandle) -> Result<(), String> {
    match app.get_webview_window("main") {
        Some(window) => {
            window
                .show()
                .map_err(|e| format!("Failed to show window: {}", e))?;
            // println!("Main window displayed");
            Ok(())
        }
        None => Err("Main window not found".to_string()),
    }
}

/// Tauri应用程序运行函数
/// 初始化并启动Tauri应用程序，配置插件和命令处理器
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;
    use std::path::Path;

    let builder = tauri::Builder::default();

    // 在应用启动时处理命令行参数
    let args: Vec<String> = std::env::args().collect();
    
    // 过滤掉Tauri开发模式的参数
    let _filtered_args: Vec<String> = args
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
                        let abs_path_str = absolute_path.to_string_lossy().to_string();
                        abs_path_str
                    }
                    Err(_) => {
                        arg // 如果获取当前目录失败，返回原始参数
                    }
                }
            } else {
                // 如果已经是绝对路径，直接返回
                arg
            }
        })
        .collect();

    // 移除控制台输出代码，因为现在在 main.rs 中处理

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Windows 首次运行自动初始化 CLI 到 PATH
            #[cfg(windows)]
            {
                // ensure_cli_installed_on_first_run();
            }

            // 启动时清理残留的更新脚本
            #[cfg(windows)]
            {
                let current_exe = std::env::current_exe().unwrap_or_default();
                if let Some(current_dir) = current_exe.parent() {
                    let script_path = current_dir.join("restart_update.bat");
                    if script_path.exists() {
                        let _ = std::fs::remove_file(&script_path);
                        println!("Cleaned up restart_update.bat on startup");
                    }
                }
            }

            // 启动更新检查器 - 使用 tauri::async_runtime 来避免 Tokio 运行时错误
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_update_checker(app_handle).await {
                    eprintln!("Failed to start update checker: {}", e);
                }
            });

            // 获取主窗口
            let main_window = app
                .get_webview_window("main")
                .expect("failed to get main window");

            // 在 debug 模式下启用开发者工具（调试用）
            #[cfg(debug_assertions)]
            {
                main_window.open_devtools();
            }

            // 禁用右键菜单
            main_window
                .eval(
                    "
                document.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
                
                // 添加 F12 快捷键支持开发者工具
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'F12') {
                        e.preventDefault();
                        // 通过 Tauri API 切换开发者工具
                        window.__TAURI__.invoke('toggle_devtools');
                    }
                });
                
                // 确保在DOM加载后也生效
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() {
                        document.addEventListener('contextmenu', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        });
                        
                        document.addEventListener('keydown', function(e) {
                            if (e.key === 'F12') {
                                e.preventDefault();
                                window.__TAURI__.invoke('toggle_devtools');
                            }
                        });
                    });
                }
            ",
                )
                .unwrap_or_else(|e| {
                    eprintln!("Failed to inject context menu disable script: {}", e);
                });

            // 将窗口句柄存储到应用状态中，供前端调用
            app.manage(main_window);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            read_file_content,
            write_file_content,
            check_file_exists,
            get_file_info,
            set_open_file,
            save_file,
            get_directory_contents,
            rename_file,
            update_file_line_ending,
            execute_file,
            open_in_terminal,
            show_in_explorer,
            get_cli_args,
            start_file_watching,
            stop_file_watching,
            check_file_external_changes,
            open_url,
            enable_prevent_sleep,
            disable_prevent_sleep,
            get_prevent_sleep_status,
            show_main_window,
            load_image_with_proxy,
            get_system_proxy,
            set_proxy_config,
            // 注册 CLI 管理命令
            install_cli,
            uninstall_cli,
            check_cli_installed,
            // 开发者工具切换命令
            toggle_devtools,
            // 自动更新相关命令
            check_for_updates,
            download_update,
            install_update,
            perform_auto_update,
            start_update_checker,
            stop_update_checker,
            // 获取应用程序路径信息
            get_app_path_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 在 Windows 平台提供 CLI 安装/卸载/检查命令
#[tauri::command]
#[cfg(windows)]
async fn install_cli(command_name: Option<String>) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    use std::process::Command;

    let exe_path =
        std::env::current_exe().map_err(|e| format!("无法获取当前可执行文件路径: {}", e))?;
    let local_appdata =
        std::env::var("LOCALAPPDATA").map_err(|e| format!("无法获取 LOCALAPPDATA: {}", e))?;

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
  "%EXE%"
) else (
  "%EXE%" %*
)
"#,
        exe = sanitized_exe
    );
    fs::write(&shim_path, shim_content).map_err(|e| format!("写入 CLI 启动脚本失败: {}", e))?;

    // 将 bin 目录加入用户 PATH（若不存在）
    let bin_str = bin_dir.to_string_lossy().replace("\\", "\\\\");
    let ps_script = format!(
        "${{bin}} = '{}'; $old = [Environment]::GetEnvironmentVariable('Path','User'); if ([string]::IsNullOrWhiteSpace($old)) {{ $new = $bin }} else {{ $parts = ($old -split ';') | ForEach-Object {{ $_.Trim() }} | Where-Object {{ $_ -ne '' }}; if ($parts | Where-Object {{ $_.ToLower() -eq $bin.ToLower() }}) {{ $new = $old }} else {{ $new = ($old.TrimEnd(';') + ';' + $bin) }} }}; [Environment]::SetEnvironmentVariable('Path',$new,'User')",
        bin_str
    );
    Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &ps_script,
        ])
        .status()
        .map_err(|e| format!("更新 PATH 失败: {}", e))?;

    // 广播环境变量变更
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG,
    };
    const WM_SETTINGCHANGE: u32 = 0x001A;
    let env_wide: Vec<u16> = "Environment\0".encode_utf16().collect();
    unsafe {
        let mut _result: usize = 0;
        let _ = SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            env_wide.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5000,
            &mut _result,
        );
    }

    Ok(format!("已安装 CLI: {}", cmd_name))
}

#[tauri::command]
#[cfg(windows)]
async fn uninstall_cli() -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    use std::process::Command;

    let local_appdata =
        std::env::var("LOCALAPPDATA").map_err(|e| format!("无法获取 LOCALAPPDATA: {}", e))?;
    let bin_dir = Path::new(&local_appdata).join("miaogu-notepad").join("bin");

    // 删除 bin 目录（如果存在）
    if bin_dir.exists() {
        fs::remove_dir_all(&bin_dir).map_err(|e| format!("删除 bin 目录失败: {}", e))?;
    }

    // 从用户 PATH 中移除该目录
    let bin_str = bin_dir.to_string_lossy().replace("\\", "\\\\");
    let ps_script = format!(
        "${{bin}} = '{}'; $old = [Environment]::GetEnvironmentVariable('Path','User'); $parts = ($old -split ';') | ForEach-Object {{ $_.Trim() }} | Where-Object {{ $_ -ne '' }}; $filtered = $parts | Where-Object {{ $_.ToLower() -ne $bin.ToLower() }}; $new = [string]::Join(';', $filtered); [Environment]::SetEnvironmentVariable('Path',$new,'User')",
        bin_str
    );
    Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &ps_script,
        ])
        .status()
        .map_err(|e| format!("更新 PATH 失败: {}", e))?;

    // 广播环境变量变更
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG,
    };
    const WM_SETTINGCHANGE: u32 = 0x001A;
    let env_wide: Vec<u16> = "Environment\0".encode_utf16().collect();
    unsafe {
        let mut _result: usize = 0;
        let _ = SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            env_wide.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5000,
            &mut _result,
        );
    }

    Ok("已卸载 CLI".to_string())
}

#[tauri::command]
#[cfg(windows)]
async fn check_cli_installed() -> Result<bool, String> {
    use std::fs;
    use std::path::Path;

    let local_appdata =
        std::env::var("LOCALAPPDATA").map_err(|e| format!("无法获取 LOCALAPPDATA: {}", e))?;
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
            p.extension()
                .map(|ext| ext.to_string_lossy() == "cmd")
                .unwrap_or(false)
        });

    Ok(has_cmd)
}

// 非 Windows 平台提供占位实现，避免编译错误
#[tauri::command]
#[cfg(not(windows))]
async fn install_cli(_command_name: Option<String>) -> Result<String, String> {
    Err("仅在 Windows 平台支持 CLI 安装".to_string())
}

#[tauri::command]
#[cfg(not(windows))]
async fn uninstall_cli() -> Result<String, String> {
    Err("仅在 Windows 平台支持 CLI 卸载".to_string())
}

#[tauri::command]
#[cfg(not(windows))]
async fn check_cli_installed() -> Result<bool, String> {
    Ok(false)
}

// 开发者工具切换命令
#[tauri::command]
async fn toggle_devtools(app: AppHandle) -> Result<(), String> {
    let _main_window = app
        .get_webview_window("main")
        .ok_or("无法获取主窗口")?;
    
    // 切换开发者工具的显示状态
    #[cfg(debug_assertions)]
    if _main_window.is_devtools_open() {
        _main_window.close_devtools();
    } else {
        _main_window.open_devtools();
    }
    
    Ok(())
}

/// 检查更新
/// 从GitHub Releases API获取最新版本信息并与当前版本比较
#[tauri::command]
async fn check_for_updates() -> Result<VersionInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    let repo_url = "https://api.github.com/repos/hhyufan/miaogu-notepad/releases/latest";
    
    println!("=== 后端调试信息 ===");
    println!("当前版本 (CARGO_PKG_VERSION): {}", current_version);
    println!("检查更新URL: {}", repo_url);
    
    let client = reqwest::Client::new();
    let response = client
        .get(repo_url)
        .header("User-Agent", "miaogu-notepad")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API returned status: {}", response.status()));
    }
    
    let response_text = response.text().await
        .map_err(|e| format!("Failed to get response text: {}", e))?;
    
    let release: GitHubRelease = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse release info: {}", e))?;
    
    // 移除版本号前的 'v' 前缀（如果存在）
    let latest_version = release.tag_name.trim_start_matches('v');
    let has_update = version_compare(current_version, latest_version);
    
    println!("GitHub最新版本: {}", latest_version);
    println!("版本比较结果 (需要更新): {}", has_update);
    
    // 查找Windows exe文件
    let download_url = release.assets
        .iter()
        .find(|asset| asset.name.ends_with(".exe") && !asset.name.contains("setup"))
        .map(|asset| asset.browser_download_url.clone());
    
    let version_info = VersionInfo {
        current_version: current_version.to_string(),
        latest_version: latest_version.to_string(),
        has_update,
        download_url,
        release_notes: release.body,
        published_at: Some(release.published_at),
    };
    
    println!("返回的VersionInfo: {:?}", version_info);
    println!("=== 后端调试信息结束 ===");
    
    Ok(version_info)
}

/// 启动定时更新检查任务
#[tauri::command]
async fn start_update_checker(app_handle: AppHandle) -> Result<String, String> {
    let mut is_running = UPDATE_CHECK_RUNNING.lock().map_err(|e| format!("Failed to lock update checker state: {}", e))?;
    
    if *is_running {
        return Ok("Update checker is already running".to_string());
    }
    
    *is_running = true;
    drop(is_running); // 释放锁
    
    let app_handle_clone = app_handle.clone();
    
    // 启动后台任务 - 使用 tauri::async_runtime 来避免 Tokio 运行时错误
    tauri::async_runtime::spawn(async move {
        let mut interval = interval(Duration::from_secs(3600)); // 每小时检查一次
        
        loop {
            interval.tick().await;
            
            // 检查是否应该继续运行
            {
                let is_running = UPDATE_CHECK_RUNNING.lock().unwrap();
                if !*is_running {
                    break;
                }
            }
            
            // 执行更新检查
            match check_for_updates().await {
                Ok(version_info) => {
                    if version_info.has_update {
                        // 发送更新可用事件到前端
                        let _ = app_handle_clone.emit("update-available", &version_info);
                        println!("Update available: {} -> {}", version_info.current_version, version_info.latest_version);
                    }
                }
                Err(e) => {
                    println!("Update check failed: {}", e);
                }
            }
        }
        
        println!("Update checker stopped");
    });
    
    Ok("Update checker started".to_string())
}

/// 停止定时更新检查任务
#[tauri::command]
async fn stop_update_checker() -> Result<String, String> {
    let mut is_running = UPDATE_CHECK_RUNNING.lock().map_err(|e| format!("Failed to lock update checker state: {}", e))?;
    *is_running = false;
    Ok("Update checker stopped".to_string())
}

/// 简单的版本比较函数
/// 比较两个版本号，返回是否需要更新
fn version_compare(current: &str, latest: &str) -> bool {
    let current_parts: Vec<u32> = current
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let latest_parts: Vec<u32> = latest
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    
    let max_len = current_parts.len().max(latest_parts.len());
    
    for i in 0..max_len {
        let current_part = current_parts.get(i).unwrap_or(&0);
        let latest_part = latest_parts.get(i).unwrap_or(&0);
        
        if latest_part > current_part {
            return true;
        } else if latest_part < current_part {
            return false;
        }
    }
    
    false
}

/// 下载更新文件
/// 从指定URL下载exe文件到临时位置
#[tauri::command]
async fn download_update(
    app_handle: AppHandle,
    downloadUrl: String,
) -> Result<String, String> {
    println!("Starting download from: {}", downloadUrl);
    
    // 发送下载开始事件
    let _ = app_handle.emit("update-progress", UpdateProgress {
        stage: "downloading".to_string(),
        progress: 0.0,
        message: "开始下载更新文件...".to_string(),
        error: None,
    });
    
    let client = external_reqwest::Client::new();
    let response = client
        .get(&downloadUrl)
        .header("User-Agent", "miaogu-notepad")
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }
    
    let _total_size = response.content_length().unwrap_or(0);
    
    // 获取当前exe文件路径
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current exe path: {}", e))?;
    
    let current_dir = current_exe.parent()
        .ok_or("Failed to get current directory")?;
    
    let temp_file_path = current_dir.join("miaogu-notepad.new.exe");
    
    // 创建文件
    let mut file = std::fs::File::create(&temp_file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
    // 使用流式下载以支持进度更新
    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let total_size = _total_size;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Failed to read chunk: {}", e))?;
        
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        // 计算并发送进度更新
        let progress = if total_size > 0 {
            downloaded as f64 / total_size as f64
        } else {
            0.0
        };
        
        // 每下载一定量数据就发送一次进度更新（避免过于频繁）
        if downloaded % (512 * 1024) == 0 || progress >= 1.0 {
            let _ = app_handle.emit("update-progress", UpdateProgress {
                stage: "downloading".to_string(),
                progress,
                message: format!("正在下载... {:.1}%", progress * 100.0),
                error: None,
            });
        }
    }
    
    // 发送完成进度
    let _ = app_handle.emit("update-progress", UpdateProgress {
        stage: "downloading".to_string(),
        progress: 1.0,
        message: "下载完成".to_string(),
        error: None,
    });
    
    file.flush().map_err(|e| format!("Failed to flush file: {}", e))?;
    
    println!("Download completed: {}", temp_file_path.display());
    
    Ok(temp_file_path.to_string_lossy().to_string())
}

/// 安装更新
/// 执行文件替换：当前exe -> .old，新exe -> 当前名称，删除.old
#[tauri::command]
async fn install_update(
    app_handle: AppHandle,
    new_file_path: String,
) -> Result<String, String> {
    println!("Installing update from: {}", new_file_path);
    
    // 发送安装开始事件
    let _ = app_handle.emit("update-progress", UpdateProgress {
        stage: "installing".to_string(),
        progress: 0.0,
        message: "开始安装更新...".to_string(),
        error: None,
    });
    
    let new_path = Path::new(&new_file_path);
    if !new_path.exists() {
        return Err("New file not found".to_string());
    }
    
    // 获取当前exe路径
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current exe path: {}", e))?;
    
    let current_dir = current_exe.parent()
        .ok_or("Failed to get current directory")?;
    
    let old_exe_path = current_dir.join("miaogu-notepad.old.exe");
    let target_exe_path = current_dir.join("miaogu-notepad.exe");
    
    // 步骤1: 如果存在旧的.old文件，先删除
    if old_exe_path.exists() {
        std::fs::remove_file(&old_exe_path)
            .map_err(|e| format!("Failed to remove old backup: {}", e))?;
    }
    
    let _ = app_handle.emit("update-progress", UpdateProgress {
        stage: "installing".to_string(),
        progress: 0.25,
        message: "备份当前版本...".to_string(),
        error: None,
    });
    
    // 步骤2: 将当前exe重命名为.old
    std::fs::rename(&current_exe, &old_exe_path)
        .map_err(|e| format!("Failed to backup current exe: {}", e))?;
    
    let _ = app_handle.emit("update-progress", UpdateProgress {
        stage: "installing".to_string(),
        progress: 0.5,
        message: "安装新版本...".to_string(),
        error: None,
    });
    
    // 步骤3: 将.new文件重命名为目标exe名称
    std::fs::rename(&new_path, &target_exe_path)
        .map_err(|e| {
            // 如果失败，尝试恢复
            let _ = std::fs::rename(&old_exe_path, &current_exe);
            format!("Failed to install new exe: {}", e)
        })?;
    
    let _ = app_handle.emit("update-progress", UpdateProgress {
        stage: "installing".to_string(),
        progress: 0.75,
        message: "准备重启应用...".to_string(),
        error: None,
    });
    
    let _ = app_handle.emit("update-progress", UpdateProgress {
        stage: "completed".to_string(),
        progress: 1.0,
        message: "更新安装完成！正在重启应用程序...".to_string(),
        error: None,
    });
    
    println!("Update installation completed successfully");
    
    // 启动新应用程序
    let new_exe_path = target_exe_path.to_string_lossy().to_string();
    
    #[cfg(windows)]
    {
        use std::process::Command;
        
        // 创建一个批处理脚本来处理重启逻辑
        let batch_script = format!(
            r#"@echo off
timeout /t 2 /nobreak >nul
if exist "{}" del "{}"
start "" "{}"
"#,
            old_exe_path.to_string_lossy(),
            old_exe_path.to_string_lossy(),
            new_exe_path
        );
        
        let script_path = current_dir.join("restart_update.bat");
        std::fs::write(&script_path, batch_script)
            .map_err(|e| format!("Failed to create restart script: {}", e))?;
        
        // 启动批处理脚本
        Command::new("cmd")
            .args(&["/C", &script_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to start restart script: {}", e))?;
    }
    
    #[cfg(not(windows))]
    {
        use std::process::Command;
        
        // 在非Windows系统上直接启动新应用
        Command::new(&new_exe_path)
            .spawn()
            .map_err(|e| format!("Failed to start new application: {}", e))?;
        
        // 删除旧文件
        if old_exe_path.exists() {
            let _ = std::fs::remove_file(&old_exe_path);
        }
    }
    
    // 退出当前应用程序
    std::process::exit(0);
}

/// 执行完整的自动更新流程
#[tauri::command]
async fn perform_auto_update(app_handle: AppHandle) -> Result<String, String> {
    println!("Starting auto update process");
    
    // 步骤1: 检查更新
    let _ = app_handle.emit("update-progress", UpdateProgress {
        stage: "checking".to_string(),
        progress: 0.0,
        message: "检查更新中...".to_string(),
        error: None,
    });
    
    let version_info = match check_for_updates().await {
        Ok(info) => info,
        Err(e) => {
            let error_msg = format!("检查更新失败: {}", e);
            let _ = app_handle.emit("update-progress", UpdateProgress {
                stage: "error".to_string(),
                progress: 0.0,
                message: "检查更新失败".to_string(),
                error: Some(error_msg.clone()),
            });
            return Err(error_msg);
        }
    };
    
    if !version_info.has_update {
        let _ = app_handle.emit("update-progress", UpdateProgress {
            stage: "completed".to_string(),
            progress: 1.0,
            message: "当前已是最新版本".to_string(),
            error: None,
        });
        return Ok("No update available".to_string());
    }
    
    let download_url = match version_info.download_url {
        Some(url) => url,
        None => {
            let error_msg = "未找到下载链接".to_string();
            let _ = app_handle.emit("update-progress", UpdateProgress {
                stage: "error".to_string(),
                progress: 0.0,
                message: "获取下载链接失败".to_string(),
                error: Some(error_msg.clone()),
            });
            return Err(error_msg);
        }
    };
    
    // 步骤2: 下载更新
    let temp_file_path = match download_update(app_handle.clone(), download_url).await {
        Ok(path) => path,
        Err(e) => {
            let error_msg = format!("下载更新失败: {}", e);
            let _ = app_handle.emit("update-progress", UpdateProgress {
                stage: "error".to_string(),
                progress: 0.0,
                message: "下载更新失败".to_string(),
                error: Some(error_msg.clone()),
            });
            return Err(error_msg);
        }
    };
    
    // 步骤3: 安装更新
    match install_update(app_handle.clone(), temp_file_path).await {
        Ok(result) => Ok(result),
        Err(e) => {
            let error_msg = format!("安装更新失败: {}", e);
            let _ = app_handle.emit("update-progress", UpdateProgress {
                stage: "error".to_string(),
                progress: 0.0,
                message: "安装更新失败".to_string(),
                error: Some(error_msg.clone()),
            });
            Err(error_msg)
        }
    }
}
