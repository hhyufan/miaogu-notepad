import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { persistenceManager } from '../utils/persistenceManager';
import { fileApi } from '../utils/tauriApi';
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
  setFormatOnType
} from '../store/slices/editorSlice';

/**
 * 会话恢复Hook
 * 负责在应用启动时恢复上次的工作状态
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

        // 初始化持久化管理器
        await persistenceManager.initialize();

        // 恢复主题设置
        await restoreThemeSettings();

        // 恢复编辑器设置
        await restoreEditorSettings();

        // 恢复文件状态
        await restoreFileState();


      } catch (error) {
        console.error('Session restore failed:', error);
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

    } catch (error) {
      console.error('Failed to restore theme settings:', error);
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
    } catch (error) {
      console.error('Failed to restore editor settings:', error);
    }
  };

  /**
   * 恢复文件状态
   */
  const restoreFileState = async () => {
    try {
      const openedFiles = await persistenceManager.getSetting('openedFiles', []);
      const currentFilePath = await persistenceManager.getSetting('currentFilePath', '');
      const editorContent = await persistenceManager.getSetting('editorContent', '');

      // 恢复编辑器内容
      if (editorContent) {
        dispatch(updateEditorContent(editorContent));
      }

      // 恢复打开的文件
      if (openedFiles && openedFiles.length > 0) {
        for (const fileInfo of openedFiles) {
          try {
            // 检查文件是否仍然存在
            if (!fileInfo.isTemporary && fileInfo.path) {
              // 添加超时和错误处理，避免回调错误
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('File operation timeout')), 5000)
              );

              try {
                const exists = await Promise.race([
                  fileApi.fileExists(fileInfo.path),
                  timeoutPromise
                ]);

                if (exists) {
                  // 读取文件内容
                  const content = await Promise.race([
                    fileApi.readFileContent(fileInfo.path),
                    timeoutPromise
                  ]);

                  dispatch(openFile({
                    ...fileInfo,
                    content,
                    originalContent: content
                  }));
                } else {
                  console.warn(`File does not exist, skipping restore: ${fileInfo.path}`);
                }
              } catch (timeoutError) {
                console.warn(`File operation timeout, skipping restore: ${fileInfo.path}`);
              }
            } else if (fileInfo.isTemporary) {
              // 恢复临时文件
              dispatch(openFile({
                ...fileInfo,
                content: fileInfo.content || '',
                originalContent: ''
              }));
            }
          } catch (error) {
            console.error(`Failed to restore file: ${fileInfo.path}`, error);
          }
        }

        // 恢复当前文件
        if (currentFilePath) {
          dispatch(switchFile(currentFilePath));
        }
      }
    } catch (error) {
      console.error('Failed to restore file state:', error);
    }
  };

  /**
   * 手动触发会话保存
   */
  const saveSession = async () => {
    try {
      // 这里可以添加手动保存逻辑
      // 通常由Redux中间件自动处理

    } catch (error) {
      console.error('Failed to manually save session:', error);
    }
  };

  /**
   * 清除会话数据
   */
  const clearSession = async () => {
    try {
      await persistenceManager.clearAll();

    } catch (error) {
      console.error('Failed to clear session data:', error);
    }
  };

  return {
    isRestoring,
    restoreError,
    saveSession,
    clearSession
  };
};

export default useSessionRestore;
