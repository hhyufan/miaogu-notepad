import { useEffect, useState, useRef, useCallback } from 'react';
import { Layout, Button, ConfigProvider, theme, App as AntdApp, Spin } from 'antd';
import { MoonFilled, SunOutlined, CodeOutlined, EyeOutlined, PartitionOutlined } from '@ant-design/icons';
import { Provider, useSelector } from 'react-redux';
import { store } from './store';
import { useTheme } from './hooks/redux';
import { useI18n } from './hooks/useI18n';
import tauriApi from './utils/tauriApi';
const { settings: settingsApi, app: appApi } = tauriApi;
import { useSessionRestore } from './hooks/useSessionRestore';
import AppHeader from './components/AppHeader';
import TabBar from './components/TabBar';
import CodeEditor from './components/CodeEditor';
import TreeEditor from './components/TreeEditor';
import EditorStatusBar from './components/EditorStatusBar';

import { useFileManager } from './hooks/useFileManager.jsx';
import { withThemeTransition, withEditorModeTransition } from './utils/viewTransition';
import './App.scss';

const { Content } = Layout;

// 编辑器模式枚举
const EDITOR_MODES = {
  MONACO: 'monaco',
  MARKDOWN: 'markdown',
  MGTREE: 'mgtree'
};

// 内部组件，用于访问文件上下文
const AppContent = ({ isDarkMode, toggleTheme, fileManager }) => {
  const { t } = useI18n();
  const [isTreeMode, setIsTreeMode] = useState(false);
  const [editorMode, setEditorMode] = useState(EDITOR_MODES.MONACO);
  const { currentFile } = fileManager;

  // 检查当前文件是否为.mgtree文件
  const isMgtreeFile = currentFile && currentFile.name && currentFile.name.endsWith('.mgtree');

  // 检查当前文件是否为Markdown文件
  const isMarkdownFile = currentFile && currentFile.name &&
    ['md', 'markdown'].some(ext => currentFile.name.toLowerCase().endsWith('.' + ext));

  // 切换编辑器模式的函数
  const toggleEditorMode = useCallback(async () => {
    await withEditorModeTransition(() => {
      if (isMgtreeFile) {
        // mgtree文件：Monaco <-> MGTree
        if (editorMode === EDITOR_MODES.MONACO) {
          setEditorMode(EDITOR_MODES.MGTREE);
          setIsTreeMode(true);
        } else {
          setEditorMode(EDITOR_MODES.MONACO);
          setIsTreeMode(false);
        }
      } else if (isMarkdownFile) {
        // Markdown文件：Monaco <-> Markdown预览
        if (editorMode === EDITOR_MODES.MONACO) {
          setEditorMode(EDITOR_MODES.MARKDOWN);
        } else {
          setEditorMode(EDITOR_MODES.MONACO);
        }
      }
    });
  }, [editorMode, isMgtreeFile, isMarkdownFile]);

  // 获取编辑器模式图标
  const getEditorModeIcon = () => {
    if (isMgtreeFile) {
      return editorMode === EDITOR_MODES.MGTREE ? <CodeOutlined /> : <PartitionOutlined />;
    } else if (isMarkdownFile) {
      return editorMode === EDITOR_MODES.MARKDOWN ? <CodeOutlined /> : <EyeOutlined />;
    }
    return <CodeOutlined />;
  };

  // 获取编辑器模式按钮的CSS类名
  const getEditorModeClassName = () => {
    if (isMgtreeFile) {
      return editorMode === EDITOR_MODES.MGTREE ? 'code-mode' : 'mgtree-mode';
    } else if (isMarkdownFile) {
      return editorMode === EDITOR_MODES.MARKDOWN ? 'code-mode' : 'preview-mode';
    }
    return 'code-mode';
  };

  // 获取编辑器模式提示文本
  const getEditorModeTitle = () => {
    if (isMgtreeFile) {
      return editorMode === EDITOR_MODES.MGTREE ? t('editor.switchToCodeEditor') : t('editor.switchToTreeEditor');
    } else if (isMarkdownFile) {
      return editorMode === EDITOR_MODES.MARKDOWN ? t('editor.switchToCodeEditor') : t('editor.switchToPreviewMode');
    }
    return t('editor.editorMode');
  };

  // 键盘事件监听 - CTRL + / 切换编辑器
  useEffect(() => {
    const handleKeyDown = async (event) => {
      if (event.ctrlKey && event.key === '/') {
        event.preventDefault();
        toggleEditorMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleEditorMode]);

  // 当文件切换时，根据文件类型设置编辑器模式
  useEffect(() => {
    // 其他文件重置为Monaco编辑器模式
    setEditorMode(EDITOR_MODES.MONACO);
    setIsTreeMode(false);
  }, [isMgtreeFile, isMarkdownFile, fileManager.currentFile?.path]); // 添加文件路径依赖，确保文件切换时触发

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
        <div className="code-editor-container">
          <div
            className="monaco-editor-wrapper"
            style={{ display: (isMgtreeFile && isTreeMode) ? 'none' : 'block' }}
          >
            <CodeEditor
              isDarkMode={isDarkMode}
              fileManager={fileManager}
              showMarkdownPreview={isMarkdownFile && editorMode === EDITOR_MODES.MARKDOWN}
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
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// 主应用组件（在Provider内部）
const MainApp = () => {
  const { 
    theme: currentTheme, 
    setTheme, 
    setFontSize, 
    setFontFamily, 
    setLineHeight,
    setBackgroundImage,
    setBackgroundEnabled,
    setBackgroundTransparency
  } = useTheme();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);

  // 会话恢复
  const { isRestoring, restoreError } = useSessionRestore();

  // 获取背景状态
  const { backgroundEnabled, backgroundImage } = useSelector((state) => state.theme);



  // 初始化文件管理器
  const fileManager = useFileManager();

  // 主题切换函数
  const toggleTheme = useCallback(async () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    await withThemeTransition(() => {
      setTheme(newTheme);
    });

    // 保存到Tauri设置
    if (window.__TAURI__) {
      settingsApi.set('theme', newTheme).catch(() => {
        // Silently handle theme save errors
      });
    } else {
      localStorage.setItem('theme', newTheme);
    }
  }, [currentTheme, setTheme]);

  // 手动测试CLI参数的函数
  const testCliArgs = async () => {
    try {
      const args = await appApi.getCliArgs();
      return args;
    } catch (error) {
      // Silently handle CLI args test errors
      return [];
    }
  };

  // 设置调试文件路径的函数
  const setDebugFile = (filePath) => {
    if (!window.__TAURI__) {
      localStorage.setItem('miaogu-notepad-debug-file', filePath);
    }
  };

  // 测试文件打开的函数
  const testFileOpen = async () => {
    try {
      const args = await appApi.getCliArgs();

      if (args && args.length > 0) {
        const filePath = args[0];

        // 检查文件是否存在
        try {
          await fileApi.fileExists(filePath);
        } catch (error) {
          // Silently handle file existence check errors
        }

        try {
          await fileManager.setOpenFile(filePath);
          return { success: true, filePath };
        } catch (error) {
          return { success: false, error };
        }
      } else {
        // 检查开发模式下的调试文件
        if (!hasTauri) {
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
      }
    } catch (error) {
      return { success: false, error };
    }
    return { success: false };
  };

  // 用于跟踪是否已经处理过CLI参数
  const cliArgsProcessedRef = useRef(false);

  // 处理命令行参数中的文件路径 - 只在应用初始化时执行一次
  useEffect(() => {
    const handleCliArgs = async () => {
      // 如果已经处理过CLI参数，直接返回
      if (cliArgsProcessedRef.current) {
        return;
      }

      // 在 Tauri v2 中，检查是否在 Tauri 环境中运行
      const hasTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

      // 查看当前文件状态的函数
      const showFileStatus = () => {
        return {
          currentFile: fileManager.currentFile,
          openedFiles: fileManager.openedFiles,
          editorContentLength: fileManager.currentCode?.length || 0
        };
      };

      // 添加调试函数到window对象，方便调试
      window.testCliArgs = testCliArgs;
      window.setDebugFile = setDebugFile;
      window.testFileOpen = testFileOpen;
      window.showFileStatus = showFileStatus;

      if (!isRestoring && !loading) {
        // 标记CLI参数已开始处理
        cliArgsProcessedRef.current = true;

        // 尝试获取CLI参数（无论是否在Tauri环境中）
        try {
          const args = await appApi.getCliArgs();

          if (args && args.length > 0) {
            // 获取第一个参数作为文件路径
            const filePath = args[0];

            if (filePath && typeof filePath === 'string') {
              // 检查文件是否存在
              try {
                await fileApi.fileExists(filePath);
              } catch (error) {
                // Silently handle file existence check errors
              }

              // 尝试打开文件
              try {
                await fileManager.setOpenFile(filePath);
                return; // 成功打开文件，不需要创建新文件
              } catch (error) {
                // 静默处理CLI参数文件打开错误
              }
            }
          }
        } catch (error) {
          // Silently handle CLI args errors in development mode
        }

        // 开发模式：检查localStorage中的调试文件
        if (!window.__TAURI__) {
          const debugFile = localStorage.getItem('miaogu-notepad-debug-file');
          if (debugFile) {
            try {
              await fileManager.setOpenFile(debugFile);
              return;
            } catch (error) {
              // 静默处理调试文件打开错误
            }
          }
        }

        // 如果没有命令行参数或打开失败，且没有其他打开的文件，则创建新文件
        if (fileManager.openedFiles.length === 0) {
          const initialContent = ''
          fileManager.createFile('untitled.js', initialContent);
        }
      }
    };

    handleCliArgs();
  }, [isRestoring, loading]); // 移除fileManager相关依赖，避免重复执行





  useEffect(() => {
    // 初始化应用设置
    const initializeApp = async () => {
      try {
        // 检查是否在Tauri环境中
        if (window.__TAURI__) {
          // 从持久化存储加载设置
          const savedTheme = await settingsApi.get('theme', 'light');
          const savedFontSize = await settingsApi.get('fontSize', 14);
          const savedFontFamily = await settingsApi.get('fontFamily', 'Consolas, Monaco, monospace');
          const savedLineHeight = await settingsApi.get('lineHeight', 1.5);
          const savedBackgroundImage = await settingsApi.get('backgroundImage', '');
          const savedBackgroundEnabled = await settingsApi.get('backgroundEnabled', false);
          const savedBackgroundTransparency = await settingsApi.get('backgroundTransparency', { dark: 80, light: 55 });

          // 应用所有设置到Redux store
          setTheme(savedTheme);
          setFontSize(savedFontSize);
          setFontFamily(savedFontFamily);
          setLineHeight(savedLineHeight);
          setBackgroundImage(savedBackgroundImage);
          setBackgroundEnabled(savedBackgroundEnabled);
          
          // 设置背景透明度（需要分别设置dark和light模式）
          if (savedBackgroundTransparency && typeof savedBackgroundTransparency === 'object') {
            if (savedBackgroundTransparency.dark !== undefined) {
              setBackgroundTransparency('dark', savedBackgroundTransparency.dark);
            }
            if (savedBackgroundTransparency.light !== undefined) {
              setBackgroundTransparency('light', savedBackgroundTransparency.light);
            }
          }
          
          document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
          // 浏览器环境，使用默认设置
          // 只在首次加载时设置默认主题，避免覆盖用户的主题切换
          if (!document.documentElement.getAttribute('data-theme')) {
            setTheme('light');
            document.documentElement.setAttribute('data-theme', 'light');
          }
        }
      } catch (error) {
        // 出错时使用默认设置
        if (!document.documentElement.getAttribute('data-theme')) {
          setTheme('light');
          document.documentElement.setAttribute('data-theme', 'light');
        }
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []); // 移除setTheme依赖，避免重复初始化

  // 初始化主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  // 监听背景设置变化并更新CSS变量
  useEffect(() => {
    const updateBackgroundStyles = () => {
      const state = store.getState();
      const { backgroundEnabled, backgroundTransparency, backgroundImage } = state.theme;

      if (backgroundEnabled && backgroundImage) {
        // 设置背景图片和双透明度 - 修复CSS变量格式
        const imageUrl = `url("${backgroundImage}")`;
        document.documentElement.style.setProperty('--editor-background-image', imageUrl);

        // 使用双透明度设置 - 修正颜色值，使用黑色而不是深灰色
        const darkTransparency = backgroundTransparency.dark / 100;
        const lightTransparency = backgroundTransparency.light / 100;

        const lightOpacity = `rgba(255, 255, 255, ${lightTransparency})`;
        const darkOpacity = `rgba(0, 0, 0, ${darkTransparency})`; // 使用纯黑色增强透明度效果

        document.documentElement.style.setProperty('--editor-background-light', lightOpacity);
        document.documentElement.style.setProperty('--editor-background-dark', darkOpacity);

        // 不直接设置 --editor-background，让CSS根据主题自动选择
        // CSS中已经定义了：
        // [data-theme='light'] { --editor-background: var(--editor-background-light); }
        // [data-theme='dark'] { --editor-background: var(--editor-background-dark); }

        // 测试图片是否能加载
        const testImg = new Image();
        testImg.src = backgroundImage;
      } else {
        // 清除背景图片，设置为透明
        document.documentElement.style.setProperty('--editor-background-image', 'none');

        const defaultLight = 'rgba(255, 255, 255, 0.5)';
        const defaultDark = 'rgba(0, 0, 0, 0.5)';

        document.documentElement.style.setProperty('--editor-background-light', defaultLight);
        document.documentElement.style.setProperty('--editor-background-dark', defaultDark);

        // 不直接设置 --editor-background，让CSS根据主题自动选择

      }
    };

    // 初始化背景样式
    updateBackgroundStyles();

    // 添加延迟检查，确保DOM已渲染
    setTimeout(() => {
      const rootStyle = window.getComputedStyle(document.documentElement);

      const appLayout = document.querySelector('.app-layout');
    }, 1000);

    // 监听store变化
    const unsubscribe = store.subscribe(updateBackgroundStyles);

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
          className={`app-layout ${backgroundEnabled && backgroundImage ? 'has-background' : ''}`}
          data-theme={currentTheme}>
          <AppHeader fileManager={fileManager} />
          <TabBar fileManager={fileManager} />
          <Layout className="main-layout">
            <Content className="app-content">
              <AppContent
                isDarkMode={currentTheme === 'dark'}
                toggleTheme={toggleTheme}
                fileManager={fileManager}
              />
            </Content>
            <EditorStatusBar fileManager={fileManager} />
          </Layout>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
};

function App() {
  return (
    <Provider store={store}>
      <MainApp />
    </Provider>
  );
}

export default App;
