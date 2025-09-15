import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Typography, Image, message } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import 'prismjs/plugins/autoloader/prism-autoloader';
import { theme } from 'antd';
import TreeViewer from './TreeViewer';
import MermaidRenderer from './MermaidRenderer';
import { useTheme } from '../hooks/redux';
import { useI18n } from '../hooks/useI18n';
import tauriApi from '../utils/tauriApi';
import { convertFileSrc } from '@tauri-apps/api/core';
const { settings: settingsApi } = tauriApi;

const { useToken } = theme;

// 配置必须在模块作用域
Prism.plugins.autoloader.languages_path =
  'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/';
Prism.languages.vue = Prism.languages.html; // 提前注册扩展语言

// AutoTreeH1 组件：自动检测并渲染对应的 TreeViewer
const AutoTreeH1 = ({ titleText, isDarkMode, containerRef, children, currentFileName, currentFolder }) => {
  const [treeFilePath, setTreeFilePath] = useState(null);

  useEffect(() => {
    const checkTreeFile = async () => {
      // 提取并清理标题文本
      const cleanTitle = titleText.trim();

      // 构建可能的 mgtree 文件路径
      const possiblePaths = [
        `trees/${cleanTitle}.mgtree`,
        `${cleanTitle}.mgtree`
      ];

      // 快速检查是否存在对应的 mgtree 文件
      for (const path of possiblePaths) {
        try {
          // 使用file协议直接访问本地文件系统
          let fullUrl;
          if (currentFolder) {
            // 构建完整的本地文件路径
            const separator = currentFolder.includes('\\') ? '\\' : '/';
            let fullPath;
            // 去除path中可能存在的trees前缀，避免重复
            const cleanPath = path.startsWith('trees/') ? path.replace('trees/', '') : path;
            // 检查currentFolder是否已经包含trees目录，避免重复添加
            if (currentFolder.endsWith('trees') || currentFolder.endsWith('trees/') || currentFolder.endsWith('trees\\')) {
              fullPath = `${currentFolder}${separator}${cleanPath}`;
            } else {
              fullPath = `${currentFolder}${separator}trees${separator}${cleanPath}`;
            }
            // 使用Tauri的convertFileSrc转换本地文件路径
            try {
              fullUrl = convertFileSrc(fullPath);
            } catch (error) {
              console.warn('Tauri路径转换失败:', error);
              fullUrl = `file:///${fullPath.replace(/\\/g, '/')}`;
            }
          } else {
            // 如果没有目录信息，尝试相对路径
            const relativePath = `trees/${path}`;
            try {
              fullUrl = convertFileSrc(relativePath);
            } catch (error) {
              console.warn('Tauri相对路径转换失败:', error);
              fullUrl = `file:///${relativePath}`;
            }
          }
          const response = await fetch(fullUrl);

          if (response.ok) {
            // 检查响应内容类型和实际内容
            const contentType = response.headers.get('content-type');
            const text = await response.text();

            // 确保不是HTML错误页面，且有实际内容
            if (text.trim().length > 0 && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
              // 如果文件在trees目录下，只传递文件名给TreeViewer
              const fileName = path.startsWith('trees/') ? path.replace('trees/', '') : path;
              setTreeFilePath(fileName);
              return;
            }
          }
        } catch (error) {
          // 继续检查下一个路径
        }
      }
      // 没有找到有效文件，不显示任何内容
      setTreeFilePath(null);
    };

    if (titleText) {
      checkTreeFile();
    } else {
      setTreeFilePath(null);
    }
  }, [titleText, currentFolder]);

  const handleJumpToCode = useCallback((jumpLanguage, jumpIndex) => {


    // 查找对应语言和索引的代码块
    const codeBlocks = containerRef.current?.querySelectorAll(`pre.language-${jumpLanguage}`) || [];


    if (codeBlocks.length >= jumpIndex && jumpIndex > 0) {
      const targetPre = codeBlocks[jumpIndex - 1]; // 索引从1开始，数组从0开始


      // 滚动到目标代码块
      targetPre.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // 添加高亮效果

      targetPre.style.setProperty('transition', 'all 0.3s ease', 'important');
      targetPre.style.setProperty('border', '1px solid rgba(24, 144, 255, 0.5)', 'important');
      targetPre.style.setProperty('border-radius', '4px', 'important');

      // 3秒后移除高亮效果
      setTimeout(() => {

        targetPre.style.removeProperty('border');
        targetPre.style.removeProperty('border-radius');
      }, 3000);
    } else {

    }
  }, [containerRef]);



  return (
    <div>
      <h1 style={{
        fontSize: '2rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        color: isDarkMode ? '#f9fafb' : '#111827',
        borderBottom: `2px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
        paddingBottom: '0.5rem'
      }}>
        {children}
      </h1>
      {treeFilePath && (
        <div style={{ marginBottom: '1.5rem' }}>
          <TreeViewer
            treeFilePath={treeFilePath}
            onJumpToCode={handleJumpToCode}
            currentFileName={currentFileName}
            currentFolder={currentFolder}
          />
        </div>
      )}
    </div>
  );
};

// 基础样式函数，接收token参数
const getBaseStyle = (token) => ({
  color: token.colorText,
  fontFamily: "'Poppins', sans-serif"
});

const getTextStyle = (token) => ({
  ...getBaseStyle(token),
  fontSize: '1rem',
  lineHeight: 1.6
});

const getHeadingStyle = (token) => ({
  ...getBaseStyle(token),
  margin: '1.2em 0 0.6em',
  lineHeight: 1.2
});

const getQuoteStyle = (token, isDarkMode) => ({
  ...getBaseStyle(token),
  borderLeft: `4px solid ${token.colorPrimary}`,
  paddingLeft: '1rem',
  margin: '1rem 0',
  fontStyle: 'normal',
  background: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
  border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: isDarkMode ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
  padding: '1rem',
  borderRadius: '12px'
});

const getListStyle = (token) => ({
  ...getBaseStyle(token),
  paddingLeft: '1.5rem',
  margin: '1rem 0'
});

const getListItemStyle = (token) => ({
  ...getBaseStyle(token),
  margin: '0.4rem 0'
});

const getLinkStyle = (token) => ({
  ...getBaseStyle(token),
  color: token.colorPrimary,
  textDecoration: 'underline'
});

const getHrStyle = (token) => ({
  ...getBaseStyle(token),
  border: 0,
  borderTop: `1px solid ${token.colorBorder}`,
  margin: '1.5rem 0'
});

const getTableStyle = (token, isDarkMode) => ({
  ...getBaseStyle(token),
  borderCollapse: 'collapse',
  margin: '1rem 0',
  border: `2px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)'}`,
  width: '100%',
  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: isDarkMode ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 8px 32px rgba(0, 0, 0, 0.1)'
});

const getTableHeadStyle = (token, isDarkMode) => ({
  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.03)',
  borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'}`
});

const getTableCellStyle = (token, isDarkMode) => ({
  ...getBaseStyle(token),
  border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`,
  padding: '0.75rem 1rem',
  backgroundColor: 'transparent'
});

const getTableHeaderStyle = (token, isDarkMode) => ({
  ...getBaseStyle(token),
  border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`,
  padding: '0.75rem 1rem',
  fontWeight: 600,
  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.03)',
  textAlign: 'left'
});

// 语言显示名称映射表
const LANGUAGE_DISPLAY_MAP = {
  html: 'HTML',
  xml: 'XML',
  sql: 'SQL',
  css: 'CSS',
  cpp: 'C++',
  sass: 'Sass',
  scss: 'Sass',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  php: 'PHP',
  md: 'Markdown',
  yml: 'YAML',
  yaml: 'YAML',
  json: 'JSON',
  rb: 'Ruby',
  java: 'Java',
  c: 'C',
  go: 'Go',
  rust: 'Rust',
  kotlin: 'Kotlin',
  swift: 'Swift',
  mermaid: 'Mermaid'
};

const MarkdownRenderer = React.memo(({ content, currentFileName, currentFolder, isDarkMode }) => {
  const containerRef = useRef(null);
  const { token } = useToken();
  const { t } = useI18n();

  // 使用useMemo来稳定content，避免不必要的重新渲染
  const memoizedContent = useMemo(() => content, [content]);

  // 监听主题变化并更新样式
  useEffect(() => {

    // 更新主题样式
    const updateTheme = () => {
      // 移除现有的主题样式
      const existingStyle = document.getElementById('prism-theme');
      if (existingStyle) {
        existingStyle.remove();
      }

      // 创建link元素来加载CSS文件
      const link = document.createElement('link');
      link.id = 'prism-theme';
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = isDarkMode ? '/prism-one-dark.css' : '/prism-one-light.css';
      document.head.appendChild(link);
    };

    updateTheme();

    return () => {
      // 清理主题样式
      const existingStyle = document.getElementById('prism-theme');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [isDarkMode]);

  // 复制到剪贴板的函数
  const handleCopyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(t('message.success.copiedToClipboard'));
    } catch (err) {
      message.error(t('message.error.copyFailed'));
    }
  }, []);

  // 清理语言标签
  const cleanupLabels = useCallback(() => {
    const existingLabels = containerRef.current?.querySelectorAll('.lang-tag') || [];
    existingLabels.forEach(label => label.remove());
  }, []);

  // 添加语言标签
  const addLanguageLabels = useCallback(() => {
    cleanupLabels();

    const codeBlocks = containerRef.current?.querySelectorAll('code') || [];

    codeBlocks.forEach((code) => {
      const pre = code.closest('pre');
      if (!pre) return;

      // 提取语言类型
      const langClass = [...code.classList].find((c) => c.startsWith('language-'));
      const rawLang = langClass ? langClass.split('-')[1] || '' : '';
      const langKey = rawLang.toLowerCase();

      // 获取显示名称
      let displayLang = LANGUAGE_DISPLAY_MAP[langKey];

      // 处理未定义的特殊情况
      if (!displayLang) {
        const versionMatch = langKey.match(/^(\D+)(\d+)$/);
        if (versionMatch) {
          displayLang = `${versionMatch[1].charAt(0).toUpperCase()}${versionMatch[1].slice(
            1
          )} ${versionMatch[2]}`;
        } else {
          displayLang = langKey.charAt(0).toUpperCase() + langKey.slice(1);
        }
      }

      // 创建标签
      const tag = document.createElement('button');
      tag.className = 'lang-tag';
      // 样式由CSS文件控制，不设置内联样式

      // 设置显示名称
      tag.textContent = displayLang;

      // 添加点击事件
      tag.addEventListener('click', () => {
        handleCopyToClipboard(code.textContent);
      });

      // 设置pre的相对定位
      pre.style.position = 'relative';
      pre.appendChild(tag);
    });
  }, [token, handleCopyToClipboard, cleanupLabels]);

  // 高亮代码并添加语言标签
  const highlightCode = useCallback(() => {
    if (containerRef?.current) {
      Prism.highlightAllUnder(containerRef?.current);
    }
    addLanguageLabels();
  }, [addLanguageLabels]);

  // 在内容更新后高亮代码
  useEffect(() => {
    const timer = setTimeout(() => {
      highlightCode();
    }, 100);

    return () => clearTimeout(timer);
  }, [memoizedContent, highlightCode]);

  return (
    <div ref={containerRef}>
      {React.useMemo(() => (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml={false}
          components={{
            h1: ({ children }) => {
              const titleText = typeof children === 'string' ? children :
                (Array.isArray(children) ? children.join('') : String(children));
              return (
                <AutoTreeH1
                  titleText={titleText}
                  isDarkMode={isDarkMode}
                  containerRef={containerRef}
                  currentFileName={currentFileName}
                  currentFolder={currentFolder}
                >
                  {children}
                </AutoTreeH1>
              );
            },
            h2: ({ children }) => <h2 style={{ ...getHeadingStyle(token), fontSize: '1.5rem' }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ ...getHeadingStyle(token), fontSize: '1.25rem' }}>{children}</h3>,
            h4: ({ children }) => <h4 style={{ ...getHeadingStyle(token), fontSize: '1.125rem' }}>{children}</h4>,
            h5: ({ children }) => <h5 style={{ ...getHeadingStyle(token), fontSize: '1rem' }}>{children}</h5>,
            h6: ({ children }) => <h6 style={{ ...getHeadingStyle(token), fontSize: '0.875rem' }}>{children}</h6>,
            p: ({ children }) => <p style={getTextStyle(token)}>{children}</p>,
            blockquote: ({ children }) => <blockquote style={getQuoteStyle(token, isDarkMode)}>{children}</blockquote>,
            ul: ({ children }) => <ul style={getListStyle(token)}>{children}</ul>,
            ol: ({ children }) => <ol style={getListStyle(token)}>{children}</ol>,
            li: ({ children }) => <li style={getListItemStyle(token)}>{children}</li>,
            a: ({ children, href }) => (
              <a href={href} style={getLinkStyle(token)}>
                {children}
              </a>
            ),
            em: ({ children }) => <em style={getTextStyle(token)}>{children}</em>,
            strong: ({ children }) => <strong style={{ ...getTextStyle(token), fontWeight: 600 }}>{children}</strong>,
            hr: () => <hr style={getHrStyle(token)} />,
            table: ({ children }) => (
              <table
                style={getTableStyle(token, isDarkMode)}
                data-theme={isDarkMode ? 'dark' : 'light'}
              >
                {children}
              </table>
            ),
            thead: ({ children }) => (
              <thead
                style={getTableHeadStyle(token, isDarkMode)}
                data-theme={isDarkMode ? 'dark' : 'light'}
              >
                {children}
              </thead>
            ),
            td: ({ children }) => (
              <td
                style={getTableCellStyle(token, isDarkMode)}
                data-theme={isDarkMode ? 'dark' : 'light'}
              >
                {children}
              </td>
            ),
            th: ({ children }) => (
              <th
                style={getTableHeaderStyle(token, isDarkMode)}
                data-theme={isDarkMode ? 'dark' : 'light'}
              >
                {children}
              </th>
            ),
            img: ({ src, alt, ...props }) => {
              // 处理图片路径，基于当前md文件的路径
              let imageSrc = src;

              // URL解码处理
              let decodedSrc = src;
              try {
                decodedSrc = decodeURIComponent(src);

              } catch (e) {
                console.warn('URL解码失败:', e);
              }

              if (decodedSrc && !decodedSrc.startsWith('http') && !decodedSrc.startsWith('https') && !decodedSrc.startsWith('data:')) {
                // 相对路径处理：基于当前md文件所在目录
                if (currentFolder && currentFileName) {
                  // 检查currentFolder是否是绝对路径（Windows: C:\ 或 Unix: /）
                  const isAbsolutePath = /^[A-Za-z]:\\/.test(currentFolder) || currentFolder.startsWith('/');

                  let fullPath;
                  if (isAbsolutePath) {
                    // 绝对路径：直接拼接
                    const separator = currentFolder.includes('\\') ? '\\' : '/';
                    fullPath = `${currentFolder}${separator}${decodedSrc}`;
                  } else {
                    // 相对路径：添加前缀
                    const basePath = currentFolder.startsWith('/') ? currentFolder : `/${currentFolder}`;
                    fullPath = `${basePath}/${decodedSrc}`;
                  }

                  // 使用Tauri的convertFileSrc转换本地文件路径
                  try {
                    imageSrc = convertFileSrc(fullPath);

                  } catch (error) {
                    console.warn('Tauri路径转换失败:', error);
                    imageSrc = fullPath;
                  }
                } else {
                  // 如果没有目录信息，尝试相对于根目录
                  const rootPath = `/${decodedSrc}`;
                  try {
                    imageSrc = convertFileSrc(rootPath);

                  } catch (error) {
                    console.warn('Tauri根目录路径转换失败:', error);
                    imageSrc = rootPath;
                  }
                }
              } else if (decodedSrc?.startsWith('images/')) {
                const rootPath = `/${decodedSrc}`;
                try {
                  imageSrc = convertFileSrc(rootPath);
                } catch (error) {
                  imageSrc = rootPath;
                }
              } else {
                imageSrc = decodedSrc;
              }

              return (
                <Image
                  src={imageSrc}
                  alt={alt}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '500px',
                    width: 'auto',
                    height: 'auto',
                    borderRadius: '4px',
                    boxShadow: token.boxShadow,
                    border: `1px solid ${token.colorBorder}`,
                    margin: '1rem 0',
                    display: 'block',
                    objectFit: 'contain'
                  }}
                  preview={{
                    mask: t('common.clickToPreview'),
                    maskClassName: 'custom-mask'
                  }}
                  {...props}
                />
              );
            },
            code: ({ className, children, inline, ...props }) => {
              const language = className?.replace('language-', '') || '';

              // 处理树状图
              if (!inline && language === 'tree') {
                const treeContent = String(children).replace(/\n$/, '');

                // 创建跳转到代码块的回调函数
                const handleJumpToCode = (jumpLanguage, jumpIndex) => {


                  // 查找对应语言和索引的代码块
                  const codeBlocks = containerRef.current?.querySelectorAll(`pre.language-${jumpLanguage}`) || [];


                  if (codeBlocks.length >= jumpIndex && jumpIndex > 0) {
                    const targetCodeBlock = codeBlocks[jumpIndex - 1]; // 索引从1开始，数组从0开始
                    const targetPre = targetCodeBlock.closest('pre');


                    if (targetPre) {
                      // 滚动到目标代码块
                      targetPre.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                      });

                      // 添加高亮效果

                      targetPre.style.setProperty('transition', 'all 0.3s ease', 'important');
                      targetPre.style.setProperty('border', '1px solid rgba(24, 144, 255, 0.5)', 'important');
                      targetPre.style.setProperty('border-radius', '4px', 'important');

                      // 3秒后移除高亮效果
                      setTimeout(() => {

                        targetPre.style.removeProperty('border');
                        targetPre.style.removeProperty('border-radius');
                      }, 3000);
                    }
                  } else {

                    message.error(`未找到${jumpLanguage}代码示例#${jumpIndex}`);
                  }
                };

                const trimmedContent = treeContent.trim();

                // 检查是否是@tree()引用语法
                const refMatch = trimmedContent.match(/^@tree\((.+)\)$/);
                if (refMatch) {
                  // @tree()语法支持外部文件引用
                  let refPath = refMatch[1].trim();
                  // 如果没有扩展名，自动添加.mgtree
                  if (!refPath.includes('.')) {
                    refPath += '.mgtree';
                  }
                  return <TreeViewer treeFilePath={refPath} onJumpToCode={handleJumpToCode} currentFileName={currentFileName} currentFolder={currentFolder} />;
                } else {
                  // ```tree代码块只支持内容渲染
                  return <TreeViewer treeContent={treeContent} onJumpToCode={handleJumpToCode} currentFileName={currentFileName} currentFolder={currentFolder} />;
                }
              }

              // 处理Mermaid图表
              if (!inline && language === 'mermaid') {
                const mermaidCode = String(children).replace(/\n$/, '');
                return <MermaidRenderer code={mermaidCode} isDarkMode={isDarkMode} />;
              }

              return !inline && language ? (
                <pre
                  className={`language-${language}`}
                  style={{
                    position: 'relative',
                    overflow: 'auto',
                    fontSize: '1rem',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Fira Mono', Consolas, Menlo, Courier, monospace !important"
                  }}
                >
                  <code className={className} {...props} style={{
                    fontSize: '0.9rem',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Fira Mono', Consolas, Menlo, Courier, monospace !important"
                  }}>
                    {children}
                  </code>
                </pre>
              ) : (
                <code style={{
                  backgroundColor: isDarkMode ? '#201f1b' : '#e6f3ff',
                  color: isDarkMode ? '#d1d5db' : '#374151',
                  padding: '3px 6px',
                  margin: '0 6px',
                  borderRadius: '4px',
                  fontSize: '0.9em',
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Fira Mono', Consolas, Menlo, Courier, monospace",
                  fontWeight: '500',
                  border: `1px solid ${isDarkMode ? '#2563eb' : '#93c5fd'}`
                }}{...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {memoizedContent}
        </ReactMarkdown>
      ), [memoizedContent, token, isDarkMode, currentFileName, currentFolder])}
    </div>
  );
});

const MarkdownViewer = ({ content, fileName, currentFolder, onClose }) => {
  const { theme: currentTheme } = useTheme();
  const { t } = useI18n();
  const localIsDarkMode = currentTheme === 'dark';
  const [zoomLevel, setZoomLevel] = useState(1); // 缩放级别，1为默认大小
  const containerRef = useRef(null);

  // 鼠标滚轮缩放功能
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1; // 向下滚动缩小，向上滚动放大
        setZoomLevel(prev => {
          const newZoom = prev + delta;
          // 限制缩放范围在0.5到3之间
          return Math.max(0.5, Math.min(3, newZoom));
        });
      }
    };

    const element = containerRef.current;
    if (element) {
      element.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        element.removeEventListener('wheel', handleWheel);
      };
    }
  }, []);

  // 监听Ctrl + /快捷键关闭预览
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === '/' && onClose) {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="markdown-viewer-container"
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: 'transparent',
        padding: '24px',
        paddingTop: '60px', // 为主题切换按钮留出空间
        paddingRight: '80px', // 为主题切换按钮留出空间
        zoom: zoomLevel // 应用缩放
      }}
    >
      <MarkdownRenderer
        content={content}
        currentFileName={fileName}
        currentFolder={currentFolder}
        isDarkMode={localIsDarkMode}
      />
    </div>
  );
};

export default MarkdownViewer;
