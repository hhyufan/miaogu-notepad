import { useEffect, useState, useRef, useCallback } from 'react';
import { Layout, Button, ConfigProvider, theme, App as AntdApp, Spin } from 'antd';
import { MoonFilled, SunOutlined } from '@ant-design/icons';
import { Provider, useSelector } from 'react-redux';
import { store } from './store';
import { useTheme } from './hooks/redux';
import { settingsApi } from './utils/tauriApi';
import { useSessionRestore } from './hooks/useSessionRestore';
import AppHeader from './components/AppHeader';
import TabBar from './components/TabBar';
import CodeEditor from './components/CodeEditor';
import EditorStatusBar from './components/EditorStatusBar';

import { useFileManager } from './hooks/useFileManager';
import './App.scss';

const { Content } = Layout;

// 内部组件，用于访问文件上下文
const AppContent = ({ isDarkMode, toggleTheme, fileManager }) => {
  return (
    <>
      <div className="theme-toggle">
        <Button
          type="text"
          icon={isDarkMode ? <MoonFilled /> : <SunOutlined />}
          onClick={toggleTheme}
          title={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}
          className="theme-toggle-btn"
        />
      </div>
      <div className="content-container">
        <div className="code-editor-container">
          <CodeEditor
            isDarkMode={isDarkMode}
            fileManager={fileManager}
          />
        </div>
      </div>
    </>
  );
};

// 主应用组件（在Provider内部）
const MainApp = () => {
  const { theme: currentTheme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);

  // 会话恢复
  const { isRestoring, restoreError } = useSessionRestore();

  // 获取背景状态
  const { backgroundEnabled, backgroundImage, backgroundTransparency } = useSelector((state) => state.theme);



  // 初始化文件管理器
  const fileManager = useFileManager();

  // 主题切换函数
  const toggleTheme = useCallback(() => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    // 保存到Tauri设置
    if (window.__TAURI__) {
      settingsApi.set('theme', newTheme).catch(error => {
        console.error('保存主题设置失败:', error);
      });
    } else {
      localStorage.setItem('theme', newTheme);
    }
  }, [currentTheme, setTheme]);





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

          setTheme(savedTheme);
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
        console.error('Failed to initialize app:', error);
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
          {isRestoring ? '正在恢复会话...' : '加载中...'}
        </div>
        {restoreError && (
          <div className="restore-error">
            恢复会话失败: {restoreError}
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
