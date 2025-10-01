/**
 * @fileoverview 标签页组件 - 管理多个打开文件的标签页显示和操作
 * 提供文件标签页的显示、切换、关闭等功能，支持右键菜单操作和重命名功能
 * @author hhyufan
 * @version 1.3.0
 */

import './TabBar.scss'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { EditOutlined, FileAddOutlined, PlusOutlined } from '@ant-design/icons'
import { Tabs, Dropdown, Button } from 'antd'
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
        closeFile: closeFileByPath,
        createFile
    } = fileManager

    const { theme, backgroundEnabled, backgroundImage } = useSelector(state => state.theme)
    const hasBackground = backgroundEnabled && backgroundImage

    // 添加悬停状态管理
    const [isHovered, setIsHovered] = useState(false)
    const [contextMenu, setContextMenu] = useState({ visible: false, tabKey: null })

    // 添加重命名状态管理
    const [renamingTab, setRenamingTab] = useState(null)
    const [renameValue, setRenameValue] = useState('')
    const renameInputRef = useRef(null)
    const [isRenaming, setIsRenaming] = useState(false) // 添加重命名进行中的标志

    // 添加点击延时管理，防止单击和双击冲突
    const [clickTimer, setClickTimer] = useState(null)
    const [clickCount, setClickCount] = useState(0)

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

    // 计算文本宽度的函数
    const getTextWidth = useCallback((text) => {
        if (!text) return 0;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        return context.measureText(text).width;
    }, []);

    // 处理标签页重命名
    const handleTabRename = useCallback(async (file, newName) => {
        if (!newName || newName.trim() === file.name) {
            setRenamingTab(null)
            setIsRenaming(false)
            return
        }

        try {
            if (file.isTemporary) {
                await fileManager.createFile(newName.trim(), file.content || '')
                fileManager.closeFile(file.path)
            } else {
                await fileManager.renameFile(file.path, newName.trim())
            }
        } catch (error) {
            console.error('重命名失败:', error)
        }

        setRenamingTab(null)
        setIsRenaming(false)
    }, [fileManager])

    // 获取文件唯一标识
    const getFileKey = useCallback((file) => {
        if (file.isTemporary) {
            return `temp-${file.name}`;
        }
        return file.path;
    }, []);

    // 开始重命名
    const startRename = useCallback((file) => {
        const tabKey = getFileKey(file)
        setRenamingTab(tabKey)
        setRenameValue(file.name)
        setIsRenaming(true) // 设置重命名进行中标志
        
        // 使用requestAnimationFrame确保DOM完全更新后再聚焦
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (renameInputRef.current) {
                    try {
                        renameInputRef.current.focus()
                        renameInputRef.current.select()
                        // 强制设置光标位置
                        renameInputRef.current.setSelectionRange(0, renameInputRef.current.value.length)
                    } catch (error) {
                        console.warn('Focus failed:', error)
                        // 如果focus失败，再次尝试
                        setTimeout(() => {
                            if (renameInputRef.current) {
                                renameInputRef.current.focus()
                            }
                        }, 50)
                    }
                }
            }, 50)
        })
    }, [getFileKey])

    // 取消重命名
    const cancelRename = useCallback(() => {
        setRenamingTab(null)
        setRenameValue('')
        setIsRenaming(false)
    }, [])

    // 处理重命名键盘事件
    const handleRenameKeyDown = useCallback((e, file) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
            handleTabRename(file, e.target.value)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setRenamingTab(null)
        }
    }, [handleTabRename])

    const onChange = useCallback((activeKey) => {
        // 清除之前的计时器
        if (clickTimer) {
            clearTimeout(clickTimer)
        }

        // 增加点击计数
        const newClickCount = clickCount + 1
        setClickCount(newClickCount)

        // 设置新的计时器
        const timer = setTimeout(() => {
            // 如果点击的是当前激活的标签，触发重命名而不是切换
            if (currentFile && getFileKey(currentFile) === activeKey) {
                const file = openedFiles.find(f => getFileKey(f) === activeKey)
                if (file) {
                    startRename(file)
                }
            } else {
                switchToFile(activeKey)
            }
            // 重置点击计数
            setClickCount(0)
        }, 200) // 200ms延时，防止双击冲突

        setClickTimer(timer)
    }, [switchToFile, currentFile, getFileKey, openedFiles, startRename, clickTimer, clickCount])

    const handleNewFile = useCallback(async () => {
        try {
            await createFile();
        } catch (error) {
            console.error('新建文件失败:', error);
        }
    }, [createFile])

    const onEdit = useCallback((targetKey, action) => {
        if (action === 'remove') {
            closeFileByPath(targetKey)
        } else if (action === 'add') {
            handleNewFile();
        }
    }, [closeFileByPath, handleNewFile])

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
    }, [openedFiles, closeFileByPath, getFileKey])

    const handleCloseAll = useCallback(() => {
        openedFiles.forEach(file => {
            closeFileByPath(getFileKey(file))
        })
        setContextMenu({ visible: false, tabKey: null })
    }, [openedFiles, closeFileByPath, getFileKey])

    const contextMenuItems = [
        {
            key: 'rename',
            label: t('tabs.rename'),
            onClick: () => {
                const file = openedFiles.find(f => getFileKey(f) === contextMenu.tabKey)
                if (file) {
                    startRename(file)
                }
                setContextMenu({ visible: false, tabKey: null })
            },
        },
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
                <span
                    className="tab-label"
                    onDoubleClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        startRename(file)
                    }}
                >
                    {renamingTab === getFileKey(file) ? (
                        <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={(e) => {
                                // 检查焦点是否转移到了其他可交互元素
                                const relatedTarget = e.relatedTarget;
                                const isClickingOnInteractiveElement = relatedTarget && (
                                    relatedTarget.tagName === 'BUTTON' ||
                                    relatedTarget.tagName === 'INPUT' ||
                                    relatedTarget.classList.contains('ant-tabs-tab') ||
                                    relatedTarget.closest('.ant-dropdown') ||
                                    relatedTarget.closest('.window-controls')
                                );
                                
                                // 如果不是点击交互元素且不在重命名过程中，则处理重命名
                                if (!isRenaming && !isClickingOnInteractiveElement) {
                                    handleTabRename(file, renameValue)
                                }
                            }}
                            onFocus={() => {
                                // 获得焦点后清除重命名进行中标志
                                setTimeout(() => setIsRenaming(false), 100)
                            }}
                            onKeyDown={(e) => handleRenameKeyDown(e, file)}
                            className="tab-rename-input"
                            autoFocus
                            style={{
                                width: `${Math.max(getTextWidth(renameValue) + 20, 60)}px`,
                                minWidth: '60px',
                                maxWidth: '200px',
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                padding: '0',
                                margin: '0',
                                textAlign: 'left',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                display: 'inline-block',
                                verticalAlign: 'baseline'
                                // 移除内联的color样式，让CSS类处理主题自适应
                            }}
                        />
                    ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
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
                    )}
                </span>
            </Dropdown>
        ),
        closable: true
    })), [openedFiles, getFileKey, contextMenuItems, renamingTab, renameValue, startRename, handleTabRename, handleRenameKeyDown])

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
            className={`tab-bar ${hasBackground ? 'with-background' : ''} ${isHovered ? 'hovered' : ''}`}
            data-theme={theme}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Tabs
                type="editable-card"
                onChange={onChange}
                activeKey={currentFile ? getFileKey(currentFile) : ''}
                onEdit={onEdit}
                items={items}
            />
        </div>
    )
};

export default TabBar;
