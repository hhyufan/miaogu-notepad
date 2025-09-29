/**
 * @fileoverview 标签页组件 - 管理多个打开文件的标签页显示和操作
 * 提供文件标签页的显示、切换、关闭等功能，支持右键菜单操作
 * @author hhyufan
 * @version 1.2.0
 */

import './TabBar.scss'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { EditOutlined, FileAddOutlined } from '@ant-design/icons'
import { Tabs, Dropdown } from 'antd'
import { useI18n } from '../hooks/useI18n'
import extensionToLanguage from '../configs/file-extensions.json'

/**
 * 根据文件名推断编程语言
 * @param {string} fileName - 文件名
 * @returns {string} 编程语言标识符
 */
const getLanguageFromFileName = (fileName) => {
    if (!fileName) return 'plaintext';
    const extension = fileName.toLowerCase().split('.').pop();

    // 🔥 特殊处理：对于.mgtree文件，返回mgtree而不是plaintext
    if (extension === 'mgtree') {

        return 'mgtree';
    }

    return extensionToLanguage[extension] || 'plaintext';
};

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

    // 创建语言设置的ref，供CodeEditor使用
    const languageRef = useRef('plaintext');

    // 从DOM标签页获取当前活动标签页的文件名和语言
    const getLanguageFromActiveTab = useCallback(() => {
      try {
        // 查找aria-selected="true"的标签页按钮
        const activeTabBtn = document.querySelector('.ant-tabs-tab-btn[aria-selected="true"]');
        if (activeTabBtn) {
          // 获取按钮内的span元素
          const spanElement = activeTabBtn.querySelector('span');
          if (spanElement) {
            const fileName = spanElement.textContent || spanElement.innerText || '';

            if (fileName.trim()) {
              return getLanguageFromFileName(fileName.trim());
            }
          }
        }
      } catch (error) {
        console.warn('Failed to get current tab file name from DOM:', error);
      }
      return 'plaintext';
    }, []);

    // 更新languageRef的值
    const updateLanguageRef = useCallback(() => {
        const language = getLanguageFromActiveTab();
        if (languageRef.current !== language) {

            languageRef.current = language;
        }
    }, [getLanguageFromActiveTab]);
  useEffect(() => {
    updateLanguageRef()
  });
    // 监听标签页变化并更新语言
    useEffect(() => {
        // 初始更新
        updateLanguageRef();

        // 创建MutationObserver监听DOM变化
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            mutations.forEach((mutation) => {
                // 监听aria-selected属性变化
                if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
                    shouldUpdate = true;
                }
                // 监听class变化（ant-tabs-tab-active）
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList && (target.classList.contains('ant-tabs-tab') || target.classList.contains('ant-tabs-tab-btn'))) {
                        shouldUpdate = true;
                    }
                }
                // 监听标签页内容变化
                if (mutation.type === 'childList') {
                    const target = mutation.target;
                    if (target.classList && (target.classList.contains('ant-tabs-tab') || target.classList.contains('ant-tabs-tab-btn'))) {
                        shouldUpdate = true;
                    }
                }
            });

            if (shouldUpdate) {
                // 延迟更新，确保DOM已完全更新
                setTimeout(updateLanguageRef, 10);
            }
        });

        // 开始观察标签页容器
        const tabsContainer = document.querySelector('.ant-tabs-nav');
        if (tabsContainer) {
            observer.observe(tabsContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['aria-selected', 'class']
            });
        }

        return () => {
            observer.disconnect();
        };
    }, [updateLanguageRef]);

    // 将languageRef暴露给fileManager，供其他组件使用
    useEffect(() => {
        if (fileManager) {
            fileManager.tabBarRef = { languageRef };
        }
    }, [fileManager]);

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
        if (openedFiles.length === 0) {
            document.documentElement.style.setProperty('--tab-bar-height', '0px')
        } else {
            document.documentElement.style.setProperty('--tab-bar-height', '40px')
        }

        return () => {
            document.documentElement.style.setProperty('--tab-bar-height', '0px')
        }
    }, [openedFiles.length])

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
