/*!
 * @fileoverview Tauri应用程序入口点
 *
 * 喵咕记事本 - 基于Tauri的跨平台文本编辑器
 *
 * @author hhyufan
 * @version 1.2.0
 */

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    miaogu_notepad_lib::run()
}
