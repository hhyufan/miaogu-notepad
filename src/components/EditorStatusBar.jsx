/**
 * @fileoverview 编辑器状态栏组件 - 显示文件路径、编码信息、光标位置和字符统计
 * 提供文件路径面包屑导航、编码选择、实时光标位置和字符数统计功能
 * @author hhyufan
 * @version 1.3.1
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Breadcrumb, Button, Divider, Dropdown, Tooltip} from 'antd'
import {FileOutlined, FolderOutlined} from '@ant-design/icons'
import {useCurrentFile, useFileActions} from '../hooks/useFileManager.jsx'
import {useTheme} from '../hooks/redux'
import {useI18n} from '../hooks/useI18n'
import tauriApi from '../utils/tauriApi'
import {buildFullPath, splitPath} from '../utils/pathUtils'
import './EditorStatusBar.scss'

const {file: fileApi} = tauriApi

/**
 * 标准化编码名称
 * 将编码名称转换为标准格式，处理特殊编码映射
 * @param {string} encoding - 原始编码名称
 * @returns {string} 标准化后的编码名称
 */
function standardizeEncodingName(encoding) {
    const lowerKey = encoding.toLowerCase()
    const specialMap = {
        'iso-8859-1': 'WINDOWS-1252',
        gb2312: 'GB18030',
        big5: 'BIG5-HKSCS'
    }
    const mapped = specialMap[lowerKey] || encoding
    return mapped.toUpperCase() === mapped ? mapped : mapped.toUpperCase()
}

/**
 * 编辑器状态栏组件
 * 显示当前文件的状态信息，包括路径、编码、行尾符等，并提供相关操作
 *
 * @component
 * @param {Object} props - 组件属性
 * @param {Object} props.fileManager - 文件管理器实例，提供文件操作能力
 * @param {Object} props.cursorPosition - 光标位置信息 {lineNumber, column}
 * @param {number} props.characterCount - 字符数统计
 * @param {boolean} props.hasOpenFiles - 是否有打开的文件
 * @returns {JSX.Element} 渲染的状态栏组件
 *
 * @example
 * <EditorStatusBar
 *   fileManager={fileManager}
 *   cursorPosition={{ lineNumber: 5, column: 10 }}
 *   characterCount={256}
 *   hasOpenFiles={true}
 * />
 */
const EditorStatusBar = ({
                             fileManager,
                             cursorPosition = {lineNumber: 1, column: 1},
                             characterCount = 0,
                             hasOpenFiles
                         }) => {
    /** 当前打开的文件对象 */
    const currentFile = useCurrentFile(fileManager)
    /** 文件操作工具函数 */
    const {updateFileLineEnding} = useFileActions(fileManager)
    /** 主题配置 */
    const {backgroundEnabled, backgroundImage} = useTheme()
    /** 国际化工具 */
    const {t} = useI18n()
    /** 是否有背景图片 */
    const hasBackground = backgroundEnabled && backgroundImage
    /** 文件路径分段 */
    const [pathSegments, setPathSegments] = useState([])
    /** 目录内容缓存 */
    const [directoryContents, setDirectoryContents] = useState({})
    /** 面包屑容器引用 */
    const breadcrumbRef = useRef(null)
    /** 文件路径容器引用 */
    const filePathRef = useRef(null)
    /** 滚动状态管理 */
    const [scrollState, setScrollState] = useState({
        canScroll: false,
        scrollLeft: 0,
        scrollWidth: 0,
        clientWidth: 0
    })
    /** 拖拽状态管理 */
    const [isDragging, setIsDragging] = useState(false)
    const [dragStartX, setDragStartX] = useState(0)
    const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0)

    /**
     * 行尾符选项配置
     * @type {Array<Object>} 包含value和label的选项数组
     */
    const lineEndingOptions = useMemo(() => [
        {value: 'LF', label: t('editor.lineEnding.LF')},
        {value: 'CRLF', label: t('editor.lineEnding.CRLF')},
        {value: 'CR', label: t('editor.lineEnding.CR')}
    ], [t])

    /**
     * 获取当前行尾符的显示标签
     * @returns {string} 行尾符标签文本
     */
    const getCurrentLineEndingLabel = useCallback(() => {
        const lineEndingValue = typeof currentFile['lineEnding'] === 'string' ? currentFile['lineEnding'] : 'LF'
        const option = lineEndingOptions.find((opt) => opt.value === lineEndingValue)
        return option ? option.label : 'LF (\\n)'
    }, [currentFile['lineEnding'], lineEndingOptions])

    /**
     * 获取当前文件编码的显示标签
     * @returns {string} 编码标签文本
     */
    const getCurrentEncodingLabel = useCallback(() => {
        const encodingValue = typeof currentFile['encoding'] === 'string' ? currentFile['encoding'] : 'UTF-8'
        return standardizeEncodingName(encodingValue)
    }, [currentFile['encoding']])

    /**
     * 当当前文件路径变化时更新路径分段
     */
    useEffect(() => {
        if (currentFile && currentFile['path'] && !currentFile['isTemporary'] && !currentFile['isUpdateLog']) {
            const segments = splitPath(currentFile['path'])
            setPathSegments(segments)
            setDirectoryContents({})
        } else {
            setPathSegments([])
        }
    }, [currentFile?.path, currentFile?.isTemporary, currentFile?.isUpdateLog])

    /**
     * 监听面包屑更新事件
     */
    useEffect(() => {
        const handleBreadcrumbUpdate = (event) => {
            const {path} = event.detail
            if (path) {
                const segments = splitPath(path)
                setPathSegments(segments)
                setDirectoryContents({})
            }
        }

        window.addEventListener('update-breadcrumb', handleBreadcrumbUpdate)
        return () => {
            window.removeEventListener('update-breadcrumb', handleBreadcrumbUpdate)
        }
    }, [])

    /**
     * 更新滚动状态信息
     * 计算是否需要滚动条，更新滚动条位置和尺寸
     */
    const updateScrollState = useCallback(() => {
        if (breadcrumbRef.current && filePathRef.current) {
            const breadcrumb = breadcrumbRef.current
            const container = filePathRef.current

            const scrollWidth = breadcrumb.scrollWidth
            const clientWidth = breadcrumb.clientWidth
            const scrollLeft = breadcrumb.scrollLeft
            const canScroll = scrollWidth > clientWidth

            setScrollState({
                canScroll,
                scrollLeft,
                scrollWidth,
                clientWidth
            })

            const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 1
            const hasFile = currentFile['path'] && !currentFile['isTemporary']

            if (hasFile && canScroll && !isAtEnd) {
                container.classList.add('has-overflow')
            } else {
                container.classList.remove('has-overflow')
            }

            const thumbElement = container.querySelector('.scroll-thumb')
            if (thumbElement) {
                if (canScroll) {
                    const scrollPercentage = scrollLeft / (scrollWidth - clientWidth)
                    const thumbWidth = Math.max(20, (clientWidth / scrollWidth) * 100)
                    const thumbLeft = scrollPercentage * (100 - thumbWidth)

                    thumbElement.style.width = `${thumbWidth}%`
                    thumbElement.style.left = `${thumbLeft}%`
                } else {
                    thumbElement.style.width = '20%'
                    thumbElement.style.left = '0%'
                }
            }
        }
    }, [currentFile['path'], currentFile['isTemporary']])

    /**
     * 延迟更新滚动状态，避免频繁计算
     */
    useEffect(() => {
        const timer = setTimeout(updateScrollState, 100)
        return () => clearTimeout(timer)
    }, [pathSegments, updateScrollState])

    /**
     * 初始化滚动状态
     */
    useEffect(() => {
        updateScrollState()
    }, [updateScrollState])

    /**
     * 监听窗口大小变化，更新滚动状态
     */
    useEffect(() => {
        const handleResize = () => updateScrollState()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [updateScrollState])

    /**
     * 处理滚动条点击事件
     * @param {React.MouseEvent} e - 鼠标事件对象
     */
    const handleScrollBarClick = useCallback((e) => {
        if (!breadcrumbRef.current || !scrollState.canScroll || isDragging) return

        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const percentage = clickX / rect.width
        const maxScroll = scrollState.scrollWidth - scrollState.clientWidth
        breadcrumbRef.current.scrollLeft = percentage * maxScroll
        updateScrollState()
    }, [scrollState.canScroll, scrollState.scrollWidth, scrollState.clientWidth, isDragging, updateScrollState])

    /**
     * 处理滚动条滑块鼠标按下事件
     * @param {React.MouseEvent} e - 鼠标事件对象
     */
    const handleThumbMouseDown = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!breadcrumbRef.current || !scrollState.canScroll) return

        setIsDragging(true)
        setDragStartX(e.clientX)
        setDragStartScrollLeft(breadcrumbRef.current.scrollLeft)

        if (filePathRef.current) {
            filePathRef.current.classList.add('dragging')
        }
    }, [scrollState.canScroll])

    /**
     * 处理鼠标移动事件（拖拽滚动条时）
     * @param {React.MouseEvent} e - 鼠标事件对象
     */
    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !breadcrumbRef.current || !filePathRef.current) return

        const deltaX = e.clientX - dragStartX
        const containerRect = filePathRef.current.getBoundingClientRect()
        const containerWidth = containerRect.width
        const maxScroll = scrollState.scrollWidth - scrollState.clientWidth

        const sensitivity = 2.0
        const scrollDelta = (deltaX / containerWidth) * maxScroll * sensitivity
        breadcrumbRef.current.scrollLeft = Math.max(
            0,
            Math.min(maxScroll, dragStartScrollLeft + scrollDelta)
        )
        updateScrollState()
    }, [isDragging, dragStartX, dragStartScrollLeft, scrollState.scrollWidth, scrollState.clientWidth, updateScrollState])

    /**
     * 处理鼠标释放事件（结束拖拽）
     */
    const handleMouseUp = useCallback(() => {
        setIsDragging(false)

        if (filePathRef.current) {
            filePathRef.current.classList.remove('dragging')
        }
    }, [])

    /**
     * 拖拽期间监听全局鼠标事件
     */
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    /**
     * 处理面包屑滚动事件
     */
    const handleBreadcrumbScroll = useCallback(() => {
        updateScrollState()
    }, [updateScrollState])

    /**
     * 构建指定索引的路径
     * @param {number} index - 路径分段索引
     * @returns {string} 构建的完整路径
     */
    const buildPath = useCallback((index) => {
        return buildFullPath(pathSegments, index)
    }, [pathSegments])

    /**
     * 处理面包屑点击事件
     * @param {number} index - 面包屑项索引
     */
    const handleBreadcrumbClick = useCallback(async (index) => {
        const dirPath = buildPath(index)
        if (!dirPath) return

        try {
            const isFile = dirPath.includes('.') && !dirPath.endsWith('\\')
            if (isFile) {
                // 如果是文件，直接打开文件
                await fileManager.setOpenFile(dirPath)
                return
            }

            // 如果是目录，获取该目录下的内容
            const result = await fileApi.getDirectoryContents(dirPath)
            // Tauri版本直接返回数组，不需要.contents
            const contents = Array.isArray(result) ? result : (result.contents || [])
            setDirectoryContents(prev => ({...prev, [index]: contents}))
        } catch (error) {
            // 如果获取目录内容失败，可能是文件，尝试打开文件
            try {
                await fileManager.setOpenFile(dirPath)
            } catch (fileError) {
                // 静默处理错误
            }
        }
    }, [buildFullPath, pathSegments, fileManager])

    /**
     * 处理文件或目录点击
     * @param {string} filePath - 文件路径
     * @param {boolean} isDirectory - 是否为目录
     */
    const handleFileClick = useCallback(async (filePath, isDirectory) => {
        if (!filePath) return

        try {
            // 如果是文件，打开文件
            if (!isDirectory) {
                await fileManager.setOpenFile(filePath)
            }
            // 无论是文件还是目录，都更新面包屑路径
            if (filePath) {
                const segments = splitPath(filePath)
                setPathSegments(segments)
                // 清除之前的目录内容缓存，确保切换后显示正确的目录内容
                setDirectoryContents({})
            }
        } catch (error) {
            // 静默处理错误
        }
    }, [fileManager])

    /**
     * 生成面包屑下拉菜单项
     * @param {number} index - 面包屑项索引
     * @returns {Array<Object>} 下拉菜单项数组
     */
    const getDropdownItems = useCallback((index) => {
        const contents = directoryContents[index] || []

        // 对内容进行排序，目录排在前面，文件排在后面
        const sortedContents = [...contents].sort((a, b) => {
            if (a['is_dir'] && !b['is_dir']) return -1
            if (!a['is_dir'] && b['is_dir']) return 1
            return a.name.localeCompare(b.name)
        })

        return sortedContents.map((item) => ({
            key: item.path,
            label: item.name,
            icon: item['is_dir'] ? <FolderOutlined/> : <FileOutlined/>,
            onClick: () => handleFileClick(item.path, item['is_dir'])
        }))
    }, [directoryContents, handleFileClick])

    /**
     * 处理右键菜单点击
     * @param {number} index - 面包屑项索引
     */
    const handleContextMenuClick = useCallback(async (index) => {
        const dirPath = buildPath(index)
        if (!dirPath) return

        try {
            await fileApi.showInExplorer(dirPath)
        } catch (error) {
            console.error('打开资源管理器失败:', error)
        }
    }, [buildFullPath, pathSegments])

    /**
     * 生成右键菜单项
     * @param {number} index - 面包屑项索引
     * @returns {Array<Object>} 右键菜单项数组
     */
    const getContextMenuItems = useCallback((index) => [
        {
            key: 'openInExplorer',
            label: t('breadcrumb.openInExplorer'),
            onClick: () => handleContextMenuClick(index)
        }
    ], [handleContextMenuClick, t])

    /**
     * 生成面包屑items
     * @type {Array<Object>} 面包屑项数组
     */
    const breadcrumbItems = useMemo(() => {
        return pathSegments.map((segment, index) => ({
            key: index,
            title: (
                <Dropdown
                    menu={{items: getDropdownItems(index)}}
                    trigger={['click']}
                    placement="topLeft"
                    overlayStyle={{
                        maxHeight: '265px',
                        overflow: 'auto'
                    }}
                    onOpenChange={(open) => {
                        if (open) handleBreadcrumbClick(index).catch(() => {
                        })
                    }}
                >
                    <Dropdown
                        menu={{items: getContextMenuItems(index)}}
                        trigger={['contextMenu']}
                        placement="bottomLeft"
                    >
                        <span style={{cursor: 'pointer'}}>
                            {/^[A-Z]:\\$/i.test(segment) ? segment.substring(0, 2) : segment}
                        </span>
                    </Dropdown>
                </Dropdown>
            )
        }))
    }, [pathSegments, getDropdownItems, handleBreadcrumbClick, getContextMenuItems])

    /**
     * 处理行尾符变更
     * @param {string} value - 行尾符值 (LF/CRLF/CR)
     */
    const handleLineEndingChange = useCallback((value) => {
        if (updateFileLineEnding && currentFile['path']) {
            updateFileLineEnding(currentFile['path'], value)
        }
    }, [updateFileLineEnding, currentFile['path']])

    // 当没有打开文件时隐藏状态栏
    if (!hasOpenFiles) {
        return null;
    }

    return (
        <div className={`editor-status-bar ${hasBackground ? 'with-background' : ''}`}>
            <div className="status-item file-path" ref={filePathRef}>
                {/* 自定义滚动条轨道 - 只在有文件且需要滚动时显示 */}
                {currentFile['path'] && !currentFile['isTemporary'] && scrollState.canScroll && (
                    <>
                        <div className="scroll-track" onClick={handleScrollBarClick}></div>
                        <div
                            className={`scroll-thumb ${isDragging ? 'dragging' : ''}`}
                            onMouseDown={handleThumbMouseDown}
                            style={{
                                cursor: isDragging ? 'grabbing' : 'grab'
                            }}
                        ></div>
                    </>
                )}
                {pathSegments.length > 0 ? (
                    <div
                        ref={breadcrumbRef}
                        className="breadcrumb-container"
                        onScroll={handleBreadcrumbScroll}
                    >
                        <Breadcrumb
                            items={breadcrumbItems}
                            separator={
                                <svg
                                    className="icon"
                                    viewBox="0 0 1024 1024"
                                    version="1.1"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    style={{transform: 'translateY(3px)'}}
                                >
                                    <path
                                        d="M704 514.368a52.864 52.864 0 0 1-15.808 37.888L415.872 819.2a55.296 55.296 0 0 1-73.984-2.752 52.608 52.608 0 0 1-2.816-72.512l233.6-228.928-233.6-228.992a52.736 52.736 0 0 1-17.536-53.056 53.952 53.952 0 0 1 40.192-39.424c19.904-4.672 40.832 1.92 54.144 17.216l272.32 266.88c9.92 9.792 15.616 23.04 15.808 36.8z"
                                        fill="#1296db"
                                        fillOpacity=".88"
                                    ></path>
                                </svg>
                            }
                        />
                    </div>
                ) : (
                    t('editor.unsavedFile')
                )}
            </div>
            <div className="status-right">
                {/* 行列信息和字符数 */}
                <div className="status-item cursor-info">
                    {t('statusBar.line')} {cursorPosition?.lineNumber || 1},&nbsp;&nbsp;{t('statusBar.column')} {cursorPosition?.column || 1}
                </div>

                <Divider type="vertical"/>

                <div className="status-item character-count">
                    {characterCount || 0} {t('statusBar.characters')}
                </div>

                <Divider type="vertical"/>

                <Tooltip title={t('editor.encoding')}>
                    <div className="status-item">
                        <Button
                            className="encoding-button"
                            size="small"
                            disabled={!currentFile['path'] || currentFile['isTemporary']}
                        >
                            {getCurrentEncodingLabel()}
                        </Button>
                    </div>
                </Tooltip>
                <Divider type="vertical"/>
                <Tooltip title={t('editor.lineEnding.title')}>
                    <div className="status-item">
                        <Dropdown
                            disabled={!currentFile['path'] || currentFile['isTemporary']}
                            menu={{
                                items: lineEndingOptions.map((option) => ({
                                    key: option.value,
                                    label: option.label,
                                    onClick: () => handleLineEndingChange(option.value)
                                }))
                            }}
                            trigger={['click']}
                            placement="topLeft"
                        >
                            <Button
                                className="line-ending-button"
                                size="small"
                                disabled={!currentFile['path'] || currentFile['isTemporary']}
                            >
                                {getCurrentLineEndingLabel()}
                            </Button>
                        </Dropdown>
                    </div>
                </Tooltip>
            </div>
        </div>
    )
}

export default EditorStatusBar
