import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Modal } from 'antd'
import tauriApi from '../utils/tauriApi';
const { file: fileApi } = tauriApi;
import { useI18n } from './useI18n'
import { listen } from '@tauri-apps/api/event'

// 高性能工具函数
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

// 获取文件名的工具函数
const getFileName = (path, t) => {
    return path.split(/[\/\\]/).pop() || t('common.untitled')
}

// 获取文件扩展名的工具函数
const getFileExtensionOptimized = (fileName) => {
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1).toLowerCase() : ''
}

// 简化的文件类型检查
const isFileBlacklisted = (fileName) => {
    const ext = getFileExtensionOptimized(fileName)
    const blacklistedExts = ['exe', 'dll', 'bin', 'so', 'dylib', 'zip', 'rar', '7z', 'tar', 'gz']
    return blacklistedExts.includes(ext)
}

// 生成保存文件过滤器
const getSaveFilters = (currentFileName = '', t) => {
    const ext = getFileExtensionOptimized(currentFileName)

    // 如果文件有扩展名，生成推荐过滤器；否则只返回通用过滤器
    if (ext) {
        const recommendedFilter = {
            name: t('dialog.fileFilter.fileType', { type: ext.toUpperCase() }),
            extensions: [ext]
        }
        return [recommendedFilter, { name: t('dialog.fileFilter.allFiles'), extensions: ['*'] }]
    } else {
        // 没有扩展名时，只返回通用过滤器，避免自动添加后缀
        return [{ name: t('dialog.fileFilter.allFiles'), extensions: ['*'] }]
    }
}

// 文件缓存管理器
class FileCache {
    constructor(maxSize = 100) {
        this.cache = new Map()
        this.maxSize = maxSize
        this.accessOrder = new Set()
    }

    get(key) {
        if (this.cache.has(key)) {
            this.accessOrder.delete(key)
            this.accessOrder.add(key)
            return this.cache.get(key)
        }
        return null
    }

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

    delete(key) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
    }

    clear() {
        this.cache.clear()
        this.accessOrder.clear()
    }
}

// 全局文件缓存实例
const fileCache = new FileCache(50)

// 通用错误处理函数
const createHandleError = (t) => (titleKey, error, params = {}) => {
    const title = t(`messages.error.${titleKey}`)
    const errorMessage = error?.message || error || t('messages.error.unknownError')
    const content = params.fileName ? t(`messages.error.${titleKey}`, params) : errorMessage
    // 静默处理错误提示
    Modal.error({ title, content })
}

/**
 * 文件管理 Hook - 适配Tauri API
 * 提供完整的文件操作功能，包括打开、保存、创建、关闭等
 */
export const useFileManager = () => {
    const { t } = useI18n()
    const handleError = createHandleError(t)
    const [currentFilePath, setCurrentFilePath] = useState('')
    const [openedFiles, setOpenedFiles] = useState([]) // 结构：{ path: string, name: string, isTemporary: boolean, isModified: boolean, content: string, originalContent: string }[]
    const [editorCode, setEditorCode] = useState('')
    const [defaultFileName, setDefaultFileName] = useState(() => t('untitled'))
    const defaultFileNameRef = useRef(defaultFileName)
    const [fileWatchers, setFileWatchers] = useState(new Map())

    // 跟踪用户主动保存操作的ref
    const userSavingFiles = useRef(new Set())

    // 性能优化：使用 Map 来快速查找文件
    const openedFilesMap = useMemo(() => {
        const map = new Map()
        openedFiles.forEach(file => map.set(file.path, file))
        return map
    }, [openedFiles])

    // 文件监听器清理
    useEffect(() => {
        return paths => {
            fileWatchers.forEach(watcher => {
                if (watcher && typeof watcher.unwatch === 'function') {
                    watcher.unwatch(paths)
                }
            })
        }
    }, [])

    // 防抖的文件保存函数
    const debouncedAutoSave = useMemo(
        () => debounce(async (filePath, content) => {
            if (fileApi?.writeFileContent && filePath && !filePath.startsWith('temp://')) {
                try {
                    await fileApi.writeFileContent(filePath, content)
                } catch (error) {
                    // 静默处理自动保存错误
                }
            }
        }, 500),
        []
    )

    // 节流的编辑器内容更新函数
    const throttledEditorUpdate = useMemo(
        () => throttle((content) => {
            setEditorCode(content)
        }, 100),
        []
    )

    useEffect(() => {
        defaultFileNameRef.current = defaultFileName
    }, [defaultFileName])

    // 用于防止重复打开同一个文件
    const lastOpenedFileRef = useRef({ path: '', timestamp: 0 })

    // 监听通过"打开方式"打开文件的事件 (Tauri版本)
    useEffect(() => {
        const handleFileOpen = async (filePath) => {
            // 接收到文件打开事件
            if (filePath) {
                const now = Date.now()
                const lastOpened = lastOpenedFileRef.current

                // 防止短时间内重复打开同一个文件（2秒内）
                if (lastOpened.path === filePath && (now - lastOpened.timestamp) < 2000) {
                    return
                }

                // 更新最后打开的文件信息
                lastOpenedFileRef.current = { path: filePath, timestamp: now }

                try {
                    await setOpenFile(filePath)
                    // 文件关联打开成功
                } catch (error) {
                    // 静默处理文件关联打开错误
                }
            }
        }

        // 在Tauri环境中监听open-file事件
        const hasTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
        if (hasTauri) {
            // 监听来自Rust后端的open-file事件
            const unlisten = listen('open-file', (event) => {
                handleFileOpen(event.payload)
            })

            // 清理监听器
            return () => {
                unlisten.then(fn => fn())
            }
        } else {
            // 开发模式下的调试支持
            window.debugOpenFile = handleFileOpen
        }

        return () => {
            if (!window.__TAURI__) {
                delete window.debugOpenFile
            }
        }
    }, [])

    // 获取当前文件对象 - 优化缓存逻辑
    const currentFile = useMemo(() => {
        return openedFilesMap.get(currentFilePath) || {
            path: '',
            name: defaultFileName,
            isTemporary: true,
            isModified: false,
            content: editorCode,
            originalContent: '', // 临时文件的原始内容为空
            encoding: 'UTF-8',
            lineEnding: 'LF'
        }
    }, [openedFilesMap, currentFilePath, defaultFileName, editorCode])

    // 获取当前文件内容
    const currentCode = useMemo(() => currentFile.content, [currentFile.content])

    // 检查并处理文件路径冲突
    const handlePathConflict = useCallback((filePath) => {
        // 查找是否有重复路径的文件
        const duplicates = openedFiles.filter((f) => f.path === filePath)

        if (duplicates.length > 1) {
            // 保留第一个文件，关闭其他重复的文件
            const [keepFile, ...removeFiles] = duplicates
            setOpenedFiles((prev) => prev.filter((f) => !removeFiles.includes(f)))
        }
    }, [openedFiles])

    // 检查并清理空的临时文件
    const cleanupEmptyTempFiles = useCallback(() => {
        setOpenedFiles((prev) => {
            // 查找空的临时文件（内容为空且未修改）
            const emptyTempFiles = prev.filter(file =>
                file.isTemporary &&
                !file.isModified &&
                (file.content === '' || file.content === file.originalContent)
            )

            if (emptyTempFiles.length === 0) return prev

            // 移除空的临时文件
            const newFiles = prev.filter(file => !emptyTempFiles.includes(file))

            // 如果当前文件是被清理的空临时文件之一，需要切换到其他文件
            const currentFileWasRemoved = emptyTempFiles.some(file => file.path === currentFilePath)
            if (currentFileWasRemoved && newFiles.length > 0) {
                // 切换到第一个文件
                const firstFile = newFiles[0]
                setCurrentFilePath(firstFile.path)
                setEditorCode(firstFile.content)
                throttledEditorUpdate(firstFile.content)
            } else if (currentFileWasRemoved && newFiles.length === 0) {
                // 如果没有其他文件，重置状态
                setCurrentFilePath('')
                setEditorCode('')
                throttledEditorUpdate('')
            }

            return newFiles
        })
    }, [currentFilePath, throttledEditorUpdate])

    // 检查并关闭空的当前临时文件
    const closeEmptyCurrentTempFile = useCallback(() => {
        if (currentFile && currentFile.isTemporary && !currentFile.isModified &&
            (currentFile.content === '' || currentFile.content === currentFile.originalContent)) {
            // 关闭当前空的临时文件
            setOpenedFiles((prev) => prev.filter(f => f.path !== currentFile.path))
            return true
        }
        return false
    }, [currentFile])

    // 设置打开文件
    const setOpenFile = useCallback(async (filePath, content = null, options = {}) => {
        try {
            // 检查文件黑名单
            const fileName = getFileName(filePath, t)
            if (isFileBlacklisted(fileName)) {
                handleError('fileTypeNotSupported', '', { fileName })
                return
            }

            // 检查文件是否已经打开
            if (openedFilesMap.has(filePath)) {
                setCurrentFilePath(filePath)
                const file = openedFilesMap.get(filePath)
                throttledEditorUpdate(file.content)
                return
            }

            // 在打开新文件前，检查并关闭空的当前临时文件
            closeEmptyCurrentTempFile()

            let fileContent = content
            let fileEncoding = options.encoding || 'UTF-8'
            let fileLineEnding = options.lineEnding || 'LF'

            // 如果没有提供内容，则从文件系统读取
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

            setOpenedFiles((prev) => [...prev, newFile])
            setCurrentFilePath(filePath)
            throttledEditorUpdate(fileContent)

            // 缓存文件内容
            fileCache.set(filePath, fileContent)

            // 开始监听文件变更（仅对非临时文件）
            if (!filePath.startsWith('temp://')) {
                try {
                    await fileApi.startFileWatching(filePath)
                } catch (error) {
                    console.warn('Failed to start file watching:', error)
                }
            }

            // 检查并处理可能的路径冲突
            handlePathConflict(filePath)
        } catch (error) {
            handleError('fileOpenFailed', error)
        }
    }, [openedFilesMap, handlePathConflict, closeEmptyCurrentTempFile, throttledEditorUpdate])

    // 打开文件
    const openFile = useCallback(async () => {
        try {
            const result = await fileApi.openFileDialog(t)
            if (!result) return

            await setOpenFile(result)
        } catch (error) {
            handleError('fileOpenFailed', error)
        }
    }, [setOpenFile])

    // 创建新文件
    const createFile = useCallback(async (fileName = null, initialContent = '') => {
        try {
            // 在创建新文件前，检查并关闭空的当前临时文件
            closeEmptyCurrentTempFile()

            const finalFileName = fileName || defaultFileName
            // 生成临时文件路径
            const tempPath = `temp://${finalFileName}-${Date.now()}`

            const newFile = {
                path: tempPath,
                name: finalFileName,
                isTemporary: true,
                isModified: initialContent !== '', // 如果有初始内容，标记为已修改
                content: initialContent,
                originalContent: '',
                encoding: 'UTF-8',
                lineEnding: 'LF'
            }

            setOpenedFiles((prev) => [...prev, newFile])
            setCurrentFilePath(tempPath)
            throttledEditorUpdate(initialContent)

            // 如果使用了默认文件名，更新默认文件名计数
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
    }, [closeEmptyCurrentTempFile, throttledEditorUpdate])

    // 更新代码内容 - 参考主项目实现的高性能优化版本
    const updateCode = useCallback((newCode) => {
        // 避免不必要的状态更新
        if (editorCode === newCode) return

        setEditorCode(newCode)

        // 批量更新文件状态，减少重新渲染
        setOpenedFiles((prev) => {
            const targetIndex = prev.findIndex(file => file.path === currentFilePath)
            if (targetIndex === -1) return prev

            const targetFile = prev[targetIndex]
            // 使用originalContent进行修改检测，如果没有originalContent则使用content
            const isModified = targetFile.originalContent !== undefined
                ? targetFile.originalContent !== newCode
                : targetFile.content !== newCode

            // 如果状态没有变化，直接返回原数组
            if (targetFile.content === newCode && targetFile.isModified === isModified) {
                return prev
            }

            // 使用浅拷贝优化性能
            const newFiles = [...prev]
            newFiles[targetIndex] = {
                ...targetFile,
                content: newCode,
                isModified
            }

            return newFiles
        })

        // 使用防抖的自动保存（仅对临时文件）
        if (currentFile && currentFile.isTemporary && currentFilePath) {
            debouncedAutoSave(currentFilePath, newCode)
        }

        // 使用节流的编辑器内容更新
        throttledEditorUpdate(newCode)
    }, [editorCode, currentFilePath, currentFile, debouncedAutoSave, throttledEditorUpdate])

    // 更新默认文件名
    const updateDefaultFileName = useCallback((newName) => {
        if (!newName.trim()) return false
        setDefaultFileName(newName)
        return true
    }, [])

    // 关闭文件
    const closeFile = useCallback((key) => {
        // 清除相关缓存
        fileCache.delete(`file_${key}`)

        // 停止文件监听（仅对非临时文件）
        if (!key.startsWith('temp://')) {
            try {
                fileApi.stopFileWatching(key)
            } catch (error) {
                console.warn('Failed to stop file watching:', error)
            }
        }

        setOpenedFiles((prev) => {
            // 查找要关闭的文件
            let fileToClose = prev.find(f => f.path === key)

            // 如果直接匹配失败，检查是否是临时文件的 key 格式
            if (!fileToClose && key.startsWith('temp-')) {
                const tempFileName = key.replace('temp-', '')
                fileToClose = prev.find(f => f.isTemporary && f.name === tempFileName)
            }

            if (!fileToClose) return prev

            const newFiles = prev.filter((f) => f !== fileToClose)

            if (fileToClose.path === currentFilePath) {
                const newCurrentPath = newFiles[0]?.path || ''
                setCurrentFilePath(newCurrentPath)

                // 如果关闭后没有剩余文件，自动创建新的临时文件
                if (newFiles.length === 0) {
                    updateDefaultFileName(t('untitled'))
                    setEditorCode('')
                    throttledEditorUpdate('')
                    // 自动创建新的临时文件
                    setTimeout(() => {
                        createFile()
                    }, 0)
                } else {
                    // 切换到第一个文件
                    const firstFile = newFiles[0]
                    setEditorCode(firstFile.content)
                    throttledEditorUpdate(firstFile.content)
                }
            }

            return newFiles
        })
    }, [currentFilePath, updateDefaultFileName, throttledEditorUpdate, createFile])

    // 保存文件
    const saveFile = useCallback(async (saveAs = false) => {
        let targetPath = null // 初始化targetPath

        try {
            const contentToSave = editorCode
            const hasNoOpenFile = !currentFilePath || currentFilePath.startsWith('temp://')

            if (saveAs || hasNoOpenFile) {
                // 另存为或保存新文件
                const result = await fileApi.saveFileDialog(currentFile.name, t, saveAs || hasNoOpenFile)

                if (!result) return { success: false, canceled: true }
                targetPath = result
            } else {
                // 保存现有文件
                targetPath = currentFilePath
            }

            // 标记文件正在被用户主动保存
            userSavingFiles.current.add(targetPath)

            // 检查是否与已打开的文件路径重复（不包括当前文件）
            const duplicateOpenedFile = openedFiles.find(
                (f) => f.path !== currentFilePath && f.path === targetPath
            )

            if (duplicateOpenedFile) {
                // 选择覆盖，关闭已打开的重复文件
                closeFile(duplicateOpenedFile.path)
            }

            // 使用文件的原始编码保存
            const fileEncoding = currentFile.encoding || 'UTF-8'
            const saveResult = await fileApi.saveFile(targetPath, contentToSave, fileEncoding)
            if (!saveResult.success) {
                return { success: false, conflict: true, targetPath }
            }

            // 获取文件名
            const fileName = targetPath.split(/[\\/]/).pop() || 'unknown'

            // 先更新当前文件路径，然后更新文件列表
            setCurrentFilePath(targetPath)

            if (currentFilePath && openedFiles.some((file) => file.path === currentFilePath)) {
                // 如果当前有打开的文件，更新它
                setOpenedFiles((prev) =>
                    prev.map((file) =>
                        file.path === currentFilePath
                            ? {
                                ...file,
                                path: targetPath,
                                name: fileName,
                                isTemporary: false,
                                encoding: saveResult.encoding || fileEncoding, // 使用保存后返回的编码
                                isModified: false,
                                content: contentToSave, // 更新文件内容
                                originalContent: contentToSave // 更新原始内容
                            }
                            : file
                    )
                )
            } else {
                // 如果没有打开的文件，创建一个新的文件标签
                const newFile = {
                    path: targetPath,
                    name: fileName,
                    isTemporary: false,
                    isModified: false,
                    content: contentToSave,
                    originalContent: contentToSave, // 保存原始内容
                    encoding: saveResult.encoding || fileEncoding, // 使用保存后返回的编码
                    lineEnding: saveResult['line_ending'] || 'LF'
                }
                setOpenedFiles((prev) => [...prev, newFile])
            }

            // 如果成功保存了临时文件，重置默认文件名但不清除编辑器内容
            if (hasNoOpenFile) {
                // 立即更新状态，避免UI延迟
                setDefaultFileName(t('common.untitled'))
                // 注意：不清除编辑器内容，保持用户的编辑状态
            }

            // 检查并处理可能的路径冲突
            handlePathConflict(targetPath)

            return { success: true, path: targetPath }
        } catch (error) {
            handleError('fileSaveFailed', error)
            return { success: false, error: error.message || '未知错误' }
        } finally {
            // 清除保存标记
            if (targetPath) {
                userSavingFiles.current.delete(targetPath)
            }
        }
    }, [currentFilePath, openedFiles, editorCode, currentFile, closeFile, handlePathConflict, throttledEditorUpdate])

    // 切换文件
    const switchFile = useCallback((key) => {
        // 首先尝试直接匹配路径
        let target = openedFilesMap.get(key)
        let targetPath = key

        // 如果直接匹配失败，检查是否是临时文件的 key 格式
        if (!target && key.startsWith('temp-')) {
            // 查找匹配的临时文件
            const tempFileName = key.replace('temp-', '')
            const tempFile = openedFiles.find(file =>
                file.isTemporary && file.name === tempFileName
            )
            if (tempFile) {
                target = tempFile
                targetPath = tempFile.path
            }
        }

        if (!target) return

        setCurrentFilePath(targetPath)
        setEditorCode(target.content)

        // 使用节流的编辑器内容更新
        throttledEditorUpdate(target.content)
    }, [openedFilesMap, openedFiles, throttledEditorUpdate])

    // 检查未保存的临时文件和已修改文件
    const getUnsavedFiles = useCallback(() => {
        const unsavedFiles = openedFiles.filter((file) => file.isTemporary || file.isModified)

        // 如果只有一个临时文件且内容为空，不触发未保存判断
        if (unsavedFiles.length === 1 && openedFiles.length === 1) {
            const singleFile = unsavedFiles[0]
            if (singleFile.isTemporary &&
                (singleFile.content === '' || singleFile.content === singleFile.originalContent)) {
                return []
            }
        }

        return unsavedFiles
    }, [openedFiles])

    // 检查当前文件是否有未保存的修改
    const hasUnsavedChanges = useMemo(() => {
        return currentFile && (currentFile.isTemporary || currentFile.isModified)
    }, [currentFile])

    // 另存为文件
    const exportFile = useCallback(async () => {
        await saveFile(true)
    }, [saveFile])

    // 保存指定的文件对象数组
    const saveFiles = useCallback(async (files) => {
        const results = []

        for (let file of files) {
            try {
                let targetPath = file.path
                const isTemp = file.isTemporary

                if (isTemp) {
                    // 如果是临时文件，调用另存为对话框
                    const result = await fileApi.saveFileDialog(file.name, t, true)

                    if (!result) {
                        // 用户取消了保存操作
                        results.push({ path: file.path, success: false, canceled: true })
                        continue
                    }
                    targetPath = result

                    // 检查是否与已打开的文件路径重复（不包括当前文件）
                    const duplicateOpenedFile = openedFiles.find(
                        (f) => f.path !== file.path && f.path === targetPath
                    )

                    if (duplicateOpenedFile) {
                        // 选择覆盖，关闭已打开的重复文件
                        closeFile(duplicateOpenedFile.path)
                    }
                }

                // 使用文件的原始编码保存
                const fileEncoding = file.encoding || 'UTF-8'
                const saveResult = await fileApi.saveFile(targetPath, file.content, fileEncoding)
                if (!saveResult.success) {
                    results.push({ path: file.path, success: false, message: saveResult.message })
                    continue
                }

                results.push({ path: file.path, success: true, newPath: targetPath })

                // 更新文件状态
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
                                encoding: saveResult.encoding || fileEncoding, // 使用保存后返回的编码
                                lineEnding: saveResult['line_ending'] || f.lineEnding || 'LF'
                            }
                            : f
                    )
                )

                // 如果保存的是当前文件，更新当前文件路径
                if (file.path === currentFilePath) {
                    setCurrentFilePath(targetPath)
                }

            } catch (error) {
                results.push({ path: file.path, success: false, error: error.message })
            }
        }

        return results
    }, [fileApi, openedFiles, closeFile, currentFilePath, setOpenedFiles, setCurrentFilePath])

    // 重命名文件
    const renameFile = useCallback(async (oldPath, newName) => {
        try {
            // 检查是否为临时文件
            if (oldPath.startsWith('temp://')) {
                // 对于临时文件，只需要更新内存中的文件信息
                const newTempPath = `temp://${newName}-${Date.now()}`

                // 更新打开的文件列表
                setOpenedFiles((prev) =>
                    prev.map((file) =>
                        file.path === oldPath
                            ? {
                                ...file,
                                path: newTempPath,
                                name: newName
                            }
                            : file
                    )
                )

                // 如果重命名的是当前文件，更新当前文件路径
                if (currentFilePath === oldPath) {
                    setCurrentFilePath(newTempPath)
                }

                return { success: true, newPath: newTempPath }
            }

            // 对于实际文件，使用文件系统API
            if (!oldPath || oldPath.trim() === '') {
                handleError('invalidFilePath', '')
                return { success: false, message: '未提供有效的文件路径' }
            }

            // 构建新的完整路径
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

    // 切换到文件（用于面包屑点击）
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

    // 显示文件冲突解决对话框
    const showFileConflictDialog = useCallback(async (filePath) => {
        return new Promise((resolve) => {
            const fileName = filePath.split(/[\/]/).pop()



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

                        resolve('external')
                    },
                    onCancel: () => {

                        resolve('current')
                    },
                    width: 480,
                    centered: true
                })

            } catch (error) {
                console.error('Error calling Modal.confirm:', error)
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

            if (currentFile.isModified) {



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

                                const fileEncoding = currentFile.encoding || 'UTF-8'
                                const saveResult = await fileApi.saveFile(filePath, currentFile.content, fileEncoding)
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

        setupListener()

        return () => {
            if (unlisten) {

                unlisten()
            }
        }
    }, [])

    // 在编辑器启动时重置默认文件名
    useEffect(() => {
        // 当编辑器初始化时，如果没有打开的文件，重置默认文件名
        if (openedFiles.length === 0) {
            updateDefaultFileName(t('common.untitled'))
            throttledEditorUpdate('')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // 空依赖数组确保只在组件挂载时执行一次

    return {
        // 状态
        currentFile,
        openedFiles,
        currentCode,
        hasUnsavedChanges,

        // 操作函数
        openFile,
        createFile,
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
        updateFileContent
    }
}

// 高性能文件选择器 hooks
export const useFileSelector = (selector, fileManager) => {
    if (!fileManager) throw new Error('useFileSelector必须传入fileManager对象')

    return useMemo(() => selector(fileManager), [fileManager, selector])
}

// 专门用于获取当前文件的hook
export const useCurrentFile = (fileManager) => {
    return useFileSelector(useCallback(state => state.currentFile, []), fileManager)
}

// 专门用于获取打开文件列表的hook
export const useOpenedFiles = (fileManager) => {
    return useFileSelector(useCallback(state => state.openedFiles, []), fileManager)
}

// 专门用于获取文件操作函数的hook
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
