/**
 * @fileoverview 主题Hook - 管理应用的明暗主题状态
 * 提供主题切换功能，基于Redux状态管理，确保状态一致性
 * @author hhyufan
 * @version 1.3.0
 */

import { useEffect } from 'react';
import { useSelector } from 'react-redux';

/**
 * 主题钩子 - 管理应用的明暗主题状态
 * 基于Redux状态，确保与其他组件的主题状态保持一致
 * @returns {Object} 包含主题状态的对象
 * @returns {boolean} returns.isDarkMode - 是否为暗色主题
 * @returns {string} returns.theme - 当前主题名称
 */
export const useTheme = () => {
  const theme = useSelector((state) => state.theme.theme);
  const isDarkMode = theme === 'dark';

  console.log('🎨 [useTheme] Hook调用:', {
    theme,
    isDarkMode,
    timestamp: new Date().toISOString()
  });

  // 同步DOM类名，确保CSS主题样式正确应用
  useEffect(() => {
    console.log('🎨 [useTheme] DOM更新开始:', {
      theme,
      isDarkMode,
      currentClasses: {
        documentElement: document.documentElement.className,
        body: document.body.className,
        dataTheme: document.documentElement.getAttribute('data-theme')
      }
    });

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-theme');
      document.documentElement.setAttribute('data-theme', 'light');
    }

    console.log('🎨 [useTheme] DOM更新完成:', {
      theme,
      isDarkMode,
      updatedClasses: {
        documentElement: document.documentElement.className,
        body: document.body.className,
        dataTheme: document.documentElement.getAttribute('data-theme')
      }
    });
  }, [isDarkMode, theme]);

  return {
    isDarkMode,
    theme
  };
};

export default useTheme;
