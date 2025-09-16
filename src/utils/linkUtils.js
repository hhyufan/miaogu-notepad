/**
 * @fileoverview 链接处理工具函数 - 处理超链接的跳转逻辑
 * 支持本地文件路径和外部链接的识别与处理
 * @author hhyufan
 * @version 1.2.0
 */

import { invoke } from '@tauri-apps/api/core';
import { exists } from '@tauri-apps/plugin-fs';
import { resolvePath } from './pathUtils';

/**
 * 检查是否为外部链接
 * @param {string} href - 链接地址
 * @returns {boolean} 是否为外部链接
 */
export const isExternalLink = (href) => {
  if (!href) return false;
  
  // 检查是否为HTTP/HTTPS链接
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return true;
  }
  
  // 检查是否为其他协议链接
  const protocolRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
  return protocolRegex.test(href);
};

/**
 * 检查是否为本地文件链接
 * @param {string} href - 链接地址
 * @param {string} currentFolder - 当前文件夹路径
 * @returns {Promise<{isLocal: boolean, fullPath?: string}>}
 */
export const checkLocalFile = async (href, currentFolder) => {
  if (!href || !currentFolder) {
    return { isLocal: false };
  }
  
  try {
    // 解析相对路径为绝对路径
    const fullPath = resolvePath(currentFolder, href);
    
    // 直接使用Node.js的fs模块检查文件是否存在（避免Tauri权限问题）
    try {
      const fileExists = await exists(fullPath);
      return {
        isLocal: fileExists,
        fullPath: fileExists ? fullPath : undefined
      };
    } catch (fsError) {
      // 如果Tauri fs检查失败，尝试直接打开文件
      console.warn('Tauri fs检查失败，尝试直接处理:', fsError);
      return {
        isLocal: true, // 假设是本地文件，让后续处理决定
        fullPath: fullPath
      };
    }
  } catch (error) {
    console.warn('检查本地文件失败:', error);
    return { isLocal: false };
  }
};

/**
 * 处理链接点击事件
 * @param {string} href - 链接地址
 * @param {string} currentFolder - 当前文件夹路径
 * @param {Function} openFile - 打开文件的回调函数
 * @returns {Promise<boolean>} 是否成功处理
 */
export const handleLinkClick = async (href, currentFolder, openFile) => {
  if (!href) return false;
  
  try {
    // 检查是否为外部链接
    if (isExternalLink(href)) {
      // 使用系统默认浏览器打开外部链接
      await invoke('open_url', { url: href });
      return true;
    }
    
    // 检查是否为本地文件
    const { isLocal, fullPath } = await checkLocalFile(href, currentFolder);
    
    if (isLocal && fullPath) {
      // 在新标签页打开本地文件
      if (openFile) {
        await openFile(fullPath);
        return true;
      }
    }
    
    // 如果不是本地文件，尝试作为外部链接处理
    if (href.includes('.') || href.includes('/')) {
      await invoke('open_url', { url: href });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('处理链接点击失败:', error);
    return false;
  }
};

/**
 * 为链接元素添加点击处理
 * @param {HTMLElement} linkElement - 链接元素
 * @param {string} currentFolder - 当前文件夹路径
 * @param {Function} openFile - 打开文件的回调函数
 */
export const attachLinkHandler = (linkElement, currentFolder, openFile) => {
  if (!linkElement || linkElement.dataset.linkHandlerAttached) {
    return;
  }
  
  const href = linkElement.getAttribute('href');
  if (!href) return;
  
  // 标记已处理，避免重复绑定
  linkElement.dataset.linkHandlerAttached = 'true';
  
  linkElement.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const success = await handleLinkClick(href, currentFolder, openFile);
    
    if (!success) {
      console.warn('无法处理链接:', href);
    }
  });
  
  // 添加视觉提示
  linkElement.style.cursor = 'pointer';
  linkElement.title = isExternalLink(href) ? '在浏览器中打开' : '在新标签页中打开';
};