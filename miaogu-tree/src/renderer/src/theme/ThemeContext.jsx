import { createContext, useContext, useState, useEffect } from "react";

// 主题类型
// eslint-disable-next-line react-refresh/only-export-components
export const THEME_TYPES = {
  LIGHT: "light",
  DARK: "dark",
};

// 生成CSS变量
const getCSSVariables = (theme) => {
  const flattenObject = (obj, prefix = "") => {
    let result = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}-${key}` : key;
      if (typeof value === "object" && value !== null) {
        result = { ...result, ...flattenObject(value, newKey) };
      } else {
        result[`--${newKey}`] = value;
      }
    }
    return result;
  };
  return flattenObject(theme);
};

// 主题配置 - 与主程序保持一致
const themes = {
  light: {
    // 背景色
    background: {
      primary: "#ffffff",
      secondary: "#f8f9fa",
      tertiary: "#f1f3f4",
      card: "#ffffff",
      overlay: "rgba(255, 255, 255, 0.95)",
    },
    // 文字颜色
    text: {
      primary: "#262626",
      secondary: "#595959",
      muted: "#8c8c8c",
      inverse: "#ffffff",
      accent: "#1890ff",
    },
    // 边框颜色
    border: {
      primary: "#d9d9d9",
      secondary: "#f0f0f0",
      muted: "#fafafa",
      accent: "#1890ff",
    },
    // 阴影
    shadow: {
      sm: "0 1px 3px rgba(0, 0, 0, 0.1)",
      md: "0 4px 12px rgba(0, 0, 0, 0.15)",
      lg: "0 10px 25px rgba(0, 0, 0, 0.2)",
      xl: "0 25px 50px rgba(0, 0, 0, 0.25)",
      colored: "0 8px 25px rgba(24, 144, 255, 0.15)",
    },
    // 强调色
    accent: {
      primary: "#1890ff",
      secondary: "#722ed1",
      success: "#52c41a",
      warning: "#faad14",
      error: "#ff4d4f",
      info: "#13c2c2",
    },
  },
  dark: {
    // 背景色
    background: {
      primary: "#0f1419",
      secondary: "#1c2128",
      tertiary: "#262c36",
      card: "#1f1f1f",
      overlay: "rgba(15, 20, 25, 0.95)",
    },
    // 文字颜色
    text: {
      primary: "#f0f6fc",
      secondary: "#c9d1d9",
      muted: "#8b949e",
      inverse: "#0f1419",
      accent: "#58a6ff",
    },
    // 边框颜色
    border: {
      primary: "#30363d",
      secondary: "#21262d",
      muted: "#1c2128",
      accent: "#58a6ff",
    },
    // 阴影
    shadow: {
      sm: "0 1px 3px rgba(0, 0, 0, 0.4)",
      md: "0 4px 12px rgba(0, 0, 0, 0.5)",
      lg: "0 10px 25px rgba(0, 0, 0, 0.6)",
      xl: "0 25px 50px rgba(0, 0, 0, 0.7)",
      colored: "0 8px 25px rgba(88, 166, 255, 0.3)",
    },
    // 强调色
    accent: {
      primary: "#58a6ff",
      secondary: "#a5a2ff",
      success: "#3fb950",
      warning: "#d29922",
      error: "#f85149",
      info: "#39c5cf",
    },
  },
};

// 创建主题上下文
const ThemeContext = createContext();

// 主题提供者组件
// eslint-disable-next-line react/prop-types
export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [theme, setTheme] = useState(themes.light);

  // 切换主题
  const toggleTheme = () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    updateTheme(newIsDarkMode);
  };

  // 更新主题
  const updateTheme = (isDark) => {
    const newTheme = isDark ? themes.dark : themes.light;
    setTheme(newTheme);

    // 更新CSS变量
    const cssVariables = getCSSVariables(newTheme);
    const root = document.documentElement;

    Object.entries(cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // 更新data-theme属性
    root.setAttribute(
      "data-theme",
      isDark ? THEME_TYPES.DARK : THEME_TYPES.LIGHT,
    );

    // 保存到localStorage
    localStorage.setItem(
      "theme",
      isDark ? THEME_TYPES.DARK : THEME_TYPES.LIGHT,
    );
  };

  // 初始化主题
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark = savedTheme
      ? savedTheme === THEME_TYPES.DARK
      : prefersDark;

    setIsDarkMode(shouldUseDark);
    updateTheme(shouldUseDark);
  }, []);

  const value = {
    isDarkMode,
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

// 使用主题的Hook
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export default ThemeContext;
