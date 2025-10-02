/**
 * @fileoverview 应用程序主组件
 * 提供整体布局、主题管理、编辑器模式切换等核心功能
 * @author hhyufan
 * @version 1.3.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { App as AntdApp, Button, ConfigProvider, Layout, Spin, theme } from 'antd';
import { CodeOutlined, EyeOutlined, InboxOutlined, MoonFilled, PartitionOutlined, SunOutlined } from '@ant-design/icons';
import { Provider, useSelector } from 'react-redux';
import { invoke } from '@tauri-apps/api/core';
import { store } from './store';
import { useTheme } from './hooks/redux';
import { useI18n } from './hooks/useI18n';
import tauriApi, { fileApi } from './utils/tauriApi';
import { useSessionRestore } from './hooks/useSessionRestore';
import AppHeader from './components/AppHeader';
import TabBar from './components/TabBar';
import CodeEditor from './components/CodeEditor';
import TreeEditor from './components/TreeEditor';
import EditorStatusBar from './components/EditorStatusBar';

import WelcomeScreen from './components/WelcomeScreen';

import { useFileManager } from './hooks/useFileManager.jsx';
import { withEditorModeTransition, withThemeTransition } from './utils/viewTransition';
import './App.scss';

const { settings: settingsApi, app: appApi } = tauriApi;
const { Content } = Layout;

/**
 * 编辑器模式枚举
 */
const EDITOR_MODES = {
  MONACO: 'monaco',
  MARKDOWN: 'markdown',
  MGTREE: 'mgtree'
};

/**
 * 应用内容组件 - 处理编辑器模式切换和主题切换
 * @param {Object} props - 组件属性
 * @param {boolean} props.isDarkMode - 是否为暗色模式
 * @param {Function} props.toggleTheme - 主题切换函数
 * @param {Object} props.fileManager - 文件管理器实例
 */
const AppContent = ({ isDarkMode, toggleTheme, fileManager, isHeaderVisible, setCursorPosition, setCharacterCount }) => {
  const { t } = useI18n();
  const [isTreeMode, setIsTreeMode] = useState(false);
  const [editorMode, setEditorMode] = useState(EDITOR_MODES.MONACO);
  const { currentFile, openedFiles, newFile, openFile } = fileManager;

  const isMgtreeFile = currentFile && currentFile['name'] && currentFile['name'].endsWith('.mgtree');
  const isMarkdownFile = currentFile && currentFile['name'] &&
    ['md', 'markdown'].some(ext => currentFile['name'].toLowerCase().endsWith('.' + ext));

  // 检查是否有打开的文件
  const hasOpenFiles = openedFiles && openedFiles.length > 0;

  /**
   * 切换编辑器模式
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

  const getEditorModeIcon = () => {
    if (isMgtreeFile) {
      return editorMode === EDITOR_MODES.MGTREE ? <CodeOutlined /> : <PartitionOutlined />;
    } else if (isMarkdownFile) {
      return editorMode === EDITOR_MODES.MARKDOWN ? <CodeOutlined /> : <EyeOutlined />;
    }
    return <CodeOutlined />;
  };

  const getEditorModeClassName = () => {
    if (isMgtreeFile) {
      return editorMode === EDITOR_MODES.MGTREE ? 'code-mode' : 'mgtree-mode';
    } else if (isMarkdownFile) {
      return editorMode === EDITOR_MODES.MARKDOWN ? 'code-mode' : 'preview-mode';
    }
    return 'code-mode';
  };

  const getEditorModeTitle = () => {
    if (isMgtreeFile) {
      return editorMode === EDITOR_MODES.MGTREE ? t('editor.switchToCodeEditor') : t('editor.switchToTreeEditor');
    } else if (isMarkdownFile) {
      return editorMode === EDITOR_MODES.MARKDOWN ? t('editor.switchToCodeEditor') : t('editor.switchToPreviewMode');
    }
    return t('editor.editorMode');
  };

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

  useEffect(() => {
    setEditorMode(EDITOR_MODES.MONACO);
    setIsTreeMode(false);
  }, [isMgtreeFile, isMarkdownFile, fileManager.currentFile?.path]);

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
              <CodeEditor
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
                <TreeEditor
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
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [characterCount, setCharacterCount] = useState(0);

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

  // F11键切换全屏模式（隐藏AppHeader、最大化窗口并隐藏任务栏）
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
              // 进入全屏模式：隐藏Header，设置全屏状态（这会隐藏任务栏），防止休眠
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

    // 监听窗口状态变化，当窗口退出全屏时自动显示AppHeader
    const checkWindowState = async () => {
      if (typeof window !== 'undefined' && window['__TAURI_INTERNALS__']) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();

          const isFullscreen = await appWindow.isFullscreen();

          // 如果当前Header是隐藏的，但窗口不是全屏状态，则显示Header
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

  // 全局键盘快捷键处理（确保F11全屏模式下也能使用）
  useEffect(() => {
    const handleGlobalKeyDown = async (event) => {
      // Ctrl+N 新建文件
      if (event.ctrlKey && event.key === 'n' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();

        try {
          // 不传文件名，让createFile方法自动处理索引
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
   */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * 处理拖拽离开事件
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
   */
  const toggleTheme = useCallback(async () => {
    console.log('🔄 [App] toggleTheme开始:', {
      currentTheme,
      timestamp: new Date().toISOString()
    });

    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    console.log('🔄 [App] 准备切换到新主题:', newTheme);

    // 直接设置主题，不使用视觉过渡，避免时序问题
    setTheme(newTheme);

    console.log('🔄 [App] toggleTheme完成:', {
      oldTheme: currentTheme,
      newTheme,
      timestamp: new Date().toISOString()
    });

    // 移除重复的localStorage操作，主题持久化由Redux persist和persistenceManager统一处理
  }, [currentTheme, setTheme]);

  const testCliArgs = async () => {
    try {
      return await appApi.getCliArgs();
    } catch (error) {
      return [];
    }
  };

  const setDebugFile = (filePath) => {
    if (!window['__TAURI__']) {
      localStorage.setItem('miaogu-notepad-debug-file', filePath);
    }
  };

  const testFileOpen = async () => {
    try {
      const args = await appApi.getCliArgs();

      if (args && args.length > 0) {
        const filePath = args[0];

        try {
          await fileApi.fileExists(filePath);
        } catch (error) { }

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

      if (!isRestoring && !loading) {
        cliArgsProcessedRef.current = true;

        try {
          const args = await appApi.getCliArgs();

          if (args && args.length > 0) {
            const filePath = args[0];

            if (filePath && typeof filePath === 'string') {
              try {
                await fileApi.fileExists(filePath);
              } catch (error) { }

              try {
                await fileManager.setOpenFile(filePath);
                return;
              } catch (error) { }
            }
          }
        } catch (error) { }

        if (!window['__TAURI__']) {
          const debugFile = localStorage.getItem('miaogu-notepad-debug-file');
          if (debugFile) {
            try {
              await fileManager.setOpenFile(debugFile);
              return;
            } catch (error) { }
          }
        }

        if (fileManager.openedFiles.length === 0) {
          // 不在这里创建初始文件，让useSessionRestore处理
          // const initialContent = '// Monaco Editor is working!\n
          // await fileManager.createFile('untitled.js', initialContent);
        }
      }
    };

    handleCliArgs().then();
  }, [isRestoring, loading]);

  useEffect(() => {
    const initializeApp = async () => {
      try {


        // 使用与 tauriApi.js 一致的环境检测
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {


          const savedTheme = await settingsApi.get('theme', 'light');
          const savedFontSize = await settingsApi.get('fontSize', 14);
          const savedFontFamily = await settingsApi.get('fontFamily', 'Consolas, Monaco, monospace');
          const savedLineHeight = await settingsApi.get('lineHeight', 1.5);
          const savedBackgroundImage = await settingsApi.get('backgroundImage', '');
          const savedBackgroundEnabled = await settingsApi.get('backgroundEnabled', false);
          const savedBackgroundTransparency = await settingsApi.get('backgroundTransparency', { dark: 80, light: 55 });

          setTheme(savedTheme);
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
      } finally {
        setLoading(false);
      }
    };

    initializeApp().then();
  }, []);

  useEffect(() => {
    console.log('🎨 [App] 主题同步 - 设置data-theme属性:', {
      currentTheme,
      timestamp: new Date().toISOString()
    });
    
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
    
    console.log('🎨 [App] 主题同步完成:', {
      currentTheme,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      timestamp: new Date().toISOString()
    });
  }, [currentTheme]);

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

  if (loading || isRestoring) {
    return (
      <div className="app-loading">
        <Spin size="large" />
        <div className="loading-spinner">
          {isRestoring ? t('message.info.restoringSession') : t('message.info.loading')}
        </div>
        {restoreError && (
          <div className="restore-error">
            {t('message.error.restoreSessionFailed')}: {restoreError}
          </div>
        )}
      </div>
    );
  }

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
          {isHeaderVisible && <AppHeader fileManager={fileManager} hasOpenFiles={hasOpenFiles} />}
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
