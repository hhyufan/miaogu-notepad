/**
 * @fileoverview 会话恢复Hook - 负责在应用启动时恢复上次的工作状态
 * 包括文件状态、编辑器配置、主题设置等的完整恢复
 * @author hhyufan
 * @version 1.2.0
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
  setFontSize,
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

      if (themeSettings.theme) {
        dispatch(setTheme(themeSettings.theme));
      }
      if (themeSettings.fontSize) {
        dispatch(setFontSize(themeSettings.fontSize));
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

    } catch (error) {}
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
                }
              } catch (timeoutError) {}
            } else if (fileInfo.isTemporary) {
              dispatch(openFile({
                ...fileInfo,
                content: fileInfo.content || '',
                originalContent: ''
              }));
            }
          } catch (error) {}
        }

        if (currentFilePath) {
          dispatch(switchFile(currentFilePath));
        }
      }
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
