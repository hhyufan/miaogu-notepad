/*!
 * @fileoverview Tauri应用程序入口点
 *
 * 喵咕记事本 - 基于Tauri的跨平台文本编辑器
 *
 * @author hhyufan
 * @version 1.3.0
 */

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(all(not(debug_assertions)), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::path::Path;

#[cfg(windows)]
use windows_sys::Win32::System::Console::AttachConsole;

fn main() {
    // 设置环境变量来抑制libpng警告
    env::set_var("LIBPNG_SUPPRESS_WARNINGS", "1");
    env::set_var("PNG_SKIP_SETJMP_CHECK", "1");
    // 抑制所有PNG相关的警告输出
    env::set_var("RUST_LOG", "error");
    
    // 获取命令行参数
    let args: Vec<String> = env::args().collect();
    
    // 无论是否有参数，都附加到控制台以确保行为一致
    #[cfg(windows)]
    {
        unsafe {
            // 只尝试附加到父进程的控制台，不创建新的控制台
            AttachConsole(0xFFFFFFFF); // ATTACH_PARENT_PROCESS
            // 不检查返回值，如果附加失败就直接使用eprintln!
        }
    }
    
    // 输出统一格式的启动信息
    eprintln!("Miaogu Notepad - Starting application...");
    
    // 如果有命令行参数，处理文件路径
    if args.len() > 1 {
        for (i, arg) in args.iter().enumerate() {
            if i > 0 { // 跳过程序名
                let file_path = Path::new(arg);
                
                // 如果文件不存在，创建它
                if !file_path.exists() {
                    // 确保父目录存在
                    if let Some(parent) = file_path.parent() {
                        if !parent.exists() {
                            if let Err(e) = fs::create_dir_all(parent) {
                                eprintln!("Miaogu Notepad - Failed to create directory: {}", parent.display());
                                eprintln!("Miaogu Notepad - Error: {}", e);
                                eprintln!("Miaogu Notepad - Please check directory permissions or try running as administrator");
                                return;
                            }
                        }
                    }
                    
                    // 创建空文件
                    if let Err(e) = fs::write(file_path, "") {
                        eprintln!("Miaogu Notepad - Failed to open file: {}", arg);
                        eprintln!("Miaogu Notepad - Error: {}", e);
                        eprintln!("Miaogu Notepad - Please check file permissions or try running as administrator");
                        return;
                    }
                    eprintln!("Miaogu Notepad - Created and opening file: {}", arg);
                } else {
                    eprintln!("Miaogu Notepad - Opening file: {}", arg);
                }
            }
        }
    }

    miaogu_notepad_lib::run()
}
