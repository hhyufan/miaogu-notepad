/**
 * @fileoverview 主题Hook - 管理应用的明暗主题状态
 * 提供主题切换功能，支持本地存储和DOM类名管理
 * @author hhyufan
 * @version 1.2.0
 */

import { useState, useEffect } from 'react';

/**
 * 主题钩子 - 管理应用的明暗主题状态
 * @returns {Object} 包含主题状态和切换函数的对象
 * @returns {boolean} returns.isDarkMode - 是否为暗色主题
 * @returns {Function} returns.toggleTheme - 切换主题函数
 */
export const useTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return {
    isDarkMode,
    toggleTheme
  };
};

export default useTheme;
