import './TabBar.scss'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { EditOutlined, FileAddOutlined } from '@ant-design/icons'
import { Tabs, Dropdown } from 'antd'
import { useI18n } from '../hooks/useI18n'

const TabBar = ({ fileManager }) => {
    const { t } = useI18n();
    const { 
        currentFile, 
        openedFiles, 
        switchFile: switchToFile, 
        closeFile: closeFileByPath 
    } = fileManager
    
    const { theme, backgroundEnabled, backgroundImage } = useSelector(state => state.theme)
    const hasBackground = backgroundEnabled && backgroundImage
    const [contextMenu, setContextMenu] = useState({ visible: false, tabKey: null })

    const onChange = useCallback((activeKey) => {
        switchToFile(activeKey)
    }, [switchToFile])

    const onEdit = useCallback((targetKey, action) => {
        if (action === 'remove') {
            closeFileByPath(targetKey)
        }
    }, [closeFileByPath])

    // 右键菜单处理函数
    const handleCloseTab = useCallback((tabKey) => {
        closeFileByPath(tabKey)
        setContextMenu({ visible: false, tabKey: null })
    }, [closeFileByPath])

    const handleCloseOthers = useCallback((tabKey) => {
        openedFiles.forEach(file => {
            const fileKey = getFileKey(file)
            if (fileKey !== tabKey) {
                closeFileByPath(fileKey)
            }
        })
        setContextMenu({ visible: false, tabKey: null })
    }, [openedFiles, closeFileByPath])

    const handleCloseAll = useCallback(() => {
        openedFiles.forEach(file => {
            closeFileByPath(getFileKey(file))
        })
        setContextMenu({ visible: false, tabKey: null })
    }, [openedFiles, closeFileByPath])

    // 右键菜单项
    const contextMenuItems = [
        {
            key: 'close',
            label: t('tabs.close'),
            onClick: () => handleCloseTab(contextMenu.tabKey),
        },
        {
            key: 'closeOthers',
            label: t('tabs.closeOthers'),
            onClick: () => handleCloseOthers(contextMenu.tabKey),
        },
        {
            key: 'closeAll',
            label: t('tabs.closeAll'),
            onClick: () => handleCloseAll(),
        },
    ]

    // 生成唯一的文件标识符
    const getFileKey = useCallback((file) => {
        // 对于临时文件，使用临时标识符
        if (file.isTemporary) {
            return `temp-${file.name}`;
        }
        // 对于已保存文件，使用文件路径
        return file.path;
    }, []);

    const items = useMemo(() => openedFiles.map((file) => ({
        key: getFileKey(file),
        label: (
            <Dropdown
                menu={{ items: contextMenuItems }}
                trigger={['contextMenu']}
                onOpenChange={(visible) => {
                    if (visible) {
                        setContextMenu({ visible: true, tabKey: getFileKey(file) })
                    } else {
                        setContextMenu({ visible: false, tabKey: null })
                    }
                }}
            >
                <span>
                    {file.name}
                    {file.isTemporary ? (
                        <FileAddOutlined
                            style={{ marginLeft: '5px', fontSize: '12px', color: '#1890ff' }}
                        />
                    ) : file.isModified ? (
                        <EditOutlined
                            style={{ marginLeft: '5px', fontSize: '12px', color: '#faad14' }}
                        />
                    ) : null}
                </span>
            </Dropdown>
        ),
        closable: true
    })), [openedFiles, getFileKey, contextMenuItems])

    // 设置标签栏高度CSS变量
    useEffect(() => {
        if (openedFiles.length === 0) {
            document.documentElement.style.setProperty('--tab-bar-height', '0px')
        } else {
            document.documentElement.style.setProperty('--tab-bar-height', '40px')
        }

        // 组件卸载时清理
        return () => {
            document.documentElement.style.setProperty('--tab-bar-height', '0px')
        }
    }, [openedFiles.length])

    // 如果没有打开的文件，不渲染标签栏
    if (openedFiles.length === 0) {
        return null
    }

    return (
        <div 
            className={`tab-bar ${hasBackground ? 'with-background' : ''}`}
            data-theme={theme}
        >
            <Tabs
                type="editable-card"
                onChange={onChange}
                activeKey={currentFile ? getFileKey(currentFile) : ''}
                onEdit={onEdit}
                items={items}
                hideAdd
            />
        </div>
    )
};

export default TabBar;