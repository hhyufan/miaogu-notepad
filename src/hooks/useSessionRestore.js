/**
 * @fileoverview 会话恢复Hook - 负责在应用启动时恢复上次的工作状态
 * 包括文件状态、编辑器配置、主题设置等的完整恢复
 * @author hhyufan
 * @version 1.3.1
 */

import {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';
import {persistenceManager} from '../utils/persistenceManager';
import {store} from '../store';
import tauriApi from '../utils/tauriApi';
import {openFile, switchFile, updateEditorContent} from '../store/slices/fileSlice';
import {
  setBackgroundEnabled,
  setBackgroundTransparency,
  setFontFamily,
  setLineHeight,
  setTheme
} from '../store/slices/themeSlice';
import {
  setAutoIndent,
  setCursorBlinking,
  setCursorStyle,
  setFolding,
  setFormatOnPaste,
  setFormatOnType,
  setGlyphMargin,
  setInsertSpaces,
  setLanguage,
  setLineNumbers,
  setMatchBrackets,
  setMinimap,
  setRenderWhitespace,
  setScrollBeyondLastLine,
  setShowFoldingControls,
  setTabSize,
  setWordWrap,
} from '../store/slices/editorSlice';
import {checkUpdateComplete} from '../store/slices/updateSlice';

const {file: fileApi, app: appApi} = tauriApi;

/**
 * 会话恢复Hook - 负责在应用启动时恢复上次的工作状态
 * 包括文件状态、编辑器配置、主题设置等的完整恢复
 * @returns {Object} 包含恢复状态和操作函数的对象
 * @returns {boolean} returns.isRestoring - 是否正在恢复会话
 * @returns {string|null} returns.restoreError - 恢复过程中的错误信息
 * @returns {Function} returns.saveSession - 手动触发会话保存
 * @returns {Function} returns.clearSession - 清除会话数据
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

                // 在会话恢复完成后自动检测更新
                await checkForUpdatesOnStartup();

            } catch (error) {
                setRestoreError(error.message);
            } finally {
                setIsRestoring(false);
            }
        };

        restoreSession().catch();
    }, [dispatch]);

    /**
     * 应用启动时自动检测更新
     */
    const checkForUpdatesOnStartup = async () => {
        try {

            const updateInfo = await appApi.checkForUpdates();
            
            if (updateInfo && updateInfo.has_update) {

                
                // 更新Redux状态
                dispatch(checkUpdateComplete({
                    hasUpdate: true,
                    updateInfo: updateInfo
                }));
                
                // 将更新信息存储到localStorage中，供SettingsModal使用
                localStorage.setItem('updateInfo', JSON.stringify(updateInfo));
                
                // 触发自定义事件通知其他组件有更新可用
                window.dispatchEvent(new CustomEvent('updateAvailable', { 
                    detail: updateInfo 
                }));
            } else {

                
                // 更新Redux状态 - 没有更新
                dispatch(checkUpdateComplete({
                    hasUpdate: false,
                    updateInfo: updateInfo
                }));
            }
        } catch (error) {
            console.error('🔄 [useSessionRestore] 自动检测更新失败:', error);
        }
    };

    /**
     * 恢复主题设置
     * 注意：主题设置主要通过Redux Persist自动恢复，这里只处理特殊情况
     */
    const restoreThemeSettings = async () => {
        try {
            // 等待一小段时间确保Redux Persist完全恢复
            await new Promise(resolve => setTimeout(resolve, 100));

            const themeSettings = await persistenceManager.getSetting('themeSettings', {});

            const currentState = store.getState();
            const currentTheme = currentState.theme.theme;
            // 如果当前主题仍是默认值且Tauri存储中有主题设置，则使用Tauri存储的设置
            if (currentTheme === 'light' && themeSettings.theme && themeSettings.theme !== 'light' && themeSettings.theme !== 'undefined') {

                dispatch(setTheme(themeSettings.theme));
            }

            // 恢复其他主题相关设置（这些不在Redux Persist中）
            if (themeSettings.fontFamily && themeSettings.fontFamily !== currentState.theme.fontFamily) {

                dispatch(setFontFamily(themeSettings.fontFamily));
            }
            if (themeSettings.lineHeight && themeSettings.lineHeight !== currentState.theme.lineHeight) {

                dispatch(setLineHeight(themeSettings.lineHeight));
            }
            if (typeof themeSettings.backgroundEnabled === 'boolean' && themeSettings.backgroundEnabled !== currentState.theme.backgroundEnabled) {

                dispatch(setBackgroundEnabled(themeSettings.backgroundEnabled));
            }
            if (themeSettings.backgroundTransparency) {
                Object.entries(themeSettings.backgroundTransparency).forEach(([theme, value]) => {
                    const currentTransparency = currentState.theme.backgroundTransparency[theme];
                    if (value !== currentTransparency) {

                        dispatch(setBackgroundTransparency({theme, value}));
                    }
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

        } catch (error) {
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
                            } catch (timeoutError) {
                            }
                        } else if (fileInfo.isTemporary) {
                            dispatch(openFile({
                                ...fileInfo,
                                content: fileInfo.content || '',
                                originalContent: ''
                            }));
                            hasRestoredFiles = true;
                        }
                    } catch (error) {
                    }
                }

                if (currentFilePath && hasRestoredFiles) {
                    dispatch(switchFile(currentFilePath));
                }
            }

            // 不再自动创建初始临时文件，让应用显示欢迎界面
        } catch (error) {
        }
    };

    /**
     * 手动触发会话保存
     */
    const saveSession = async () => {
        try {
        } catch (error) {
        }
    };

    /**
     * 清除会话数据
     */
    const clearSession = async () => {
        try {
            await persistenceManager.clearAll();
        } catch (error) {
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
