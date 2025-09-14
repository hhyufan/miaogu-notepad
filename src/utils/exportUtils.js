/**
 * 树状图导出工具函数
 * 适用于Tauri环境的版本
 */

import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { getI18n } from '../i18n';

/**
 * 将DOM元素转换为Canvas并导出为PNG
 * @param {Element} element - 要导出的DOM元素
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} 导出结果
 */
export const exportWithHtml2Canvas = async (element, options = {}) => {
  try {
    const {
      filename = `tree-export-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`,
      backgroundColor = '#ffffff',
      scale = 2
    } = options;

    // 确定文本颜色（基于背景色判断主题）
    const isDarkTheme = backgroundColor === '#1f1f1f' || backgroundColor === '#2f2f2f' || backgroundColor.includes('rgb(31, 31, 31)');
    const textColor = isDarkTheme ? '#f0f0f0' : '#262626';

    // 临时移除渐变背景样式，避免导出时样式问题
    const jumpNodes = element.querySelectorAll('.tree-node-text.has-code, .node-title.has-code');
    const codeNodes = element.querySelectorAll('.tree-node-text.code, code');
    const originalJumpStyles = [];
    const originalCodeStyles = [];

    // 处理跳跃节点样式
    jumpNodes.forEach((node, index) => {
      originalJumpStyles[index] = {
        background: node.style.background,
        webkitBackgroundClip: node.style.webkitBackgroundClip,
        webkitTextFillColor: node.style.webkitTextFillColor,
        backgroundClip: node.style.backgroundClip,
        color: node.style.color
      };

      // 移除渐变样式，设置纯色
      node.style.background = 'none';
      node.style.webkitBackgroundClip = 'initial';
      node.style.webkitTextFillColor = 'initial';
      node.style.backgroundClip = 'initial';
      node.style.color = textColor;
    });

    // 处理行内代码样式
    codeNodes.forEach((node, index) => {
      originalCodeStyles[index] = {
        background: node.style.background,
        webkitBackgroundClip: node.style.webkitBackgroundClip,
        webkitTextFillColor: node.style.webkitTextFillColor,
        backgroundClip: node.style.backgroundClip,
        color: node.style.color
      };

      // 移除渐变样式，设置纯色
      node.style.background = 'none';
      node.style.webkitBackgroundClip = 'initial';
      node.style.webkitTextFillColor = 'initial';
      node.style.backgroundClip = 'initial';
      node.style.color = textColor;
    });

    // 获取元素尺寸
    const rect = element.getBoundingClientRect();
    const padding = 20;
    const width = rect.width + (padding * 2);
    const height = rect.height + (padding * 2);

    // 创建Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = width * scale;
    canvas.height = height * scale;

    // 设置高质量渲染
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 设置背景色
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 使用简单的DOM到Canvas转换
    // 注意：这是一个简化版本，实际项目中可能需要html2canvas库
    await new Promise((resolve) => {
      // 创建SVG foreignObject来包含HTML内容
      const data = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="padding: ${padding}px; background-color: ${backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${element.outerHTML}
            </div>
          </foreignObject>
        </svg>
      `;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };

      img.onerror = () => {
        // 如果SVG方法失败，使用纯色填充作为后备
        ctx.fillStyle = textColor;
        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const { t } = getI18n();
        ctx.fillText(t('export.treeExport'), padding, padding + 20);
        resolve();
      };

      const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.src = url;
    });

    // 转换为Blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png', 1.0);
    });

    if (!blob) {
      throw new Error('Failed to create PNG blob');
    }

    try {
      // 使用Tauri的保存对话框
      const filePath = await save({
        defaultPath: filename,
        filters: [{
          name: 'PNG Images',
          extensions: ['png']
        }]
      });

      if (!filePath) {
        const { t } = getI18n();
        return { success: false, message: t('export.userCancelled') };
      }

      // 将Blob转换为ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 使用Tauri API保存文件
      await writeFile(filePath, uint8Array);

      const { t } = getI18n();
      return { success: true, message: t('export.exportSuccess') };
    } catch (error) {
      throw error;
    } finally {
      // 恢复跳跃节点原始样式
      jumpNodes.forEach((node, index) => {
        if (originalJumpStyles[index]) {
          node.style.background = originalJumpStyles[index].background || '';
          node.style.webkitBackgroundClip = originalJumpStyles[index].webkitBackgroundClip || '';
          node.style.webkitTextFillColor = originalJumpStyles[index].webkitTextFillColor || '';
          node.style.backgroundClip = originalJumpStyles[index].backgroundClip || '';
          node.style.color = originalJumpStyles[index].color || '';
        }
      });

      // 恢复行内代码原始样式
      codeNodes.forEach((node, index) => {
        if (originalCodeStyles[index]) {
          node.style.background = originalCodeStyles[index].background || '';
          node.style.webkitBackgroundClip = originalCodeStyles[index].webkitBackgroundClip || '';
          node.style.webkitTextFillColor = originalCodeStyles[index].webkitTextFillColor || '';
          node.style.backgroundClip = originalCodeStyles[index].backgroundClip || '';
          node.style.color = originalCodeStyles[index].color || '';
        }
      });
    }
  } catch (error) {
    const { t } = getI18n();
    return { success: false, message: t('export.exportFailed', { error: error.message }) };
  }
};

/**
 * 导出树状图为PNG（主要导出函数）
 * @param {Element} treeElement - 树状图DOM元素
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} 导出结果
 */
export const exportTreeToPNG = async (treeElement, options = {}) => {
  return await exportWithHtml2Canvas(treeElement, options);
};

export default {
  exportTreeToPNG,
  exportWithHtml2Canvas
};