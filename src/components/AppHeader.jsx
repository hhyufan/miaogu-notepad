/**
 * @fileoverview 应用头部组件 - 包含菜单栏、窗口控制和文件操作功能
 * 提供文件新建、打开、保存等操作，以及窗口最小化、最大化、关闭等控制
 * @author hhyufan
 * @version 1.2.0
 */

import { Layout, Button, Dropdown, Modal, Input, Typography, Checkbox } from 'antd';
import {
    MinusOutlined,
    BorderOutlined,
    CloseOutlined,
    FullscreenExitOutlined,
    PlusSquareOutlined,
    FileOutlined,
    FolderOpenOutlined,
    SaveOutlined,
    SaveFilled,
    SettingOutlined,
    FileAddOutlined
} from '@ant-design/icons';

/**
 * 内联SVG图标组件 - 支持CSS颜色继承的置顶图标
 * @param {Object} props - 组件属性
 * @param {string} props.className - CSS类名
 * @param {Object} props.style - 内联样式
 * @returns {JSX.Element} SVG图标元素
 */
const PinIcon = ({ className, style }) => (
    <svg
        className={className}
        style={style}
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
    >
        <path
            d="M355.157333 42.666667h313.728c15.402667 0 29.781333 0 41.514667 1.066666 12.288 1.109333 27.605333 3.754667 41.728 13.141334a85.333333 85.333333 0 0 1 36.437333 53.76c3.413333 16.64 0.213333 31.829333-3.328 43.648-3.370667 11.306667-8.704 24.618667-14.421333 38.954666l-43.648 109.056-1.749333 4.522667-0.042667 0.085333v95.786667l0.042667 8.874667v0.128l0.085333 0.085333 5.461333 6.954667 68.181334 85.205333c13.141333 16.469333 24.832 31.061333 33.024 43.434667 7.978667 12.074667 17.706667 29.184 17.749333 49.877333a85.333333 85.333333 0 0 1-32.128 66.773333c-16.128 12.885333-35.584 16-50.005333 17.322667-14.762667 1.322667-33.450667 1.322667-54.613334 1.322667H554.666667v256a42.666667 42.666667 0 1 1-85.333334 0v-256H310.826667c-21.12 0-39.808 0-54.613334-1.322667-14.378667-1.322667-33.834667-4.437333-50.005333-17.322667a85.333333 85.333333 0 0 1-32.085333-66.773333c0-20.693333 9.770667-37.802667 17.749333-49.877333 8.192-12.373333 19.84-26.965333 33.024-43.477334L293.12 418.730667c2.986667-3.754667 4.437333-5.546667 5.461333-6.954667l0.085334-0.085333v-0.128A258.133333 258.133333 0 0 0 298.666667 402.730667v-90.88V306.773333a253.056 253.056 0 0 0-1.792-4.522666L253.866667 194.773333l-0.64-1.536c-5.717333-14.336-11.093333-27.648-14.421334-38.954666-3.541333-11.818667-6.784-27.008-3.328-43.648a85.333333 85.333333 0 0 1 36.394667-53.76c14.165333-9.386667 29.482667-12.032 41.813333-13.141334C325.333333 42.666667 339.669333 42.666667 355.114667 42.666667z m356.138667 554.666666c23.594667 0 38.357333-0.042667 48.768-0.981333l2.005333-0.213333a81.792 81.792 0 0 0-1.066666-1.706667c-5.802667-8.746667-14.933333-20.266667-29.696-38.698667l-66.986667-83.712-1.152-1.450666a118.528 118.528 0 0 1-13.824-20.053334 85.205333 85.205333 0 0 1-7.594667-21.674666 118.314667 118.314667 0 0 1-1.706666-24.277334V311.850667v-1.066667c0-3.84 0-8.661333 0.512-13.653333 0.512-4.266667 1.322667-8.533333 2.474666-12.714667 1.28-4.778667 3.114667-9.301333 4.565334-12.842667l0.341333-0.938666 43.008-107.52a455.424 455.424 0 0 0 12.8-34.304l-1.066667-0.085334A455.552 455.552 0 0 0 667.178667 128H356.864a455.552 455.552 0 0 0-36.608 0.853333l0.298667 1.024c2.133333 7.125333 5.973333 16.810667 12.544 33.237334l42.965333 107.52 0.426667 0.938666a85.333333 85.333333 0 0 1 7.552 39.253334v93.738666c0 6.912 0 15.616-1.749334 24.32a85.290667 85.290667 0 0 1-7.637333 21.632 118.528 118.528 0 0 1-14.933333 21.504l-66.986667 83.712c-14.72 18.432-23.893333 29.952-29.696 38.698667a85.333333 85.333333 0 0 0-1.109333 1.706667l2.048 0.213333c10.410667 0.938667 25.173333 0.981333 48.725333 0.981333h398.592z"
            fill="currentColor"
            transform="translate(0, 20)"
        />
    </svg>
);
import './AppHeader.scss';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';
import SettingsModal from './SettingsModal';

const { Header } = Layout;
const { Title, Text } = Typography;

/**
 * 从文件路径中提取文件名
 * @param {string} path - 文件路径
 * @param {Function} t - 国际化翻译函数
 * @returns {string} 文件名或默认的"未命名"文本
 */
const getFileNameFromPath = (path, t) => {
    return path.split(/[\/\\]/).pop() || t('common.untitled');
};

/**
 * 应用头部组件
 * 提供文件操作菜单、窗口控制按钮和标题栏功能
 * @param {Object} props - 组件属性
 * @param {Object} props.fileManager - 文件管理器实例，包含文件操作方法
 * @returns {JSX.Element} 头部组件
 */
const AppHeader = ({ fileManager }) => {
    const { t } = useI18n();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [isEditingFileName, setIsEditingFileName] = useState(false);
    const [editedFileName, setEditedFileName] = useState('');
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [unsavedModalVisible, setUnsavedModalVisible] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const selectedFilesRef = useRef([]);
    const fileNameInputRef = useRef(null);

    const {
        currentFile,
        currentCode,
        openFile: openFileDialog,
        saveFile: saveCurrentFile,
        exportFile: saveAsFile,
        createFile: createNewFile,
        renameFile,
        getUnsavedFiles,
        saveFiles
    } = fileManager;

    const handleOpenFile = async () => {
        await openFileDialog();
    };

    const handleSaveFile = async () => {
        await saveCurrentFile();
    };

    const handleSaveAsFile = async () => {
        await saveAsFile();
    };

    const handleNewFile = () => {
        setIsModalVisible(true);
    };

    const handleCreateFile = () => {
        if (newFileName.trim()) {
            createNewFile(newFileName.trim(), '');
            setNewFileName('');
            setIsModalVisible(false);
        }
    };

    const isTauriEnvironment = () => {
        return typeof window !== 'undefined' && window['__TAURI_INTERNALS__'];
    };

    const handleMinimize = async () => {
        if (!isTauriEnvironment()) {

            return;
        }
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            await appWindow.minimize();
        } catch (error) {
        }
    };

    const handleMaximize = async () => {
        if (!isTauriEnvironment()) {

            setIsMaximized(!isMaximized);
            return;
        }
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            if (isMaximized) {
                await appWindow.unmaximize();
                setIsMaximized(false);
            } else {
                await appWindow.maximize();
                setIsMaximized(true);
            }
        } catch (error) {
        }
    };

    const handlePin = async () => {
        if (!isTauriEnvironment()) {
            setIsPinned(!isPinned);

            return;
        }
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            const newIsPinned = !isPinned;
            await appWindow.setAlwaysOnTop(newIsPinned);
            setIsPinned(newIsPinned);

        } catch (error) {
            console.error('窗口置顶切换失败:', error);
        }
    };

    const handleSelectFile = (e, file) => {
        const isChecked = e.target.checked;
        setSelectedFiles(prev => {
            const newSelected = isChecked
                ? [...prev, file]
                : prev.filter(f => f.path !== file.path);
            selectedFilesRef.current = newSelected;
            return newSelected;
        });
    };

    const saveSelectedFiles = async (files) => {
        if (!files || files.length === 0) return;

        try {
            const results = await saveFiles(files);
            const successCount = results.filter(r => r.success).length;
            const canceledCount = results.filter(r => r.canceled).length;

            if (successCount === files.length) {
                setUnsavedModalVisible(false);
                setSelectedFiles([]);
                selectedFilesRef.current = [];
                await closeWindow();
            } else if (canceledCount > 0 && successCount + canceledCount === files.length) {

            } else {
            }
        } catch (error) {
        }
    };

    const closeWindow = async () => {
        if (!isTauriEnvironment()) {

            return;
        }
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            await appWindow.close();
        } catch (error) {
        }
    };

    const handleClose = async () => {

        const unsavedFiles = getUnsavedFiles();
        if (unsavedFiles.length > 0) {
            setSelectedFiles(unsavedFiles);
            selectedFilesRef.current = unsavedFiles;
            setUnsavedModalVisible(true);
        } else {
            await closeWindow();
        }
    };

    const getCurrentFileName = () => {
        if (currentFile?.name) {
            return currentFile['name'];
        }
        if (currentFile?.path) {
            return getFileNameFromPath(currentFile['path'], t);
        }
        return t('common.untitled');
    };

    const handleFileRename = async () => {
        if (editedFileName.trim() && editedFileName !== getCurrentFileName()) {
            try {
                if (!currentFile?.path) {
                    await createNewFile(editedFileName.trim(), currentCode);
                    return;
                }

                await renameFile(currentFile['path'], editedFileName.trim());
            } catch (error) {
                setEditedFileName(getCurrentFileName());
            }
        }
        setIsEditingFileName(false);
    };

    useEffect(() => {
        let unlisten;
        const setupWindowListener = async () => {
            if (!isTauriEnvironment()) {

                return;
            }
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const appWindow = getCurrentWindow();
                unlisten = await appWindow.onResized(async () => {
                    const maximized = await appWindow.isMaximized();
                    setIsMaximized(maximized);
                });
            } catch (error) {
            }
        };
        setupWindowListener().catch();
        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'n' && !e.shiftKey) {
                e.preventDefault();
                handleNewFile();
            }

            if (e.ctrlKey && e.key === 'o' && !e.shiftKey) {
                e.preventDefault();
                handleOpenFile().catch();
            }

            if (e.ctrlKey && e.key === 's' && !e.shiftKey) {
                e.preventDefault();
                handleSaveFile().catch();
            }

            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                handleSaveAsFile().catch();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentFile]);

    const fileMenuItems = [
        {
            key: 'open',
            icon: <FolderOpenOutlined />,
            label: t('header.fileMenu.open'),
            onClick: handleOpenFile,
            extra: 'Ctrl + O'
        },
        {
            key: 'save',
            icon: <SaveOutlined />,
            label: t('header.fileMenu.save'),
            onClick: handleSaveFile,
            extra: 'Ctrl + S'
        },
        {
            key: 'saveAs',
            icon: <SaveFilled />,
            label: t('header.fileMenu.saveAs'),
            onClick: handleSaveAsFile,
            extra: 'Ctrl + Shift + S'
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: t('header.settings'),
            onClick: () => setIsSettingsVisible(true),
        },
    ];

    return (
        <>
            <Header className="app-header">
                <div className="left-container">
                    <Dropdown menu={{ items: fileMenuItems }} trigger={['click']}>
                        <Button type="text" className="file-menu-btn">
                            <FileOutlined /> {t('header.file')}
                        </Button>
                    </Dropdown>
                    <Button
                        type="text"
                        icon={<PlusSquareOutlined />}
                        onClick={handleNewFile}
                        className="create-file-btn"
                    />
                </div>

                <div className="file-info-container">
                    {isEditingFileName ? (
                        <input
                            spellCheck={false}
                            ref={fileNameInputRef}
                            type="text"
                            className="file-title-edit"
                            value={editedFileName}
                            onChange={(e) => setEditedFileName(e.target.value)}
                            onBlur={handleFileRename}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                    await handleFileRename();
                                } else if (e.key === 'Escape') {
                                    setIsEditingFileName(false);
                                    setEditedFileName(getCurrentFileName());
                                }
                            }}
                        />
                    ) : (
                        <Title
                            level={4}
                            className="file-title"
                            onClick={() => {
                                setEditedFileName(getCurrentFileName());
                                setIsEditingFileName(true);
                                setTimeout(() => fileNameInputRef.current?.focus(), 0);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            {getCurrentFileName()}
                        </Title>
                    )}
                    {currentFile?.path && !currentFile?.isTemporary && (
                        <Text type="secondary" className="file-path">
                            {currentFile['path']}
                        </Text>
                    )}
                </div>

                <div className="window-controls">
                    <Button
                        type="text"
                        icon={<PinIcon className={`pin-icon ${isPinned ? '' : 'pinned'}`} />}
                        onClick={handlePin}
                        className={`window-control-btn pin-btn ${isPinned ? 'pinned' : ''}`}
                        title={isPinned ? t('window.unpin') : t('window.pin')}
                    />
                    <Button
                        type="text"
                        icon={<MinusOutlined />}
                        onClick={handleMinimize}
                        className="window-control-btn"
                    />
                    <Button
                        type="text"
                        icon={isMaximized ? <FullscreenExitOutlined /> : <BorderOutlined />}
                        onClick={handleMaximize}
                        className="window-control-btn"
                    />
                    <Button
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={handleClose}
                        className="window-control-btn close-btn"
                    />
                </div>
            </Header>

            {/* 新建文件模态框 */}
            <Modal
                className="header-modal"
                title={t('dialog.newFile.title')}
                open={isModalVisible}
                onOk={handleCreateFile}
                onCancel={() => {
                    setIsModalVisible(false);
                    setNewFileName('');
                }}
                okText={t('dialog.newFile.create')}
                cancelText={t('dialog.newFile.cancel')}
                width={350}
            >
                <Input
                    placeholder={t('dialog.newFile.placeholder')}
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onPressEnter={handleCreateFile}
                    autoFocus
                />
            </Modal>
            <Modal
                className="header-modal"
                title={t('dialog.unsavedFiles')}
                open={unsavedModalVisible}
                onCancel={() => setUnsavedModalVisible(false)}
                maskClosable={false}
                width={400}
                footer={[
                    <Button
                        className="custom-button-warning"
                        key="cancel"
                        onClick={() => {
                            if (!isTauriEnvironment()) {

                                return;
                            }
                            import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
                                const appWindow = getCurrentWindow();
                                appWindow.close().catch();
                            }).catch(() => { });
                        }}
                    >
                        {t('dialog.dontSave')}
                    </Button>,
                    <Button
                        key="save"
                        className="custom-button-success"
                        disabled={selectedFiles.length === 0}
                        onClick={() => saveSelectedFiles(selectedFilesRef.current)}
                    >
                        {t('dialog.saveSelectedFiles', { count: selectedFiles.length })}
                    </Button>
                ]}
            >
                <div className="unsaved-files-modal">
                    <p>{t('dialog.unsavedFilesMessage')}</p>
                    <div className="file-checkbox-list">
                        {getUnsavedFiles().map((file) => (
                            <div key={file.path} className="file-checkbox-item">
                                <Checkbox
                                    onChange={(e) => handleSelectFile(e, file)}
                                    checked={selectedFiles
                                        .map((file) => file.path)
                                        .includes(file.path)}
                                >
                                    {file.name}{' '}
                                    {file.isTemporary && (
                                        <FileAddOutlined
                                            style={{
                                                marginLeft: '5px',
                                                fontSize: '12px',
                                                color: '#1890ff'
                                            }}
                                        />
                                    )}
                                </Checkbox>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* 设置模态框 */}
            <SettingsModal
                visible={isSettingsVisible}
                onClose={() => setIsSettingsVisible(false)}
            />
        </>
    );
};

export default AppHeader;
