/**
 * @fileoverview 欢迎界面组件
 * 在没有文件打开时显示的欢迎页面，提供新建文件和打开文件的快捷操作
 * @author hhyufan
 * @version 1.0.0
 */

import React from 'react';
import { Button, Typography, Space } from 'antd';
import { FileAddOutlined, FolderOpenOutlined, CodeOutlined } from '@ant-design/icons';
import { useI18n } from '../hooks/useI18n';
import './WelcomeScreen.scss';

const { Title, Text } = Typography;

/**
 * 欢迎界面组件
 * @param {Object} props - 组件属性
 * @param {Function} props.onNewFile - 新建文件回调
 * @param {Function} props.onOpenFile - 打开文件回调
 * @param {boolean} props.isDarkMode - 是否为暗色模式
 */
const WelcomeScreen = ({ onNewFile, onOpenFile, isDarkMode }) => {
  const { t } = useI18n();

  return (
    <div className={`welcome-screen ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="welcome-content">
        <div className="welcome-icon">
          <CodeOutlined />
        </div>
        
        <Title level={2} className="welcome-title">
          {t('welcome.title', '欢迎使用 Miaogu IDE')}
        </Title>
        
        <Text className="welcome-description">
          {t('welcome.description', '开始您的编程之旅，创建新文件或打开现有项目')}
        </Text>
        
        <Space direction="horizontal" size="large" className="welcome-actions">
          <Button
            type="primary"
            size="large"
            icon={<FileAddOutlined />}
            onClick={onNewFile}
            className="welcome-button"
          >
            {t('welcome.newFile', '新建文件')}
          </Button>
          
          <Button
            size="large"
            icon={<FolderOpenOutlined />}
            onClick={onOpenFile}
            className="welcome-button"
          >
            {t('welcome.openFile', '打开文件')}
          </Button>
        </Space>
        
        <div className="welcome-tips">
          <Text type="secondary" className="welcome-tip">
            {t('welcome.tip', '提示：您也可以直接拖拽文件到此处打开')}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;