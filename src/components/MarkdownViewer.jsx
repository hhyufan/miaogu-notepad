/**
 * @fileoverview Markdown预览组件 - 提供Markdown文档的渲染和预览功能
 * 支持代码高亮、Mermaid图表、树形结构可视化等扩展功能
 * @author hhyufan
 * @version 1.3.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Image, message, FloatButton } from 'antd';
import { VerticalAlignTopOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import Prism from 'prismjs';
import 'prismjs/plugins/autoloader/prism-autoloader';
import { theme } from 'antd';
import TreeViewer from './TreeViewer';
import MermaidRenderer from './MermaidRenderer';
import { useTheme } from '../hooks/redux';
import { useI18n } from '../hooks/useI18n';
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolvePath } from '../utils/pathUtils';
import { handleLinkClick } from '../utils/linkUtils';
import { parseFootnotes, addFootnoteJumpHandlers } from '../utils/footnoteParser';
const { useToken } = theme;

Prism.plugins.autoloader.languages_path =
  'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/';
Prism.languages.vue = Prism.languages.html;

const AutoTreeH1 = ({ titleText, isDarkMode, containerRef, children, currentFileName, currentFolder, onOpenFile }) => {
  const [treeFilePath, setTreeFilePath] = useState(null);

  useEffect(() => {
    const checkTreeFile = async () => {
      const cleanTitle = titleText.trim();

      const possiblePaths = [
        `trees/${cleanTitle}.mgtree`,
        `${cleanTitle}.mgtree`
      ];

      for (const path of possiblePaths) {
        try {
          let fullPath;
          if (currentFolder) {
            const separator = currentFolder.includes('\\') ? '\\' : '/';
            // 去除path中可能存在的trees前缀，避免重复
            const cleanPath = path.startsWith('trees/') ? path.replace('trees/', '') : path;
            // 检查currentFolder是否已经包含trees目录，避免重复添加
            if (currentFolder.endsWith('trees') || currentFolder.endsWith('trees/') || currentFolder.endsWith('trees\\')) {
              fullPath = `${currentFolder}${separator}${cleanPath}`;
            } else {
              fullPath = `${currentFolder}${separator}trees${separator}${cleanPath}`;
            }
          } else {
            // 如果没有目录信息，跳过这个路径检查
            continue;
          }

          // 使用readTextFile直接读取文件，避免convertFileSrc的500错误
          try {
            const { readTextFile } = await import('@tauri-apps/plugin-fs');
            const text = await readTextFile(fullPath);

            // 确保有实际内容
            if (text.trim().length > 0) {
              // 如果文件在trees目录下，只传递文件名给TreeViewer
              const fileName = path.startsWith('trees/') ? path.replace('trees/', '') : path;
              setTreeFilePath(fileName);
              return;
            }
          } catch (fetchError) {
            // 如果readTextFile失败，静默跳过这个文件

          }
        } catch (error) {
          // 静默处理错误，继续检查下一个路径
          (`检查文件时出错: ${path}`, error);
        }
      }
      // 没有找到有效文件，不显示任何内容
      setTreeFilePath(null);
    };

    if (titleText) {
      checkTreeFile().catch();
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
            isAutoTree={true}
            onOpenMgtree={onOpenFile}
          />
        </div>
      )}
    </div>
  );
};

// 基础样式函数，接收token参数
const getBaseStyle = (token) => ({
  color: token['colorText'],
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
  borderLeft: `4px solid ${token['colorPrimary']}`,
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
  color: token['colorPrimary'],
  textDecoration: 'underline'
});

const getHrStyle = (token) => ({
  ...getBaseStyle(token),
  border: 0,
  borderTop: `1px solid ${token['colorBorder']}`,
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

// 代码块样式函数
const getCodeStyle = (token) => ({
  ...getBaseStyle(token),
  backgroundColor: token['colorBgContainer'],
  border: `1px solid ${token['colorBorder']}`,
  borderRadius: '4px',
  padding: '0.5rem',
  fontSize: '0.9rem',
  fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace"
});

// 内联代码样式函数
const getInlineCodeStyle = (token) => ({
  ...getBaseStyle(token),
  backgroundColor: token['colorBgContainer'],
  border: `1px solid ${token['colorBorder']}`,
  borderRadius: '3px',
  padding: '0.2rem 0.4rem',
  margin: '0 0.2rem',
  fontSize: '0.85rem',
  fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
  color: token['colorPrimary']
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

const MarkdownRenderer = React.memo(({ content, currentFileName, currentFolder, isDarkMode, containerRef, openFile }) => {
  const { token } = useToken();

  // 处理脚注解析
  const processedContent = useMemo(() => {
    if (!content) return '';
    const result = parseFootnotes(content);






    return result.content;
  }, [content]);
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
        handleCopyToClipboard(code.textContent).catch();
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

  // 添加脚注跳转功能
  const addFootnoteJumpHandlersCallback = useCallback(() => {
    if (!containerRef?.current) return;
    // 使用自定义脚注跳转处理器
    addFootnoteJumpHandlers(containerRef.current);
  }, []);

  // 在内容更新后高亮代码并添加脚注跳转功能
  useEffect(() => {
    const timer = setTimeout(() => {
      highlightCode();
      addFootnoteJumpHandlersCallback();
    }, 100);

    return () => clearTimeout(timer);
  }, [processedContent, highlightCode, addFootnoteJumpHandlersCallback]);

  return (
    <div ref={containerRef}>
      {React.useMemo(() => (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          remarkRehypeOptions={{ allowDangerousHtml: true }}
          skipHtml={false}
          children={processedContent}
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
                  onOpenFile={openFile}
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
            p: ({ children }) => {
              return <p style={getTextStyle(token)}>{children}</p>;
            },
            blockquote: ({ children }) => <blockquote style={getQuoteStyle(token, isDarkMode)}>{children}</blockquote>,
            ul: ({ children }) => <ul style={getListStyle(token)}>{children}</ul>,
            ol: ({ children }) => <ol style={getListStyle(token)}>{children}</ol>,
            li: ({ children }) => <li style={getListItemStyle(token)}>{children}</li>,
            span: ({ children, id, ...props }) => {
              // 对于脚注span，确保内容能正确渲染Markdown
              if (id && id.startsWith('fn-')) {
                return (
                  <span
                    id={id}
                    style={{
                      color: isDarkMode ? '#9ca3af' : '#6b7280' // 明暗主题不同的灰色
                    }}
                    {...props}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      remarkRehypeOptions={{ allowDangerousHtml: true }}
                      skipHtml={false}
                      components={{
                        p: ({ children }) => <>{children}</>,
                        code: ({ children, className, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          return match ? (
                            <code className={className} style={getCodeStyle(token)} {...props}>
                              {children}
                            </code>
                          ) : (
                            <code style={{
                              backgroundColor: isDarkMode ? '#201f1b' : '#e6f3ff',
                              color: isDarkMode ? '#9ca3af' : '#6b7280', // 使用与脚注文本相同的灰色
                              padding: '3px 6px',
                              margin: '0 6px',
                              borderRadius: '4px',
                              fontSize: '0.9em',
                              fontFamily: "'JetBrains Mono', 'Fira Code', 'Fira Mono', Consolas, Menlo, Courier, monospace",
                              fontWeight: '500',
                              border: `1px solid ${isDarkMode ? '#2563eb' : '#93c5fd'}`
                            }} {...props}>
                              {children}
                            </code>
                          );
                        },
                        a: ({ children, href, ...props }) => {
                          // 处理脚注回引链接
                          if (href && href.startsWith('#')) {
                            const handleClick = (e) => {
                              e.preventDefault();
                              const targetId = href.substring(1);
                              const targetElement = containerRef.current?.querySelector('#' + targetId);
                              if (targetElement) {
                                targetElement.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center'
                                });
                              }
                            };

                            return (
                              <a
                                href={href}
                                style={{
                                  ...getLinkStyle(token),
                                  cursor: 'pointer',
                                  textDecoration: 'none'
                                }}
                                onClick={handleClick}
                                {...props}
                              >
                                {children}
                              </a>
                            );
                          }

                          return (
                            <a href={href} style={getLinkStyle(token)} {...props}>
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {typeof children === 'string' ? children : String(children || '')}
                    </ReactMarkdown>
                  </span>
                );
              }
              return <span id={id} {...props}>{children}</span>;
            },
            a: ({ children, href, id, className, ...props }) => {
              // 如果是锚点链接（以#开头），使用默认的链接行为
              if (href && href.startsWith('#')) {
                return (
                  <a
                    id={id}
                    href={href}
                    className={className}
                    style={{
                      ...getLinkStyle(token),
                      cursor: 'pointer',
                      textDecoration: 'none'
                    }}
                    title={href}
                    {...props}
                  >
                    {children}
                  </a>
                );
              }

              const handleClick = async (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (href && openFile) {
                  const success = await handleLinkClick(href, currentFolder, openFile);
                  if (!success) {
                    console.warn('无法处理链接:', href);
                  }
                }
              };

              return (
                <span
                  style={{
                    ...getLinkStyle(token),
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                  onClick={handleClick}
                  title={href}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleClick(e);
                    }
                  }}
                >
                  {children}
                </span>
              );
            },
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
              let imageSrc;

              let decodedSrc = src;
              try {
                decodedSrc = decodeURIComponent(src);


              } catch (e) {
                console.warn('URL解码失败:', e);
              }

              if (decodedSrc && !decodedSrc.startsWith('http') && !decodedSrc.startsWith('https') && !decodedSrc.startsWith('data:')) {




                // 相对路径处理：基于当前md文件所在目录
                if (currentFolder && currentFileName) {
                  // 使用新的路径解析函数处理相对路径，支持../父级目录引用
                  const fullPath = resolvePath(currentFolder, decodedSrc);


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
                    boxShadow: token['boxShadow'],
                    border: `1px solid ${token['colorBorder']}`,
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

                    message.error(`未找到${jumpLanguage}代码示例#${jumpIndex}`).then();
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
          {processedContent}
        </ReactMarkdown>
      ), [processedContent, token, isDarkMode, currentFileName, currentFolder])}
    </div>
  );
});

const MarkdownViewer = ({ content, fileName, currentFolder, onClose, openFile, isHeaderVisible = true }) => {
  const { theme: currentTheme } = useTheme();
  const localIsDarkMode = currentTheme === 'dark';
  const [zoomLevel, setZoomLevel] = useState(1); // 缩放级别，1为默认大小
  const [showBackToTop, setShowBackToTop] = useState(false);
  const containerRef = useRef(null);

  // 鼠标滚轮缩放功能和滚动监听
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
      // 对于非Ctrl+滚轮事件，不阻止默认行为，让浏览器处理
    };

    const handleScroll = () => {
      // 检查容器的滚动位置
      const element = containerRef.current;
      if (element) {
        const scrollTop = element.scrollTop;
        setShowBackToTop(scrollTop > 300);
      }
    };

    const element = containerRef.current;
    if (element) {
      // 使用passive: false是因为需要preventDefault来阻止缩放时的默认滚动行为
      element.addEventListener('wheel', handleWheel, { passive: false });
      element.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (element) {
        element.removeEventListener('wheel', handleWheel);
        element.removeEventListener('scroll', handleScroll);
      }
    };
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
        height: '100%', // 改为100%，让父容器控制高度
        backgroundColor: 'transparent',
        padding: '24px',
        paddingTop: isHeaderVisible ? '40px' : '16px', // 减少顶部间距，避免显示过低
        paddingRight: '80px', // 为主题切换按钮留出空间
        zoom: zoomLevel, // 应用缩放
        overflow: 'auto' // 添加滚动
      }}
    >
      <MarkdownRenderer
        content={content}
        currentFileName={fileName}
        currentFolder={currentFolder}
        isDarkMode={localIsDarkMode}
        containerRef={containerRef}
        openFile={openFile}
      />
      {showBackToTop && content && (
        <FloatButton
          icon={<VerticalAlignTopOutlined />}
          onClick={() => {
            const element = containerRef.current;
            if (element) {
              element.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          style={{
            position: 'fixed',
            bottom: '40px',
            right: '20px',
            zIndex: 1000
          }}
        />
      )}
    </div>
  );
};

export default MarkdownViewer;
