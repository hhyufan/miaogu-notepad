/**
 * @fileoverview Tauri API封装 - 提供文件操作、设置存储、窗口控制等功能
 * 统一封装Tauri的各种API，提供一致的接口给前端使用
 * @author hhyufan
 * @version 1.3.0
 */

import {invoke} from '@tauri-apps/api/core';
import {open, save} from '@tauri-apps/plugin-dialog';
import {exists, readFile, readTextFile, writeTextFile} from '@tauri-apps/plugin-fs';
// 导入 Tauri Store
let Store, load;
try {
    const storeModule = await import('@tauri-apps/plugin-store');
    Store = storeModule.Store;
    load = storeModule.load;
} catch (error) {
    console.warn('Tauri Store 不可用，将使用 localStorage');
}

let store = null;
let storeInitialized = false;
let useLocalStorage = false;

/**
 * 初始化存储实例
 * @returns {Promise<*>} 存储实例
 */
const initStore = async () => {
    if (storeInitialized) return store;

    try {
        // 检查是否在 Tauri 环境中


        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
            // 在 Tauri 环境中，使用 Tauri Store


            try {
                // 使用 load 函数创建 Store 实例
                if (load) {
                    store = await load('settings.json', {autoSave: true});
                    useLocalStorage = false;
                    storeInitialized = true;

                } else {
                    throw new Error('load 函数不可用');
                }
            } catch (storeError) {
                console.error('Tauri Store 初始化失败，回退到 localStorage:', storeError);
                useLocalStorage = true;
                storeInitialized = true;
            }
        } else {
            // 在浏览器环境中，使用 localStorage

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

/**
 * 本地存储适配器
 * 当Tauri Store不可用时，使用localStorage作为后备方案
 */
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
    }
};

/**
 * 文件操作 API
 * 提供文件读写、对话框、文件监控等功能
 */
export const fileApi = {
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

    async saveFileDialog(defaultName = 'untitled.txt', t, isNewFile = false) {
        try {
            let finalDefaultName = defaultName;
            if (defaultName && !defaultName.includes('.')) {
                finalDefaultName = `${defaultName}.txt`;
            }

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
                const base64 = await this.readBinaryFile(selected);
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

    async readFile(filePath) {
        try {
            return await readTextFile(filePath);
        } catch (error) {
            throw error;
        }
    },

    async readBinaryFile(filePath) {
        try {
            const data = await readFile(filePath);
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

    async writeFile(filePath, content) {
        try {
            await writeTextFile(filePath, content);
            return {success: true};
        } catch (error) {
            throw error;
        }
    },

    async fileExists(filePath) {
        try {
            return await exists(filePath);
        } catch (error) {
            return false;
        }
    },

    async readFileContent(filePath) {
        try {
            const result = await invoke('read_file_content', {path: filePath});
            return {
                content: result.content || '',
                encoding: result.encoding || 'UTF-8',
                lineEnding: result.line_ending || 'LF'
            };
        } catch (error) {
            throw error;
        }
    },

    async writeFileContent(filePath, content) {
        try {
            await invoke('write_file_content', {path: filePath, content});
            return {success: true};
        } catch (error) {
            throw error;
        }
    },

    async checkFileExists(filePath) {
        try {
            return await invoke('check_file_exists', {path: filePath});
        } catch (error) {
            return false;
        }
    },

    async getFileInfo(filePath) {
        try {
            return await invoke('get_file_info', {path: filePath});
        } catch (error) {
            throw new Error(`获取文件信息失败: ${error}`);
        }
    },

    async isDirectory(filePath) {
        try {
            const fileInfo = await invoke('get_file_info', {path: filePath});
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

    async setOpenFile(filePath) {
        try {
            if (!filePath) {
                throw new Error('filePath is required');
            }
            return await invoke('set_open_file', {filePath: filePath});
        } catch (error) {
            throw error;
        }
    },

    async saveFile(filePath, content, encoding = null) {
        try {
            return await invoke('save_file', {filePath, content, encoding});
        } catch (error) {
            throw error;
        }
    },

    async getDirectoryContents(dirPath) {
        try {
            const contents = await invoke('get_directory_contents', {dirPath});
            return contents;
        } catch (error) {
            throw error;
        }
    },

    async renameFile(oldPath, newPath) {
        try {
            return await invoke('rename_file', {oldPath, newPath});
        } catch (error) {
            throw error;
        }
    },

    async executeFile(filePath) {
        try {
            return await invoke('execute_file', {filePath});
        } catch (error) {
            throw error;
        }
    },

    async openInTerminal(path) {
        try {
            return await invoke('open_in_terminal', {path});
        } catch (error) {
            throw error;
        }
    },

    async showInExplorer(path) {
        try {
            return await invoke('show_in_explorer', {path});
        } catch (error) {
            throw error;
        }
    },

    async startFileWatching(filePath) {
        try {
            return await invoke('start_file_watching', {filePath});
        } catch (error) {
            throw error;
        }
    },

    async stopFileWatching(filePath) {
        try {
            return await invoke('stop_file_watching', {filePath});
        } catch (error) {
            throw error;
        }
    },

    async checkFileExternalChanges(filePath) {
        try {
            return await invoke('check_file_external_changes', {filePath});
        } catch (error) {
            throw error;
        }
    }
};

/**
 * 设置存储 API
 * 提供应用设置的持久化存储功能
 */
export const settingsApi = {
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

    async set(key, value) {
        try {


            await initStore();
            const currentStore = useLocalStorage ? localStorageStore : store;

            if (!currentStore) {
                console.error('存储实例为空');
                throw new Error('存储实例初始化失败');
            }

            // 确保参数正确传递给 Tauri Store
            if (!useLocalStorage && store) {
                // 对于 Tauri Store，确保 key 和 value 都是有效的
                if (typeof key !== 'string' || key.trim() === '') {
                    throw new Error('无效的键名');
                }
                if (value === undefined) {
                    throw new Error('值不能为 undefined');
                }

                await store.set(key, value);
            } else {
                // 对于 localStorage，使用现有的适配器

                await localStorageStore.set(key, value);
            }

            // 验证设置是否成功
            const verifyValue = await currentStore.get(key);


            // 对于 Tauri Store，由于使用了 autoSave，不需要手动调用 save()
            if (!useLocalStorage && store) {

            }
        } catch (error) {
            console.error(`设置 ${key} 失败:`, error);
            console.error('错误详情:', error.message, error.stack);
            throw error;
        }
    },

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
        }
    },

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

/**
 * 应用 API
 * 提供应用级别的功能，如命令行参数获取等
 */
export const appApi = {
    async greet(name) {
        try {
            return await invoke('greet', {name});
        } catch (error) {
            throw error;
        }
    },

    async getCliArgs() {
        try {
            if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
                const args = await invoke('get_cli_args');
                return args;
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                const fileParam = urlParams.get('file');

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

export default {
    file: fileApi,
    settings: settingsApi,
    app: appApi
};
