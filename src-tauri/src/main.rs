/*!
 * @fileoverview Tauri应用程序入口点
 *
 * 喵咕记事本 - 基于Tauri的跨平台文本编辑器
 *
 * @author hhyufan
 * @version 1.3.1
 */

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(all(not(debug_assertions)), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::path::Path;

use miaogu_notepad_lib::FileProcessingError;

#[cfg(windows)]
use windows_sys::Win32::System::Console::AttachConsole;

fn main() {
    setup_env();
    setup_console();

    eprintln!("Miaogu Notepad - Starting application...");

    // 处理命令行参数
    if let Err(e) = env::args()
        .skip(1)
        .map(process_file_argument)
        .collect::<Result<Vec<_>, _>>()
    {
        eprintln!("Miaogu Notepad - Error: {}", e);
        eprintln!(
            "Miaogu Notepad - Please check file permissions or try running as administrator."
        );

        return;
    }

    miaogu_notepad_lib::run()
}

fn setup_env() {
    // 设置环境变量来抑制 libpng 警告
    [
        "LIBPNG_SUPPRESS_WARNINGS",
        "PNG_SKIP_SETJMP_CHECK",
        "RUST_LOG",
    ]
    .iter()
    .zip(["1", "1", "error"].iter())
    .for_each(|(var, value)| env::set_var(var, value));
}

fn setup_console() {
    // 无论是否有参数，都附加到控制台以确保行为一致
    #[cfg(windows)]
    {
        unsafe {
            // 只尝试附加到父进程的控制台，不创建新的控制台
            AttachConsole(0xFFFFFFFF); // ATTACH_PARENT_PROCESS
                                       // 不检查返回值，如果附加失败就直接使用eprintln!
        }
    }
}

fn process_file_argument(file_path: String) -> Result<(), FileProcessingError> {
    let path = Path::new(&file_path);

    match path.exists() {
        true => {
            eprintln!("Miaogu Notepad - Opening file: {}", file_path);
            Ok(())
        }

        false => create_and_announce_file(path, &file_path),
    }
}

fn create_and_announce_file(path: &Path, file_path: &str) -> Result<(), FileProcessingError> {
    create_file_with_parents(path)?;

    eprintln!("Miaogu Notepad - Created and opening file: {}", file_path);
    Ok(())
}

fn create_file_with_parents(path: &Path) -> Result<(), FileProcessingError> {
    // 使用函数式编程处理父目录创建
    path.parent().map(ensure_directory_exists).transpose()?;

    fs::write(path, "").map_err(|e| FileProcessingError::FileCreation(path.to_path_buf(), e))?;

    Ok(())
}

fn ensure_directory_exists(dir: &Path) -> Result<(), FileProcessingError> {
    if !dir.exists() {
        fs::create_dir_all(dir)
            .map_err(|e| FileProcessingError::DirectoryCreation(dir.to_path_buf(), e))?;
    }

    Ok(())
}
