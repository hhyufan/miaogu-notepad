/**
 * @fileoverview 标签页组件 - 管理多个打开文件的标签页显示和操作
 * 提供文件标签页的显示、切换、关闭等功能，支持右键菜单操作
 * @author hhyufan
 * @version 1.2.0
 */

import './TabBar.scss'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { EditOutlined, FileAddOutlined } from '@ant-design/icons'
import { Tabs, Dropdown } from 'antd'
import { useI18n } from '../hooks/useI18n'

/**
 * 标签页组件
 * @param {Object} props - 组件属性
 * @param {Object} props.fileManager - 文件管理器实例
 * @returns {JSX.Element} 标签页组件
 */
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

    const getFileKey = useCallback((file) => {
        if (file.isTemporary) {
            return `temp-${file.name}`;
        }
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

    useEffect(() => {
        if (openedFiles.length === 0 || (openedFiles.length === 1 && openedFiles[0].isTemporary)) {
            document.documentElement.style.setProperty('--tab-bar-height', '0px')
        } else {
            document.documentElement.style.setProperty('--tab-bar-height', '40px')
        }

        return () => {
            document.documentElement.style.setProperty('--tab-bar-height', '0px')
        }
    }, [openedFiles.length, openedFiles])

    if (openedFiles.length === 0 || (openedFiles.length === 1 && openedFiles[0].isTemporary)) {
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
