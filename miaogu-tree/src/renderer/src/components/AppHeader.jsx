import { useState, useEffect } from "react";
import { Button, Space, Tooltip } from "antd";
import {
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
  FullscreenExitOutlined,
  MoonFilled,
  SunOutlined,
} from "@ant-design/icons";
import "./AppHeader.scss";
// eslint-disable-next-line react/prop-types
const AppHeader = ({ isDarkMode, onToggleTheme }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 检查窗口是否最大化
    const checkMaximized = async () => {
      if (window.api && window.api.windowIsMaximized) {
        const maximized = await window.api.windowIsMaximized();
        setIsMaximized(maximized);
      }
    };
    checkMaximized();
  }, []);

  const handleMinimize = () => {
    if (window.api && window.api.windowMinimize) {
      window.api.windowMinimize();
    }
  };

  const handleMaximize = async () => {
    if (window.api && window.api.windowMaximize) {
      await window.api.windowMaximize();
      // 重新检查最大化状态
      if (window.api.windowIsMaximized) {
        const maximized = await window.api.windowIsMaximized();
        setIsMaximized(maximized);
      }
    }
  };

  const handleClose = () => {
    if (window.api && window.api.windowClose) {
      window.api.windowClose();
    }
  };

  return (
    <div className="app-header" tabIndex={-1}>
      <div className="header-left" tabIndex={-1}>
        <Space size="small" className="operation-buttons" tabIndex={-1}>
          <Tooltip title={isDarkMode ? "切换到亮色模式" : "切换到暗色模式"} tabIndex={-1}>
            <Button
              type="text"
              size="small"
              icon={isDarkMode ? <MoonFilled /> : <SunOutlined />}
              onClick={onToggleTheme}
              className="operation-btn theme-btn"
              tabIndex={-1}
            />
          </Tooltip>
        </Space>
      </div>

      <div className="header-center drag-region" tabIndex={-1}>{/* 可拖拽区域 */}</div>

      <div className="window-controls" tabIndex={-1}>
        <Button
          type="text"
          icon={<MinusOutlined />}
          onClick={handleMinimize}
          className="window-control-btn"
          tabIndex={-1}
        />
        <Button
          type="text"
          icon={isMaximized ? <FullscreenExitOutlined /> : <BorderOutlined />}
          onClick={handleMaximize}
          className="window-control-btn"
          tabIndex={-1}
        />
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={handleClose}
          className="window-control-btn close-btn"
          tabIndex={-1}
        />
      </div>
    </div>
  );
};

export default AppHeader;
