/**
 * @fileoverview 会话恢复Hook - 负责在应用启动时恢复上次的工作状态
 * 包括文件状态、编辑器配置、主题设置等的完整恢复
 * @author hhyufan
 * @version 1.3.0
 */

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { persistenceManager } from '../utils/persistenceManager';
import tauriApi from '../utils/tauriApi';

const { file: fileApi } = tauriApi;
import {
  openFile,
  switchFile,
  updateEditorContent
} from '../store/slices/fileSlice';
import {
  setTheme,
  setFontFamily,
  setLineHeight,
  setBackgroundImage,
  setBackgroundEnabled,
  setBackgroundTransparency
} from '../store/slices/themeSlice';
import {
  setLanguage,
  setWordWrap,
  setMinimap,
  setScrollBeyondLastLine,
  setTabSize,
  setInsertSpaces,
  setRenderWhitespace,
  setCursorBlinking,
  setCursorStyle,
  setLineNumbers,
  setGlyphMargin,
  setFolding,
  setShowFoldingControls,
  setMatchBrackets,
  setAutoIndent,
  setFormatOnPaste,
  setFormatOnType,

} from '../store/slices/editorSlice';

/**
 * 会话恢复Hook - 负责在应用启动时恢复上次的工作状态
 * 包括文件状态、编辑器配置、主题设置等的完整恢复
 * @returns {Object} 包含恢复状态和操作函数的对象
 * @returns {boolean} returns.isRestoring - 是否正在恢复中
 * @returns {boolean} returns.isRestored - 是否已完成恢复
 * @returns {Function} returns.restoreSession - 手动触发会话恢复
 */
export const useSessionRestore = () => {
  const dispatch = useDispatch();
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        setIsRestoring(true);
        setRestoreError(null);

        await persistenceManager.initialize();
        await restoreThemeSettings();
        await restoreEditorSettings();
        await restoreFileState();

      } catch (error) {
        setRestoreError(error.message);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSession().catch();
  }, [dispatch]);

  /**
   * 恢复主题设置
   */
  const restoreThemeSettings = async () => {
    try {


      const themeSettings = await persistenceManager.getSetting('themeSettings', {});


      // 优先使用Tauri存储的主题设置
      if (themeSettings.theme) {

        dispatch(setTheme(themeSettings.theme));
      } else {
        // 如果Tauri存储中没有主题设置，尝试从localStorage读取（兼容旧版本）
        const localTheme = localStorage.getItem('theme');


        if (localTheme && (localTheme === 'dark' || localTheme === 'light')) {

          dispatch(setTheme(localTheme));
          // 将localStorage中的主题设置迁移到Tauri存储
          await persistenceManager.saveSetting('themeSettings', { theme: localTheme });
        } else {

        }
      }

      if (themeSettings.fontFamily) {

        dispatch(setFontFamily(themeSettings.fontFamily));
      }
      if (themeSettings.lineHeight) {

        dispatch(setLineHeight(themeSettings.lineHeight));
      }
      if (themeSettings.backgroundImage) {

        dispatch(setBackgroundImage(themeSettings.backgroundImage));
      }
      if (typeof themeSettings.backgroundEnabled === 'boolean') {

        dispatch(setBackgroundEnabled(themeSettings.backgroundEnabled));
      }
      if (themeSettings.backgroundTransparency) {

        Object.entries(themeSettings.backgroundTransparency).forEach(([theme, value]) => {
          dispatch(setBackgroundTransparency({ theme, value }));
        });
      }


    } catch (error) {
      console.error('🔄 [useSessionRestore] 主题设置恢复失败:', error);
    }
  };

  /**
   * 恢复编辑器设置
   */
  const restoreEditorSettings = async () => {
    try {
      const editorSettings = await persistenceManager.getSetting('editorSettings', {});

      if (editorSettings.language) {
        dispatch(setLanguage(editorSettings.language));
      }
      if (editorSettings.wordWrap) {
        dispatch(setWordWrap(editorSettings.wordWrap));
      }
      if (editorSettings.minimap) {
        dispatch(setMinimap(editorSettings.minimap));
      }
      if (typeof editorSettings.scrollBeyondLastLine === 'boolean') {
        dispatch(setScrollBeyondLastLine(editorSettings.scrollBeyondLastLine));
      }
      if (editorSettings.tabSize) {
        dispatch(setTabSize(editorSettings.tabSize));
      }
      if (typeof editorSettings.insertSpaces === 'boolean') {
        dispatch(setInsertSpaces(editorSettings.insertSpaces));
      }
      if (editorSettings.renderWhitespace) {
        dispatch(setRenderWhitespace(editorSettings.renderWhitespace));
      }
      if (editorSettings.cursorBlinking) {
        dispatch(setCursorBlinking(editorSettings.cursorBlinking));
      }
      if (editorSettings.cursorStyle) {
        dispatch(setCursorStyle(editorSettings.cursorStyle));
      }
      if (editorSettings.lineNumbers) {
        dispatch(setLineNumbers(editorSettings.lineNumbers));
      }
      if (typeof editorSettings.glyphMargin === 'boolean') {
        dispatch(setGlyphMargin(editorSettings.glyphMargin));
      }
      if (typeof editorSettings.folding === 'boolean') {
        dispatch(setFolding(editorSettings.folding));
      }
      if (editorSettings.showFoldingControls) {
        dispatch(setShowFoldingControls(editorSettings.showFoldingControls));
      }
      if (editorSettings.matchBrackets) {
        dispatch(setMatchBrackets(editorSettings.matchBrackets));
      }
      if (editorSettings.autoIndent) {
        dispatch(setAutoIndent(editorSettings.autoIndent));
      }
      if (typeof editorSettings.formatOnPaste === 'boolean') {
        dispatch(setFormatOnPaste(editorSettings.formatOnPaste));
      }
      if (typeof editorSettings.formatOnType === 'boolean') {
        dispatch(setFormatOnType(editorSettings.formatOnType));
      }

    } catch (error) {}
  };

  /**
   * 恢复文件状态
   */
  const restoreFileState = async () => {
    try {
      const openedFiles = await persistenceManager.getSetting('openedFiles', []);
      const currentFilePath = await persistenceManager.getSetting('currentFilePath', '');
      const editorContent = await persistenceManager.getSetting('editorContent', '');

      if (editorContent) {
        dispatch(updateEditorContent(editorContent));
      }

      let hasRestoredFiles = false;

      if (openedFiles && openedFiles.length > 0) {
        for (const fileInfo of openedFiles) {
          try {
            if (!fileInfo.isTemporary && fileInfo.path) {
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('File operation timeout')), 5000)
              );

              try {
                const exists = await Promise.race([
                  fileApi.fileExists(fileInfo.path),
                  timeoutPromise
                ]);

                if (exists) {
                  const content = await Promise.race([
                    fileApi.readFileContent(fileInfo.path),
                    timeoutPromise
                  ]);

                  dispatch(openFile({
                    ...fileInfo,
                    content,
                    originalContent: content
                  }));
                  hasRestoredFiles = true;
                }
              } catch (timeoutError) {}
            } else if (fileInfo.isTemporary) {
              dispatch(openFile({
                ...fileInfo,
                content: fileInfo.content || '',
                originalContent: ''
              }));
              hasRestoredFiles = true;
            }
          } catch (error) {}
        }

        if (currentFilePath && hasRestoredFiles) {
          dispatch(switchFile(currentFilePath));
        }
      }

      // 不再自动创建初始临时文件，让应用显示欢迎界面
    } catch (error) {}
  };

  /**
   * 手动触发会话保存
   */
  const saveSession = async () => {
    try {
    } catch (error) {}
  };

  /**
   * 清除会话数据
   */
  const clearSession = async () => {
    try {
      await persistenceManager.clearAll();
    } catch (error) {}
  };

  return {
    isRestoring,
    restoreError,
    saveSession,
    clearSession
  };
};

export default useSessionRestore;
