
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";

import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import { useCurrentFile } from "./store/hooks";

import TreeEditor from "./components/TreeEditor";
import StatusBar from "./components/StatusBar";

import "./App.css";

const AppContent = () => {
  const { isDarkMode, theme: currentTheme } = useTheme();
  const currentFile = useCurrentFile();



  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorBgContainer: currentTheme.background.card,
          colorBgElevated: currentTheme.background.tertiary,
          colorBorder: currentTheme.border.primary,
          colorText: currentTheme.text.primary,
        },
      }}
    >
      <div className="app-container">
        <TreeEditor />
        <StatusBar currentFile={currentFile} />
      </div>
    </ConfigProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
