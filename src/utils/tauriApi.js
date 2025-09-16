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

    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {

      // 由于 Tauri Store API 存在兼容性问题，暂时使用 localStorage
      useLocalStorage = true;
      storeInitialized = true;
    } else {

      // 在非 Tauri 环境中使用 localStorage 作为备用
      useLocalStorage = true;
      storeInitialized = true;
    }
  } catch (error) {
    console.error('Store初始化失败，回退到localStorage:', error);
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
      return null;
    }
  },

  async set(key, value) {
    try {
      const storageKey = `miaogu-notepad-${key}`;
      const serializedValue = JSON.stringify(value);

      localStorage.setItem(storageKey, serializedValue);

    } catch (error) {
      console.error(`localStorage设置失败: ${key}`, error);
      // 检查是否是存储空间不足
      if (error.name === 'QuotaExceededError') {
        throw new Error('存储空间不足，请清理浏览器缓存');
      }
      throw new Error(`localStorage设置失败: ${error.message}`);
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(`miaogu-notepad-${key}`);
    } catch (error) {
      throw error;
    }
  },

  async clear() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('miaogu-notepad-'));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
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
      throw error;
    }
  },

  // 读取文件内容
  async readFile(filePath) {
    try {
      return await readTextFile(filePath);
    } catch (error) {
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
      throw error;
    }
  },

  // 写入文件内容
  async writeFile(filePath, content) {
    try {
      await writeTextFile(filePath, content);
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  // 检查文件是否存在
  async fileExists(filePath) {
    try {
      return await exists(filePath);
    } catch (error) {
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
      throw error;
    }
  },

  // 使用 Tauri 命令写入文件
  async writeFileContent(filePath, content) {
    try {
      await invoke('write_file_content', { path: filePath, content });
      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  // 检查文件是否存在（使用 Tauri 命令）
  async checkFileExists(filePath) {
    try {
      return await invoke('check_file_exists', { path: filePath });
    } catch (error) {
      return false;
    }
  },

  // 获取文件信息
  async getFileInfo(filePath) {
    try {
      return await invoke('get_file_info', { path: filePath });
    } catch (error) {
      throw new Error(`获取文件信息失败: ${error}`);
    }
  },

  async isDirectory(filePath) {
    try {
      const fileInfo = await invoke('get_file_info', { path: filePath });
      return fileInfo.is_dir;
    } catch (error) {
      console.error('检查目录失败:', error);
      return false;
    }
  },

  async updateFileLineEnding(filePath, lineEnding) {
    try {
      return await invoke('update_file_line_ending', {
        filePath: filePath,
        lineEnding: lineEnding
      });
    } catch (error) {
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
      throw error;
    }
  },

  // 保存文件（类似主项目的saveFile）
  async saveFile(filePath, content, encoding = null) {
    try {
      return await invoke('save_file', { filePath, content, encoding });
    } catch (error) {
      throw error;
    }
  },

  // 获取目录内容
async getDirectoryContents(dirPath) {
    try {
      const contents = await invoke('get_directory_contents', { dirPath });
      return contents;
    } catch (error) {
      throw error;
    }
  },

  async renameFile(oldPath, newPath) {
    try {
      return await invoke('rename_file', { oldPath, newPath });
    } catch (error) {
      throw error;
    }
  },

  // 执行文件
  async executeFile(filePath) {
    try {
      return await invoke('execute_file', { filePath });
    } catch (error) {
      throw error;
    }
  },

  // 在终端中打开
  async openInTerminal(path) {
    try {
      return await invoke('open_in_terminal', { path });
    } catch (error) {
      throw error;
    }
  },

  // 在资源管理器中显示
   async showInExplorer(path) {
     try {
       return await invoke('show_in_explorer', { path });
     } catch (error) {
       throw error;
     }
   },

  // 开始文件监听
  async startFileWatching(filePath) {
    try {
      return await invoke('start_file_watching', { filePath });
    } catch (error) {
      throw error;
    }
  },

  // 停止文件监听
  async stopFileWatching(filePath) {
    try {
      return await invoke('stop_file_watching', { filePath });
    } catch (error) {
      throw error;
    }
  },

  // 检查文件外部变更
  async checkFileExternalChanges(filePath) {
    try {
      return await invoke('check_file_external_changes', { filePath });
    } catch (error) {
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
        return defaultValue;
      }
      const value = await currentStore.get(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  },

  // 设置值
  async set(key, value) {
    try {

      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;


      if (!currentStore) {
        console.error('存储实例为空');
        throw new Error('存储实例初始化失败');
      }

      await currentStore.set(key, value);


      if (currentStore.save) {
        await currentStore.save();

      }
    } catch (error) {
      console.error(`设置 ${key} 失败:`, error);
      throw error;
    }
  },

  // 删除设置
  async delete(key) {
    try {
      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;
      if (!currentStore) {
        return;
      }
      await currentStore.delete(key);
      await currentStore.save();
    } catch (error) {
      throw error;
    }
  },

  // 清空所有设置
  async clear() {
    try {
      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;
      if (!currentStore) {
        return;
      }
      await currentStore.clear();
      await currentStore.save();
    } catch (error) {
      // Silently handle clear errors
    }
  },

  // 获取所有设置
  async getAll() {
    try {
      await initStore();
      const currentStore = useLocalStorage ? localStorageStore : store;
      if (!currentStore) {
        return {};
      }
      return await currentStore.entries();
    } catch (error) {
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
      throw error;
    }
  },

  // 获取命令行参数
  async getCliArgs() {
    try {
      // 在Tauri环境中调用原生方法
      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
        const args = await invoke('get_cli_args');
        return args;
      } else {
        // 在开发环境中，从URL参数或localStorage获取模拟的文件路径
        const urlParams = new URLSearchParams(window.location.search);
        const fileParam = urlParams.get('file');

        // 检查localStorage中是否有调试用的文件路径
        const debugFilePath = localStorage.getItem('miaogu-notepad-debug-file');

        if (fileParam) {
          return [fileParam];
        } else if (debugFilePath) {
          return [debugFilePath];
        } else {
          return [];
        }
      }
    } catch (error) {
      return [];
    }
  }
};

// 导出所有 API
export default {
  file: fileApi,
  settings: settingsApi,
  app: appApi
};
