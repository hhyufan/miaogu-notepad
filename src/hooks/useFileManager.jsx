/**
 * @fileoverview 文件管理Hook - 提供文件操作、标签页管理、会话恢复等功能
 * 包含文件打开、保存、关闭、重命名等核心功能，以及标签页管理和会话恢复
 * @author hhyufan
 * @version 1.2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from 'antd'
import tauriApi from '../utils/tauriApi';
import { useI18n } from './useI18n'
import { listen } from '@tauri-apps/api/event'
import { withFileTransition } from '../utils/viewTransition'

const { file: fileApi } = tauriApi;

/**
 * 防抖函数 - 延迟执行函数调用
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 延迟时间(ms)
 * @returns {Function} 防抖后的函数
 */
const debounce = (func, wait) => {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

/**
 * 节流函数 - 限制函数执行频率
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制间隔(ms)
 * @returns {Function} 节流后的函数
 */
const throttle = (func, limit) => {
    let inThrottle
    return function () {
        const args = arguments
        const context = this
        if (!inThrottle) {
            func.apply(context, args)
            inThrottle = true
            setTimeout(() => (inThrottle = false), limit)
        }
    }
}

/**
 * 从文件路径获取文件名
 * @param {string} path - 文件路径
 * @param {Function} t - 国际化翻译函数
 * @returns {string} 文件名
 */
const getFileName = (path, t) => {
    return path.split(/[\/\\]/).pop() || t('common.untitled')
}

/**
 * 获取文件扩展名
 * @param {string} fileName - 文件名
 * @returns {string} 文件扩展名(小写)
 */
const getFileExtensionOptimized = (fileName) => {
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1).toLowerCase() : ''
}

/**
 * 检查文件是否在黑名单中
 * @param {string} fileName - 文件名
 * @returns {boolean} 是否被禁止打开
 */
const isFileBlacklisted = (fileName) => {
    const ext = getFileExtensionOptimized(fileName)
    const blacklistedExts = ['exe', 'dll', 'bin', 'so', 'dylib', 'zip', 'rar', '7z', 'tar', 'gz']
    return blacklistedExts.includes(ext)
}

/**
 * 获取保存文件的过滤器配置
 * 根据当前文件扩展名生成推荐的文件类型过滤器
 * @param {string} currentFileName - 当前文件名，默认为空字符串
 * @param {Function} t - 国际化翻译函数
 * @returns {Array} 文件过滤器配置数组
 */
const getSaveFilters = (currentFileName = '', t) => {
    const ext = getFileExtensionOptimized(currentFileName)

    if (ext) {
        const recommendedFilter = {
            name: t('dialog.fileFilter.fileType', { type: ext.toUpperCase() }),
            extensions: [ext]
        }
        return [recommendedFilter, { name: t('dialog.fileFilter.allFiles'), extensions: ['*'] }]
    } else {
        return [{ name: t('dialog.fileFilter.allFiles'), extensions: ['*'] }]
    }
}

/**
 * 文件缓存类
 * 使用LRU算法管理文件内容缓存，提高文件访问性能
 */
class FileCache {
    /**
     * 构造函数
     * @param {number} maxSize - 缓存最大容量，默认100
     */
    constructor(maxSize = 100) {
        this.cache = new Map()
        this.maxSize = maxSize
        this.accessOrder = new Set()
    }

    /**
     * 获取缓存值
     * @param {string} key - 缓存键
     * @returns {*} 缓存值，不存在则返回null
     */
    get(key) {
        if (this.cache.has(key)) {
            this.accessOrder.delete(key)
            this.accessOrder.add(key)
            return this.cache.get(key)
        }
        return null
    }

    /**
     * 设置缓存值
     * @param {string} key - 缓存键
     * @param {*} value - 缓存值
     */
    set(key, value) {
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.accessOrder.values().next().value
            this.accessOrder.delete(firstKey)
            this.cache.delete(firstKey)
        }

        this.cache.set(key, value)
        this.accessOrder.delete(key)
        this.accessOrder.add(key)
    }

    /**
     * 删除缓存项
     * @param {string} key - 缓存键
     */
    delete(key) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
    }

    /**
     * 清空所有缓存
     */
    clear() {
        this.cache.clear()
        this.accessOrder.clear()
    }
}

const fileCache = new FileCache(50)

/**
 * 创建错误处理函数
 * @param {Function} t - 国际化翻译函数
 * @returns {Function} 错误处理函数
 */
const createHandleError = (t) => (titleKey, error, params = {}) => {
    const title = t(`messages.error.${titleKey}`)
    const errorMessage = error?.message || error || t('messages.error.unknownError')
    const content = params.fileName ? t(`messages.error.${titleKey}`, params) : errorMessage
    Modal.error({ title, content })
}

/**
 * 文件管理 Hook - 适配Tauri API
 * 提供完整的文件操作功能，包括打开、保存、关闭、重命名等
 * 支持标签页管理、会话恢复、文件缓存等高级功能
 * @returns {Object} 文件管理器对象，包含所有文件操作方法和状态
 */
export const useFileManager = () => {
    const { t } = useI18n()
    const handleError = createHandleError(t)
    const [currentFilePath, setCurrentFilePath] = useState('')
    const [openedFiles, setOpenedFiles] = useState([])
    const [editorCode, setEditorCode] = useState('')
    const [defaultFileName, setDefaultFileName] = useState(() => t('common.untitled') + '.js')
    const defaultFileNameRef = useRef(defaultFileName)
    const [fileWatchers, _] = useState(new Map())

    const userSavingFiles = useRef(new Set())

    // 获取编辑器实时内容的方法，由CodeEditor组件设置
    const getEditorContent = useRef(null)

    const openedFilesMap = useMemo(() => {
        const map = new Map()
        openedFiles.forEach(file => map.set(file.path, file))
        return map
    }, [openedFiles])

    useEffect(() => {
        return paths => {
            fileWatchers.forEach(watcher => {
                if (watcher && typeof watcher.unwatch === 'function') {
                    watcher.unwatch(paths)
                }
            })
        }
    }, [])

    const debouncedAutoSave = useMemo(
        () => debounce(async (filePath, content) => {
            if (fileApi?.writeFileContent && filePath && !filePath.startsWith('temp://')) {
                try {
                    await fileApi.writeFileContent(filePath, content)
                } catch (error) {
                }
            }
        }, 500),
        []
    )

    const throttledEditorUpdate = useMemo(
        () => throttle((content) => {
            setEditorCode(content)
        }, 100),
        []
    )

    useEffect(() => {
        defaultFileNameRef.current = defaultFileName
    }, [defaultFileName])

    const lastOpenedFileRef = useRef({ path: '', timestamp: 0 })

    useEffect(() => {
        const handleFileOpen = async (filePath) => {
            if (filePath) {




                const now = Date.now()
                const lastOpened = lastOpenedFileRef.current

                if (lastOpened.path === filePath && (now - lastOpened.timestamp) < 2000) {

                    return
                }

                const existingFileIndex = openedFiles.findIndex(f => f.path === filePath);

                if (existingFileIndex !== -1) {

                    setCurrentFilePath(filePath)

                    const file = openedFiles[existingFileIndex];
                    throttledEditorUpdate(file.content)

                    lastOpenedFileRef.current = { path: filePath, timestamp: now }
                    return
                }


                lastOpenedFileRef.current = { path: filePath, timestamp: now }

                try {
                    await setOpenFile(filePath)
                } catch (error) {
                }
            }
        }

        const hasTauri = typeof window !== 'undefined' && window['__TAURI_INTERNALS__'] !== undefined;
        if (hasTauri) {


            const unlistenOpenFile = listen('open-file', (event) => {

                handleFileOpen(event.payload).catch()
            })

            const unlistenFileDrop = listen('tauri://drag-drop', async (event) => {

                window.dispatchEvent(new CustomEvent('tauri-drag-leave'));

                const { paths } = event.payload;
                if (Array.isArray(paths) && paths.length > 0) {
                    for (const path of paths) {
                        try {


                            const isDirectory = await fileApi.isDirectory(path);

                            if (isDirectory) {

                                window.dispatchEvent(new CustomEvent('update-breadcrumb', {
                                    detail: { path }
                                }));
                            } else {

                                await handleFileOpen(path);
                            }
                        } catch (error) {
                            console.error('Failed to check if dropped item is directory:', path, error);

                            try {
                                await handleFileOpen(path);
                            } catch (fileError) {
                                console.error('Failed to open as file:', path, fileError);
                            }
                        }
                    }
                }
            })

            const unlistenDragEnter = listen('tauri://drag-enter', (_) => {

                window.dispatchEvent(new CustomEvent('tauri-drag-enter'));
            })

            const unlistenDragLeave = listen('tauri://drag-leave', (_) => {

                window.dispatchEvent(new CustomEvent('tauri-drag-leave'));
            })

            return () => {
                unlistenOpenFile.then(fn => fn())
                unlistenFileDrop.then(fn => fn())
                unlistenDragEnter.then(fn => fn())
                unlistenDragLeave.then(fn => fn())
            }
        } else {
            window.debugOpenFile = handleFileOpen
        }

        return () => {
            if (!window['__TAURI__']) {
                delete window.debugOpenFile
            }
        }
    }, [])

    const currentFile = useMemo(() => {
        const fileFromMap = openedFilesMap.get(currentFilePath);
        if (fileFromMap) {
            return fileFromMap;
        }

        // 如果没有在map中找到文件，但openedFiles中有文件且currentFilePath匹配，直接返回该文件
        if (currentFilePath && openedFiles.length > 0) {
            const fileFromArray = openedFiles.find(f => f.path === currentFilePath);
            if (fileFromArray) {
                return fileFromArray;
            }
        }

        // 如果没有当前文件路径，返回空对象
        if (!currentFilePath) {
            return {
                path: '',
                name: '',
                isTemporary: false,
                isModified: false,
                content: '',
                originalContent: '',
                encoding: 'UTF-8',
                lineEnding: 'LF'
            }
        }

        let fileName = defaultFileName;
        if (currentFilePath && currentFilePath.startsWith('temp://')) {
            const tempFileName = currentFilePath.split('temp://')[1];
            if (tempFileName && tempFileName.includes('-')) {
                fileName = tempFileName.split('-')[0];
            }
        }

        // 当没有打开的文件时，创建临时文件
        // 如果是初始化状态且没有编辑器内容，使用默认内容
        let content = editorCode || '';
        // 对于临时文件，确保内容与编辑器同步
        if (currentFilePath && currentFilePath.startsWith('temp://') && editorCode !== undefined) {
            content = editorCode;
        }

        const hasEditorContent = content && content.trim() !== ''

        const tempFile = {
            path: currentFilePath || '',
            name: fileName,
            isTemporary: true,
            isModified: hasEditorContent,
            content: content,
            originalContent: '',
            encoding: 'UTF-8',
            lineEnding: 'LF'
        }

        // 确保临时文件被添加到openedFiles中
        if (currentFilePath && currentFilePath.startsWith('temp://')) {
            setOpenedFiles((prev) => {
                const existingIndex = prev.findIndex(f => f.path === currentFilePath);
                if (existingIndex === -1) {
                    // 如果临时文件不存在，添加它
                    return [...prev, tempFile];
                }
                return prev;
            });
        }

        return tempFile;
    }, [openedFilesMap, currentFilePath, defaultFileName, editorCode, openedFiles])

    const currentCode = useMemo(() => {
        if (currentFile['isTemporary']) {
            return editorCode;
        }
        return currentFile['content'];
    }, [currentFile['content'], currentFile['isTemporary'], editorCode])

    const handlePathConflict = useCallback((filePath) => {
        const duplicates = openedFiles.filter((f) => f.path === filePath)

        if (duplicates.length > 1) {
            const [keepFile, ...removeFiles] = duplicates
            setOpenedFiles((prev) => prev.filter((f) => !removeFiles.includes(f)))
        }
    }, [openedFiles])

    useCallback(() => {
        setOpenedFiles((prev) => {
            const emptyTempFiles = prev.filter(file =>
                file.isTemporary &&
                !file.isModified &&
                (file.content === '' || file.content === file.originalContent)
            )

            if (emptyTempFiles.length === 0) return prev

            const newFiles = prev.filter(file => !emptyTempFiles.includes(file))

            const currentFileWasRemoved = emptyTempFiles.some(file => file.path === currentFilePath)
            if (currentFileWasRemoved && newFiles.length > 0) {
                const firstFile = newFiles[0]
                setCurrentFilePath(firstFile.path)
                setEditorCode(firstFile.content)
                throttledEditorUpdate(firstFile.content)
            } else if (currentFileWasRemoved && newFiles.length === 0) {
                setCurrentFilePath('')
                setEditorCode('')
                throttledEditorUpdate('')
            }

            return newFiles
        })
    }, [currentFilePath, throttledEditorUpdate])

    const closeEmptyCurrentTempFile = useCallback(() => {
        if (currentFile && currentFile['isTemporary']) {
            // 检查编辑器中的实际内容，而不仅仅依赖文件的isModified状态
            const actualContent = editorCode || currentFile['content'] || ''
            const isEmpty = actualContent.trim() === '' || actualContent === currentFile['originalContent']

            if (!currentFile['isModified'] && isEmpty) {
                setOpenedFiles((prev) => prev.filter(f => f.path !== currentFile['path']))
                return true
            }
        }
        return false
    }, [currentFile, editorCode])

    const setOpenFile = useCallback(async (filePath, content = null, options = {}) => {
        try {
            const fileName = getFileName(filePath, t)
            if (isFileBlacklisted(fileName)) {
                handleError('fileTypeNotSupported', '', { fileName })
                return
            }

            if (openedFilesMap.has(filePath) && !options['forceReload']) {
                setCurrentFilePath(filePath)
                const file = openedFilesMap.get(filePath)
                throttledEditorUpdate(file.content)
                return
            }

            if (openedFilesMap.has(filePath) && options['forceReload']) {
                setOpenedFiles(prev => prev.filter(f => f.path !== filePath))
            }

            const existingFileIndex = openedFiles.findIndex(f => f.path === filePath)
            if (existingFileIndex !== -1 && !options['forceReload']) {
                setCurrentFilePath(filePath)
                const existingFile = openedFiles[existingFileIndex]
                throttledEditorUpdate(existingFile.content)
                return
            }

            if (existingFileIndex !== -1 && options['forceReload']) {
                setOpenedFiles(prev => prev.filter((f, index) => index !== existingFileIndex))
            }

            closeEmptyCurrentTempFile()

            let fileContent = content
            let fileEncoding = options['encoding'] || 'UTF-8'
            let fileLineEnding = options['lineEnding'] || 'LF'

            if (fileContent === null) {
                const result = await fileApi.readFileContent(filePath)
                if (!result || typeof result.content !== 'string') {
                    throw new Error('读取文件内容失败')
                }
                fileContent = result.content
                fileEncoding = result.encoding || 'UTF-8'
                fileLineEnding = result.lineEnding || 'LF'
            }

            const newFile = {
                path: filePath,
                name: fileName,
                isTemporary: false,
                isModified: false,
                content: fileContent,
                originalContent: fileContent,
                encoding: fileEncoding,
                lineEnding: fileLineEnding
            }

            handlePathConflict(filePath)

            setOpenedFiles((prev) => {
                const existingIndex = prev.findIndex(f => f.path === filePath);
                if (existingIndex !== -1) {

                    const newFiles = [...prev];
                    newFiles[existingIndex] = newFile;
                    return newFiles;
                }
                return [...prev, newFile];
            })
            setCurrentFilePath(filePath)
            throttledEditorUpdate(fileContent)

            fileCache.set(filePath, fileContent)

            if (!filePath.startsWith('temp://')) {
                try {
                    await fileApi.startFileWatching(filePath)
                } catch (error) {
                    console.warn('Failed to start file watching:', error)
                }
            }
        } catch (error) {
            handleError('fileOpenFailed', error)
        }
    }, [openedFilesMap, handlePathConflict, closeEmptyCurrentTempFile, throttledEditorUpdate])

    const openFile = useCallback(async () => {
        try {
            const result = await fileApi.openFileDialog(t)
            if (!result) return

            await setOpenFile(result)
        } catch (error) {
            handleError('fileOpenFailed', error)
        }
    }, [setOpenFile])

    const createFile = useCallback(async (fileName = null, initialContent = '') => {
        try {
            // 在创建新文件之前，保存当前编辑器的内容到当前文件
            if (currentFile && currentFile['isTemporary'] && editorCode && editorCode.trim() !== '') {
                // 更新当前临时文件的内容，避免内容丢失
                setOpenedFiles((prev) => {
                    const targetIndex = prev.findIndex(file => file.path === currentFile.path)
                    if (targetIndex !== -1) {
                        const newFiles = [...prev]
                        newFiles[targetIndex] = {
                            ...currentFile,
                            content: editorCode,
                            isModified: true
                        }
                        return newFiles
                    }
                    return prev
                })
            }

            closeEmptyCurrentTempFile()

            const finalFileName = fileName || defaultFileName
            const tempPath = `temp://${finalFileName}`

            const newFile = {
                path: tempPath,
                name: finalFileName,
                isTemporary: true,
                isModified: initialContent !== '',
                content: initialContent,
                originalContent: '',
                encoding: 'UTF-8',
                lineEnding: 'LF'
            }

            setOpenedFiles((prev) => [...prev, newFile])
            setCurrentFilePath(tempPath)
            setEditorCode(initialContent)

            if (!fileName) {
                const match = defaultFileName.match(/(.*?)(\d*)$/)
                if (match) {
                    const [, baseName, num] = match
                    const nextNum = num ? parseInt(num) + 1 : 2
                    setDefaultFileName(`${baseName}${nextNum}`)
                }
            }
        } catch (error) {
            handleError('createTempFileFailed', error)
        }
    }, [closeEmptyCurrentTempFile, currentFile, editorCode])

    const updateCode = useCallback((newCode) => {
        if (editorCode === newCode) return

        setEditorCode(newCode)

        setOpenedFiles((prev) => {
            const targetIndex = prev.findIndex(file => file.path === currentFilePath)

            // 如果没有找到对应的文件，直接返回，不进行任何更新
            if (targetIndex === -1) {
                console.warn('updateCode: 未找到对应文件', currentFilePath)
                return prev
            }

            const targetFile = prev[targetIndex]
            const isModified = targetFile.originalContent !== undefined
                ? targetFile.originalContent !== newCode
                : targetFile.content !== newCode

            // 如果内容和修改状态都没有变化，直接返回
            if (targetFile.content === newCode && targetFile.isModified === isModified) {
                return prev
            }

            const newFiles = [...prev]
            newFiles[targetIndex] = {
                ...targetFile,
                content: newCode,
                isModified
            }

            return newFiles
        })

        if (currentFile && currentFile['isTemporary'] && currentFilePath) {
            debouncedAutoSave(currentFilePath, newCode)
        }
    }, [editorCode, currentFilePath, currentFile, debouncedAutoSave])

    const updateDefaultFileName = useCallback((newName) => {
        if (!newName.trim()) return false
        setDefaultFileName(newName)
        return true
    }, [])

    const closeFile = useCallback((key) => {
        fileCache.delete(`file_${key}`)

        if (!key.startsWith('temp://')) {
            try {
                fileApi.stopFileWatching(key).then()
            } catch (error) {
                console.warn('Failed to stop file watching:', error)
            }
        }

        setOpenedFiles((prev) => {
            let fileToClose = prev.find(f => f.path === key)

            if (!fileToClose && key.startsWith('temp-')) {
                const tempFileName = key.replace('temp-', '')
                fileToClose = prev.find(f => f.isTemporary && f.name === tempFileName)
            }

            if (!fileToClose) return prev

            const newFiles = prev.filter((f) => f !== fileToClose)

            if (fileToClose.path === currentFilePath) {
                const newCurrentPath = newFiles[0]?.path || ''
                setCurrentFilePath(newCurrentPath)

                if (newFiles.length === 0) {
                    // 当关闭最后一个文件时，清空编辑器
                    setCurrentFilePath('')
                    setEditorCode('')
                    throttledEditorUpdate('')

                    // 返回空数组，不自动创建临时文件
                    return []
                } else {
                    const firstFile = newFiles[0]
                    setEditorCode(firstFile.content)
                    throttledEditorUpdate(firstFile.content)
                }
            }

            return newFiles
        })
    }, [currentFilePath, updateDefaultFileName, throttledEditorUpdate, createFile])

    const saveFile = useCallback(async (saveAs = false) => {
        let targetPath = null

        try {
            // 总是优先从编辑器获取实时内容，确保保存的是最新的编辑器内容
            let contentToSave
            if (getEditorContent.current && typeof getEditorContent.current === 'function') {
                // 直接从编辑器获取实时内容
                contentToSave = getEditorContent.current()
            } else {
                // 如果编辑器引用不可用，回退到文件状态或editorCode
                contentToSave = currentFile?.content || editorCode
            }

            const hasNoOpenFile = !currentFilePath || currentFilePath.startsWith('temp://')

            if (saveAs || hasNoOpenFile) {
                const result = await fileApi.saveFileDialog(currentFile['name'], t, saveAs || hasNoOpenFile)

                if (!result) return { success: false, canceled: true }
                targetPath = result

                // 只有在用户选择了保存路径后才检查重复文件
                const duplicateOpenedFile = openedFiles.find(
                    (f) => f.path !== currentFilePath && f.path === targetPath
                )

                if (duplicateOpenedFile) {
                    closeFile(duplicateOpenedFile.path)
                }
            } else {
                targetPath = currentFilePath
            }

            userSavingFiles.current.add(targetPath)

            const fileEncoding = currentFile['encoding'] || 'UTF-8'
            const saveResult = await fileApi.saveFile(targetPath, contentToSave, fileEncoding)
            if (!saveResult.success) {
                return { success: false, conflict: true, targetPath }
            }

            const fileName = targetPath.split(/[\\/]/).pop() || 'unknown'

            setCurrentFilePath(targetPath)

            if (currentFilePath && openedFiles.some((file) => file.path === currentFilePath)) {
                setOpenedFiles((prev) =>
                    prev.map((file) =>
                        file.path === currentFilePath
                            ? {
                                ...file,
                                path: targetPath,
                                name: fileName,
                                isTemporary: false,
                                encoding: saveResult.encoding || fileEncoding,
                                isModified: false,
                                content: contentToSave,
                                originalContent: contentToSave
                            }
                            : file
                    )
                )
            } else {
                const newFile = {
                    path: targetPath,
                    name: fileName,
                    isTemporary: false,
                    isModified: false,
                    content: contentToSave,
                    originalContent: contentToSave,
                    encoding: saveResult.encoding || fileEncoding,
                    lineEnding: saveResult['line_ending'] || 'LF'
                }
                setOpenedFiles((prev) => [...prev, newFile])
            }

            if (hasNoOpenFile) {
                setDefaultFileName(t('common.untitled'))
            }

            handlePathConflict(targetPath)

            window.dispatchEvent(new CustomEvent('file-saved', { detail: { path: targetPath } }));

            return { success: true, path: targetPath }
        } catch (error) {
            handleError('fileSaveFailed', error)
            return { success: false, error: error.message || '未知错误' }
        } finally {
            if (targetPath) {
                userSavingFiles.current.delete(targetPath)
            }
        }
    }, [currentFilePath, openedFiles, editorCode, currentFile, closeFile, handlePathConflict, throttledEditorUpdate])

    const switchFile = useCallback((key) => {
        let target = openedFilesMap.get(key)
        let targetPath = key

        if (!target && key.startsWith('temp-')) {
            const tempFileName = key.replace('temp-', '')
            const tempFile = openedFiles.find(file =>
                file.isTemporary && file.name === tempFileName
            )
            if (tempFile) {
                target = tempFile
                targetPath = tempFile.path
            }
        }

        if (!target) {
            return;
        }

        withFileTransition(() => {
            setCurrentFilePath(targetPath)
            setEditorCode(target.content)

            throttledEditorUpdate(target.content)
        }).then()
    }, [openedFilesMap, openedFiles, throttledEditorUpdate])

    const getUnsavedFiles = useCallback(() => {
        const unsavedFiles = openedFiles.filter((file) => file.isTemporary || file.isModified)

        if (unsavedFiles.length === 1 && openedFiles.length === 1) {
            const singleFile = unsavedFiles[0]
            if (singleFile.isTemporary &&
                (singleFile.content === '' || singleFile.content === singleFile.originalContent)) {
                return []
            }
        }

        return unsavedFiles
    }, [openedFiles])

    const hasUnsavedChanges = useMemo(() => {
        return currentFile && (currentFile['isTemporary'] || currentFile['isModified'])
    }, [currentFile])

    const exportFile = useCallback(async () => {
        await saveFile(true)
    }, [saveFile])

    const saveFiles = useCallback(async (files) => {
        const results = []

        for (let file of files) {
            try {
                let targetPath = file.path
                const isTemp = file.isTemporary

                if (isTemp) {
                    const result = await fileApi.saveFileDialog(file.name, t, true)

                    if (!result) {
                        results.push({ path: file.path, success: false, canceled: true })
                        continue
                    }
                    targetPath = result

                    const duplicateOpenedFile = openedFiles.find(
                        (f) => f.path !== file.path && f.path === targetPath
                    )

                    if (duplicateOpenedFile) {
                        closeFile(duplicateOpenedFile.path)
                    }
                }

                const fileEncoding = file.encoding || 'UTF-8'
                const saveResult = await fileApi.saveFile(targetPath, file.content, fileEncoding)
                if (!saveResult.success) {
                    results.push({ path: file.path, success: false, message: saveResult.message })
                    continue
                }

                results.push({ path: file.path, success: true, newPath: targetPath })

                setOpenedFiles((prev) =>
                    prev.map((f) =>
                        f.path === file.path
                            ? {
                                ...f,
                                content: file.content,
                                originalContent: file.content,
                                path: targetPath,
                                name: targetPath.split(/[\/\\]/).pop() || 'unknown',
                                isTemporary: false,
                                isModified: false,
                                encoding: saveResult.encoding || fileEncoding,
                                lineEnding: saveResult['line_ending'] || f.lineEnding || 'LF'
                            }
                            : f
                    )
                )

                if (file.path === currentFilePath) {
                    setCurrentFilePath(targetPath)
                }

            } catch (error) {
                results.push({ path: file.path, success: false, error: error.message })
            }
        }

        return results
    }, [fileApi, openedFiles, closeFile, currentFilePath, setOpenedFiles, setCurrentFilePath])

    const renameFile = useCallback(async (oldPath, newName) => {
        try {
            if (oldPath.startsWith('temp://')) {
                const newTempPath = `temp://${newName}`















                // 测试getEditorContent.current是否能正常工作
                if (getEditorContent?.current) {
                    try {
                        const editorRealContent = getEditorContent.current()



                    } catch (error) {
                        console.error('获取编辑器实时内容时出错:', error)
                    }
                }

                setOpenedFiles((prev) => {

                    return prev.map((file) => {
                        if (file.path === oldPath) {
                            // 获取当前文件的实际内容
                            let actualContent = file.content

                            // 如果是当前正在编辑的文件，优先使用编辑器的实时内容
                            if (oldPath === currentFilePath) {
                                // 尝试从编辑器获取实时内容
                                if (getEditorContent.current) {
                                    try {
                                        actualContent = getEditorContent.current()

                                    } catch (error) {
                                        console.warn('获取编辑器实时内容失败，使用editorCode:', error)
                                        actualContent = (editorCode !== undefined && editorCode !== null) ? editorCode : file.content
                                    }
                                } else {
                                    // 如果getEditorContent不可用，使用editorCode
                                    actualContent = (editorCode !== undefined && editorCode !== null) ? editorCode : file.content

                                }
                            }

                            return {
                                ...file,
                                path: newTempPath,
                                name: newName,
                                content: actualContent,
                                isModified: oldPath === currentFilePath ?
                                    (actualContent !== file.originalContent) :
                                    file.isModified
                            }
                        }
                        return file
                    })
                })

                if (currentFilePath === oldPath) {
                    setCurrentFilePath(newTempPath)

                }


                return { success: true, newPath: newTempPath }
            }

            if (!oldPath || oldPath.trim() === '') {
                handleError('invalidFilePath', '')
                return { success: false, message: '未提供有效的文件路径' }
            }

            const oldDir = oldPath.substring(0, oldPath.lastIndexOf('\\') + 1)
            const newPath = oldDir + newName

            const result = await fileApi.renameFile(oldPath, newPath)
            if (!result.success) {
                handleError('fileRenameFailed', result.message)
                return { success: false, message: result.message }
            }

            const actualNewPath = result['file_path'] || newPath

            // 更新打开的文件列表
            setOpenedFiles((prev) =>
                prev.map((file) =>
                    file.path === oldPath
                        ? {
                            ...file,
                            path: actualNewPath,
                            name: newName
                        }
                        : file
                )
            )

            // 如果重命名的是当前文件，更新当前文件路径
            if (currentFilePath === oldPath) {
                setCurrentFilePath(actualNewPath)
            }

            return { success: true, newPath: actualNewPath }
        } catch (error) {
            handleError('fileRenameFailed', error)
            return { success: false, error: error.message }
        }
    }, [currentFilePath])

    // 刷新文件内容
    const refreshFileContent = useCallback(async (filePath) => {
        try {
            const result = await fileApi.readFileContent(filePath)
            if (!result || typeof result.content !== 'string') {
                throw new Error('读取文件内容失败')
            }

            const fileContent = result.content
            const encoding = result.encoding || 'UTF-8'
            const lineEnding = result.lineEnding || 'LF'

            // 更新文件列表中的内容
            setOpenedFiles((prev) =>
                prev.map((file) =>
                    file.path === filePath
                        ? {
                            ...file,
                            content: fileContent,
                            originalContent: fileContent,
                            encoding,
                            lineEnding,
                            isModified: false
                        }
                        : file
                )
            )

            // 如果刷新的是当前文件，更新编辑器内容
            if (currentFilePath === filePath) {
                setEditorCode(fileContent)
                throttledEditorUpdate(fileContent)
            }

            // 更新缓存
            fileCache.set(filePath, fileContent)
        } catch (error) {
            handleError('refreshFileContentFailed', error)
        }
    }, [currentFilePath, throttledEditorUpdate])

    // 更新文件内容（用于外部文件变化监听）
    const updateFileContent = useCallback((filePath, newContent, encoding, lineEnding) => {
        setOpenedFiles((prev) =>
            prev.map((file) =>
                file.path === filePath
                    ? {
                        ...file,
                        content: newContent,
                        originalContent: newContent,
                        encoding: encoding || file.encoding,
                        lineEnding: lineEnding || file.lineEnding,
                        isModified: false
                    }
                    : file
            )
        )

        // 如果更新的是当前文件，同步编辑器内容
        if (currentFilePath === filePath) {
            setEditorCode(newContent)
            throttledEditorUpdate(newContent)
        }

        // 更新缓存
        fileCache.set(filePath, newContent)
    }, [currentFilePath, throttledEditorUpdate])

    // 更新文件行尾序号
    const updateFileLineEnding = useCallback(async (filePath, lineEnding) => {
        try {
            if (!filePath || !lineEnding) {
                throw new Error('文件路径和行尾序号不能为空')
            }

            // 标记文件正在被用户主动修改，避免外部文件变更冲突
            userSavingFiles.current.add(filePath)

            // 暂时停止文件监听，避免监听到自己的修改
            if (fileApi && fileApi.stopFileWatching) {
                try {
                    await fileApi.stopFileWatching(filePath)
                } catch (error) {
                    console.warn('停止文件监听失败:', error)
                }
            }

            // 如果有Tauri API，先调用后端更新文件
            if (fileApi && fileApi.updateFileLineEnding) {
                const result = await fileApi.updateFileLineEnding(filePath, lineEnding)

                // 后端更新成功后，同步更新前端的编辑器内容
                if (result && result.success) {
                    // 转换当前编辑器内容的行结束符
                    const convertLineEnding = (content, targetLineEnding) => {
                        // 先统一转换为LF
                        const normalizedContent = content.replace(/\r\n|\r/g, '\n')

                        // 然后转换为目标格式
                        switch (targetLineEnding) {
                            case 'CRLF':
                                return normalizedContent.replace(/\n/g, '\r\n')
                            case 'CR':
                                return normalizedContent.replace(/\n/g, '\r')
                            case 'LF':
                            default:
                                return normalizedContent
                        }
                    }

                    // 如果是当前文件，更新编辑器内容
                    if (filePath === currentFilePath) {
                        const convertedContent = convertLineEnding(editorCode, lineEnding)
                        setEditorCode(convertedContent)
                        throttledEditorUpdate(convertedContent)
                    }

                    // 更新文件状态中的行尾序号和内容
                    setOpenedFiles((prev) =>
                        prev.map((file) => {
                            if (file.path === filePath) {
                                const convertedContent = convertLineEnding(file.content, lineEnding)
                                return {
                                    ...file,
                                    lineEnding,
                                    isModified: true,
                                    content: convertedContent
                                }
                            }
                            return file
                        })
                    )
                }
            }
        } catch (error) {
            console.error('更新文件行结束符失败:', error)
            handleError('updateFileLineEndingFailed', error)
        } finally {
            // 重新启动文件监听
            if (fileApi && fileApi.startFileWatching) {
                try {
                    await fileApi.startFileWatching(filePath)

                } catch (error) {
                    console.warn('恢复文件监听失败:', error)
                }
            }

            // 延迟移除标记，给文件系统更多时间来处理变更
            setTimeout(() => {

                userSavingFiles.current.delete(filePath)
            }, 1000) // 减少到1秒，因为已经停止了监听
        }
    }, [currentFilePath, editorCode, throttledEditorUpdate])

    // 切换到文件（用于面板点击）
    const switchToFile = useCallback(async (filePath) => {
        try {
            // 检查文件是否已经打开
            if (openedFilesMap.has(filePath)) {
                // 如果已经打开，直接切换
                switchFile(filePath)
            } else {
                // 如果没有打开，先打开文件
                await setOpenFile(filePath)
            }
        } catch (error) {
            handleError('switchFileFailed', error)
        }
    }, [openedFilesMap, switchFile, setOpenFile])

    // 防止重复处理外部文件变更的标记
    const processingExternalChanges = useRef(new Set())
    // 防止重复显示冲突modal的标记
    const activeConflictModals = useRef(new Set())

    // 显示文件冲突解决对话框
    const showFileConflictDialog = useCallback(async (filePath) => {
        // 如果该文件已经有冲突modal在显示，直接返回
        if (activeConflictModals.current.has(filePath)) {
            return 'current' // 默认保留当前版本
        }

        // 标记该文件的冲突modal正在显示
        activeConflictModals.current.add(filePath)

        return new Promise((resolve) => {
            const fileName = filePath.split(/\//).pop()

            try {
                Modal.confirm({
                    title: t('dialog.confirm.title'),
                    content: (
                        <div>
                            <p>{t('fileConflict.fileConflictMessage', { fileName })}</p>
                            <p style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
                                {t('fileConflict.chooseVersion')}
                            </p>
                        </div>
                    ),
                    okText: t('fileConflict.useExternal'),
                    cancelText: t('fileConflict.keepCurrent'),
                    onOk: () => {
                        // 移除标记
                        activeConflictModals.current.delete(filePath)
                        resolve('external')
                    },
                    onCancel: () => {
                        // 移除标记
                        activeConflictModals.current.delete(filePath)
                        resolve('current')
                    },
                    width: 480,
                    centered: true
                })

            } catch (error) {
                console.error('Error calling Modal.confirm:', error)
                // 移除标记
                activeConflictModals.current.delete(filePath)
                resolve('current') // 默认保留当前版本
            }
        })
    }, [t])

    // 处理外部文件变更
    const handleExternalFileChange = useCallback(async (filePath) => {
        try {
            // 防止重复处理同一个文件的变更
            if (processingExternalChanges.current.has(filePath)) {

                return
            }

            processingExternalChanges.current.add(filePath)


            const currentFile = openedFilesMap.get(filePath)

            if (!currentFile) {

                processingExternalChanges.current.delete(filePath)
                return
            }

            // 检查文件是否有未保存的修改

            if (currentFile['isModified']) {



                // 如果用户正在主动保存该文件，跳过冲突检查
                if (userSavingFiles.current.has(filePath)) {

                    processingExternalChanges.current.delete(filePath)
                    return
                }

                // 显示冲突解决对话框



                try {
                    const userChoice = await showFileConflictDialog(filePath)


                    if (userChoice === 'external') {
                        // 用户选择使用外部版本

                        await refreshFileContent(filePath)
                    } else if (userChoice === 'current') {
                        // 用户选择保留当前版本，直接保存当前修改

                        try {
                            // 如果是当前文件，保存当前编辑器内容
                            if (filePath === currentFilePath) {

                                const saveResult = await saveFile(false)
                                if (saveResult.success) {

                                } else {
                                    console.error('Failed to save current modifications:', saveResult)
                                }
                            } else {
                                // 如果不是当前文件，保存该文件的内容

                                const fileEncoding = currentFile['encoding'] || 'UTF-8'
                                const saveResult = await fileApi.saveFile(filePath, currentFile['content'], fileEncoding)
                                if (saveResult.success) {

                                    // 更新文件状态
                                    setOpenedFiles((prev) =>
                                        prev.map((f) =>
                                            f.path === filePath
                                                ? {
                                                    ...f,
                                                    originalContent: f.content,
                                                    isModified: false,
                                                    encoding: saveResult.encoding || fileEncoding,
                                                    lineEnding: saveResult['line_ending'] || f.lineEnding || 'LF'
                                                }
                                                : f
                                        )
                                    )
                                } else {
                                    console.error('Failed to save file modifications:', saveResult)
                                }
                            }
                        } catch (error) {
                            console.error('Error saving file modifications:', error)
                        }
                    } else {

                    }
                } catch (dialogError) {
                    console.error('Error in conflict dialog:', dialogError)
                }
            } else {
                // 文件未修改，直接同步外部变更

                await refreshFileContent(filePath)
            }
        } catch (error) {
            console.error('Failed to handle external file change:', error)
        } finally {
            // 清除处理标记
            processingExternalChanges.current.delete(filePath)
        }
    }, [openedFilesMap, refreshFileContent, showFileConflictDialog])

    // 保存handleExternalFileChange的最新引用
    const handleExternalFileChangeRef = useRef(handleExternalFileChange)
    handleExternalFileChangeRef.current = handleExternalFileChange

    // 监听文件变更事件
    useEffect(() => {
        let unlisten = null

        const setupListener = async () => {
            try {

                unlisten = await listen('file-changed', (event) => {


                    const { file_path } = event.payload
                    if (file_path) {


                        handleExternalFileChangeRef.current(file_path)
                    } else {
                        console.warn('File change event missing file_path:', event.payload)
                    }
                })
            } catch (error) {
                console.warn('Failed to setup file change listener:', error)
            }
        }

        setupListener().then()

        return () => {
            if (unlisten) {

                unlisten()
            }
        }
    }, [])

    // 监听语言变化，更新默认文件名
    useEffect(() => {
        updateDefaultFileName(t('common.untitled'))
    }, [t, updateDefaultFileName]) // 添加t作为依赖，当语言变化时重新执行

    return {
        // 状态
        currentFile,
        openedFiles,
        currentCode,
        hasUnsavedChanges,

        // 操作函数
        openFile,
        createFile,
        newFile: createFile, // 添加newFile别名，指向createFile函数
        saveFile,
        closeFile,
        switchFile,
        switchToFile,
        updateCode,
        getUnsavedFiles,
        exportFile,
        saveFiles,
        renameFile,
        refreshFileContent,
        updateDefaultFileName,
        updateFileLineEnding,
        setOpenFile,
        updateFileContent,

        // AppHeader的ref引用，用于CodeEditor获取语言设置
        appHeaderRef: null,

        // 编辑器内容获取引用，用于CodeEditor设置获取实时内容的方法
        getEditorContent
    }
}

/**
 * 高性能文件选择器 Hook
 * 使用选择器模式优化性能，避免不必要的重渲染
 * @param {Function} selector - 选择器函数，用于从fileManager中选择需要的数据
 * @param {Object} fileManager - 文件管理器对象
 * @returns {*} 选择器函数的返回值
 */
export const useFileSelector = (selector, fileManager) => {
    if (!fileManager) throw new Error('useFileSelector必须传入fileManager对象')

    return useMemo(() => selector(fileManager), [fileManager, selector])
}

/**
 * 获取当前文件的 Hook
 * @param {Object} fileManager - 文件管理器对象
 * @returns {Object|null} 当前打开的文件对象
 */
export const useCurrentFile = (fileManager) => {
    return useFileSelector(useCallback(state => state.currentFile, []), fileManager)
}

/**
 * 获取打开文件列表的 Hook
 * @param {Object} fileManager - 文件管理器对象
 * @returns {Array} 已打开的文件列表
 */
export const useOpenedFiles = (fileManager) => {
    return useFileSelector(useCallback(state => state.openedFiles, []), fileManager)
}

/**
 * 获取文件操作函数的 Hook
 * 返回所有文件操作相关的方法，便于组件使用
 * @param {Object} fileManager - 文件管理器对象
 * @returns {Object} 包含所有文件操作方法的对象
 */
export const useFileActions = (fileManager) => {
    return useFileSelector(useCallback(state => ({
        currentCode: state.currentCode,
        openFile: state.openFile,
        createFile: state.createFile,
        saveFile: state.saveFile,
        closeFile: state.closeFile,
        switchFile: state.switchFile,
        switchToFile: state.switchToFile,
        updateCode: state.updateCode,
        getUnsavedFiles: state.getUnsavedFiles,
        exportFile: state.exportFile,
        saveFiles: state.saveFiles,
        renameFile: state.renameFile,
        refreshFileContent: state.refreshFileContent,
        updateDefaultFileName: state.updateDefaultFileName,
        updateFileLineEnding: state.updateFileLineEnding,
        setOpenFile: state.setOpenFile
    }), []), fileManager)
}
export default useFileManager
