import { useState, useEffect } from 'react';

/**
 * 主题钩子 - 管理应用的明暗主题状态
 * @returns {Object} 包含isDarkMode状态和toggleTheme切换函数的对象
 */
export const useTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // 从localStorage读取保存的主题设置，默认为false（浅色主题）
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });

  // 当主题状态改变时，保存到localStorage并更新document的class
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // 更新document的class以应用全局主题样式
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkMode]);

  // 切换主题的函数
  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return {
    isDarkMode,
    toggleTheme
  };
};

export default useTheme;