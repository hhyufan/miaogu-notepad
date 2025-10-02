/**
 * @fileoverview 设置弹窗组件 - 提供主题、编辑器、AI等各种设置选项
 * 包含主题切换、字体设置、背景图片、编辑器配置、AI助手配置等功能
 * @author hhyufan
 * @version 1.3.0
 */

import { useState, useCallback, useEffect } from 'react';
import { Modal, Menu, Button, InputNumber, Select, Switch, Slider, Card, Typography, Space, App, Input } from 'antd';
import { UploadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTheme } from '../hooks/redux';
import { useI18n } from '../hooks/useI18n';
import tauriApi from '../utils/tauriApi';

const { settings: settingsApi, file: fileApi } = tauriApi;
import './SettingsModal.scss';

const { Title, Text } = Typography;
const { Option } = Select;

const fontFamilyOptions = [
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  { label: 'Fira Code', value: 'Fira Code' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Consolas', value: 'Consolas' },
];

/**
 * 设置弹窗组件
 * @param {Object} props - 组件属性
 * @param {boolean} props.visible - 弹窗是否可见
 * @param {Function} props.onClose - 关闭弹窗的回调函数
 * @returns {JSX.Element} 设置弹窗组件
 */
const SettingsModal = ({ visible, onClose }) => {
  const { message } = App.useApp();
  const {
    theme,
    fontSize,
    fontFamily,
    lineHeight,
    backgroundImage,
    backgroundEnabled,
    backgroundTransparency,
    setTheme,
    setFontFamily,
    setLineHeight,
    setBackgroundImage,
    setBackgroundEnabled,
    setBackgroundTransparency,
    resetTheme,
  } = useTheme();

  const { t, changeLanguage, currentLanguage, supportedLanguages } = useI18n();

  const [activeKey, setActiveKey] = useState('general');
  const [localSettings, setLocalSettings] = useState({
    fontSize: fontSize || 20,
    fontFamily: fontFamily || 'JetBrains Mono',
    lineHeight: lineHeight || 1.2,
    backgroundImage: backgroundImage || '',
    backgroundEnabled: backgroundEnabled || false,
    backgroundTransparency: backgroundTransparency || { dark: 80, light: 80 },

    aiEnabled: false,
    aiBaseUrl: '',
    aiApiKey: '',
    aiModel: '',
  });

  useEffect(() => {
    setLocalSettings(prev => ({
      ...prev,
      fontSize: fontSize || prev.fontSize || 20,
      fontFamily: fontFamily || prev.fontFamily || 'JetBrains Mono',
      lineHeight: lineHeight || prev.lineHeight || 1.2,
      backgroundImage: backgroundImage || prev.backgroundImage || '',
      backgroundEnabled: backgroundEnabled !== undefined ? backgroundEnabled : prev.backgroundEnabled,
      backgroundTransparency: backgroundTransparency || prev.backgroundTransparency || { dark: 80, light: 80 },

    }));
  }, [fontSize, fontFamily, lineHeight, backgroundImage, backgroundEnabled, backgroundTransparency]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [enabled, baseUrl, apiKey, model] = await Promise.all([
          settingsApi.get('ai.enabled'),
          settingsApi.get('ai.baseUrl'),
          settingsApi.get('ai.apiKey'),
          settingsApi.get('ai.model'),
        ]);
        if (!mounted) return;
        setLocalSettings(prev => ({
          ...prev,
          aiEnabled: Boolean(enabled ?? prev.aiEnabled),
          aiBaseUrl: String(baseUrl ?? prev.aiBaseUrl ?? ''),
          aiApiKey: String(apiKey ?? prev.aiApiKey ?? ''),
          aiModel: String(model ?? prev.aiModel ?? ''),
        }));
      } catch (e) {
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (localSettings.backgroundEnabled && localSettings.backgroundImage) {
      const darkTransparency = localSettings.backgroundTransparency.dark / 100;
      const lightTransparency = localSettings.backgroundTransparency.light / 100;

      if (theme === 'dark') {
        document.documentElement.style.setProperty('--editor-background', `rgba(0, 0, 0, ${darkTransparency})`);
      } else {
        document.documentElement.style.setProperty('--editor-background', `rgba(255, 255, 255, ${lightTransparency})`);
      }
    } else {
      if (theme === 'dark') {
        document.documentElement.style.setProperty('--editor-background', 'rgba(0, 0, 0, 0.5)');
      } else {
        document.documentElement.style.setProperty('--editor-background', 'rgba(255, 255, 255, 0.5)');
      }
    }
  }, [theme, localSettings.backgroundEnabled, localSettings.backgroundImage, localSettings.backgroundTransparency]);

  const updateLocalSetting = useCallback(async (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));

    if (key === 'backgroundTransparency' || key === 'backgroundEnabled' || key === 'backgroundImage') {
      const updatedSettings = { ...localSettings, [key]: value };

      if (updatedSettings.backgroundEnabled && updatedSettings.backgroundImage) {
        // 处理背景图片URL，区分base64和文件路径
        let imageUrl;
        if (updatedSettings.backgroundImage.startsWith('data:')) {
          // 如果是base64数据，直接使用
          imageUrl = `url("${updatedSettings.backgroundImage}")`;
        } else {
          // 如果是文件路径，使用convertFileSrc转换
          try {
            const { convertFileSrc } = await import('@tauri-apps/api/core');
            const convertedUrl = convertFileSrc(updatedSettings.backgroundImage);
            imageUrl = `url("${convertedUrl}")`;
          } catch (error) {
            console.warn('转换背景图片路径失败:', error);
            imageUrl = `url("${updatedSettings.backgroundImage}")`;
          }
        }

        document.documentElement.style.setProperty('--editor-background-image', imageUrl);

        const darkTransparency = updatedSettings.backgroundTransparency.dark / 100;
        const lightTransparency = updatedSettings.backgroundTransparency.light / 100;

        document.documentElement.style.setProperty('--editor-background-light', `rgba(255, 255, 255, ${lightTransparency})`);
        document.documentElement.style.setProperty('--editor-background-dark', `rgba(0, 0, 0, ${darkTransparency})`);

        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
          document.documentElement.style.setProperty('--editor-background', `rgba(0, 0, 0, ${darkTransparency})`);
        } else {
          document.documentElement.style.setProperty('--editor-background', `rgba(255, 255, 255, ${lightTransparency})`);
        }
      } else {
        document.documentElement.style.setProperty('--editor-background-image', 'none');
        document.documentElement.style.setProperty('--editor-background-light', 'rgba(255, 255, 255, 0.5)');
        document.documentElement.style.setProperty('--editor-background-dark', 'rgba(0, 0, 0, 0.5)');

        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
          document.documentElement.style.setProperty('--editor-background', 'rgba(0, 0, 0, 0.5)');
        } else {
          document.documentElement.style.setProperty('--editor-background', 'rgba(255, 255, 255, 0.5)');
        }
      }
    }
  }, [localSettings]);

  const saveSettings = useCallback(async () => {
    try {
      // 验证和设置默认值
      const validatedSettings = {
        fontSize: localSettings.fontSize || 20,
        fontFamily: localSettings.fontFamily || 'JetBrains Mono',
        lineHeight: localSettings.lineHeight || 1.2,
        backgroundImage: localSettings.backgroundImage || '',
        backgroundEnabled: localSettings.backgroundEnabled !== undefined ? localSettings.backgroundEnabled : false,
        backgroundTransparency: localSettings.backgroundTransparency || { dark: 80, light: 80 },
        aiEnabled: localSettings.aiEnabled || false,
        aiBaseUrl: localSettings.aiBaseUrl || '',
        aiApiKey: localSettings.aiApiKey || '',
        aiModel: localSettings.aiModel || ''
      };

      // 更新 Redux 状态
      setFontFamily(validatedSettings.fontFamily);
      setLineHeight(validatedSettings.lineHeight);

      setBackgroundImage(validatedSettings.backgroundImage);
      setBackgroundEnabled(validatedSettings.backgroundEnabled);

      if (validatedSettings.backgroundTransparency && typeof validatedSettings.backgroundTransparency === 'object') {
        if (validatedSettings.backgroundTransparency.dark !== undefined) {
          setBackgroundTransparency('dark', validatedSettings.backgroundTransparency.dark);
        }
        if (validatedSettings.backgroundTransparency.light !== undefined) {
          setBackgroundTransparency('light', validatedSettings.backgroundTransparency.light);
        }
      }

      // 添加调试日志


      // 保存到存储
      await settingsApi.set('fontSize', validatedSettings.fontSize);
      await settingsApi.set('fontFamily', validatedSettings.fontFamily);
      await settingsApi.set('lineHeight', validatedSettings.lineHeight);

      await settingsApi.set('backgroundImage', validatedSettings.backgroundImage);
      await settingsApi.set('backgroundEnabled', validatedSettings.backgroundEnabled);
      await settingsApi.set('backgroundTransparency', validatedSettings.backgroundTransparency);

      // 验证保存结果
      const verifyBackgroundImage = await settingsApi.get('backgroundImage', '');
      const verifyBackgroundEnabled = await settingsApi.get('backgroundEnabled', false);



      await settingsApi.set('ai.enabled', validatedSettings.aiEnabled);
      await settingsApi.set('ai.baseUrl', validatedSettings.aiBaseUrl);
      await settingsApi.set('ai.apiKey', validatedSettings.aiApiKey);
      await settingsApi.set('ai.model', validatedSettings.aiModel);

      window.dispatchEvent(new Event('ai-settings-changed'));

      message.success(t('settings.saveSuccess'));
    } catch (error) {
      console.error('设置保存失败:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });

      // 提供更详细的错误信息
      let errorMessage = error.message || t('common.unknownError');
      if (error.message && error.message.includes('missing required key value')) {
        errorMessage = '设置保存失败：参数格式错误，请重试';
      } else if (error.message && error.message.includes('存储实例初始化失败')) {
        errorMessage = '设置保存失败：存储系统初始化失败';
      }

      message.error(`${t('settings.saveError')}: ${errorMessage}`);
    }
  }, [localSettings, setFontFamily, setLineHeight, setBackgroundImage, setBackgroundEnabled, setBackgroundTransparency, t]);

  const handleReset = useCallback(() => {
    resetTheme();
    setLocalSettings({
      fontSize: 14,
      fontFamily: 'Consolas, Monaco, monospace',
      lineHeight: 1.5,
      backgroundImage: '',
      backgroundEnabled: false,
      backgroundTransparency: {
        dark: 80,
        light: 80
      },
      aiEnabled: false,
      aiBaseUrl: '',
      aiApiKey: '',
      aiModel: '',
    });
    message.success(t('settings.resetSuccess')).then();
  }, [resetTheme]);

  const handleSelectBackground = useCallback(async () => {
    try {
      // 使用原生文件选择对话框，只获取文件路径
      const selected = await fileApi.openFileDialog(t);
      if (selected) {
        // 验证是否为图片文件
        const ext = selected.split('.').pop()?.toLowerCase();
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];

        if (imageExtensions.includes(ext)) {
          updateLocalSetting('backgroundImage', selected);
          updateLocalSetting('backgroundEnabled', true);
          message.success(t('settings.backgroundSuccess'));
        } else {
          message.error(t('settings.backgroundError'));
        }
      }
    } catch (error) {
      message.error(t('settings.backgroundError'));
    }
  }, [updateLocalSetting, t]);

  useCallback(async (file) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        updateLocalSetting('backgroundImage', dataUrl);
        message.success(t('settings.backgroundUploadSuccess'));
      };
      reader.readAsDataURL(file);
      return false;
    } catch (error) {
      message.error(t('settings.backgroundUploadError'));
      return false;
    }
  }, [updateLocalSetting]);

  const renderGeneralSettings = () => (
    <div className="settings-section">
      <Title level={4}>{t('settings.general.title')}</Title>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card size="small" title={t('settings.general.theme.title')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div className="setting-item">
              <Text>{t('settings.general.theme.mode')}</Text>
              <Select
                value={theme}
                onChange={(value) => setTheme(value)}
                style={{ width: 120 }}
              >
                <Option value="light">{t('settings.general.theme.light')}</Option>
                <Option value="dark">{t('settings.general.theme.dark')}</Option>
              </Select>
            </div>
          </Space>
        </Card>
        <Card size="small" title={t('settings.language.settings')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div className="setting-item">
              <Text>{t('settings.language.select')}</Text>
              <Select
                value={currentLanguage}
                onChange={changeLanguage}
                style={{ width: 150 }}
              >
                {supportedLanguages.map(lang => (
                  <Option key={lang.code} value={lang.code}>
                    {lang.name}
                  </Option>
                ))}
              </Select>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );

  const renderEditorSettings = () => (
    <div className="settings-section">
      <Title level={4}>{t('settings.editor.title')}</Title>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card size="small" title={t('settings.editor.font.title')}>
          <Space direction="vertical" style={{ width: '100%' }}>

            <div className="setting-item">
              <Text>{t('settings.editor.font.family')}</Text>
              <Select
                value={localSettings.fontFamily}
                onChange={(value) => updateLocalSetting('fontFamily', value)}
                style={{ width: 250 }}
              >
                {fontFamilyOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </div>
            <div className="setting-item">
              <Text>{t('settings.editor.font.lineHeight')}</Text>
              <Slider
                min={1.0}
                max={2.0}
                step={0.1}
                value={localSettings.lineHeight}
                onChange={(value) => updateLocalSetting('lineHeight', value)}
                style={{ width: 200 }}
                tooltip={{ formatter: (value) => `${value}` }}
              />
            </div>
          </Space>
        </Card>

      </Space>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="settings-section">
      <Title level={4}>{t('settings.appearance.title')}</Title>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card size="small" title={t('settings.appearance.background.title')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div className="setting-item">
              <Text>{t('settings.appearance.background.enable')}</Text>
              <Switch
                checked={localSettings.backgroundEnabled}
                onChange={(checked) => updateLocalSetting('backgroundEnabled', checked)}
              />
            </div>
            {localSettings.backgroundEnabled && (
              <>
                <div className="setting-item">
                  <Text>{t('settings.appearance.background.upload')}</Text>
                  <Button
                    icon={<UploadOutlined />}
                    onClick={handleSelectBackground}
                  >
                    {t('settings.appearance.background.select')}
                  </Button>
                  {localSettings.backgroundImage && (
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => updateLocalSetting('backgroundImage', '')}
                      danger
                    >
                      {t('settings.appearance.background.remove')}
                    </Button>
                  )}
                </div>
                <div className="setting-item">
                  <Text>{t('settings.appearance.background.transparency.dark')}</Text>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={localSettings.backgroundTransparency.dark}
                    onChange={(value) => updateLocalSetting('backgroundTransparency', {
                      ...localSettings.backgroundTransparency,
                      dark: value
                    })}
                    style={{ width: 200 }}
                    tooltip={{ formatter: (value) => `${value}%` }}
                  />
                </div>
                <div className="setting-item">
                  <Text>{t('settings.appearance.background.transparency.light')}</Text>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={localSettings.backgroundTransparency.light}
                    onChange={(value) => updateLocalSetting('backgroundTransparency', {
                      ...localSettings.backgroundTransparency,
                      light: value
                    })}
                    style={{ width: 200 }}
                    tooltip={{ formatter: (value) => `${value}%` }}
                  />
                </div>
              </>
            )}
          </Space>
        </Card>
      </Space>
    </div>
  );



  const renderAISettings = () => (
    <div className="settings-section">
      <Title level={4}>{t('settings.ai.title')}</Title>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card size="small" title={t('settings.ai.basicSettings')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div className="setting-item">
              <Text>{t('settings.ai.enable')}</Text>
              <Switch
                checked={localSettings.aiEnabled}
                onChange={(checked) => updateLocalSetting('aiEnabled', checked)}
              />
            </div>
            <div className="setting-item">
              <Text>{t('settings.ai.baseUrl')}</Text>
              <Input
                value={localSettings.aiBaseUrl}
                onChange={(e) => updateLocalSetting('aiBaseUrl', e.target.value)}
                placeholder={t('settings.ai.baseUrlPlaceholder')}
                disabled={!localSettings.aiEnabled}
              />
            </div>
            <div className="setting-item">
              <Text>{t('settings.ai.apiKey')}</Text>
              <Input.Password
                value={localSettings.aiApiKey}
                onChange={(e) => updateLocalSetting('aiApiKey', e.target.value)}
                placeholder={t('settings.ai.apiKeyPlaceholder')}
                disabled={!localSettings.aiEnabled}
              />
            </div>
            <div className="setting-item">
              <Text>{t('settings.ai.model')}</Text>
              <Input
                value={localSettings.aiModel}
                onChange={(e) => updateLocalSetting('aiModel', e.target.value)}
                placeholder={t('settings.ai.modelPlaceholder')}
                disabled={!localSettings.aiEnabled}
              />
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );

  const renderContent = () => {
    switch (activeKey) {
      case 'general':
        return renderGeneralSettings();
      case 'editor':
        return renderEditorSettings();
      case 'appearance':
        return renderAppearanceSettings();
      case 'ai':
        return renderAISettings();
      default:
        return null;
    }
  };

  return (
    <Modal
      title={t('settings.title')}
      open={visible}
      onCancel={onClose}
      width="80%"
      centered
      footer={
        <Space>
          <Button key="reset" onClick={handleReset}>
            <ReloadOutlined /> {t('settings.reset')}
          </Button>
          <Button key="cancel" onClick={onClose}>
            {t('settings.cancel')}
          </Button>
          <Button key="save" type="primary" onClick={saveSettings}>
            {t('settings.save')}
          </Button>
        </Space>
      }
      className="settings-modal"
      styles={{
        body: { maxHeight: '70vh', overflow: 'hidden' }
      }}
    >
      <div className="settings-container">
        <div className="settings-menu">
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            items={[
              { key: 'general', label: t('settings.general.title') },
              { key: 'editor', label: t('settings.editor.title') },
              { key: 'appearance', label: t('settings.appearance.title') },
              { key: 'ai', label: t('settings.ai.title') },
            ]}
            onClick={({ key }) => setActiveKey(key)}
            className="settings-menu-list"
          />
        </div>
        <div className="settings-content">
          {renderContent()}
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
