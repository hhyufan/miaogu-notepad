/**
 * @fileoverview 持久化管理器 - 负责应用状态的保存和恢复
 * 提供防抖保存、状态恢复、设置管理等功能
 * @author hhyufan
 * @version 1.3.0
 */

import tauriApi from './tauriApi';

const { settings: settingsApi } = tauriApi;

/**
 * 持久化管理器 - 负责应用状态的保存和恢复
 * @class PersistenceManager
 */
class PersistenceManager {
  constructor() {
    this.isInitialized = false;
    this.saveQueue = new Map();
    this.saveTimeout = null;
  }

  /**
   * 初始化持久化管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.restoreAppState();
      this.isInitialized = true;
    } catch (error) { }
  }

  /**
   * 恢复应用状态
   * @returns {Promise<Object|null>} 恢复的状态对象或null
   */
  async restoreAppState() {
    try {
      const openedFiles = await settingsApi.get('openedFiles', []);
      const currentFilePath = await settingsApi.get('currentFilePath', '');
      const editorContent = await settingsApi.get('editorContent', '');
      const themeSettings = await settingsApi.get('themeSettings', {});
      const editorSettings = await settingsApi.get('editorSettings', {});
      const windowState = await settingsApi.get('windowState', {});

      return {
        files: {
          openedFiles,
          currentFilePath,
          editorContent
        },
        theme: themeSettings,
        editor: editorSettings,
        window: windowState
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 保存应用状态
   * @param {Object} state - Redux状态
   * @returns {Promise<void>}
   */
  async saveAppState(state) {
    if (!this.isInitialized) return;

    try {
      this.debouncedSave(state);
    } catch (error) { }
  }

  /**
   * 防抖保存函数 - 避免频繁写入
   * @param {Object} state - Redux状态
   */
  debouncedSave(state) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      await this.performSave(state);
    }, 500);
  }

  /**
   * 执行实际的保存操作
   * @param {Object} state - Redux状态
   * @returns {Promise<void>}
   */
  async performSave(state) {
    try {
      const { file, theme, editor, ui } = state;

      const filesToSave = file.openedFiles.map(f => ({
        path: f.path,
        name: f.name,
        isTemporary: f.isTemporary,
        isModified: f.isModified,
        encoding: f.encoding,
        lineEnding: f.lineEnding,
        content: f.isTemporary ? f.content : undefined // 只为临时文件保存内容
      }));

      await settingsApi.set('openedFiles', filesToSave);
      await settingsApi.set('currentFilePath', file.currentFile?.path || '');
      await settingsApi.set('editorContent', file.editorContent);

      await settingsApi.set('themeSettings', {
        theme: theme.theme,
        fontFamily: theme.fontFamily,
        lineHeight: theme.lineHeight,
        // 不存储 backgroundImage，避免 base64 数据导致存储配额超限
        // backgroundImage: theme.backgroundImage,
        backgroundEnabled: theme.backgroundEnabled,
        backgroundTransparency: theme.backgroundTransparency
      });

      await settingsApi.set('editorSettings', {
        language: editor.language,
        wordWrap: editor.wordWrap,
        minimap: editor.minimap,
        scrollBeyondLastLine: editor.scrollBeyondLastLine,
        tabSize: editor.tabSize,
        insertSpaces: editor.insertSpaces,
        renderWhitespace: editor.renderWhitespace,
        cursorBlinking: editor.cursorBlinking,
        cursorStyle: editor.cursorStyle,
        lineNumbers: editor.lineNumbers,
        glyphMargin: editor.glyphMargin,
        folding: editor.folding,
        showFoldingControls: editor.showFoldingControls,
        matchBrackets: editor.matchBrackets,
        autoIndent: editor.autoIndent,
        formatOnPaste: editor.formatOnPaste,
        formatOnType: editor.formatOnType
      });

      if (ui) {
        await settingsApi.set('windowState', {
          sidebarVisible: ui.sidebarVisible
        });
      }
    } catch (error) { }
  }

  /**
   * 保存单个设置项
   * @param {string} key - 设置键
   * @param {any} value - 设置值
   * @returns {Promise<void>}
   */
  async saveSetting(key, value) {
    try {
      console.log('💾 [persistenceManager] 保存设置:', {
        key,
        value: key === 'themeSettings' ? value : '[其他设置]',
        timestamp: new Date().toISOString()
      });
      
      await settingsApi.set(key, value);
      
      console.log('💾 [persistenceManager] 设置保存成功:', key);
    } catch (error) {
      console.error('💾 [persistenceManager] 设置保存失败:', {
        key,
        error: error.message
      });
    }
  }

  /**
   * 获取单个设置项
   * @param {string} key - 设置键
   * @param {any} defaultValue - 默认值
   * @returns {Promise<any>} 设置值
   */
  async getSetting(key, defaultValue = null) {
    try {
      console.log('📖 [persistenceManager] 获取设置:', {
        key,
        defaultValue: key === 'themeSettings' ? defaultValue : '[其他默认值]',
        timestamp: new Date().toISOString()
      });
      
      const result = await settingsApi.get(key, defaultValue);
      
      console.log('📖 [persistenceManager] 设置获取成功:', {
        key,
        result: key === 'themeSettings' ? result : '[其他结果]'
      });
      
      return result;
    } catch (error) {
      console.error('📖 [persistenceManager] 设置获取失败:', {
        key,
        error: error.message,
        返回默认值: defaultValue
      });
      return defaultValue;
    }
  }

  /**
   * 清除所有持久化数据
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      await settingsApi.clear();
    } catch (error) { }
  }

  /**
   * 销毁持久化管理器
   */
  destroy() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.isInitialized = false;
  }
}

export const persistenceManager = new PersistenceManager();

export default PersistenceManager;
