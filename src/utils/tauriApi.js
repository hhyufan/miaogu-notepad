import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists, readFile } from '@tauri-apps/plugin-fs';
import { Store } from '@tauri-apps/plugin-store';

// 创建持久化存储实例
let store = null;
let storeInitialized = false;
let useLocalStorage = false;

// 初始化 store
const initStore = async () => {
  if (storeInitialized) return store;
  
  try {
    if (typeof window !== 'undefined' && window.__TAURI__) {
      store = new Store('settings.json');
      storeInitialized = true;
      console.log('Tauri store initialized successfully');
    } else {
      // 在非 Tauri 环境中使用 localStorage 作为备用
      useLocalStorage = true;
      storeInitialized = true;
      console.log('Using localStorage as fallback storage');
    }
  } catch (error) {
    console.warn('Failed to initialize Tauri store, using localStorage:', error);
    useLocalStorage = true;
    storeInitialized = true;
  }
  
  return store;
};

// localStorage 备用存储方法
const localStorageStore = {
  async get(key) {
    try {
      const value = localStorage.getItem(`miaogu-notepad-${key}`);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Failed to get from localStorage:', error);
      return null;
    }
  },
  
  async set(key, value) {
    try {
      localStorage.setItem(`miaogu-notepad-${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to set to localStorage:', error);
      throw error;
    }
  },
  
  async delete(key) {
    try {
      localStorage.removeItem(`miaogu-notepad-${key}`);
    } catch (error) {
      console.error('Failed to delete from localStorage:', error);
      throw error;
    }
  },
  
  async clear() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('miaogu-notepad-'));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      throw error;
    }
  },
  
  async entries() {
    try {
      const entries = {};
      const keys = Object.keys(localStorage).filter(key => key.startsWith('miaogu-notepad-'));
      keys.forEach(key => {
        const actualKey = key.replace('miaogu-notepad-', '');
        const value = localStorage.getItem(key);
        try {
          entries[actualKey] = JSON.parse(value);
        } catch {
          entries[actualKey] = value;
        }
      });
      return entries;
    } catch (error) {
      console.error('Failed to get entries from localStorage:', error);
      return {};
    }
  },
  
  async save() {
    // localStorage 自动保存，无需额外操作
  }
};

// 文件操作 API
export const fileApi = {
  // 打开文件对话框
  async openFileDialog(t) {
    try {
      return await open({
        multiple: false,
        title: t ? t('dialog.fileDialog.openFile') : 'Open File',
        filters: [{
          name: t ? t('dialog.fileFilter.allFiles') : 'All Files',
          extensions: ['*']
        }]
      });
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      throw error;
    }
  },

  // 保存文件对话框
  async saveFileDialog(defaultName = 'untitled.txt', t, isNewFile = false) {
    try {
      // 检查文件名是否有扩展名，如果没有则添加 .txt
      let finalDefaultName = defaultName;
      if (defaultName && !defaultName.includes('.')) {
        finalDefaultName = `${defaultName}.txt`;
      }
      
      // 根据是否是新文件来决定标题
      const title = isNewFile 
        ? (t ? t('dialog.fileDialog.saveAs') : 'Save As')
        : (t ? t('dialog.fileDialog.saveFile') : 'Save File');
      
      return await save({
        defaultPath: finalDefaultName,
        title: title,
        filters: [{
          name: t ? t('dialog.fileFilter.allFiles') : 'All Files',
          extensions: ['*']
        }]
      });
    } catch (error) {
      console.error('Failed to open save dialog:', error);
      throw error;
    }
  },

  // 选择图片对话框
  async selectImageDialog(t) {
    try {
      const selected = await open({
        title: t ? t('dialog.fileDialog.selectImage') : 'Select Image',
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']
        }]
      });
      
      if (selected && !Array.isArray(selected)) {
        // 读取二进制文件内容并获取base64
        const base64 = await this.readBinaryFile(selected);
        // 根据文件扩展名确定MIME类型
        const ext = selected.split('.').pop().toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'bmp') mimeType = 'image/bmp';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'svg') mimeType = 'image/svg+xml';
        
        return `data:${mimeType};base64,${base64}`;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to open image selection dialog:', error);
      throw error;
    }
  },

  // 读取文件内容
  async readFile(filePath) {
    try {
      return await readTextFile(filePath);
    } catch (error) {
      // 忽略回调相关的错误，避免控制台噪音
      if (error.message && error.message.includes('callback id')) {
        console.warn('Tauri callback interrupted, this is expected during page reloads');
        throw new Error('Operation interrupted');
      }
      console.error('Failed to read file:', error);
      throw error;
    }
  },

  // 读取二进制文件内容（用于图片等）
  async readBinaryFile(filePath) {
    try {
      const data = await readFile(filePath);
      // 将Uint8Array转换为base64，使用更安全的方法
      let binary = '';
      const bytes = new Uint8Array(data);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return base64;
    } catch (error) {
      console.error('Failed to read binary file:', error);
      throw error;
    }
  },

  // 写入文件内容
  async writeFile(filePath, content) {
    try {
      await writeTextFile(filePath, content);
      return { success: true };
    } catch (error) {
      console.error('Failed to write file:', error);
      throw error;
    }
  },

  // 检查文件是否存在
  async fileExists(filePath) {
    try {
      return await exists(filePath);
    } catch (error) {
      // 忽略回调相关的错误，避免控制台噪音
      if (error.message && error.message.includes('callback id')) {
        console.warn('Tauri callback interrupted, this is expected during page reloads');
        return false;
      }
      console.error('Failed to check file existence:', error);
      return false;
    }
  },

  // 使用 Tauri 命令读取文件
  async readFileContent(filePath) {
    try {
      const result = await invoke('read_file_content', { path: filePath });
      return {
        content: result.content || '',
        encoding: result.encoding || 'UTF-8',
        lineEnding: result.line_ending || 'LF'
      };
    } catch (error) {
      // 忽略回调相关的错误，避免控制台噪音
      if (error.message && error.message.includes('callback id')) {
        console.warn('Tauri callback interrupted, this is expected during page reloads');
        throw new Error('Operation interrupted');
      }
      console.error('Failed to read file content:', error);
      throw error;
    }
  },

  // 使用 Tauri 命令写入文件
  async writeFileContent(filePath, content) {
    try {
      await invoke('write_file_content', { path: filePath, content });
      return { success: true };
    } catch (error) {
      console.error('Failed to write file content:', error);
      throw error;
    }
  },

  // 检查文件是否存在（使用 Tauri 命令）
  async checkFileExists(filePath) {
    try {
      return await invoke('check_file_exists', { path: filePath });
    } catch (error) {
      console.error('Failed to check file exists:', error);
      return false;
    }
  },

  // 获取文件信息
  async getFileInfo(filePath) {
    try {
      return await invoke('get_file_info', { path: filePath });
    } catch (error) {
      console.error('Failed to get file info:', error);
      throw error;
    }
  },

  async updateFileLineEnding(filePath, lineEnding) {
    try {
      return await invoke('update_file_line_ending', { 
        filePath: filePath, 
        lineEnding: lineEnding 
      });
    } catch (error) {
      console.error('Failed to update file line ending:', error);
      throw error;
    }
  },

  // 设置打开文件（类似主项目的setOpenFile）
  async setOpenFile(filePath) {
    try {
      if (!filePath) {
        throw new Error('filePath is required');
      }
      return await invoke('set_open_file', { filePath: filePath });
    } catch (error) {
      console.error('Failed to set open file:', error);
      throw error;
    }
  },

  // 保存文件（类似主项目的saveFile）
  async saveFile(filePath, content, encoding = null) {
    try {
      return await invoke('save_file', { filePath, content, encoding });
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  },

  // 获取目录内容
async getDirectoryContents(dirPath) {
    try {
      const contents = await invoke('get_directory_contents', { dirPath });
      return contents;
    } catch (error) {
      console.error('Failed to get directory contents:', error);
      throw error;
    }
  },

  async renameFile(oldPath, newPath) {
    try {
      const result = await invoke('rename_file', { oldPath, newPath });
      return result;
    } catch (error) {
      console.error('Failed to rename file:', error);
      throw error;
    }
  }
};

// 设置存储 API
export const settingsApi = {
  // 获取设置
  async get(key, defaultValue = null) {
    try {
      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;
      if (!currentStore) {
        console.warn('Store not available, returning default value for:', key);
        return defaultValue;
      }
      const value = await currentStore.get(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      console.error('Failed to get setting:', error);
      return defaultValue;
    }
  },

  // 设置值
  async set(key, value) {
    try {
      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;
      if (!currentStore) {
        console.warn('Store not available, setting not saved:', key, value);
        return;
      }
      await currentStore.set(key, value);
      await currentStore.save();
    } catch (error) {
      console.error('Failed to set setting:', error);
      throw error;
    }
  },

  // 删除设置
  async delete(key) {
    try {
      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;
      if (!currentStore) {
        console.warn('Store not available, cannot delete:', key);
        return;
      }
      await currentStore.delete(key);
      await currentStore.save();
    } catch (error) {
      console.error('Failed to delete setting:', error);
      throw error;
    }
  },

  // 清空所有设置
  async clear() {
    try {
      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;
      if (!currentStore) {
        console.warn('Store not available, cannot clear settings');
        return;
      }
      await currentStore.clear();
      await currentStore.save();
    } catch (error) {
      console.error('Failed to clear settings:', error);
    }
  },

  // 获取所有设置
  async getAll() {
    try {
      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;
      if (!currentStore) {
        console.warn('Store not available, returning empty object');
        return {};
      }
      return await currentStore.entries();
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return {};
    }
  }
};

// 应用 API
export const appApi = {
  // 问候函数（测试用）
  async greet(name) {
    try {
      return await invoke('greet', { name });
    } catch (error) {
      console.error('Failed to greet:', error);
      throw error;
    }
  }
};

// 导出所有 API
export default {
  file: fileApi,
  settings: settingsApi,
  app: appApi
};