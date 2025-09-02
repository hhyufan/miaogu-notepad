use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use encoding_rs::{Encoding, UTF_8};

// 文件信息结构体
#[derive(Serialize, Deserialize, Debug, Clone)]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    is_file: bool,
    is_dir: bool,
    modified: u64,
}

// 文件操作结果结构体
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

// 检测文件编码
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

// 检测行尾序列
fn detect_line_ending(content: &str) -> String {
    if content.contains("\r\n") {
        "CRLF".to_string()
    } else if content.contains('\r') && !content.contains('\n') {
        "CR".to_string()
    } else {
        "LF".to_string()
    }
}

// 文件操作相关的命令
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
        },
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("Failed to read file: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        })
    }
}

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

#[tauri::command]
async fn check_file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let file_path = Path::new(&path);
    match fs::metadata(&path) {
        Ok(metadata) => {
            let file_name = file_path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            Ok(FileInfo {
                name: file_name,
                path: path.clone(),
                size: metadata.len(),
                is_file: metadata.is_file(),
                is_dir: metadata.is_dir(),
                modified: metadata.modified()
                    .map(|time| time.duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default().as_secs())
                    .unwrap_or(0),
            })
        },
        Err(e) => Err(format!("Failed to get file info: {}", e)),
    }
}

// 设置打开文件（类似主项目的setOpenFile）
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
            let file_name = path.file_name()
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
        },
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("读取文件失败: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        })
    }
}

// 保存文件（类似主项目的saveFile）
#[tauri::command]
async fn save_file(file_path: String, content: String, encoding: Option<String>) -> Result<FileOperationResult, String> {
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
            let file_name = path.file_name()
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
        },
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("保存文件失败: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        })
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
                            modified: metadata.modified()
                                .map(|time| time.duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default().as_secs())
                                .unwrap_or(0),
                        });
                    }
                }
            }
            Ok(contents)
        },
        Err(e) => Err(format!("读取目录失败: {}", e))
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
            let new_file_name = new_file_path.file_name()
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
        },
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("文件重命名失败: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        })
    }
}

// 更新文件行尾序列
#[tauri::command]
async fn update_file_line_ending(file_path: String, line_ending: String) -> Result<FileOperationResult, String> {
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
                "LF" => {}, // LF是默认格式，无需转换
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

            match fs::write(&file_path, &content) {
                Ok(_) => {
                    let file_name = path.file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("未知文件")
                        .to_string();
                    
                    Ok(FileOperationResult {
                        success: true,
                        message: "文件行尾序列已更新".to_string(),
                        content: None,
                        file_path: Some(file_path),
                        file_name: Some(file_name),
                        encoding: Some("UTF-8".to_string()),
                        line_ending: Some(line_ending),
                    })
                },
                Err(e) => Ok(FileOperationResult {
                    success: false,
                    message: format!("写入文件失败: {}", e),
                    content: None,
                    file_path: None,
                    file_name: None,
                    encoding: None,
                    line_ending: None,
                })
            }
        },
        Err(e) => Ok(FileOperationResult {
            success: false,
            message: format!("读取文件失败: {}", e),
            content: None,
            file_path: None,
            file_name: None,
            encoding: None,
            line_ending: None,
        })
    }
}

// 应用设置相关的命令
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to 喵咕记事本!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
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
            update_file_line_ending
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
