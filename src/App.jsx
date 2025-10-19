/**
 * @fileoverview 应用程序主组件
 * 提供整体布局、主题管理、编辑器模式切换等核心功能
 * @author hhyufan
 * @version 1.4.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { App as AntdApp, Button, ConfigProvider, Layout, theme } from 'antd';
import { CodeOutlined, EyeOutlined, InboxOutlined, MoonFilled, PartitionOutlined, SunOutlined } from '@ant-design/icons';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { invoke } from '@tauri-apps/api/core';
import { store } from './store';
import { useTheme } from './hooks/redux';
import useThemeSync from './hooks/useTheme'; // 导入主题同步 hook
import { useI18n } from './hooks/useI18n';
import { initImageProxyLoader } from './utils/imageProxy';
import tauriApi, { fileApi } from './utils/tauriApi';
import { useSessionRestore } from './hooks/useSessionRestore';
import { markUpdateLogShown } from './store/slices/updateSlice';
import AppHeader from './components/AppHeader';
import TabBar from './components/TabBar';
import LazyCodeEditor from './components/LazyCodeEditor';
import LazyTreeEditor from './components/LazyTreeEditor';
import EditorStatusBar from './components/EditorStatusBar';

import WelcomeScreen from './components/WelcomeScreen';

import { useFileManager } from './hooks/useFileManager.jsx';
import { withEditorModeTransition } from './utils/viewTransition';
import './App.scss';

const { settings: settingsApi, app: appApi } = tauriApi;
const { Content } = Layout;

/**
 * 编辑器模式枚举
 * @enum {string}
 */
const EDITOR_MODES = {
    MONACO: 'monaco',    // 代码编辑模式
    MARKDOWN: 'markdown', // Markdown预览模式
    MGTREE: 'mgtree'     // 树形编辑模式
};

/**
 * 应用内容组件 - 处理编辑器模式切换和主题切换
 * @param {Object} props - 组件属性
 * @param {boolean} props.isDarkMode - 是否为暗色模式
 * @param {Function} props.toggleTheme - 主题切换函数
 * @param {Object} props.fileManager - 文件管理器实例
 * @param {boolean} props.isHeaderVisible - 头部是否可见
 * @param {Function} props.setCursorPosition - 设置光标位置的回调函数
 * @param {Function} props.setCharacterCount - 设置字符计数的回调函数
 * @returns {JSX.Element} 应用内容组件
 */
const AppContent = ({ isDarkMode, toggleTheme, fileManager, isHeaderVisible, setCursorPosition, setCharacterCount }) => {
    const { t } = useI18n();
    const [isTreeMode, setIsTreeMode] = useState(false);
    const [editorMode, setEditorMode] = useState(EDITOR_MODES.MONACO);
    const { currentFile, openedFiles, newFile, openFile } = fileManager;
    
    // Redux状态和dispatch
    const dispatch = useDispatch();
    const updateState = useSelector(state => state.update);
    const { hasUpdate, updateInfo } = updateState;

    const isMgtreeFile = currentFile && currentFile['name'] && currentFile['name'].endsWith('.mgtree');
    const isMarkdownFile = currentFile && currentFile['name'] &&
        ['md', 'markdown'].some(ext => currentFile['name'].toLowerCase().endsWith('.' + ext));

    // 检查是否有打开的文件
    const hasOpenFiles = openedFiles && openedFiles.length > 0;

    /**
     * 切换编辑器模式
     * 根据当前文件类型在代码模式、预览模式和树形模式之间切换
     */
    const toggleEditorMode = useCallback(async () => {
        await withEditorModeTransition(() => {
            if (isMgtreeFile) {
                if (editorMode === EDITOR_MODES.MONACO) {
                    setEditorMode(EDITOR_MODES.MGTREE);
                    setIsTreeMode(true);
                } else {
                    setEditorMode(EDITOR_MODES.MONACO);
                    setIsTreeMode(false);
                }
            } else if (isMarkdownFile) {
                if (editorMode === EDITOR_MODES.MONACO) {
                    setEditorMode(EDITOR_MODES.MARKDOWN);
                } else {
                    setEditorMode(EDITOR_MODES.MONACO);
                }
            }
        });
    }, [editorMode, isMgtreeFile, isMarkdownFile]);

    /**
     * 获取编辑器模式对应的图标
     * @returns {JSX.Element} 编辑器模式图标
     */
    const getEditorModeIcon = () => {
        if (isMgtreeFile) {
            return editorMode === EDITOR_MODES.MGTREE ? <CodeOutlined /> : <PartitionOutlined />;
        } else if (isMarkdownFile) {
            return editorMode === EDITOR_MODES.MARKDOWN ? <CodeOutlined /> : <EyeOutlined />;
        }
        return <CodeOutlined />;
    };

    /**
     * 获取编辑器模式对应的CSS类名
     * @returns {string} CSS类名字符串
     */
    const getEditorModeClassName = () => {
        if (isMgtreeFile) {
            return editorMode === EDITOR_MODES.MGTREE ? 'code-mode' : 'mgtree-mode';
        } else if (isMarkdownFile) {
            return editorMode === EDITOR_MODES.MARKDOWN ? 'code-mode' : 'preview-mode';
        }
        return 'code-mode';
    };

    /**
     * 获取编辑器模式切换按钮的标题
     * @returns {string} 按钮标题
     */
    const getEditorModeTitle = () => {
        if (isMgtreeFile) {
            return editorMode === EDITOR_MODES.MGTREE ? t('editor.switchToCodeEditor') : t('editor.switchToTreeEditor');
        } else if (isMarkdownFile) {
            return editorMode === EDITOR_MODES.MARKDOWN ? t('editor.switchToCodeEditor') : t('editor.switchToPreviewMode');
        }
        return t('editor.editorMode');
    };

    /**
     * 监听键盘事件，处理Ctrl+/快捷键切换编辑器模式
     */
    useEffect(() => {
        const handleKeyDown = async (event) => {
            if (event.ctrlKey && event.key === '/') {
                event.preventDefault();
                await toggleEditorMode();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [toggleEditorMode]);

    /**
     * 当文件类型或当前文件变化时，重置编辑器模式
     */
    useEffect(() => {
        // 如果是更新日志文件且是Markdown文件，默认切换到Markdown预览模式
        if (currentFile && currentFile.isUpdateLog && isMarkdownFile) {
            setEditorMode(EDITOR_MODES.MARKDOWN);
            setIsTreeMode(false);
        } else {
            setEditorMode(EDITOR_MODES.MONACO);
            setIsTreeMode(false);
        }
    }, [isMgtreeFile, isMarkdownFile, fileManager.currentFile?.path, currentFile]);

    // 使用ref来跟踪是否已经自动打开过更新日志
    const autoOpenedVersionRef = useRef(null);

    /**
     * 监听更新状态变化，自动打开更新日志
     * 只在初始化检测到新版本更新时自动打开一次
     */
    useEffect(() => {



        
        // 确保autoShowUpdateLog有默认值
        const shouldAutoShow = updateState.autoShowUpdateLog !== false; // 默认为true
        
        if (hasUpdate && updateInfo && updateInfo.latest_version && shouldAutoShow) {
            const currentVersion = updateInfo.latest_version;


            
            // 检查是否已经为这个版本自动打开过更新日志
            if (autoOpenedVersionRef.current !== currentVersion && !updateState.updateLogShown) {
                // 标记已经为这个版本自动打开过
                autoOpenedVersionRef.current = currentVersion;
                
                // 延迟打开更新日志，确保应用完全加载
                const timer = setTimeout(async () => {
                    try {

                        await openUpdateLog(currentVersion);
                        // 标记更新日志已显示
                        dispatch({type: 'update/markUpdateLogShown', payload: currentVersion});
                    } catch (error) {
                        console.error('❌ [App.jsx] 自动打开更新日志失败:', error);
                    }
                }, 1000); // 延迟1秒
                
                return () => clearTimeout(timer);
            }
        }
    }, [hasUpdate, updateInfo?.latest_version, updateState.autoShowUpdateLog, updateState.updateLogShown]); // 添加更多依赖

    return (
        <>
            <div className="theme-toggle">
                <Button
                    type="text"
                    icon={isDarkMode ? <MoonFilled /> : <SunOutlined />}
                    onClick={toggleTheme}
                    title={isDarkMode ? t('app.theme.light') : t('app.theme.dark')}
                    className="theme-toggle-btn"
                />
                {(isMgtreeFile || isMarkdownFile) && (
                    <Button
                        type="text"
                        icon={getEditorModeIcon()}
                        onClick={toggleEditorMode}
                        title={getEditorModeTitle()}
                        className={`theme-toggle-btn editor-mode-btn ${getEditorModeClassName()}`}
                    />
                )}
            </div>
            <div className="content-container">
                {!hasOpenFiles ? (
                    <WelcomeScreen
                        isDarkMode={isDarkMode}
                        onNewFile={() => newFile()}
                        onOpenFile={openFile}
                    />
                ) : (
                    <div className="code-editor-container">
                        <div
                            className="monaco-editor-wrapper"
                            style={{ display: (isMgtreeFile && isTreeMode) ? 'none' : 'block' }}
                        >
                            <LazyCodeEditor
                                isDarkMode={isDarkMode}
                                fileManager={fileManager}
                                showMarkdownPreview={isMarkdownFile && editorMode === EDITOR_MODES.MARKDOWN}
                                languageRef={fileManager.tabBarRef?.languageRef}
                                isHeaderVisible={isHeaderVisible}
                                setCursorPosition={setCursorPosition}
                                setCharacterCount={setCharacterCount}
                            />
                        </div>
                        {isMgtreeFile && (
                            <div
                                className="tree-editor-wrapper"
                                style={{ display: isTreeMode ? 'block' : 'none' }}
                            >
                                <LazyTreeEditor
                                    isDarkMode={isDarkMode}
                                    fileManager={fileManager}
                                    isHeaderVisible={isHeaderVisible}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

/**
 * 主应用组件 - 处理应用初始化、拖拽、主题管理等核心功能
 * @returns {JSX.Element} 主应用组件
 */
const MainApp = () => {
    const {
        theme: currentTheme,
        setTheme,
        setFontFamily,
        setLineHeight,
        setBackgroundImage,
        setBackgroundEnabled,
        setBackgroundTransparency
    } = useTheme();

    // 使用主题同步 hook 确保 DOM 属性正确设置
    useThemeSync();

    const { t } = useI18n();
    const [isDragOver, setIsDragOver] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
    const [characterCount, setCharacterCount] = useState(0);

    /**
     * 立即设置初始主题，确保在首次渲染时就有正确的data-theme属性
     * 避免初始渲染时的白色闪烁
     */
    useEffect(() => {
        const initialTheme = currentTheme && currentTheme !== 'undefined' ? currentTheme : 'light';
        document.documentElement.setAttribute('data-theme', initialTheme);

        // 如果当前主题是 undefined 或无效值，直接在 DOM 上设置为 light，但不触发 Redux 更新
        if (!currentTheme || currentTheme === 'undefined') {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, []); // 空依赖数组，只在组件挂载时执行一次

    /**
     * 监听Tauri拖拽事件，更新拖拽状态
     */
    useEffect(() => {
        const handleTauriDragEnter = () => {
            setIsDragOver(true);
        };

        const handleTauriDragLeave = () => {
            setIsDragOver(false);
        };

        window.addEventListener('tauri-drag-enter', handleTauriDragEnter);
        window.addEventListener('tauri-drag-leave', handleTauriDragLeave);

        return () => {
            window.removeEventListener('tauri-drag-enter', handleTauriDragEnter);
            window.removeEventListener('tauri-drag-leave', handleTauriDragLeave);
        };
    }, []);

    /**
     * 处理F11键切换全屏模式
     * 隐藏/显示AppHeader、最大化窗口并控制休眠状态
     */
    useEffect(() => {
        const handleKeyDown = async (event) => {
            if (event.key === 'F11') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                const newHeaderVisible = !isHeaderVisible;
                setIsHeaderVisible(newHeaderVisible);

                // 检查是否在Tauri环境中
                if (typeof window !== 'undefined' && window['__TAURI_INTERNALS__']) {
                    try {
                        const { getCurrentWindow } = await import('@tauri-apps/api/window');
                        const appWindow = getCurrentWindow();

                        if (newHeaderVisible) {
                            // 退出全屏模式：显示Header，退出全屏状态，允许休眠
                            await appWindow.setFullscreen(false);
                            try {
                                await invoke('disable_prevent_sleep');
                            } catch (error) {
                                console.warn('允许休眠失败:', error);
                            }
                        } else {
                            // 进入全屏模式：先检查当前窗口状态，确保正确进入全屏
                            const isCurrentlyFullscreen = await appWindow.isFullscreen();
                            const isCurrentlyMaximized = await appWindow.isMaximized();

                            // 如果当前是最大化状态，先退出最大化再进入全屏
                            if (isCurrentlyMaximized && !isCurrentlyFullscreen) {
                                await appWindow.unmaximize();
                                // 短暂延迟确保状态切换完成
                                await new Promise(resolve => setTimeout(resolve, 50));
                            }

                            // 设置全屏状态（这会隐藏任务栏并完全覆盖屏幕）
                            await appWindow.setFullscreen(true);

                            try {
                                await invoke('enable_prevent_sleep');
                            } catch (error) {
                                console.warn('防止休眠失败:', error);
                            }
                        }
                    } catch (error) {
                        console.error('F11全屏切换失败:', error);
                    }
                }
            }
        };

        /**
         * 检查窗口状态，当窗口退出全屏时自动显示AppHeader
         */
        const checkWindowState = async () => {
            if (typeof window !== 'undefined' && window['__TAURI_INTERNALS__']) {
                try {
                    const { getCurrentWindow } = await import('@tauri-apps/api/window');
                    const appWindow = getCurrentWindow();

                    const isFullscreen = await appWindow.isFullscreen();

                    // 如果当前Header是隐藏的，但窗口既不是全屏也不是最大化状态，则显示Header
                    // 或者如果窗口从全屏退出到最大化状态，也应该显示Header
                    if (!isHeaderVisible && !isFullscreen) {
                        setIsHeaderVisible(true);
                    }
                } catch (error) {
                    console.error('检查窗口状态失败:', error);
                }
            }
        };

        // 定期检查窗口状态
        const intervalId = setInterval(checkWindowState, 500);

        // 使用捕获阶段监听，确保F11事件能被优先处理
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            clearInterval(intervalId);
        };
    }, [isHeaderVisible]);

    const { isRestoring, restoreError } = useSessionRestore();
    const { backgroundEnabled, backgroundImage } = useSelector((state) => state.theme);
    const fileManager = useFileManager();

    /**
     * 全局键盘快捷键处理
     * 支持Ctrl+N新建、Ctrl+O打开、Ctrl+S保存、Ctrl+Shift+S另存为
     */
    useEffect(() => {
        const handleGlobalKeyDown = async (event) => {
            // Ctrl+N 新建文件
            if (event.ctrlKey && event.key === 'n' && !event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();

                try {
                    await fileManager.createFile();
                } catch (error) {
                    console.error('新建文件失败:', error);
                }
            }

            // Ctrl+O 打开文件
            if (event.ctrlKey && event.key === 'o' && !event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();

                try {
                    await fileManager.openFile();
                } catch (error) {
                    console.error('打开文件失败:', error);
                }
            }

            // Ctrl+S 保存文件
            if (event.ctrlKey && event.key === 's' && !event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();

                if (fileManager.currentFile) {
                    try {
                        await fileManager.saveFile(false);
                    } catch (error) {
                        console.error('保存文件失败:', error);
                    }
                }
            }

            // Ctrl+Shift+S 另存为
            if (event.ctrlKey && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                event.stopPropagation();

                if (fileManager.currentFile) {
                    try {
                        await fileManager.saveFile(true);
                    } catch (error) {
                        console.error('另存为失败:', error);
                    }
                }
            }
        };

        // 使用捕获阶段监听，确保优先处理
        document.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown, true);
        };
    }, [fileManager]);

    const { openedFiles } = fileManager;
    const hasOpenFiles = openedFiles && openedFiles.length > 0;

    /**
     * 处理拖拽悬停事件
     * @param {DragEvent} e - 拖拽事件对象
     */
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isDragOver) {
            setIsDragOver(true);
        }
    }, [isDragOver]);

    /**
     * 处理拖拽进入事件
     * @param {DragEvent} e - 拖拽事件对象
     */
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    /**
     * 处理拖拽离开事件
     * @param {DragEvent} e - 拖拽事件对象
     */
    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setIsDragOver(false);
        }
    }, []);

    /**
     * 处理文件拖拽放置事件
     * @param {DragEvent} e - 拖拽事件对象
     */
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const hasTauri = typeof window !== 'undefined' && window['__TAURI_INTERNALS__'] !== undefined;

        if (!hasTauri) {
            const files = Array.from(e.dataTransfer.files);

            if (files.length === 0) {
                return;
            }

            for (const file of files) {
                try {
                    if (file.webkitRelativePath) {
                        await fileManager.setOpenFile(file.webkitRelativePath);
                    } else {
                        let content;
                        let fileName = file.name;

                        try {
                            content = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = (e) => resolve(e.target.result);
                                reader.onerror = (e) => reject(e);
                                reader.readAsText(file, 'UTF-8');
                            });

                            await fileManager.setOpenFile(fileName, content, {
                                encoding: 'UTF-8',
                                lineEnding: 'LF'
                            });
                        } catch (error) {
                            console.error('Failed to read file:', error);
                            await fileManager.setOpenFile(fileName, '', {
                                encoding: 'UTF-8',
                                lineEnding: 'LF'
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error processing file:', error);
                }
            }
        }
    }, [fileManager]);

    /**
     * 主题切换函数
     * 在亮色和暗色主题之间切换
     */
    const toggleTheme = useCallback(async () => {
        // 确保 currentTheme 有有效值，避免传递 undefined
        const safeCurrentTheme = currentTheme || 'light';
        const newTheme = safeCurrentTheme === 'light' ? 'dark' : 'light';

        // 直接设置主题，不使用视觉过渡，避免时序问题
        setTheme(newTheme);
    }, [currentTheme, setTheme]);

    /**
     * 测试CLI参数
     * @returns {Promise<string[]>} CLI参数数组
     */
    const testCliArgs = async () => {
        try {
            return await appApi.getCliArgs();
        } catch (error) {
            return [];
        }
    };

    /**
     * 设置调试文件路径到localStorage
     * @param {string} filePath - 文件路径
     */
    const setDebugFile = (filePath) => {
        if (!window['__TAURI__']) {
            localStorage.setItem('miaogu-notepad-debug-file', filePath);
        }
    };

    /**
     * 测试打开文件
     * @returns {Promise<Object>} 包含操作结果的对象
     */
    const testFileOpen = async () => {
        try {
            const args = await appApi.getCliArgs();

            if (args && args.length > 0) {
                const filePath = args[0];

                try {
                    await fileApi.fileExists(filePath);
                } catch (error) {
                }

                try {
                    await fileManager.setOpenFile(filePath);
                    return { success: true, filePath };
                } catch (error) {
                    return { success: false, error };
                }
            } else {
                const debugFile = localStorage.getItem('miaogu-notepad-debug-file');
                if (debugFile) {
                    try {
                        await fileManager.setOpenFile(debugFile);
                        return { success: true, filePath: debugFile };
                    } catch (error) {
                        return { success: false, error };
                    }
                }
            }
        } catch (error) {
            return { success: false, error };
        }
        return { success: false };
    };

    const cliArgsProcessedRef = useRef(false);

    /**
     * 检查并处理更新日志显示
     * 在应用更新后首次启动时自动打开更新日志
     */
    const checkAndShowUpdateLog = async () => {
        try {
            // 获取当前应用版本 - 使用 checkForUpdates 方法获取版本信息
            const versionInfo = await appApi.checkForUpdates();
            const currentVersion = versionInfo?.current_version;
            if (!currentVersion) return;

            // 获取上次记录的版本
            const lastVersion = await settingsApi.get('app.lastVersion', '');
            
            // 如果版本不同，说明应用已更新
            if (lastVersion && lastVersion !== currentVersion) {
                
                // 保存新版本号
                await settingsApi.set('app.lastVersion', currentVersion);
                
                // 打开更新日志
                await openUpdateLog(currentVersion);
            } else if (!lastVersion) {
                // 首次安装，记录当前版本
                await settingsApi.set('app.lastVersion', currentVersion);
            }
        } catch (error) {
            console.error('检查更新日志失败:', error);
        }
    };

    /**
     * 打开更新日志文件
     * @param {string} version - 版本号
     */
    const openUpdateLog = async (version) => {
        try {
            
            // 构造更新日志内容
            const updateLogContent = await getUpdateLogContent(version);
            
            // 创建特殊的更新日志文件对象
            // 使用固定的路径以避免React key重复警告
            const updateLogFile = {
                name: `更新日志 v${version}.md`,
                path: `update-log.md`, // 使用固定路径，避免key冲突
                content: updateLogContent,
                isTemporary: false,
                isReadOnly: true,
                isUpdateLog: true, // 标记为更新日志文件
                encoding: 'UTF-8',
                lineEnding: 'LF',
                version: version // 添加版本信息用于显示
            };


            // 使用文件管理器打开更新日志
            await fileManager.openUpdateLog(updateLogFile);
        } catch (error) {
            console.error('❌ [App.jsx] 打开更新日志失败:', error);
            console.error('❌ [App.jsx] 错误堆栈:', error.stack);
        }
    };

    /**
     * 获取更新日志内容
     * @param {string} version - 版本号
     * @returns {Promise<string>} 更新日志内容
     */
    const getUpdateLogContent = async (version) => {
        
        try {
            // 从API获取最新版本信息
            const versionInfo = await appApi.checkForUpdates();
            
            if (versionInfo && versionInfo.release_notes) {
                // 直接使用API返回的release_notes
                return formatReleaseNotes(version, versionInfo.release_notes, versionInfo.release_name);
            }
        } catch (error) {
            console.warn('⚠️ [App.jsx] 从API获取更新日志失败:', error);
        }

        try {
        // 尝试从本地读取对应版本的更新日志文件
            const releaseFilePath = `docs/releases/RELEASE_v${version}.md`;
            
            // 检查文件是否存在
            const exists = await fileApi.fileExists(releaseFilePath);
            
            if (exists) {
                const result = await fileApi.readFileContent(releaseFilePath);
                return result.content || getDefaultUpdateLogContent(version);
            }
        } catch (error) {
            console.warn('⚠️ [App.jsx] 读取更新日志文件失败:', error);
        }

        // 如果无法读取文件，返回默认内容
        return getDefaultUpdateLogContent(version);
    };

    /**
     * 格式化API返回的发布说明
     * @param {string} version - 版本号
     * @param {string} releaseNotes - 发布说明
     * @param {string} releaseName - 发布名称
     * @returns {string} 格式化后的更新日志内容
     */
    const formatReleaseNotes = (version, releaseNotes, releaseName) => {
        // 构建标准的标题
        const standardTitle = releaseName || `🚀 Miaogu NotePad v${version} 更新日志`;
        
        // 如果发布说明已经是Markdown格式
        if (releaseNotes.includes('#') || releaseNotes.includes('##')) {
            // 检查是否已经有标题，如果有则替换第一个标题，如果没有则添加标题
            const lines = releaseNotes.split('\n');
            let hasTitle = false;
            let processedLines = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // 如果是第一个一级标题，替换它
                if (!hasTitle && line.startsWith('# ')) {
                    processedLines.push(`# ${standardTitle}`);
                    hasTitle = true;
                } else {
                    processedLines.push(lines[i]);
                }
            }
            
            // 如果没有找到一级标题，在开头添加
            if (!hasTitle) {
                processedLines.unshift(`# ${standardTitle}`, '');
            }
            
            return processedLines.join('\n');
        }
        
        // 否则，包装成标准的更新日志格式
        return `# ${standardTitle}

${releaseNotes}

---

**🌟 如果您喜欢这个项目，请给我们一个 Star！**

*喵咕记事本 - 让编程更智能，让创作更高效，让知识更有序* ✨`;
    };

    /**
     * 获取默认更新日志内容
     * @param {string} version - 版本号
     * @returns {string} 默认更新日志内容
     */
    const getDefaultUpdateLogContent = (version) => {
        return `# 🚀 Miaogu NotePad v${version} 更新日志

欢迎使用喵咕记事本 v${version}！

## ✨ 主要更新

### 🖥️ 自定义命令行启动
- 支持通过自定义命令在终端中快速启动编辑器
- 文件关联功能，可直接通过命令行打开指定文件
- 智能路径处理，支持相对路径和绝对路径

### 📋 智能更新日志系统
- 应用更新后首次启动时自动展示更新日志
- 设置中心可随时查看更新日志
- 更新日志以只读模式打开，专注于内容展示

## 🔧 功能改进
- 优化命令行参数处理
- 完善文件操作错误处理
- 提升用户界面体验

---

**🌟 如果您喜欢这个项目，请给我们一个 Star！**

*喵咕记事本 - 让编程更智能，让创作更高效，让知识更有序* ✨`;
    };

    /**
     * 处理CLI参数，打开通过命令行传递的文件
     */
    useEffect(() => {
        const handleCliArgs = async () => {
            if (cliArgsProcessedRef.current) {
                return;
            }

            const showFileStatus = () => {
                return {
                    currentFile: fileManager.currentFile,
                    openedFiles: fileManager.openedFiles,
                    editorContentLength: fileManager.currentCode?.length || 0
                };
            };

            window.testCliArgs = testCliArgs;
            window.setDebugFile = setDebugFile;
            window.testFileOpen = testFileOpen;
            window.showFileStatus = showFileStatus;
            window.openUpdateLog = openUpdateLog; // 暴露openUpdateLog方法到全局
            cliArgsProcessedRef.current = true;

            // 首先检查并处理更新日志
            await checkAndShowUpdateLog();

            try {
                const args = await appApi.getCliArgs();

                if (args && args.length > 0) {
                    const filePath = args[0];

                    if (filePath && typeof filePath === 'string') {
                        try {
                            await fileApi.fileExists(filePath);
                        } catch (error) {
                        }

                        try {
                            await fileManager.setOpenFile(filePath);
                            return;
                        } catch (error) {
                        }
                    }
                }
            } catch (error) {
            }

            if (!window['__TAURI__']) {
                const debugFile = localStorage.getItem('miaogu-notepad-debug-file');
                if (debugFile) {
                    try {
                        await fileManager.setOpenFile(debugFile);
                        return;
                    } catch (error) {
                    }
                }
            }

            if (fileManager.openedFiles.length === 0) {
                // 不在这里创建初始文件，让useSessionRestore处理
            }
        }

        handleCliArgs().then();
    }, [fileManager]);

    /**
     * 初始化应用程序设置
     * 加载保存的主题、字体、背景等设置
     */
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // 初始化图片代理加载器 - 自动检测系统代理配置
                try {
                    await initImageProxyLoader();
                } catch (error) {
                    console.warn('Failed to initialize image proxy loader:', error);
                }

                // 使用与 tauriApi.js 一致的环境检测
                if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
                    const savedTheme = await settingsApi.get('theme', 'light');
                    const savedFontFamily = await settingsApi.get('fontFamily', 'Consolas, Monaco, monospace');
                    const savedLineHeight = await settingsApi.get('lineHeight', 1.5);
                    const savedBackgroundImage = await settingsApi.get('backgroundImage', '');
                    const savedBackgroundEnabled = await settingsApi.get('backgroundEnabled', false);
                    const savedBackgroundTransparency = await settingsApi.get('backgroundTransparency', {
                        dark: 80,
                        light: 55
                    });

                    // 确保 savedTheme 有有效值，避免传递 undefined
                    const safeTheme = savedTheme && savedTheme !== 'undefined' ? savedTheme : 'light';

                    setTheme(safeTheme);
                    setFontFamily(savedFontFamily);
                    setLineHeight(savedLineHeight);
                    setBackgroundImage(savedBackgroundImage);
                    setBackgroundEnabled(savedBackgroundEnabled);

                    if (savedBackgroundTransparency && typeof savedBackgroundTransparency === 'object') {
                        if (savedBackgroundTransparency.dark !== undefined) {
                            setBackgroundTransparency('dark', savedBackgroundTransparency.dark);
                        }
                        if (savedBackgroundTransparency.light !== undefined) {
                            setBackgroundTransparency('light', savedBackgroundTransparency.light);
                        }
                    }

                    // 初始化背景图片样式
                    if (savedBackgroundEnabled && savedBackgroundImage) {
                        // 检查是否为文件路径，如果是则使用convertFileSrc转换
                        let imageUrl;
                        if (savedBackgroundImage.startsWith('data:')) {
                            // 如果是base64数据，直接使用
                            imageUrl = `url("${savedBackgroundImage}")`;
                        } else {
                            // 如果是文件路径，使用convertFileSrc转换
                            try {
                                const { convertFileSrc } = await import('@tauri-apps/api/core');
                                const convertedUrl = convertFileSrc(savedBackgroundImage);
                                imageUrl = `url("${convertedUrl}")`;
                            } catch (error) {
                                console.warn('转换背景图片路径失败:', error);
                                imageUrl = `url("${savedBackgroundImage}")`;
                            }
                        }

                        document.documentElement.style.setProperty('--editor-background-image', imageUrl);

                        const darkTransparency = savedBackgroundTransparency.dark / 100;
                        const lightTransparency = savedBackgroundTransparency.light / 100;

                        const lightOpacity = `rgba(255, 255, 255, ${lightTransparency})`;
                        const darkOpacity = `rgba(0, 0, 0, ${darkTransparency})`;

                        document.documentElement.style.setProperty('--editor-background-light', lightOpacity);
                        document.documentElement.style.setProperty('--editor-background-dark', darkOpacity);
                    } else {
                        document.documentElement.style.setProperty('--editor-background-image', 'none');
                    }

                    document.documentElement.setAttribute('data-theme', savedTheme);
                } else {
                    if (!document.documentElement.getAttribute('data-theme')) {
                        setTheme('light');
                        document.documentElement.setAttribute('data-theme', 'light');
                    }
                }
            } catch (error) {
                if (!document.documentElement.getAttribute('data-theme')) {
                    setTheme('light');
                    document.documentElement.setAttribute('data-theme', 'light');
                }
            }
        };
        initializeApp().catch(console.error);
    }, []);

    /**
     * 当主题变化时，更新背景透明度
     */
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', currentTheme);

        // 强制更新背景透明度变量以确保主题切换时正确应用
        const updateBackgroundForTheme = () => {
            const state = store.getState();
            const { backgroundEnabled, backgroundTransparency, backgroundImage } = state.theme;

            if (backgroundEnabled && backgroundImage) {
                const darkTransparency = backgroundTransparency.dark / 100;
                const lightTransparency = backgroundTransparency.light / 100;

                const lightOpacity = `rgba(255, 255, 255, ${lightTransparency})`;
                const darkOpacity = `rgba(0, 0, 0, ${darkTransparency})`;

                document.documentElement.style.setProperty('--editor-background-light', lightOpacity);
                document.documentElement.style.setProperty('--editor-background-dark', darkOpacity);
            }
        };

        updateBackgroundForTheme();
    }, [currentTheme]);

    /**
     * 监听Redux状态变化，更新背景样式
     */
    useEffect(() => {
        const updateBackgroundStyles = async () => {
            const state = store.getState();
            const { backgroundEnabled, backgroundTransparency, backgroundImage } = state.theme;

            if (backgroundEnabled && backgroundImage) {
                // 检查是否为文件路径，如果是则使用convertFileSrc转换
                let imageUrl;
                if (backgroundImage.startsWith('data:')) {
                    // 如果是base64数据，直接使用
                    imageUrl = `url("${backgroundImage}")`;
                } else {
                    // 如果是文件路径，使用convertFileSrc转换
                    try {
                        const { convertFileSrc } = await import('@tauri-apps/api/core');
                        const convertedUrl = convertFileSrc(backgroundImage);
                        imageUrl = `url("${convertedUrl}")`;
                    } catch (error) {
                        console.warn('转换背景图片路径失败:', error);
                        imageUrl = `url("${backgroundImage}")`;
                    }
                }

                document.documentElement.style.setProperty('--editor-background-image', imageUrl);

                const darkTransparency = backgroundTransparency.dark / 100;
                const lightTransparency = backgroundTransparency.light / 100;

                const lightOpacity = `rgba(255, 255, 255, ${lightTransparency})`;
                const darkOpacity = `rgba(0, 0, 0, ${darkTransparency})`;

                document.documentElement.style.setProperty('--editor-background-light', lightOpacity);
                document.documentElement.style.setProperty('--editor-background-dark', darkOpacity);

                // 预加载图片以确保正确显示
                const testImg = new Image();
                if (backgroundImage.startsWith('data:')) {
                    testImg.src = backgroundImage;
                } else {
                    try {
                        const { convertFileSrc } = await import('@tauri-apps/api/core');
                        testImg.src = convertFileSrc(backgroundImage);
                    } catch (error) {
                        testImg.src = backgroundImage;
                    }
                }
            } else {
                document.documentElement.style.setProperty('--editor-background-image', 'none');

                const defaultLight = 'rgba(255, 255, 255, 0.5)';
                const defaultDark = 'rgba(0, 0, 0, 0.5)';

                document.documentElement.style.setProperty('--editor-background-light', defaultLight);
                document.documentElement.style.setProperty('--editor-background-dark', defaultDark);
            }
        };

        updateBackgroundStyles();
        const unsubscribe = store.subscribe(() => updateBackgroundStyles());

        return () => {
            unsubscribe();
        };
    }, [currentTheme]);

    /**
     * 在应用加载完成且会话恢复完成后显示窗口
     */
    useEffect(() => {
        if (!isRestoring && !restoreError) {
            (async () => {
                try {
                    await appApi.showMainWindow();
                } catch (error) {
                    console.error('显示主窗口失败:', error);
                }
            })();
        }
    }, [isRestoring, restoreError]);

    return (
        <ConfigProvider
            theme={{
                algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    colorPrimary: '#1890ff',
                    borderRadius: 6,
                    wireframe: false
                }
            }}
        >
            <AntdApp>
                <Layout
                    className={`app-layout ${backgroundEnabled && backgroundImage ? 'has-background' : ''} ${isDragOver ? 'drag-over' : ''} ${!isHeaderVisible ? 'fullscreen-mode' : ''}`}
                    data-theme={currentTheme}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {isHeaderVisible && <AppHeader fileManager={fileManager} hasOpenFiles={hasOpenFiles} openUpdateLog={openUpdateLog} />}
                    <TabBar fileManager={fileManager} />
                    <Layout className="main-layout">
                        <Content className="app-content">
                            <AppContent
                                isDarkMode={currentTheme === 'dark'}
                                toggleTheme={toggleTheme}
                                fileManager={fileManager}
                                isHeaderVisible={isHeaderVisible}
                                setCursorPosition={setCursorPosition}
                                setCharacterCount={setCharacterCount}
                            />
                        </Content>
                        <EditorStatusBar
                            fileManager={fileManager}
                            cursorPosition={cursorPosition}
                            characterCount={characterCount}
                            hasOpenFiles={hasOpenFiles}
                        />
                    </Layout>
                    {isDragOver && (
                        <div className="drag-overlay">
                            <div className="drag-overlay-content">
                                <div className="drag-icon">
                                    <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                                </div>
                                <div className="drag-text">{t('editor.dragFiles')}</div>
                                <div className="drag-subtext">{t('editor.dragSubtext')}</div>
                            </div>
                        </div>
                    )}
                </Layout>
            </AntdApp>
        </ConfigProvider>
    );
};

/**
 * 应用程序根组件
 * 提供Redux store的Provider包装
 * @returns {JSX.Element} 应用程序根组件
 */
function App() {
    return (
        <Provider store={store}>
            <MainApp />
        </Provider>
    );
}

export default App;

