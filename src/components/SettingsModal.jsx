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

// 字体选项
const fontFamilyOptions = [
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  { label: 'Fira Code', value: 'Fira Code' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Consolas', value: 'Consolas' },
];



// 菜单项将在组件内部动态生成，使用i18n翻译

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
    setFontSize,
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
    fontSize,
    fontFamily,
    lineHeight,
    backgroundImage,
    backgroundEnabled,
    backgroundTransparency,
    aiEnabled: false,
    aiBaseUrl: '',
    aiApiKey: '',
    aiModel: '',
  });

  // 同步Redux状态到本地状态（保留 AI 相关字段）
  useEffect(() => {
    setLocalSettings(prev => ({
      ...prev,
      fontSize,
      fontFamily,
      lineHeight,
      backgroundImage,
      backgroundEnabled,
      backgroundTransparency,
    }));
  }, [fontSize, fontFamily, lineHeight, backgroundImage, backgroundEnabled, backgroundTransparency]);

  // 初次加载时读取 AI 设置
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
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // 监听主题变化，更新--editor-background变量
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

  // 更新本地设置
  const updateLocalSetting = useCallback((key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));

    // 实时更新背景透明度
    if (key === 'backgroundTransparency' || key === 'backgroundEnabled' || key === 'backgroundImage') {
      const updatedSettings = { ...localSettings, [key]: value };

      if (updatedSettings.backgroundEnabled && updatedSettings.backgroundImage) {
        document.documentElement.style.setProperty('--editor-background-image', `url(${updatedSettings.backgroundImage})`);

        const darkTransparency = updatedSettings.backgroundTransparency.dark / 100;
        const lightTransparency = updatedSettings.backgroundTransparency.light / 100;

        document.documentElement.style.setProperty('--editor-background-light', `rgba(255, 255, 255, ${lightTransparency})`);
        document.documentElement.style.setProperty('--editor-background-dark', `rgba(0, 0, 0, ${darkTransparency})`);

        // 根据当前主题设置 --editor-background
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

        // 根据当前主题设置 --editor-background
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
          document.documentElement.style.setProperty('--editor-background', 'rgba(0, 0, 0, 0.5)');
        } else {
          document.documentElement.style.setProperty('--editor-background', 'rgba(255, 255, 255, 0.5)');
        }
      }
    }
  }, [localSettings]);

  // 保存设置
  const saveSettings = useCallback(async () => {
    try {
      // 保存字体设置
      setFontSize(localSettings.fontSize);
      setFontFamily(localSettings.fontFamily);
      setLineHeight(localSettings.lineHeight);

      // 保存背景设置
      setBackgroundImage(localSettings.backgroundImage);
      setBackgroundEnabled(localSettings.backgroundEnabled);
      setBackgroundTransparency(localSettings.backgroundTransparency);

      // 保存到持久化存储
      await settingsApi.set('fontSize', localSettings.fontSize);
      await settingsApi.set('fontFamily', localSettings.fontFamily);
      await settingsApi.set('lineHeight', localSettings.lineHeight);

      await settingsApi.set('backgroundImage', localSettings.backgroundImage);
      await settingsApi.set('backgroundEnabled', localSettings.backgroundEnabled);
      await settingsApi.set('backgroundTransparency', localSettings.backgroundTransparency);

      // 保存 AI 设置
      await settingsApi.set('ai.enabled', !!localSettings.aiEnabled);
      await settingsApi.set('ai.baseUrl', localSettings.aiBaseUrl || '');
      await settingsApi.set('ai.apiKey', localSettings.aiApiKey || '');
      await settingsApi.set('ai.model', localSettings.aiModel || '');

      // 通知其他组件（如 CodeEditor）AI 设置已更新
      window.dispatchEvent(new Event('ai-settings-changed'));

      message.success(t('settings.saveSuccess'));
    } catch (error) {
      console.error('设置保存失败:', error);
      console.error('错误详情:', error.message, error.stack);
      message.error(`${t('settings.saveError')}: ${error.message || '未知错误'}`);
    }
  }, [localSettings, setFontSize, setFontFamily, setLineHeight, setBackgroundImage, setBackgroundEnabled, setBackgroundTransparency, t]);

  // 重置设置
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
    message.success(t('settings.resetSuccess'));
  }, [resetTheme]);

  // 选择背景图片
  const handleSelectBackground = useCallback(async () => {
    try {
      const result = await fileApi.selectImageDialog(t);
      if (result) {
        // result 已经是完整的 data URL 格式
        updateLocalSetting('backgroundImage', result);
        updateLocalSetting('backgroundEnabled', true);
        message.success(t('settings.backgroundSuccess'));
      }
    } catch (error) {
      // 静默处理背景图片选择错误
      message.error(t('settings.backgroundError'));
    }
  }, [updateLocalSetting, t]);

  // 上传背景图片（保留原有逻辑）
  useCallback(async (file) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        updateLocalSetting('backgroundImage', dataUrl);
        message.success('背景图片上传成功');
      };
      reader.readAsDataURL(file);
      return false; // 阻止默认上传行为
    } catch (error) {
      // 静默处理背景图片上传错误
      message.error('上传背景图片失败');
      return false;
    }
  }, [updateLocalSetting]);

  // 渲染通用设置
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

  // 渲染编辑器设置
  const renderEditorSettings = () => (
    <div className="settings-section">
      <Title level={4}>{t('settings.editor.title')}</Title>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card size="small" title={t('settings.editor.font.title')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div className="setting-item">
              <Text>{t('settings.editor.font.size')}</Text>
              <InputNumber
                min={10}
                max={30}
                value={localSettings.fontSize}
                onChange={(value) => updateLocalSetting('fontSize', value)}
                addonAfter="px"
              />
            </div>
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

  // 渲染外观设置
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



  // 渲染 AI 设置
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

  // 渲染内容
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
