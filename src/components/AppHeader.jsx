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
import './AppHeader.scss';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';
import SettingsModal from './SettingsModal';

const { Header } = Layout;
const { Title, Text } = Typography;

// 辅助函数
const getFileNameFromPath = (path, t) => {
    return path.split(/[\/]/).pop() || t('untitled');
};

const AppHeader = ({ fileManager }) => {
    const { t } = useI18n();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [isEditingFileName, setIsEditingFileName] = useState(false);
    const [editedFileName, setEditedFileName] = useState('');
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [unsavedModalVisible, setUnsavedModalVisible] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const selectedFilesRef = useRef([]);
    const fileNameInputRef = useRef(null);

    // 从fileManager获取文件管理功能
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

    // 文件操作函数
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

    // 检查是否在Tauri环境中
    const isTauriEnvironment = () => {
        return typeof window !== 'undefined' && window['__TAURI_INTERNALS__'];
    };

    // 窗口控制函数
    const handleMinimize = async () => {
        if (!isTauriEnvironment()) {

            return;
        }
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            await appWindow.minimize();
        } catch (error) {
            console.error('Failed to minimize window:', error);
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
            console.error('Failed to toggle maximize window:', error);
        }
    };

    // 处理文件选择
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

    // 保存选中的文件
    const saveSelectedFiles = async (files) => {
        if (!files || files.length === 0) return;

        try {
            const results = await saveFiles(files);
            const successCount = results.filter(r => r.success).length;
            const canceledCount = results.filter(r => r.canceled).length;

            // 如果所有选中的文件都成功保存，关闭弹窗和窗口
            if (successCount === files.length) {
                setUnsavedModalVisible(false);
                setSelectedFiles([]);
                selectedFilesRef.current = [];
                // 保存成功后关闭窗口
                await closeWindow();
            } else if (canceledCount > 0 && successCount + canceledCount === files.length) {
                // 如果有文件被取消但没有失败的文件，不关闭窗口，让用户重新选择

            } else {
                // 有文件保存失败
                console.error('Some files failed to save');
            }
        } catch (error) {
            console.error('Error occurred while saving files:', error);
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
            console.error('Failed to close window:', error);
        }
    };

    const handleClose = async () => {

        // 检查是否有未保存的内容
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
        // 优先使用name属性（不含时间戳），只有在name不存在时才从path提取
        if (currentFile?.name) {
            return currentFile.name;
        }
        if (currentFile?.path) {
            return getFileNameFromPath(currentFile.path, t);
        }
        return t('untitled');
    };

    // 提取重复的文件重命名逻辑
    const handleFileRename = async () => {
        if (editedFileName.trim() && editedFileName !== getCurrentFileName()) {
            try {
                // 如果当前没有文件（默认编辑器状态），先创建一个临时文件
                if (!currentFile?.path) {
                    await createNewFile(editedFileName.trim(), currentCode);
                    return;
                }

                await renameFile(currentFile.path, editedFileName.trim());
            } catch (error) {
                console.error('Failed to rename file:', error);
                // 重命名失败时恢复原文件名
                setEditedFileName(getCurrentFileName());
            }
        }
        setIsEditingFileName(false);
    };

    // 监听窗口状态变化
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
                console.error('Failed to setup window listener:', error);
            }
        };
        setupWindowListener().catch();
        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    // 键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+N: 新建文件
            if (e.ctrlKey && e.key === 'n' && !e.shiftKey) {
                e.preventDefault();
                handleNewFile();
            }

            // Ctrl+O: 打开文件
            if (e.ctrlKey && e.key === 'o' && !e.shiftKey) {
                e.preventDefault();
                handleOpenFile().catch();
            }

            // Ctrl+S: 保存文件
            if (e.ctrlKey && e.key === 's' && !e.shiftKey) {
                e.preventDefault();
                handleSaveFile().catch();
            }

            // Ctrl+Shift+S: 另存为
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

    // 文件菜单项
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
                            {currentFile?.isModified && ' *'}
                        </Title>
                    )}
                    {currentFile?.path && !currentFile?.isTemporary && (
                        <Text type="secondary" className="file-path">
                            {currentFile.path}
                        </Text>
                    )}
                </div>

                <div className="window-controls">
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
                            }).catch(console.error);
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
