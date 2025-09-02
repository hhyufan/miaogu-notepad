import { settingsApi } from './tauriApi';

/**
 * 持久化管理器
 * 负责应用状态的保存和恢复
 */
class PersistenceManager {
  constructor() {
    this.isInitialized = false;
    this.saveQueue = new Map();
    this.saveTimeout = null;
  }

  /**
   * 初始化持久化管理器
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // 恢复应用状态
      await this.restoreAppState();
      this.isInitialized = true;

    } catch (error) {
      console.error('持久化管理器初始化失败:', error);
    }
  }

  /**
   * 恢复应用状态
   */
  async restoreAppState() {
    try {
      // 恢复打开的文件列表
      const openedFiles = await settingsApi.get('openedFiles', []);
      const currentFilePath = await settingsApi.get('currentFilePath', '');
      const editorContent = await settingsApi.get('editorContent', '');

      // 恢复主题设置
      const themeSettings = await settingsApi.get('themeSettings', {});

      // 恢复编辑器设置
      const editorSettings = await settingsApi.get('editorSettings', {});

      // 恢复窗口状态
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
      console.error('恢复应用状态失败:', error);
      return null;
    }
  }

  /**
   * 保存应用状态
   * @param {Object} state - Redux状态
   */
  async saveAppState(state) {
    if (!this.isInitialized) return;

    try {
      // 防抖保存，避免频繁写入
      this.debouncedSave(state);
    } catch (error) {
      console.error('保存应用状态失败:', error);
    }
  }

  /**
   * 防抖保存函数
   * @param {Object} state - Redux状态
   */
  debouncedSave(state) {
    // 清除之前的定时器
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // 设置新的定时器
    this.saveTimeout = setTimeout(async () => {
      await this.performSave(state);
    }, 500); // 500ms防抖
  }

  /**
   * 执行实际的保存操作
   * @param {Object} state - Redux状态
   */
  async performSave(state) {
    try {
      const { file, theme, editor, ui } = state;

      // 保存文件状态（只保存必要信息，不保存文件内容）
      const filesToSave = file.openedFiles.map(f => ({
        path: f.path,
        name: f.name,
        isTemporary: f.isTemporary,
        isModified: f.isModified,
        encoding: f.encoding,
        lineEnding: f.lineEnding
      }));

      await settingsApi.set('openedFiles', filesToSave);
      await settingsApi.set('currentFilePath', file.currentFile?.path || '');
      await settingsApi.set('editorContent', file.editorContent);

      // 保存主题设置
      await settingsApi.set('themeSettings', {
        theme: theme.theme,
        fontSize: theme.fontSize,
        fontFamily: theme.fontFamily,
        lineHeight: theme.lineHeight,
        backgroundImage: theme.backgroundImage,
        backgroundEnabled: theme.backgroundEnabled,
        backgroundTransparency: theme.backgroundTransparency
      });

      // 保存编辑器设置
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

      // 保存窗口状态（可选）
      if (ui) {
        await settingsApi.set('windowState', {
          sidebarVisible: ui.sidebarVisible,
  
          statusBarVisible: ui.statusBarVisible
        });
      }


    } catch (error) {
      console.error('保存应用状态时出错:', error);
    }
  }

  /**
   * 保存单个设置项
   * @param {string} key - 设置键
   * @param {any} value - 设置值
   */
  async saveSetting(key, value) {
    try {
      await settingsApi.set(key, value);
    } catch (error) {
      console.error(`保存设置 ${key} 失败:`, error);
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
      return await settingsApi.get(key, defaultValue);
    } catch (error) {
      console.error(`获取设置 ${key} 失败:`, error);
      return defaultValue;
    }
  }

  /**
   * 清除所有持久化数据
   */
  async clearAll() {
    try {
      await settingsApi.clear();

    } catch (error) {
      console.error('清除持久化数据失败:', error);
    }
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

// 创建全局实例
export const persistenceManager = new PersistenceManager();

// 导出类供测试使用
export default PersistenceManager;
