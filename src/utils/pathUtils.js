/**
 * @fileoverview 路径处理工具函数 - 提供跨平台的路径操作功能
 * 支持Windows和Unix/Linux路径格式的处理和转换
 * @author hhyufan
 * @version 1.3.1
 */

/**
 * 分割文件路径为路径段
 * @param {string} filePath - 文件路径
 * @returns {string[]} 路径段数组
 */
export const splitPath = (filePath) => {
    if (!filePath || typeof filePath !== 'string') {
        return []
    }

    if (/^[A-Z]:\\/i.test(filePath)) {
        const parts = filePath.split('\\')
        const drive = parts[0] + '\\' // 保留盘符格式如 "C:\\"
        const restParts = parts.slice(1).filter(Boolean)
        return [drive, ...restParts]
    }

    // 处理Unix/Linux路径
    if (filePath.startsWith('/')) {
        const parts = filePath.split('/').filter(Boolean)
        return parts
    }

    // 处理相对路径
    return filePath.split(/[\\/]/).filter(Boolean)
}

/**
 * 构建完整路径
 * @param {string[]} pathSegments - 路径段数组
 * @param {number} index - 截止到的索引
 * @returns {string} 完整路径
 */
export const buildFullPath = (pathSegments, index) => {
    if (!pathSegments || index < 0 || index >= pathSegments.length) {
        return ''
    }

    // Windows路径处理
    if (pathSegments[0] && pathSegments[0].endsWith('\\')) {
        const segments = pathSegments.slice(0, index + 1)
        if (index === 0) {
            return segments[0] // 返回 "C:\"
        }
        return segments[0] + segments.slice(1).join('\\')
    }

    // Unix/Linux路径处理
    const segments = pathSegments.slice(0, index + 1)
    return '/' + segments.join('/')
}

/**
 * 获取文件名（不含路径）
 * @param {string} filePath - 文件路径
 * @returns {string} 文件名
 */
export const getFileName = (filePath) => {
    if (!filePath || typeof filePath !== 'string') {
        return ''
    }
    return filePath.split(/[\\/]/).pop() || ''
}

/**
 * 获取文件扩展名
 * @param {string} fileName - 文件名
 * @returns {string} 扩展名（包含点号）
 */
export const getFileExtension = (fileName) => {
    if (!fileName || typeof fileName !== 'string') {
        return ''
    }
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ''
}

/**
 * 检查是否为目录路径（以分隔符结尾）
 * @param {string} path - 路径
 * @returns {boolean} 是否为目录
 */
export const isDirectoryPath = (path) => {
    if (!path || typeof path !== 'string') {
        return false
    }
    return path.endsWith('/') || path.endsWith('\\')
}

/**
 * 规范化路径分隔符
 * @param {string} path - 路径
 * @param {string} separator - 目标分隔符（默认为系统分隔符）
 * @returns {string} 规范化后的路径
 */
export const normalizePath = (path, separator = null) => {
    if (!path || typeof path !== 'string') {
        return ''
    }

    // 如果没有指定分隔符，根据系统判断
    if (!separator) {
        separator = navigator.platform.toLowerCase().includes('win') ? '\\' : '/'
    }

    return path.replace(/[\\/]/g, separator)
}

/**
 * 解析相对路径，支持../父级目录引用
 * @param {string} basePath - 基础路径（当前文件所在目录）
 * @param {string} relativePath - 相对路径
 * @returns {string} 解析后的绝对路径
 */
export const resolvePath = (basePath, relativePath) => {
    if (!basePath || !relativePath) {
        return relativePath || ''
    }

    // 如果相对路径已经是绝对路径，直接返回
    if (relativePath.startsWith('http') || relativePath.startsWith('https') ||
        relativePath.startsWith('data:') || /^[A-Za-z]:\\/.test(relativePath) ||
        relativePath.startsWith('/')) {
        return relativePath
    }

    // 规范化路径分隔符 - 统一使用 / 进行处理
    const normalizedBase = basePath.replace(/\\/g, '/')
    const normalizedRelative = relativePath.replace(/\\/g, '/')

    // 分割路径为段
    let baseSegments = normalizedBase.split('/').filter(Boolean)
    const relativeSegments = normalizedRelative.split('/').filter(Boolean)

    // 对于Windows路径，需要特殊处理盘符
    let driveLetter = ''
    if (/^[A-Za-z]:/.test(basePath)) {
        driveLetter = baseSegments[0] // 例如 "C:"
        baseSegments = baseSegments.slice(1) // 移除盘符段
    }

    // 处理相对路径段
    const resultSegments = [...baseSegments]

    for (const segment of relativeSegments) {
        if (segment === '..') {
            // 返回上级目录
            if (resultSegments.length > 0) {
                resultSegments.pop()
            }
        } else if (segment !== '.') {
            // 添加当前段（忽略.当前目录）
            resultSegments.push(segment)
        }
    }

    // 重新构建路径
    let resolvedPath

    // 如果原始基础路径是Windows绝对路径
    if (driveLetter) {
        resolvedPath = driveLetter + '\\' + resultSegments.join('\\')
    } else if (basePath.startsWith('/')) {
        // Unix/Linux绝对路径
        resolvedPath = '/' + resultSegments.join('/')
    } else {
        // 相对路径
        resolvedPath = resultSegments.join('/')
    }

    return resolvedPath
}
