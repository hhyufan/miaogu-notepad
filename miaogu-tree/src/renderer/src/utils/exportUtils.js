/**
 * 树状图PNG导出工具函数
 * 使用浏览器原生API实现DOM转PNG功能
 */

import html2canvas from 'html2canvas';

/**
 * 获取元素的所有计算样式
 * @param {Element} element - DOM元素
 * @returns {Object} 样式对象
 */
const getComputedStyles = (element) => {
  const computedStyle = window.getComputedStyle(element);
  const styles = {};
  
  // 复制所有样式属性
  for (let i = 0; i < computedStyle.length; i++) {
    const property = computedStyle[i];
    styles[property] = computedStyle.getPropertyValue(property);
  }
  
  return styles;
};

/**
 * 将DOM元素转换为SVG
 * @param {Element} element - 要转换的DOM元素
 * @param {Object} options - 配置选项
 * @returns {Promise<string>} SVG字符串
 */
const domToSvg = async (element, options = {}) => {
  const {
    width = element.offsetWidth,
    height = element.offsetHeight,
    backgroundColor = '#ffffff'
  } = options;

  // 创建SVG容器
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // 添加背景
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', '100%');
  background.setAttribute('height', '100%');
  background.setAttribute('fill', backgroundColor);
  svg.appendChild(background);

  // 创建foreignObject来包含HTML内容
  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');

  // 克隆元素并应用样式
  const clonedElement = element.cloneNode(true);
  
  // 递归应用内联样式
  const applyInlineStyles = (original, clone) => {
    const originalStyle = getComputedStyles(original);
    let styleString = '';
    
    // 重要的样式属性
    const importantStyles = [
      'color', 'background-color', 'font-family', 'font-size', 'font-weight',
      'line-height', 'padding', 'margin', 'border', 'border-radius',
      'display', 'flex-direction', 'align-items', 'justify-content',
      'gap', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'
    ];
    
    importantStyles.forEach(prop => {
      if (originalStyle[prop]) {
        styleString += `${prop}: ${originalStyle[prop]}; `;
      }
    });
    
    clone.setAttribute('style', styleString);
    
    // 递归处理子元素
    for (let i = 0; i < original.children.length; i++) {
      if (clone.children[i]) {
        applyInlineStyles(original.children[i], clone.children[i]);
      }
    }
  };

  applyInlineStyles(element, clonedElement);
  
  foreignObject.appendChild(clonedElement);
  svg.appendChild(foreignObject);

  return new XMLSerializer().serializeToString(svg);
};

/**
 * 将SVG转换为PNG
 * @param {string} svgString - SVG字符串
 * @param {Object} options - 配置选项
 * @returns {Promise<Blob>} PNG Blob对象
 */
const svgToPng = (svgString, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      width = 800,
      height = 600,
      scale = 2 // 提高分辨率
    } = options;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = width * scale;
    canvas.height = height * scale;
    
    // 设置高质量渲染
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const img = new Image();
    
    img.onload = () => {
      // 清除画布并设置白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 绘制图像
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob'));
        }
      }, 'image/png', 1.0);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load SVG image'));
    };
    
    // 创建SVG数据URL
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  });
};

/**
 * 保存PNG文件到用户选择的位置
 * @param {Blob} blob - PNG文件数据
 * @param {string} defaultFilename - 默认文件名
 */
const savePngFile = async (blob, defaultFilename) => {
  try {
    // 显示保存对话框
    const result = await window.api.savePngDialog(defaultFilename);
    
    if (result.canceled) {
      return false; // 用户取消了保存
    }
    
    // 将Blob转换为ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // 保存文件
    await window.api.writeBinaryFile(result.filePath, uint8Array);
    
    return true; // 保存成功
  } catch (error) {
    console.error('保存PNG文件失败:', error);
    throw error;
  }
};

/**
 * 导出树状图为PNG
 * @param {Element} treeElement - 树状图DOM元素
 * @param {Object} options - 配置选项
 * @returns {Promise<void>}
 */
export const exportTreeToPNG = async (treeElement, options = {}) => {
  try {
    const {
      filename = `tree-export-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`,
      backgroundColor = '#ffffff',
      scale = 2,
      padding = 20
    } = options;

    // 确定文本颜色（基于背景色判断主题）
    const isDarkTheme = backgroundColor === '#1f1f1f' || backgroundColor === '#2f2f2f' || backgroundColor.includes('rgb(31, 31, 31)');
    const textColor = isDarkTheme ? '#f0f0f0' : '#262626';

    // 临时移除跳跃节点和行内代码的渐变背景样式
    const jumpNodes = treeElement.querySelectorAll('.tree-node-text.has-code, .node-title.has-code');
    const codeNodes = treeElement.querySelectorAll('.tree-node-text.code, code');
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
    const rect = treeElement.getBoundingClientRect();
    const width = rect.width + (padding * 2);
    const height = rect.height + (padding * 2);

    // 创建包装容器来添加内边距
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      padding: ${padding}px;
      background-color: ${backgroundColor};
      width: ${rect.width}px;
      height: ${rect.height}px;
      box-sizing: content-box;
    `;
    
    // 克隆树元素
    const clonedTree = treeElement.cloneNode(true);
    wrapper.appendChild(clonedTree);
    
    // 临时添加到文档中以获取正确的样式
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '-9999px';
    document.body.appendChild(wrapper);

    try {
      // 转换为SVG
      const svgString = await domToSvg(wrapper, {
        width,
        height,
        backgroundColor
      });

      // 转换为PNG
      const pngBlob = await svgToPng(svgString, {
        width,
        height,
        scale
      });

      // 保存文件
      const saved = await savePngFile(pngBlob, filename);
      if (!saved) {
        return { success: false, message: '用户取消了保存' };
      }
      
      return { success: true, message: '导出成功' };
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
      
      // 清理临时元素
      document.body.removeChild(wrapper);
    }
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, message: `导出失败: ${error.message}` };
  }
};

/**
 * 使用html2canvas库导出（如果可用）
 * @param {Element} element - 要导出的元素
 * @param {Object} options - 配置选项
 * @returns {Promise<void>}
 */
export const exportWithHtml2Canvas = async (element, options = {}) => {
  // 检查html2canvas是否可用
  if (typeof html2canvas === 'undefined') {
    throw new Error('html2canvas library is not available');
  }

  const {
    filename = `tree-export-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`,
    backgroundColor = '#ffffff',
    scale = 2
  } = options;

  // 确定文本颜色（基于背景色判断主题）
  const isDarkTheme = backgroundColor === '#0f1419' || backgroundColor === '#1f1f1f' || backgroundColor === '#2f2f2f' || backgroundColor === '#1e3a5f' || backgroundColor.includes('rgb(15, 20, 25)') || backgroundColor.includes('rgb(31, 31, 31)') || backgroundColor.includes('rgb(30, 58, 95)');
  const textColor = isDarkTheme ? '#f0f6fc' : '#262626';

  // 临时移除跳跃节点和行内代码的渐变背景样式
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

  try {
    const canvas = await html2canvas(element, {
      backgroundColor,
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight
    });

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            const saved = await savePngFile(blob, filename);
            if (!saved) {
              resolve({ success: false, message: '用户取消了保存' });
            } else {
              resolve({ success: true, message: '导出成功' });
            }
          } catch (error) {
            resolve({ success: false, message: `保存失败: ${error.message}` });
          }
        } else {
          resolve({ success: false, message: '生成图片失败' });
        }
      }, 'image/png', 1.0);
    });
  } catch (error) {
    console.error('html2canvas export failed:', error);
    return { success: false, message: `导出失败: ${error.message}` };
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
};

export default {
  exportTreeToPNG,
  exportWithHtml2Canvas,
  savePngFile
};