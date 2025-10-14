/**
 * @fileoverview 设置弹窗组件 - 提供主题、编辑器、AI等各种设置选项
 * 包含主题切换、字体设置、背景图片、编辑器配置、AI助手配置等功能
 * @author hhyufan
 * @version 1.3.1
 */

import {useCallback, useEffect, useState} from 'react';
import {App, Badge, Button, Card, Input, Menu, Modal, Progress, Select, Slider, Space, Switch, Tag, Typography} from 'antd';
import {DeleteOutlined, DownloadOutlined, ReloadOutlined, SyncOutlined, UploadOutlined} from '@ant-design/icons';
import {useTheme} from '../hooks/redux';
import {useI18n} from '../hooks/useI18n';
import {
    useCurrentFile,
    useEditorSettings,
    useRecentFiles,
    useUpdateState,
    useAppDispatch
} from '../store/hooks';
import {checkUpdateComplete} from '../store/slices/updateSlice';
import tauriApi from '../utils/tauriApi';
import './SettingsModal.scss';

const {settings: settingsApi, file: fileApi, app: appApi} = tauriApi;

const {Title, Text} = Typography;
const {Option} = Select;

/**
 * 字体选项配置
 * @type {Array<Object>} 包含label和value的字体选项数组
 */
const fontFamilyOptions = [
    {label: 'JetBrains Mono', value: 'JetBrains Mono'},
    {label: 'Fira Code', value: 'Fira Code'},
    {label: 'Courier New', value: 'Courier New'},
    {label: 'Consolas', value: 'Consolas'},
];

/**
 * 设置弹窗组件
 * 提供应用的各种设置选项，包括通用设置、编辑器设置、外观设置和AI设置
 *
 * @component
 * @param {Object} props - 组件属性
 * @param {boolean} props.visible - 弹窗是否可见
 * @param {Function} props.onClose - 关闭弹窗的回调函数
 * @returns {JSX.Element} 渲染的设置弹窗组件
 *
 * @example
 * <SettingsModal
 *   visible={showSettings}
 *   onClose={() => setShowSettings(false)}
 * />
 */
const SettingsModal = ({visible, onClose}) => {
    const {message} = App.useApp();
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

    const dispatch = useAppDispatch();
    const {t, changeLanguage, currentLanguage, supportedLanguages} = useI18n();
    const updateState = useUpdateState();
    const updateInfo = updateState?.updateInfo;

    /** 当前激活的设置标签页 */
    const [activeKey, setActiveKey] = useState('general');
    /** 本地设置状态，用于临时存储用户修改 */
    const [localSettings, setLocalSettings] = useState({
        fontSize: fontSize || 20,
        fontFamily: fontFamily || 'JetBrains Mono',
        lineHeight: lineHeight || 1.2,
        backgroundImage: backgroundImage || '',
        backgroundEnabled: backgroundEnabled || false,
        backgroundTransparency: backgroundTransparency || {dark: 80, light: 80},

        aiEnabled: false,
        aiBaseUrl: '',
        aiApiKey: '',
        aiModel: '',

        // 环境变量设置
        envCommandName: 'mgnp',
        envInstalled: false,
    });

    const [envBusy, setEnvBusy] = useState(false);

    // 更新功能相关状态
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isInstalling, setIsInstalling] = useState(false);

    /**
     * 当全局设置变化时更新本地设置
     * 确保本地设置与全局状态同步
     */
    useEffect(() => {
        setLocalSettings(prev => ({
            ...prev,
            fontSize: fontSize || prev.fontSize || 20,
            fontFamily: fontFamily || prev.fontFamily || 'JetBrains Mono',
            lineHeight: lineHeight || prev.lineHeight || 1.2,
            backgroundImage: backgroundImage || prev.backgroundImage || '',
            backgroundEnabled: backgroundEnabled !== undefined ? backgroundEnabled : prev.backgroundEnabled,
            backgroundTransparency: backgroundTransparency || prev.backgroundTransparency || {dark: 80, light: 80},
        }));
    }, [fontSize, fontFamily, lineHeight, backgroundImage, backgroundEnabled, backgroundTransparency]);

    /**
     * 初始化AI设置和获取当前版本
     * 从存储中加载AI相关配置，并获取应用当前版本
     */
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
                // 读取 CLI 安装状态与命令名
                const [cliInstalled, cliName] = await Promise.all([
                    appApi.checkCliInstalled(),
                    settingsApi.get('system.env.commandName'),
                ]);
                
                // 注释掉本地版本获取，使用 Redux store 中的版本信息
                // try {
                //     const versionInfo = await appApi.checkForUpdates();
                //     if (versionInfo && versionInfo.current_version) {
                //         setCurrentVersion(versionInfo.current_version);
                //     }
                // } catch (error) {
                //     console.warn('获取应用版本失败:', error);
                //     // 保持默认版本
                // }
                
                if (!mounted) return;
                setLocalSettings(prev => ({
                    ...prev,
                    aiEnabled: Boolean(enabled ?? prev.aiEnabled),
                    aiBaseUrl: String(baseUrl ?? prev.baseUrl ?? ''),
                    aiApiKey: String(apiKey ?? prev.aiApiKey ?? ''),
                    aiModel: String(model ?? prev.aiModel ?? ''),
                    envInstalled: Boolean(cliInstalled ?? prev.envInstalled ?? false),
                    envCommandName: String(cliName ?? prev.envCommandName ?? 'mgnp'),
                }));
            } catch (e) {
                console.warn('加载AI/系统设置失败:', e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // 移除本地更新信息监听，直接使用 Redux store 中的数据
    // useEffect(() => {
    //     // 检查localStorage中是否有更新信息
    //     const checkStoredUpdateInfo = () => {
    //         try {
    //             const storedUpdateInfo = localStorage.getItem('updateInfo');
    //             if (storedUpdateInfo) {
    //                 const parsedUpdateInfo = JSON.parse(storedUpdateInfo);
    //                 setUpdateInfo(parsedUpdateInfo);
    //             }
    //         } catch (error) {
    //             console.error('解析存储的更新信息失败:', error);
    //         }
    //     };
    //
    //     // 监听自动更新事件
    //     const handleUpdateAvailable = (event) => {
    //         setUpdateInfo(event.detail);
    //     };
    //
    //     // 初始检查
    //     checkStoredUpdateInfo();
    //
    //     // 添加事件监听器
    //     window.addEventListener('updateAvailable', handleUpdateAvailable);
    //
    //     return () => {
    //         window.removeEventListener('updateAvailable', handleUpdateAvailable);
    //     };
    // }, []);

    /**
     * 根据当前主题和背景设置更新CSS变量
     * 实时预览背景效果
     */
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

    /**
     * 更新本地设置并实时应用背景相关变化
     * @param {string} key - 设置项键名
     * @param {any} value - 设置项值
     */
    const updateLocalSetting = useCallback(async (key, value) => {
        setLocalSettings(prev => ({...prev, [key]: value}));

        // 处理背景相关设置的实时更新
        if (key === 'backgroundTransparency' || key === 'backgroundEnabled' || key === 'backgroundImage') {
            const updatedSettings = {...localSettings, [key]: value};

            if (updatedSettings.backgroundEnabled && updatedSettings.backgroundImage) {
                // 处理背景图片URL，区分base64和文件路径
                let imageUrl;
                if (updatedSettings.backgroundImage.startsWith('data:')) {
                    // 如果是base64数据，直接使用
                    imageUrl = `url("${updatedSettings.backgroundImage}")`;
                } else {
                    // 如果是文件路径，使用convertFileSrc转换
                    try {
                        const {convertFileSrc} = await import('@tauri-apps/api/core');
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

    /**
     * 保存所有设置到存储并更新全局状态
     * 显示保存结果的提示信息
     */
    const saveSettings = useCallback(async () => {
        try {
            // 验证和设置默认值
            const validatedSettings = {
                fontSize: localSettings.fontSize || 20,
                fontFamily: localSettings.fontFamily || 'JetBrains Mono',
                lineHeight: localSettings.lineHeight || 1.2,
                backgroundImage: localSettings.backgroundImage || '',
                backgroundEnabled: localSettings.backgroundEnabled !== undefined ? localSettings.backgroundEnabled : false,
                backgroundTransparency: localSettings.backgroundTransparency || {dark: 80, light: 80},
                aiEnabled: localSettings.aiEnabled || false,
                aiBaseUrl: localSettings.aiBaseUrl || '',
                aiApiKey: localSettings.aiApiKey || '',
                aiModel: localSettings.aiModel || '',
                envInstalled: Boolean(localSettings.envInstalled),
                envCommandName: String(localSettings.envCommandName || 'mgnp')
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

            // 保存到存储
            await settingsApi.set('fontSize', validatedSettings.fontSize);
            await settingsApi.set('fontFamily', validatedSettings.fontFamily);
            await settingsApi.set('lineHeight', validatedSettings.lineHeight);

            await settingsApi.set('backgroundImage', validatedSettings.backgroundImage);
            await settingsApi.set('backgroundEnabled', validatedSettings.backgroundEnabled);
            await settingsApi.set('backgroundTransparency', validatedSettings.backgroundTransparency);

            await settingsApi.set('ai.enabled', validatedSettings.aiEnabled);
            await settingsApi.set('ai.baseUrl', validatedSettings.aiBaseUrl);
            await settingsApi.set('ai.apiKey', validatedSettings.aiApiKey);
            await settingsApi.set('ai.model', validatedSettings.aiModel);

            // 持久化系统设置
            await settingsApi.set('system.env.installed', validatedSettings.envInstalled);
            await settingsApi.set('system.env.commandName', validatedSettings.envCommandName);

            // 触发AI设置变更事件
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

    /**
     * 重置所有设置为默认值
     * 显示重置成功的提示信息
     */
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
    }, [resetTheme, t]);

    /**
     * 处理背景图片选择
     * 打开文件选择对话框并验证图片格式
     */
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

    /**
     * 处理背景图片上传
     * 将图片转换为base64格式并更新设置
     * @param {File} file - 上传的图片文件
     * @returns {boolean} 始终返回false，阻止默认上传行为
     */
    const handleBackgroundUpload = useCallback(async (file) => {
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
    }, [updateLocalSetting, t]);

    /**
     * 渲染通用设置面板
     * 包含主题切换和语言设置
     * @returns {JSX.Element} 通用设置面板
     */
    const renderGeneralSettings = () => (
        <div className="settings-section">
            <Title level={4}>{t('settings.general.title')}</Title>
            <Space direction="vertical" size="large" style={{width: '100%'}}>
                <Card size="small" title={t('settings.general.theme.title')}>
                    <Space direction="vertical" style={{width: '100%'}}>
                        <div className="setting-item">
                            <Text>{t('settings.general.theme.mode')}</Text>
                            <Select
                                value={theme}
                                onChange={(value) => setTheme(value)}
                                style={{width: 120}}
                            >
                                <Option value="light">{t('settings.general.theme.light')}</Option>
                                <Option value="dark">{t('settings.general.theme.dark')}</Option>
                            </Select>
                        </div>
                    </Space>
                </Card>
                <Card size="small" title={t('settings.language.settings')}>
                    <Space direction="vertical" style={{width: '100%'}}>
                        <div className="setting-item">
                            <Text>{t('settings.language.select')}</Text>
                            <Select
                                value={currentLanguage}
                                onChange={changeLanguage}
                                style={{width: 150}}
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

    /**
     * 渲染系统设置面板
     * 包含环境变量配置等系统相关设置
     * @returns {JSX.Element} 系统设置面板
     */
    const renderSystemSettings = () => (
        <div className="settings-section">
            <Title level={4}>{t('settings.system.title')}</Title>
            <Space direction="vertical" size="large" style={{width: '100%'}}>
                <Card 
                    size="small" 
                    title={
                        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                            {t('settings.system.environment.title')}
                            <Tag 
                                color={localSettings.envInstalled ? 'success' : 'warning'}
                                style={{
                                    margin: 0,
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    letterSpacing: '0.5px',
                                    border: 'none',
                                    marginLeft: 'auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Badge 
                                    status={localSettings.envInstalled ? 'success' : 'warning'}
                                    style={{margin: 0}}
                                />
                                {localSettings.envInstalled 
                                    ? t('settings.system.environment.installed') 
                                    : t('settings.system.environment.notInstalled')
                                }
                            </Tag>
                        </div>
                    }
                >
                    <Space direction="vertical" style={{width: '100%'}}>
                        <div className="setting-item">
                            <Text>{t('settings.system.environment.commandName')}</Text>
                            <Input
                                value={localSettings.envCommandName}
                                onChange={(e) => updateLocalSetting('envCommandName', e.target.value)}
                                placeholder="mgnp"
                                style={{width: 200}}
                            />
                        </div>
                        <div className="setting-item" style={{display: 'flex', alignItems: 'center', gap: 12}}>
                            <Text>{t('settings.system.environment.toggleLabel')}</Text>
                            <Switch
                                checked={localSettings.envInstalled}
                                loading={envBusy}
                                onChange={async (checked) => {
                                    setEnvBusy(true);
                                    try {
                                        if (checked) {
                                            await handleInstallEnvironment();
                                        } else {
                                            await handleUninstallEnvironment();
                                        }
                                    } finally {
                                        setEnvBusy(false);
                                    }
                                }}
                            />
                        </div>
                    </Space>
                </Card>

                {/* 更新功能 */}
                <Card 
                    size="small" 
                    title={
                        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                            <DownloadOutlined />
                            {t('settings.system.update.title')}
                            {updateState?.hasUpdate ? (
                                <Tag color="success" style={{margin: 0, marginLeft: 'auto'}}>
                                    {t('settings.system.update.newVersionAvailable')}
                                </Tag>
                            ) : (
                                <Tag color="green" style={{margin: 0, marginLeft: 'auto'}}>
                                    {t('settings.system.update.upToDate')}
                                </Tag>
                            )}
                        </div>
                    }
                >
                    <Space direction="vertical" style={{width: '100%'}}>
                        {/* 当前版本信息 */}
                        <div className="setting-item">
                            <Text>{t('settings.system.update.currentVersion')}</Text>
                            <Text strong>{updateState?.updateInfo?.current_version || '1.3.1'}</Text>
                        </div>

                        {/* 最新版本信息 - 只在有更新时显示 */}
                        {updateState?.hasUpdate && (
                            <div className="setting-item">
                                <Text>{t('settings.system.update.latestVersion')}</Text>
                                <Text strong style={{color: '#52c41a'}}>{updateState?.updateInfo?.latest_version}</Text>
                            </div>
                        )}

                        {/* 更新状态显示 */}
                        {updateState?.hasUpdate && (
                            <div className="setting-item">
                                <Space direction="vertical" style={{width: '100%'}}>
                                    {/* 下载进度 */}
                                    {isDownloading && (
                                        <div>
                                            <Text>{t('settings.system.update.downloading')}</Text>
                                            <Progress 
                                                percent={downloadProgress} 
                                                size="small"
                                                status="active"
                                            />
                                        </div>
                                    )}

                                    {/* 一键更新按钮 */}
                                    <Button
                                        type="primary"
                                        size="large"
                                        icon={<SyncOutlined />}
                                        loading={isDownloading || isInstalling}
                                        onClick={handleAutoUpdate}
                                        style={{width: '100%'}}
                                    >
                                        {isDownloading ? t('settings.system.update.downloading') : 
                                         isInstalling ? t('settings.system.update.installing') :
                                         t('settings.system.update.updateNow')}
                                    </Button>
                                </Space>
                            </div>
                        )}
                    </Space>
                </Card>
            </Space>
        </div>
    );

    /**
     * 处理环境变量安装
     */
    const handleInstallEnvironment = async () => {
        try {
            const name = localSettings.envCommandName || 'mgnp';
            const res = await appApi.installCli(name);

            const installed = await appApi.checkCliInstalled();
            updateLocalSetting('envInstalled', installed);
            await settingsApi.set('system.env.installed', installed);
            await settingsApi.set('system.env.commandName', name);
            if (installed) {
                message.success(t('settings.system.environment.installSuccess'));
            } else {
                message.error(t('settings.system.environment.installFailed'));
            }
        } catch (error) {
            console.error('Failed to install environment:', error);
            message.error(t('settings.system.environment.installFailed'));
        }
    };

    /**
     * 处理环境变量卸载
     */
    const handleUninstallEnvironment = async () => {
        try {
            const res = await appApi.uninstallCli();

            const installed = await appApi.checkCliInstalled();
            updateLocalSetting('envInstalled', installed);
            await settingsApi.set('system.env.installed', installed);
            if (!installed) {
                message.success(t('settings.system.environment.uninstallSuccess'));
            } else {
                message.error(t('settings.system.environment.uninstallFailed'));
            }
        } catch (error) {
            console.error('Failed to uninstall environment:', error);
            message.error(t('settings.system.environment.uninstallFailed'));
        }
    };

    /**
     * 检查更新
     */
    const handleCheckForUpdates = async () => {
        setIsCheckingUpdate(true);
        try {


            
            const newUpdateInfo = await appApi.checkForUpdates();
            





            
            // 这里应该更新 Redux store，而不是本地状态
            dispatch(checkUpdateComplete({
                hasUpdate: newUpdateInfo.has_update,
                updateInfo: newUpdateInfo
            }));
            
            if (newUpdateInfo.has_update) {
                message.success(t('settings.system.update.updateAvailable', { version: newUpdateInfo.latest_version }));
            } else {
                message.info(t('settings.system.update.noUpdateAvailable'));
            }
        } catch (error) {
            console.error('检查更新失败:', error);
            message.error(t('settings.system.update.checkFailed'));
        } finally {
            setIsCheckingUpdate(false);
        }
    };

    /**
     * 下载更新
     */
    const handleDownloadUpdate = async () => {
        if (!updateState?.updateInfo || !updateState.updateInfo.download_url) {
            message.error(t('settings.system.update.noDownloadUrl'));
            return;
        }

        setIsDownloading(true);
        setDownloadProgress(0);
        
        try {
            // 监听更新进度事件
            const { listen } = await import('@tauri-apps/api/event');
            const unlisten = await listen('update-progress', (event) => {
                const progress = event.payload;
                if (progress.stage === 'downloading') {
                    setDownloadProgress(Math.round(progress.progress * 100));
                }
            });
            
            // 执行下载
            const tempFilePath = await appApi.downloadUpdate(updateState.updateInfo.download_url);
            
            // 清理监听器
            unlisten();
            
            message.success(t('settings.system.update.downloadComplete'));
            // 下载完成后，应该更新 Redux store 而不是本地状态
            // setUpdateInfo(prev => ({ 
            //     ...prev, 
            //     downloaded: true,
            //     tempFilePath: tempFilePath
            // }));

        } catch (error) {
            console.error('下载更新失败:', error);
            message.error(t('settings.system.update.downloadFailed') + ': ' + error.message);
        } finally {
            setIsDownloading(false);
        }
    };

    /**
     * 安装更新
     */
    const handleInstallUpdate = async () => {
        if (!updateInfo || !updateInfo.downloaded) {
            message.error(t('settings.system.update.downloadFirst'));
            return;
        }

        setIsInstalling(true);
        
        try {
            await appApi.installUpdate(updateInfo.tempFilePath, (progress) => {
                if (progress.stage === 'installing') {
                    // 可以在这里显示安装进度

                }
            });
            
            message.success(t('settings.system.update.installComplete'));
            // 安装完成后，应用会重启，这里可能不会执行到
        } catch (error) {
            console.error('安装更新失败:', error);
            message.error(t('settings.system.update.installFailed') + ': ' + error.message);
        } finally {
            setIsInstalling(false);
        }
    };

    /**
     * 执行自动更新
     */
    const handleAutoUpdate = async () => {
        // 防抖：如果正在更新中（检查、下载或安装），直接返回
        if (isCheckingUpdate || isDownloading || isInstalling) {
            return;
        }

        setIsCheckingUpdate(true);
        setIsDownloading(false);
        setIsInstalling(false);
        setDownloadProgress(0);
        
        try {
            await appApi.performAutoUpdate((progress) => {

                
                switch (progress.stage) {
                    case 'checking':
                        setIsCheckingUpdate(true);
                        break;
                    case 'downloading':
                        setIsCheckingUpdate(false);
                        setIsDownloading(true);
                        setDownloadProgress(Math.round(progress.progress * 100));
                        break;
                    case 'installing':
                        setIsDownloading(false);
                        setIsInstalling(true);
                        break;
                    case 'completed':
                        setIsCheckingUpdate(false);
                        setIsDownloading(false);
                        setIsInstalling(false);
                        message.success(progress.message || t('settings.system.update.autoUpdateComplete'));
                        break;
                    case 'error':
                        setIsCheckingUpdate(false);
                        setIsDownloading(false);
                        setIsInstalling(false);
                        const errorMessage = progress.error || t('settings.system.update.autoUpdateFailed');
                        message.error(errorMessage);
                        break;
                }
            });
        } catch (error) {
            console.error('自动更新失败:', error);
            const errorMessage = error.message ? 
                `${t('settings.system.update.autoUpdateFailed')}: ${error.message}` : 
                t('settings.system.update.autoUpdateFailed');
            message.error(errorMessage);
        } finally {
            setIsCheckingUpdate(false);
            setIsDownloading(false);
            setIsInstalling(false);
        }
    };

    /**
     * 渲染编辑器设置面板
     * 包含字体相关设置
     * @returns {JSX.Element} 编辑器设置面板
     */
    const renderEditorSettings = () => (
        <div className="settings-section">
            <Title level={4}>{t('settings.editor.title')}</Title>
            <Space direction="vertical" size="large" style={{width: '100%'}}>
                <Card size="small" title={t('settings.editor.font.title')}>
                    <Space direction="vertical" style={{width: '100%'}}>
                        <div className="setting-item">
                            <Text>{t('settings.editor.font.family')}</Text>
                            <Select
                                value={localSettings.fontFamily}
                                onChange={(value) => updateLocalSetting('fontFamily', value)}
                                style={{width: 250}}
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
                                style={{width: 200}}
                                tooltip={{formatter: (value) => `${value}`}}
                            />
                        </div>
                    </Space>
                </Card>
            </Space>
        </div>
    );

    /**
     * 渲染外观设置面板
     * 包含背景图片相关设置
     * @returns {JSX.Element} 外观设置面板
     */
    const renderAppearanceSettings = () => (
        <div className="settings-section">
            <Title level={4}>{t('settings.appearance.title')}</Title>
            <Space direction="vertical" size="large" style={{width: '100%'}}>
                <Card size="small" title={t('settings.appearance.background.title')}>
                    <Space direction="vertical" style={{width: '100%'}}>
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
                                        icon={<UploadOutlined/>}
                                        onClick={handleSelectBackground}
                                    >
                                        {t('settings.appearance.background.select')}
                                    </Button>
                                    {localSettings.backgroundImage && (
                                        <Button
                                            type="text"
                                            icon={<DeleteOutlined/>}
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
                                        style={{width: 200}}
                                        tooltip={{formatter: (value) => `${value}%`}}
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
                                        style={{width: 200}}
                                        tooltip={{formatter: (value) => `${value}%`}}
                                    />
                                </div>
                            </>
                        )}
                    </Space>
                </Card>
            </Space>
        </div>
    );

    /**
     * 渲染AI设置面板
     * 包含AI助手的相关配置
     * @returns {JSX.Element} AI设置面板
     */
    const renderAISettings = () => (
        <div className="settings-section">
            <Title level={4}>{t('settings.ai.title')}</Title>
            <Space direction="vertical" size="large" style={{width: '100%'}}>
                <Card size="small" title={t('settings.ai.basicSettings')}>
                    <Space direction="vertical" style={{width: '100%'}}>
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

    /**
     * 根据当前激活的标签页渲染对应的设置内容
     * @returns {JSX.Element} 当前激活的设置面板内容
     */
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
            case 'system':
                return renderSystemSettings();
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
                        <ReloadOutlined/> {t('settings.reset')}
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
                body: {maxHeight: '70vh', overflow: 'hidden'}
            }}
        >
            <div className="settings-container">
                <div className="settings-menu">
                    <Menu
                        mode="inline"
                        selectedKeys={[activeKey]}
                        items={[
                            {key: 'general', label: t('settings.general.title')},
                            {key: 'editor', label: t('settings.editor.title')},
                            {key: 'appearance', label: t('settings.appearance.title')},
                            {key: 'ai', label: t('settings.ai.title')},
                            {key: 'system', label: t('settings.system.title')},
                        ]}
                        onClick={({key}) => setActiveKey(key)}
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
