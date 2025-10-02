/**
 * 高级代码编辑器组件，基于Monaco Editor构建
 * 支持多语言语法高亮、AI智能补全、自定义幽灵文本(Ghost Text)、Markdown预览等功能
 * 集成主题切换、编辑器配置定制和文件操作能力
 *
 * @component
 * @param {Object} props - 组件属性
 * @param {boolean} props.isDarkMode - 控制暗色/亮色主题切换
 * @param {Object} props.fileManager - 文件管理工具，包含当前文件信息和操作方法
 * @param {boolean} [props.showMarkdownPreview=false] - 外部控制Markdown预览显示
 * @param {Object} [props.languageRef] - 语言设置引用，用于动态切换语法
 * @param {boolean} [props.isHeaderVisible=true] - 控制头部显示状态，影响布局
 * @param {Function} [props.setCursorPosition] - 同步光标位置的回调
 * @param {Function} [props.setCharacterCount] - 同步字符计数的回调
 * @returns {JSX.Element} 渲染的编辑器组件
 *
 * @example
 * <CodeEditor
 *   isDarkMode={true}
 *   fileManager={fileManagerInstance}
 *   showMarkdownPreview={false}
 * />
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Empty, message, FloatButton } from 'antd';
import { VerticalAlignTopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import '../monaco-worker';
import * as monaco from 'monaco-editor';
import { shikiToMonaco } from '@shikijs/monaco';
import { createHighlighter } from 'shiki';
import { useEditor, useTheme } from '../hooks/redux';
import tauriApi from '../utils/tauriApi';
import { handleLinkClick } from '../utils/linkUtils';
import MarkdownViewer from './MarkdownViewer';
import extensionToLanguage from '../configs/file-extensions.json';
import { mgtreeLanguageConfig, mgtreeThemeConfig } from '../configs/mgtree-language';
import { mgtreeTextMateGrammar, mgtreeShikiTheme } from '../configs/mgtree-textmate';
import './CodeEditor.scss';

const { file: fileApi, settings: settingsApi } = tauriApi;

/** 主题配置映射表 */
const themes = {
  'One': ['one-dark-pro', 'one-light']
};

function CodeEditor({ isDarkMode, fileManager, showMarkdownPreview = false, languageRef, isHeaderVisible = true, setCursorPosition, setCharacterCount }) {
  const { t } = useTranslation();
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const isInternalChange = useRef(false);
  const [highlighterReady, setHighlighterReady] = useState(false);
  const [internalShowMarkdownPreview, setInternalShowMarkdownPreview] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const actualShowMarkdownPreview = showMarkdownPreview || internalShowMarkdownPreview;
  const { fontSize, fontFamily, lineHeight } = useTheme();
  const { wordWrap, scrollBeyondLastLine, tabSize, insertSpaces, minimap, lineNumbers, folding, matchBrackets, autoIndent, formatOnPaste, formatOnType, renderWhitespace, cursorBlinking, cursorStyle, glyphMargin, showFoldingControls } = useEditor();
  const { currentFile, updateCode: updateContent } = fileManager;

  /**
   * 向文件管理器暴露获取编辑器内容的方法
   * 确保外部可随时获取当前编辑内容
   */
  useEffect(() => {
    if (fileManager && editorRef.current) {
      if (!fileManager.getEditorContent) {
        fileManager.getEditorContent = { current: null };
      }
      fileManager.getEditorContent.current = () => editorRef.current.getValue();
    }
  }, [fileManager, editorRef.current]);

  // AI补全相关状态与引用
  const [aiSettings, setAiSettings] = useState({
    enabled: false,
    baseUrl: '',
    apiKey: '',
    model: ''
  });
  const inlineAcceptRef = useRef(null);
  const wasModifiedRef = useRef(false);
  const providerDisposablesRef = useRef([]);
  const keydownDisposableRef = useRef(null);
  const inlineSuggestDisposableRef = useRef(null);
  const coreDisposablesRef = useRef([]);
  const ctrlLPressedRef = useRef(false);

  const cursorPositionRef = useRef(null);
  const cursorTimerRef = useRef(null);
  const isCompletionActiveRef = useRef(false);

  // API请求限制控制
  const apiRequestCountRef = useRef(0);
  const apiRequestResetTimerRef = useRef(null);
  const lastRequestTimeRef = useRef(0);
  const firstRequestTimeRef = useRef(0);
  const MAX_REQUESTS_PER_MINUTE = 6;
  const REQUEST_RESET_INTERVAL = 10000;
  const retrySuggestionRef = useRef(null);

  // 幽灵文本(Ghost Text)相关引用
  const ghostTextsRef = useRef(new Map());
  const ghostTextCounterRef = useRef(0);
  const triggerTimeoutRef = useRef(null);
  const pendingGhostTextsRef = useRef([]);
  const createGhostTimeoutRef = useRef(null);

  /**
   * 从DOM获取当前活动标签页的文件名
   * @returns {string} 文件名，默认返回'plaintext'
   */
  const getCurrentTabFileName = useCallback(() => {
    try {
      const activeTabBtn = document.querySelector('.ant-tabs-tab-btn[aria-selected="true"]');
      if (activeTabBtn) {
        const spanElement = activeTabBtn.querySelector('span');
        if (spanElement) {
          const fileName = spanElement.textContent || spanElement.innerText || '';
          return fileName.trim() || 'plaintext';
        }
      }
    } catch (error) {
      console.warn('获取当前标签页文件名失败:', error);
    }
    return 'plaintext';
  }, [currentFile?.name]);

  /**
   * 判断当前文件是否为Markdown相关类型
   * @returns {boolean} 是否为Markdown文件
   */
  const isMarkdownFile = useCallback(() => {
    const displayFileName = getCurrentTabFileName();
    if (!displayFileName) return false;

    const extension = displayFileName.toLowerCase().split('.').pop();
    return ['md', 'markdown', 'mgtree'].includes(extension);
  }, []);

  /** 切换Markdown预览显示状态 */
  const handleToggleMarkdownPreview = useCallback(() => {
    if (!currentFile) {
      message.warning(t('message.warning.openFileFirst')).then();
      return;
    }
    if (!isMarkdownFile()) {
      message.warning(t('message.warning.markdownOnly')).then();
      return;
    }
    setInternalShowMarkdownPreview(prev => !prev);
  }, [isMarkdownFile, currentFile, t]);

  /** 关闭Markdown预览 */
  const handleCloseMarkdownPreview = useCallback(() => {
    setInternalShowMarkdownPreview(false);
  }, []);

  /**
   * 加载AI补全服务配置
   * 从本地存储或配置系统读取相关参数
   */
  const loadAiSettings = useCallback(async () => {
    try {
      const enabled = (await settingsApi?.get?.('ai.enabled')) ?? (localStorage.getItem('ai.enabled') === 'true');
      const baseUrl = (await settingsApi?.get?.('ai.baseUrl')) ?? localStorage.getItem('ai.baseUrl') ?? '';
      const apiKey = (await settingsApi?.get?.('ai.apiKey')) ?? localStorage.getItem('ai.apiKey') ?? '';
      const model = (await settingsApi?.get?.('ai.model')) ?? localStorage.getItem('ai.model') ?? '';
      setAiSettings({
        enabled: Boolean(enabled),
        baseUrl: String(baseUrl || ''),
        apiKey: String(apiKey || ''),
        model: String(model || '')
      });
    } catch {
      // 忽略加载错误，使用默认值
    }
  }, [setAiSettings]);

  /** 组件挂载时加载AI配置 */
  useEffect(() => {
    let mounted = true;
    (async () => { await loadAiSettings(); })();
    return () => { mounted = false; };
  }, [loadAiSettings]);

  /** 监听AI配置变化事件 */
  useEffect(() => {
    const handler = () => { loadAiSettings().catch(); };
    window.addEventListener('ai-settings-changed', handler);
    return () => window.removeEventListener('ai-settings-changed', handler);
  }, [loadAiSettings]);

  /**
   * 创建幽灵文本(Ghost Text)用于代码补全提示
   * 支持合并相邻幽灵文本，优化补全体验
   * @param {string} text - 幽灵文本内容
   * @param {monaco.IRange} range - 文本插入范围
   */
  const createGhostText = useCallback((text, range) => {
    if (!editorRef.current || !text || text.trim() === '') return;

    const model = editorRef.current.getModel();
    if (!model) return;

    let leftGhost = null;
    let rightGhost = null;

    // 查找左侧可合并的幽灵文本
    for (const [id, ghostData] of ghostTextsRef.current) {
      const ghostPos = ghostData.originalPosition;
      if (ghostPos.lineNumber === range.startLineNumber) {
        const ghostEndColumn = ghostPos.column + ghostData.originalText.length;
        if (ghostEndColumn === range.startColumn) {
          leftGhost = { id, ghostData };
        }
      } else if (ghostPos.lineNumber === range.startLineNumber - 1) {
        const lineContent = model.getLineContent(ghostPos.lineNumber);
        const ghostEndColumn = ghostPos.column + ghostData.originalText.length;
        const hasNewline = ghostData.originalText.includes('\n');
        if ((hasNewline || ghostEndColumn > lineContent.length) && range.startColumn === 1) {
          leftGhost = { id, ghostData };
        }
      }
    }

    // 查找右侧可合并的幽灵文本
    for (const [id, ghostData] of ghostTextsRef.current) {
      const ghostPos = ghostData.originalPosition;
      if (ghostPos.lineNumber === range.endLineNumber && ghostPos.column === range.endColumn) {
        rightGhost = { id, ghostData };
      } else if (ghostPos.lineNumber === range.endLineNumber + 1) {
        const lineContent = model.getLineContent(range.endLineNumber);
        const selectedText = model.getValueInRange(range);
        const hasNewline = selectedText.includes('\n');
        if ((hasNewline || range.endColumn > lineContent.length) && ghostPos.column === 1) {
          rightGhost = { id, ghostData };
        }
      }
    }

    // 合并幽灵文本处理
    if (leftGhost || rightGhost) {
      let mergedText = '';
      let mergedPosition = null;
      let ghostsToRemove = [];

      if (leftGhost && rightGhost) {
        let leftText = leftGhost.ghostData.originalText;
        let rightText = rightGhost.ghostData.originalText;

        if (leftGhost.ghostData.originalPosition.lineNumber < range.startLineNumber) {
          leftText += '\n';
        }
        if (range.endLineNumber < rightGhost.ghostData.originalPosition.lineNumber) {
          text += '\n';
        }

        mergedText = leftText + text + rightText;
        mergedPosition = leftGhost.ghostData.originalPosition;
        ghostsToRemove = [leftGhost.id, rightGhost.id];
      } else if (leftGhost) {
        let leftText = leftGhost.ghostData.originalText;
        if (leftGhost.ghostData.originalPosition.lineNumber < range.startLineNumber) {
          leftText += '\n';
        }
        mergedText = leftText + text;
        mergedPosition = leftGhost.ghostData.originalPosition;
        ghostsToRemove = [leftGhost.id];
      } else if (rightGhost) {
        let rightText = rightGhost.ghostData.originalText;
        if (range.endLineNumber < rightGhost.ghostData.originalPosition.lineNumber) {
          text += '\n';
        }
        mergedText = text + rightText;
        mergedPosition = { lineNumber: range.startLineNumber, column: range.startColumn };
        ghostsToRemove = [rightGhost.id];
      }

      // 清理被合并的幽灵文本
      for (const ghostId of ghostsToRemove) {
        const ghostData = ghostTextsRef.current.get(ghostId);
        if (ghostData) {
          ghostData.providerDisposable?.dispose();
          ghostTextsRef.current.delete(ghostId);
        }
      }

      editorRef.current.executeEdits('ghost-text-creation', [{
        range,
        text: '',
        forceMoveMarkers: true
      }]);

      text = mergedText;
      range = new monaco.Range(
          mergedPosition?.lineNumber, mergedPosition?.column,
          mergedPosition?.lineNumber, mergedPosition?.column
      );
    } else {
      editorRef.current.executeEdits('ghost-text-creation', [{
        range,
        text: '',
        forceMoveMarkers: true
      }]);
    }

    // 创建新幽灵文本并注册补全提供者
    const ghostId = `ghost-${++ghostTextCounterRef.current}`;
    const position = { lineNumber: range.startLineNumber, column: range.startColumn };

    ghostTextsRef.current.set(ghostId, {
      text,
      originalRange: range,
      currentPosition: position,
      originalPosition: { ...position },
      originalText: text
    });

    const provider = {
      provideInlineCompletions: async (model, position, context, _) => {
        const relevantGhosts = [];

        for (const [_, ghostData] of ghostTextsRef.current) {
          const originalPos = ghostData.originalPosition;
          const isInGhostArea = position.lineNumber > originalPos.lineNumber ||
              (position.lineNumber === originalPos.lineNumber && position.column >= originalPos.column);

          if (isInGhostArea) {
            let userInput = '';
            if (position.lineNumber === originalPos.lineNumber) {
              const lineContent = model.getLineContent(position.lineNumber);
              userInput = lineContent.substring(originalPos.column - 1, position.column - 1);
            } else {
              for (let lineNum = originalPos.lineNumber; lineNum <= position.lineNumber; lineNum++) {
                const lineContent = model.getLineContent(lineNum);
                if (lineNum === originalPos.lineNumber) {
                  userInput += lineContent.substring(originalPos.column - 1);
                } else if (lineNum === position.lineNumber) {
                  userInput += '\n' + lineContent.substring(0, position.column - 1);
                } else {
                  userInput += '\n' + lineContent;
                }
              }
            }

            if (userInput.length < ghostData.originalText.length) {
              let matchScore = 0;
              const minLength = Math.min(userInput.length, ghostData.originalText.length);
              for (let i = 0; i < minLength; i++) {
                if (userInput[i] === ghostData.originalText[i]) matchScore++;
              }

              relevantGhosts.push({
                ghostData,
                userInput,
                remainingText: ghostData.originalText.substring(userInput.length),
                originalPos
              });
            }
          }
        }

        if (relevantGhosts.length === 0) return { items: [] };

        // 排序并选择最佳匹配的幽灵文本
        relevantGhosts.sort((a, b) => {
          if (a.originalPos.lineNumber !== b.originalPos.lineNumber) {
            return a.originalPos.lineNumber - b.originalPos.lineNumber;
          }
          return a.originalPos.column - b.originalPos.column;
        });

        let bestGhost = null;
        let bestScore = -1;
        for (const ghost of relevantGhosts) {
          let score = 0;
          if (ghost.originalPos.lineNumber === position.lineNumber &&
              ghost.originalPos.column <= position.column) {
            score += 100;
          } else if (ghost.originalPos.lineNumber < position.lineNumber) {
            score += 50;
          }

          const inputLength = ghost.userInput.length;
          const originalLength = ghost.ghostData.originalText.length;
          if (inputLength > 0) {
            score += (inputLength / originalLength) * 10;
          }

          if (score > bestScore) {
            bestScore = score;
            bestGhost = ghost;
          }
        }

        return {
          items: [{
            insertText: bestGhost ? bestGhost.remainingText : '',
            range: new monaco.Range(
                position.lineNumber, position.column,
                position.lineNumber, position.column
            )
          }]
        };
      },
      freeInlineCompletions: () => {},
      handleItemDidShow: () => {},
      handlePartialAccept: () => {}
    };

    const currentLanguage = model.getLanguageId() || 'plaintext';
    ghostTextsRef.current.get(ghostId).providerDisposable =
        monaco.languages.registerInlineCompletionsProvider(currentLanguage, provider);

    // 触发补全提示
    if (triggerTimeoutRef.current) clearTimeout(triggerTimeoutRef.current);
    triggerTimeoutRef.current = setTimeout(() => {
      try {
        editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
      } catch (error) {
        if (!error.message?.includes('Canceled')) {}
      }
      triggerTimeoutRef.current = null;
    }, 20);

  }, []);

  /**
   * 防抖处理幽灵文本创建，避免频繁操作
   * 合并短时间内的多个创建请求
   */
  const debouncedCreateGhostTexts = useCallback(() => {
    if (createGhostTimeoutRef.current) clearTimeout(createGhostTimeoutRef.current);

    createGhostTimeoutRef.current = setTimeout(() => {
      const pendingTexts = [...pendingGhostTextsRef.current];
      pendingGhostTextsRef.current = [];
      if (pendingTexts.length === 0) return;

      const mergedTexts = [];
      for (const pending of pendingTexts) {
        let foundExistingGhost = false;
        for (const [_, ghostData] of ghostTextsRef.current) {
          const ghostPos = ghostData.originalPosition;
          if (ghostPos.lineNumber === pending.range.startLineNumber &&
              ghostPos.column === pending.range.startColumn &&
              pending.range.startColumn === pending.range.endColumn) {
            ghostData.text += pending.text;
            ghostData.originalText += pending.text;
            foundExistingGhost = true;
            break;
          }
        }

        if (!foundExistingGhost) {
          const existing = mergedTexts.find(m =>
              m.range.startLineNumber === pending.range.startLineNumber &&
              m.range.startColumn === pending.range.startColumn
          );

          if (existing) {
            existing.text += pending.text;
            existing.range = new monaco.Range(
                existing.range.startLineNumber,
                existing.range.startColumn,
                pending.range.endLineNumber,
                pending.range.endColumn
            );
          } else {
            mergedTexts.push(pending);
          }
        }
      }

      for (const { text, range } of mergedTexts) {
        createGhostText(text, range);
      }
    }, 100);
  }, []);

  /**
   * 处理幽灵文本添加请求，包含位置冲突检查
   * @param {string} text - 幽灵文本内容
   * @param {monaco.IRange} range - 文本范围
   */
  useCallback((text, range) => {
    const shouldCreateGhost = () => {
      const hasPendingAtSamePosition = pendingGhostTextsRef.current.some(pending =>
          pending.range.startLineNumber === range.startLineNumber &&
          pending.range.startColumn === range.startColumn &&
          pending.range.endLineNumber === range.endLineNumber &&
          pending.range.endColumn === range.endColumn
      );
      if (hasPendingAtSamePosition) return false;

      for (const [_, ghostData] of ghostTextsRef.current) {
        const ghostPos = ghostData.originalPosition;
        if (ghostPos.lineNumber === range.startLineNumber &&
            Math.abs(ghostPos.column - range.startColumn) <= 1) {
          return false;
        }
      }
      return text;
    };

    if (shouldCreateGhost()) {
      pendingGhostTextsRef.current.push({ text, range });
      debouncedCreateGhostTexts();
    }
  }, [debouncedCreateGhostTexts]);

  /**
   * 清除特定ID的幽灵文本
   * @param {string} ghostId - 幽灵文本ID
   */
  const clearSpecificGhostText = useCallback((ghostId) => {
    if (!editorRef.current || !ghostTextsRef.current.has(ghostId)) return;

    const ghostData = ghostTextsRef.current.get(ghostId);
    ghostData.providerDisposable?.dispose();
    ghostTextsRef.current.delete(ghostId);

    if (ghostTextsRef.current.size === 0) {
      const model = editorRef.current.getModel();
      model && editorRef.current.trigger('clearGhostTexts', 'editor.action.inlineSuggest.hide', {});
    }
  }, []);

  /** 清除所有幽灵文本 */
  const clearAllGhostTexts = useCallback(() => {
    if (!editorRef.current) return;

    ghostTextsRef.current.forEach((ghostData) => {
      ghostData.providerDisposable?.dispose();
    });
    ghostTextsRef.current.clear();

    const model = editorRef.current.getModel();
    model && editorRef.current.trigger('clearGhostTexts', 'editor.action.inlineSuggest.hide', {});
  }, []);

  /** 监听文件保存事件，清除所有幽灵文本 */
  useEffect(() => {
    const handleFileSaved = () => clearAllGhostTexts();
    window.addEventListener('file-saved', handleFileSaved);
    return () => window.removeEventListener('file-saved', handleFileSaved);
  }, [clearAllGhostTexts]);

  /** 恢复所有幽灵文本到编辑器中 */
  const restoreAllGhostTexts = useCallback(() => {
    if (!editorRef.current || ghostTextsRef.current.size === 0) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const edits = [];
    ghostTextsRef.current.forEach((ghostData) => {
      edits.push({
        range: new monaco.Range(
            ghostData.currentPosition.lineNumber,
            ghostData.currentPosition.column,
            ghostData.currentPosition.lineNumber,
            ghostData.currentPosition.column
        ),
        text: ghostData.text,
        forceMoveMarkers: true
      });
      ghostData.providerDisposable?.dispose();
    });

    editorRef.current.executeEdits('ghost-text-restoration', edits);
    ghostTextsRef.current.clear();
  }, []);

  /**
   * 接受当前行的幽灵文本补全
   * 只插入当前行剩余部分，保持上下文连贯
   */
  const acceptCurrentLineGhostText = useCallback(() => {
    if (!editorRef.current || ghostTextsRef.current.size === 0) {
      message.warning(t('message.warning.noGhostTextAvailable'), 1).then();
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) return;

    const position = editorRef.current.getPosition();
    if (!position) return;

    for (const [ghostId, ghostData] of ghostTextsRef.current) {
      const originalPos = ghostData.originalPosition;
      const isInGhostArea = position.lineNumber > originalPos.lineNumber ||
          (position.lineNumber === originalPos.lineNumber && position.column >= originalPos.column);

      if (isInGhostArea) {
        let userInput = '';
        if (position.lineNumber === originalPos.lineNumber) {
          const lineContent = model.getLineContent(position.lineNumber);
          userInput = lineContent.substring(originalPos.column - 1, position.column - 1);
        } else {
          for (let lineNum = originalPos.lineNumber; lineNum <= position.lineNumber; lineNum++) {
            const lineContent = model.getLineContent(lineNum);
            if (lineNum === originalPos.lineNumber) {
              userInput += lineContent.substring(originalPos.column - 1);
            } else if (lineNum === position.lineNumber) {
              userInput += '\n' + lineContent.substring(0, position.column - 1);
            } else {
              userInput += '\n' + lineContent;
            }
          }
        }

        const ghostTextLines = ghostData.originalText.split('\n');
        const userInputLines = userInput.split('\n');
        const currentLineIndex = userInputLines.length - 1;

        if (currentLineIndex < ghostTextLines.length) {
          const currentGhostLine = ghostTextLines[currentLineIndex];
          const currentUserLine = userInputLines[currentLineIndex] || '';

          if (currentUserLine.length < currentGhostLine.length) {
            const remainingText = currentGhostLine.substring(currentUserLine.length);
            editorRef.current.executeEdits('ghost-line-accept', [{
              range: new monaco.Range(
                  position.lineNumber, position.column,
                  position.lineNumber, position.column
              ),
              text: remainingText,
              forceMoveMarkers: true
            }]);

            const newPosition = {
              lineNumber: position.lineNumber,
              column: position.column + remainingText.length
            };
            editorRef.current.setPosition(newPosition);

            // 检查是否完全匹配，匹配则清除幽灵文本
            setTimeout(() => {
              const updatedPosition = editorRef.current.getPosition();
              if (updatedPosition) {
                let completedInput = '';
                if (updatedPosition.lineNumber === originalPos.lineNumber) {
                  const lineContent = model.getLineContent(originalPos.lineNumber);
                  completedInput = lineContent.substring(originalPos.column - 1, updatedPosition.column - 1);
                } else {
                  for (let lineNum = originalPos.lineNumber; lineNum <= updatedPosition.lineNumber; lineNum++) {
                    const lineContent = model.getLineContent(lineNum);
                    if (lineNum === originalPos.lineNumber) {
                      completedInput += lineContent.substring(originalPos.column - 1);
                      if (lineNum < updatedPosition.lineNumber) completedInput += '\n';
                    } else if (lineNum === updatedPosition.lineNumber) {
                      completedInput += lineContent.substring(0, updatedPosition.column - 1);
                    } else {
                      completedInput += lineContent + '\n';
                    }
                  }
                }

                if (completedInput === ghostData.originalText) {
                  clearSpecificGhostText(ghostId);
                }
              }
            }, 50);
            return;
          } else {
            message.info(t('message.info.currentLineCompleted'), 1).then();
            return;
          }
        } else {
          message.info(t('message.info.beyondGhostTextRange'), 1).then();
          return;
        }
      }
    }

    message.warning(t('message.warning.noGhostTextAtCurrentPosition'), 1).then();
  }, []);

  /**
   * 内容变化时更新幽灵文本状态
   * 处理光标移动和文本输入对补全的影响
   * @param {Object} changeEvent - 内容变化事件对象
   */
  const updateGhostTextsOnChange = useCallback((changeEvent) => {
    if (!editorRef.current || ghostTextsRef.current.size === 0) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    changeEvent.changes.forEach(change => {
      const { range, text } = change;

      ghostTextsRef.current.forEach((ghostData, ghostId) => {
        const originalPos = ghostData.originalPosition;
        const changeStartPos = { lineNumber: range.startLineNumber, column: range.startColumn };
        const changeEndPos = { lineNumber: range.endLineNumber, column: range.endColumn };

        const isAfterGhostStart = changeStartPos.lineNumber > originalPos.lineNumber ||
            (changeStartPos.lineNumber === originalPos.lineNumber && changeStartPos.column >= originalPos.column);

        if (isAfterGhostStart) {
          let userInput = '';
          if (changeEndPos.lineNumber === originalPos.lineNumber) {
            const lineText = model.getLineContent(originalPos.lineNumber);
            userInput = lineText.substring(originalPos.column - 1, changeEndPos.column + text.length - 1);
          } else {
            for (let lineNum = originalPos.lineNumber; lineNum <= changeEndPos.lineNumber; lineNum++) {
              const lineText = model.getLineContent(lineNum);
              if (lineNum === originalPos.lineNumber) {
                userInput += lineText.substring(originalPos.column - 1);
              } else if (lineNum === changeEndPos.lineNumber) {
                userInput += '\n' + lineText.substring(0, changeEndPos.column + text.length - 1);
              } else {
                userInput += '\n' + lineText;
              }
            }
          }

          // 计算匹配度
          let matchScore = 0;
          const minLength = Math.min(userInput.length, ghostData.originalText.length);
          for (let i = 0; i < minLength; i++) {
            if (userInput[i] === ghostData.originalText[i]) matchScore++;
          }

          // 完全匹配则移除幽灵文本
          if (userInput === ghostData.originalText) {
            ghostTextsRef.current.delete(ghostId);
            setTimeout(() => {
              editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
            }, 10);
          } else {
            // 匹配度高则触发补全更新
            const matchRatio = minLength > 0 ? matchScore / minLength : 1;
            if (matchRatio >= 0.7 || userInput.length === 0) {
              setTimeout(() => {
                editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
              }, 10);
            }
          }
        } else if (changeEndPos.lineNumber < originalPos.lineNumber ||
            (changeEndPos.lineNumber === originalPos.lineNumber && changeEndPos.column <= originalPos.column)) {
          // 调整幽灵文本位置（当在幽灵文本前编辑时）
          if (changeEndPos.lineNumber === originalPos.lineNumber) {
            const columnDelta = text.length - (range.endColumn - range.startColumn);
            ghostData.originalPosition.column += columnDelta;
          } else {
            const lineDelta = (range.endLineNumber - range.startLineNumber) - (text.split('\n').length - 1);
            if (lineDelta !== 0) {
              ghostData.originalPosition.lineNumber -= lineDelta;
            }
          }
        }
      });
    });
  }, []);

  /**
   * 触发AI补全请求
   * 检查配置并调用Monaco的内联补全触发机制
   */
  const triggerAICompletion = useCallback(async () => {
    if (!editorRef.current || !aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
      return;
    }

    if (isCompletionActiveRef.current) {
      return;
    }

    try {
      await editorRef.current.trigger(null, 'editor.action.inlineSuggest.trigger', {});
    } catch (error) {
      console.error('AI补全触发失败:', error);
    }
  }, [aiSettings]);

  /**
   * 执行当前文件
   * 通过文件API调用后端执行逻辑
   */
  const handleExecuteFile = useCallback(async () => {
    if (!currentFile?.path) {
      message.warning(t('message.warning.saveFileFirst'));
      return;
    }

    try {
      await fileApi.executeFile(currentFile['path']);
    } catch (error) {
      message.error(t('message.error.executionFailed', { error }));
    }
  }, [currentFile, t]);

  /**
   * 在终端中打开当前文件
   * 通过文件API调用系统终端
   */
  const handleOpenInTerminal = useCallback(async () => {
    if (!currentFile?.path) {
      message.warning(t('message.warning.saveFileFirst'));
      return;
    }

    try {
      await fileApi.openInTerminal(currentFile['path']);
    } catch (error) {
      message.error(t('message.error.openTerminalFailed', { error }));
    }
  }, [currentFile, t]);

  /**
   * 在资源管理器中显示当前文件
   * 通过文件API定位文件位置
   */
  const handleShowInExplorer = useCallback(async () => {
    if (!currentFile?.path) {
      message.warning(t('message.warning.saveFileFirst'));
      return;
    }

    try {
      await fileApi.showInExplorer(currentFile['path']);
    } catch (error) {
      message.error(t('message.error.openExplorerFailed', { error }));
    }
  }, [currentFile, t]);

  /**
   * 获取文件扩展名
   * @param {string} fileName - 文件名
   * @returns {string} 小写的文件扩展名
   */
  useCallback((fileName) => {
    if (!fileName) return '';
    return fileName.split('.').pop()?.toLowerCase() || '';
  }, []);

  /**
   * 确定编辑器应使用的主题
   * 对mgtree文件使用专用主题
   * @returns {string} 主题名称
   */
  const getEditorTheme = useCallback(() => {
    if (currentFile?.name?.endsWith('.mgtree')) {
      return isDarkMode ? 'mgtree-dark' : 'mgtree-light';
    }
    return isDarkMode ? 'shiki-one-dark-pro' : 'shiki-one-light';
  }, [isDarkMode, currentFile]);

  /**
   * 根据文件名获取对应的编程语言
   * @param {string} fileName - 文件名
   * @returns {string} Monaco支持的语言ID
   */
  const getFileLanguage = useCallback((fileName) => {
    if (!fileName) return 'plaintext';

    const ext = fileName.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'ps1': 'powershell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'conf': 'ini',
      'txt': 'plaintext',
      'mgtree': 'mgtree'
    };

    return languageMap[ext] || 'plaintext';
  }, []);

  /**
   * 初始化代码高亮器和主题系统
   * 配置Monaco支持的语言和主题
   */
  useEffect(() => {
    let mounted = true;

    const initializeThemesAndHighlighter = async () => {
      try {
        // 定义mgtree主题
        try {
          monaco.editor.defineTheme('mgtree-dark', mgtreeThemeConfig.dark);
          monaco.editor.defineTheme('mgtree-light', mgtreeThemeConfig.light);
        } catch (themeError) {
          console.error('mgtree主题定义失败:', themeError);
        }

        // 准备有效的语言列表
        const validLanguages = Object.entries(extensionToLanguage)
            .filter(([key]) => !key.startsWith('_'))
            .map(([, value]) => value);

        // 创建mgtree的Shiki主题
        const mgtreeThemes = [
          {
            name: 'mgtree-light',
            type: 'light',
            colors: mgtreeShikiTheme.light.colors,
            tokenColors: mgtreeShikiTheme.light.tokenColors
          },
          {
            name: 'mgtree-dark',
            type: 'dark',
            colors: mgtreeShikiTheme.dark.colors,
            tokenColors: mgtreeShikiTheme.dark.tokenColors
          }
        ];

        // 初始化Shiki高亮器
        const highlighter = await createHighlighter({
          themes: [...Object.values(themes).flat(), ...mgtreeThemes],
          langs: [...new Set(validLanguages)]
        });

        // 加载mgtree自定义语言
        try {
          await highlighter.loadLanguage(mgtreeTextMateGrammar);
        } catch (error) {
          console.warn('mgtree语言加载失败:', error);
        }

        // 注册mgtree语言到Monaco
        if (!monaco.languages.getLanguages().find(lang => lang.id === mgtreeLanguageConfig.id)) {
          monaco.languages.register({
            id: mgtreeLanguageConfig.id,
            extensions: mgtreeLanguageConfig.extensions,
            aliases: mgtreeLanguageConfig.aliases
          });

          monaco.languages.setLanguageConfiguration(mgtreeLanguageConfig.id, mgtreeLanguageConfig.configuration);

          try {
            monaco.languages.setMonarchTokensProvider(mgtreeLanguageConfig.id, mgtreeLanguageConfig.monarchLanguage);
          } catch (error) {
            console.error('mgtree Monarch语法注册失败:', error);
          }
        }

        // 注册Shiki主题到Monaco
        try {
          shikiToMonaco(highlighter, monaco);
        } catch (error) {
          console.error('Shiki主题转换失败，使用手动注册:', error);

          // 手动注册主题降级方案
          const shikiThemes = highlighter.getLoadedThemes();
          shikiThemes.forEach(themeName => {
            try {
              const themeData = highlighter.getTheme(themeName);
              monaco.editor.defineTheme(themeName, {
                base: themeData.type === 'dark' ? 'vs-dark' : 'vs',
                inherit: true,
                rules: themeData.tokenColors?.map(rule => ({
                  token: rule.scope?.join?.(' ') || rule.scope || '',
                  foreground: rule.settings?.foreground?.replace('#', '') || '',
                  background: rule.settings?.background?.replace('#', '') || '',
                  fontStyle: rule.settings?.fontStyle || ''
                })) || [],
                colors: themeData.colors || {}
              });
            } catch (error) {
              console.warn(`主题${themeName}注册失败:`, error);
            }
          });
        }

        if (mounted) {
          setHighlighterReady(true);
        }
      } catch (error) {
        console.error('主题和高亮器初始化失败:', error);
        if (mounted) {
          setHighlighterReady(true); // 即使失败也标记为就绪，使用基础主题
        }
      }
    };

    initializeThemesAndHighlighter().catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * 初始化Monaco编辑器实例
   * 配置编辑器选项、事件监听和自定义行为
   */
  useEffect(() => {
    if (containerRef.current && !editorRef.current && highlighterReady) {
      // 确定初始语言
      const fileNameLanguage = getFileLanguage(getCurrentTabFileName());
      const initialLanguage = fileNameLanguage || 'plaintext';

      try {
        editorRef.current = monaco.editor.create(containerRef.current, {
          value: '', // 由文件管理器控制内容
          language: languageRef?.current || initialLanguage,
          theme: 'vs-dark', // 初始主题
          fontSize,
          fontFamily,
          lineHeight,
          wordWrap,
          minimap,
          scrollBeyondLastLine,
          automaticLayout: true,
          tabSize,
          insertSpaces,
          renderWhitespace,
          cursorBlinking,
          cursorStyle,
          lineNumbers,
          glyphMargin,
          folding,
          showFoldingControls,
          matchBrackets,
          autoIndent,
          formatOnPaste,
          formatOnType,
          selectOnLineNumbers: true,
          roundedSelection: false,
          readOnly: false,
          cursorSmoothCaretAnimation: 'on',
          contextmenu: false,
          mouseWheelZoom: true,
          smoothScrolling: true,
          multiCursorModifier: 'ctrlCmd',
          accessibilitySupport: 'auto',
          renderLineHighlight: 'none', // 禁用当前行高亮
          inlineSuggest: {
            enabled: true,
            mode: 'prefix',
            suppressSuggestions: true,
            fontFamily: 'inherit',
            keepOnBlur: true,
            showToolbar: 'onHover'
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false
          },
          suggestOnTriggerCharacters: true
        });

        // 内联补全接受处理
        inlineSuggestDisposableRef.current = editorRef.current.onDidChangeModelContent((e) => {
          if (e.changes && e.changes.length > 0) {
            const change = e.changes[0];
            if (inlineAcceptRef.current && change.text) {
              const pending = inlineAcceptRef.current;
              if (change.text === pending.insertText || pending.insertText.startsWith(change.text)) {
                inlineAcceptRef.current = null;
                if (ghostTextsRef.current.size > 0) {
                  clearAllGhostTexts();
                }
              }
            }
          }
        });

        // 键盘事件处理
        if (!keydownDisposableRef.current) {
          keydownDisposableRef.current = editorRef.current.onKeyDown((e) => {
            // Tab键接受补全
            if (e.keyCode === monaco.KeyCode.Tab) {
              const model = editorRef.current?.getModel();
              const position = editorRef.current?.getPosition();
              const pending = inlineAcceptRef.current;

              if (model && position && pending &&
                  pending.lineNumber === position.lineNumber &&
                  pending.column === position.column &&
                  pending.versionId === model.getAlternativeVersionId()) {
                try {
                  const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
                  editorRef.current.executeEdits('ai-inline-accept', [{
                    range,
                    text: pending.insertText,
                    forceMoveMarkers: true
                  }]);
                  inlineAcceptRef.current = null;
                  clearAllGhostTexts();
                  e.preventDefault();
                  e.stopPropagation();
                } catch (error) {
                  inlineAcceptRef.current = null;
                }
              }
            }
            // 右箭头接受部分补全
            else if (e.keyCode === monaco.KeyCode.RightArrow && !e.shiftKey && !e.ctrlKey && !e.altKey) {
              const model = editorRef.current?.getModel();
              const position = editorRef.current?.getPosition();
              const pending = inlineAcceptRef.current;

              if (model && position && pending &&
                  pending.lineNumber === position.lineNumber &&
                  pending.column === position.column &&
                  pending.versionId === model.getAlternativeVersionId()) {
                const insertText = pending.insertText;
                const nextWordMatch = insertText.match(/^\S+/);
                const acceptText = nextWordMatch ? nextWordMatch[0] : insertText.charAt(0);

                if (acceptText) {
                  try {
                    const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
                    editorRef.current.executeEdits('ai-inline-accept-word', [{
                      range,
                      text: acceptText,
                      forceMoveMarkers: true
                    }]);

                    const remainingText = insertText.substring(acceptText.length);
                    if (remainingText) {
                      inlineAcceptRef.current = {
                        insertText: remainingText,
                        lineNumber: position.lineNumber,
                        column: position.column + acceptText.length,
                        versionId: model.getAlternativeVersionId()
                      };
                    } else {
                      inlineAcceptRef.current = null;
                      clearAllGhostTexts();
                    }

                    e.preventDefault();
                    e.stopPropagation();
                  } catch (error) {
                    inlineAcceptRef.current = null;
                  }
                }
              }
            }
            // End键接受全部补全
            else if (e.keyCode === monaco.KeyCode.End && !e.shiftKey && !e.ctrlKey && !e.altKey) {
              const model = editorRef.current?.getModel();
              const position = editorRef.current?.getPosition();
              const pending = inlineAcceptRef.current;

              if (model && position && pending &&
                  pending.lineNumber === position.lineNumber &&
                  pending.column === position.column &&
                  pending.versionId === model.getAlternativeVersionId()) {
                try {
                  const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
                  editorRef.current.executeEdits('ai-inline-accept-all', [{
                    range,
                    text: pending.insertText,
                    forceMoveMarkers: true
                  }]);
                  inlineAcceptRef.current = null;
                  clearAllGhostTexts();
                  e.preventDefault();
                  e.stopPropagation();
                } catch (error) {
                  inlineAcceptRef.current = null;
                }
              }
            }
            // Ctrl+G创建幽灵文本
            else if (e.keyCode === monaco.KeyCode.KeyG && (e.ctrlKey || e.metaKey)) {
              const selection = editorRef.current?.getSelection();
              const model = editorRef.current?.getModel();
              if (selection && model && !selection.isEmpty()) {
                const selectedText = model.getValueInRange(selection);
                if (selectedText.trim()) {
                  createGhostText(selectedText, selection);
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            }
            // Ctrl+Shift+G恢复幽灵文本
            else if (e.keyCode === monaco.KeyCode.KeyG && (e.ctrlKey || e.metaKey) && e.shiftKey) {
              restoreAllGhostTexts();
              e.preventDefault();
              e.stopPropagation();
            }
            // Ctrl+Alt+G接受当前行幽灵文本
            else if (e.keyCode === monaco.KeyCode.KeyG && (e.ctrlKey || e.metaKey) && e.altKey) {
              acceptCurrentLineGhostText();
              e.preventDefault();
              e.stopPropagation();
            }
            // Ctrl+L标记
            else if (e.keyCode === monaco.KeyCode.KeyL && (e.ctrlKey || e.metaKey)) {
              ctrlLPressedRef.current = true;
              setTimeout(() => {
                ctrlLPressedRef.current = false;
              }, 1000);
            }
            // Ctrl+/切换Markdown预览
            else if (e.keyCode === monaco.KeyCode.Slash && (e.ctrlKey || e.metaKey)) {
              handleToggleMarkdownPreview();
              e.preventDefault();
              e.stopPropagation();
            }
          });
        }

        // 添加编辑器动作（右键菜单）
        editorRef.current.addAction({
          id: 'execute-file',
          label: '执行文件',
          contextMenuGroupId: 'file-operations',
          contextMenuOrder: 1,
          run: handleExecuteFile,
          precondition: 'editorTextFocus'
        });

        editorRef.current.addAction({
          id: 'open-in-terminal',
          label: '在终端中打开',
          contextMenuGroupId: 'file-operations',
          contextMenuOrder: 2,
          run: handleOpenInTerminal,
          precondition: 'editorTextFocus'
        });

        editorRef.current.addAction({
          id: 'show-in-explorer',
          label: '在资源管理器中显示',
          contextMenuGroupId: 'file-operations',
          contextMenuOrder: 3,
          run: handleShowInExplorer,
          precondition: 'editorTextFocus'
        });

        editorRef.current.addAction({
          id: 'separator-1',
          label: '',
          contextMenuGroupId: 'file-operations',
          contextMenuOrder: 4,
          run: () => {},
          precondition: null
        });

        editorRef.current.addAction({
          id: 'ai-inline-completion',
          label: 'AI Inline Completion',
          run: () => {},
          precondition: null
        });

        // 链接点击处理（Ctrl+点击）
        editorRef.current.onMouseDown((e) => {
          if (e.event.ctrlKey || e.event.metaKey) {
            const position = e.target.position;
            if (position) {
              const model = editorRef.current.getModel();
              const lineContent = model.getLineContent(position.lineNumber);

              // 匹配链接模式
              const linkRegex = /https?:\/\/[^\s\)]+|\.\/[^\s\)]+|\.\.\/[^\s\)]+|[a-zA-Z0-9_-]+\.(md|txt|js|jsx|ts|tsx|py|java|cpp|c|h|css|scss|html|json|xml|yaml|yml)/g;
              let match;

              while ((match = linkRegex.exec(lineContent)) !== null) {
                const startCol = match.index + 1;
                const endCol = match.index + match[0].length + 1;

                if (position.column >= startCol && position.column <= endCol) {
                  const linkText = match[0];
                  handleLinkClick(linkText, currentFile?.path, fileManager.setOpenFile);
                  break;
                }
              }
            }
          }
        });

        // 滚动监听（控制返回顶部按钮）
        editorRef.current.onDidScrollChange((e) => {
          setShowBackToTop(e.scrollTop > 300);
        });

        // 设置核心监听器
        const setupCoreListeners = () => {
          if (!editorRef.current) return [];
          const disposables = [];

          // 光标位置变化监听
          const cursorDisposable = editorRef.current.onDidChangeCursorPosition((e) => {
            const newPosition = {
              lineNumber: e.position.lineNumber,
              column: e.position.column
            };
            cursorPositionRef.current = newPosition;
            if (setCursorPosition) {
              setCursorPosition(newPosition);
            }
          });
          disposables.push(cursorDisposable);

          // 内容变化监听（字符计数）
          const contentDisposable = editorRef.current.onDidChangeModelContent(() => {
            if (editorRef.current && setCharacterCount) {
              const currentValue = editorRef.current.getValue();
              setCharacterCount(currentValue.length);
            }
          });
          disposables.push(contentDisposable);

          // 模型变化监听
          const modelDisposable = editorRef.current.onDidChangeModel(() => {
            isCompletionActiveRef.current = false;
            if (editorRef.current) {
              const currentPosition = editorRef.current.getPosition();
              const currentValue = editorRef.current.getValue();

              if (currentPosition && setCursorPosition) {
                setCursorPosition({
                  lineNumber: currentPosition.lineNumber,
                  column: currentPosition.column
                });
              }

              if (setCharacterCount) {
                setCharacterCount(currentValue.length);
              }
            }
          });
          disposables.push(modelDisposable);

          return disposables;
        };

        const coreDisposables = setupCoreListeners();
        coreDisposablesRef.current = coreDisposables;

        // 初始化编辑器内容和语言
        setTimeout(() => {
          if (editorRef.current && currentFile && currentFile['content'] !== undefined) {
            const fileContent = currentFile['content'];
            if (editorRef.current.getValue() !== fileContent) {
              editorRef.current.setValue(fileContent);
            }

            // 确定语言（mgtree文件特殊处理）
            const tabBarLanguage = fileManager?.tabBarRef?.languageRef?.current;
            const fileNameLanguage = getFileLanguage(getCurrentTabFileName());
            let language;

            if (getCurrentTabFileName()?.endsWith('.mgtree')) {
              language = fileNameLanguage || 'mgtree';
            } else {
              language = tabBarLanguage || fileNameLanguage || 'plaintext';
            }

            monaco.editor.setModelLanguage(editorRef.current.getModel(), language);

            // 更新字符计数
            if (setCharacterCount) {
              const actualContent = editorRef.current.getValue();
              setCharacterCount(actualContent.length);
            }

            // 更新光标位置
            if (setCursorPosition) {
              const position = editorRef.current.getPosition() || { lineNumber: 1, column: 1 };
              setCursorPosition(position);
            }
          } else if (editorRef.current) {
            // 无文件时重置
            editorRef.current.setValue('');
            monaco.editor.setModelLanguage(editorRef.current.getModel(), 'plaintext');

            if (setCharacterCount) setCharacterCount(0);
            if (setCursorPosition) setCursorPosition({ lineNumber: 1, column: 1 });
          }
        }, 0);

      } catch (error) {
        console.error('编辑器初始化失败:', error);
      }
    }

    // 清理函数
    return () => {
      if (editorRef.current) {
        keydownDisposableRef.current?.dispose?.();
        keydownDisposableRef.current = null;

        inlineSuggestDisposableRef.current?.dispose?.();
        inlineSuggestDisposableRef.current = null;

        providerDisposablesRef.current.forEach(d => d?.dispose?.());
        providerDisposablesRef.current = [];

        coreDisposablesRef.current.forEach(d => d?.dispose?.());
        coreDisposablesRef.current = [];

        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [highlighterReady, createGhostText, restoreAllGhostTexts, acceptCurrentLineGhostText]);

  /**
   * 同步当前文件内容到编辑器
   * 当文件变化时更新编辑器内容和语言设置
   */
  useEffect(() => {
    if (!editorRef.current || isInternalChange.current) return;

    const fileContent = currentFile['content'];
    if (editorRef.current.getValue() !== fileContent) {
      editorRef.current.setValue(fileContent);
    }

    // 确定语言
    const tabBarLanguage = fileManager?.tabBarRef?.languageRef?.current;
    const fileNameLanguage = getFileLanguage(getCurrentTabFileName());
    let language;

    if (getCurrentTabFileName()?.endsWith('.mgtree')) {
      language = fileNameLanguage || 'mgtree';
    } else {
      language = tabBarLanguage || fileNameLanguage || 'plaintext';
    }

    monaco.editor.setModelLanguage(editorRef.current.getModel(), language);

    // 同步状态
    setTimeout(() => {
      if (editorRef.current) {
        if (setCharacterCount) {
          const actualContent = editorRef.current.getValue();
          setCharacterCount(actualContent.length);
        }

        if (setCursorPosition) {
          const position = editorRef.current.getPosition() || { lineNumber: 1, column: 1 };
          setCursorPosition(position);
        }
      }
    }, 0);
  }, [currentFile, getFileLanguage, setCharacterCount, setCursorPosition]);

  /**
   * 监听编辑器内容变化，同步到文件管理器
   * 并更新幽灵文本状态
   */
  useEffect(() => {
    if (!editorRef.current) return;

    const disposable = editorRef.current.onDidChangeModelContent((e) => {
      isInternalChange.current = true;
      const currentValue = editorRef.current.getValue();
      if (currentFile && updateContent) {
        updateContent(currentValue);
      }

      updateGhostTextsOnChange(e);

      setTimeout(() => {
        isInternalChange.current = false;
      }, 0);
    });

    return () => {
      disposable.dispose();
    };
  }, [updateContent, currentFile, updateGhostTextsOnChange, highlighterReady]);

  /**
   * 文件保存状态变化时清除幽灵文本
   */
  useEffect(() => {
    if (!currentFile) return;

    if (wasModifiedRef.current && !currentFile['isModified']) {
      clearAllGhostTexts();
    }

    wasModifiedRef.current = currentFile['isModified'];
  }, [currentFile?.isModified, clearAllGhostTexts]);

  /**
   * 配置AI代码补全提供者
   * 注册Monaco的内联补全服务
   */
  useEffect(() => {
    if (!editorRef.current) return;

    // 清理之前的提供者
    providerDisposablesRef.current.forEach(d => d?.dispose?.());
    providerDisposablesRef.current = [];
    inlineAcceptRef.current = null;

    if (!aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
      editorRef.current.updateOptions({ inlineSuggest: { enabled: true } });
      return;
    }

    editorRef.current.updateOptions({ inlineSuggest: { enabled: true } });

    // 为所有语言注册补全提供者
    const allLangs = monaco.languages.getLanguages().map(l => l.id);
    const disposables = allLangs.map(langId =>
        monaco.languages.registerInlineCompletionsProvider(langId, {
          provideInlineCompletions: async (model, position, context, token) => {
            try {
              isCompletionActiveRef.current = true;

              // 处理重试建议
              if (retrySuggestionRef.current) {
                const retrySuggestion = retrySuggestionRef.current;
                const currentPos = position;

                if (retrySuggestion.position.lineNumber === currentPos.lineNumber &&
                    retrySuggestion.position.column === currentPos.column &&
                    Date.now() - retrySuggestion.timestamp < 30000) {
                  retrySuggestionRef.current = null;
                  isCompletionActiveRef.current = false;

                  return {
                    items: [{
                      insertText: retrySuggestion.text,
                      range: {
                        startLineNumber: currentPos.lineNumber,
                        startColumn: currentPos.column,
                        endLineNumber: currentPos.lineNumber,
                        endColumn: currentPos.column
                      }
                    }]
                  };
                } else {
                  retrySuggestionRef.current = null;
                }
              }

              // 检查当前位置是否有幽灵文本
              const hasGhostTextAtCursor = Array.from(ghostTextsRef.current.values()).some(ghostData => {
                const ghostPos = ghostData.originalPosition || ghostData.currentPosition;
                return ghostPos &&
                    ghostPos.lineNumber === position.lineNumber &&
                    ghostPos.column === position.column;
              });

              if (hasGhostTextAtCursor) {
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              // 检查AI配置
              if (!aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              // 请求频率限制
              const now = Date.now();
              if (apiRequestCountRef.current > 0 && now - lastRequestTimeRef.current > 10000) {
                apiRequestCountRef.current = 0;
                firstRequestTimeRef.current = 0;
                if (apiRequestResetTimerRef.current) {
                  clearTimeout(apiRequestResetTimerRef.current);
                  apiRequestResetTimerRef.current = null;
                }
              }

              if (apiRequestCountRef.current >= MAX_REQUESTS_PER_MINUTE) {
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              apiRequestCountRef.current++;
              lastRequestTimeRef.current = now;
              if (apiRequestCountRef.current === 1) {
                firstRequestTimeRef.current = now;
              }

              // 重置请求计数定时器
              if (apiRequestResetTimerRef.current) {
                clearTimeout(apiRequestResetTimerRef.current);
              }
              const timeElapsed = now - firstRequestTimeRef.current;
              const timeRemaining = Math.max(0, REQUEST_RESET_INTERVAL - timeElapsed);
              apiRequestResetTimerRef.current = setTimeout(() => {
                apiRequestCountRef.current = 0;
                firstRequestTimeRef.current = 0;
              }, timeRemaining);

              // 准备补全上下文
              const before = model.getValueInRange(new monaco.Range(1, 1, position.lineNumber, position.column));
              const after = model.getValueInRange(new monaco.Range(position.lineNumber, position.column, model.getLineCount(), model.getLineMaxColumn(model.getLineCount())));
              const language = model.getLanguageId();

              const maxContext = 4000;
              const prefix = before.slice(-maxContext);
              const suffix = after.slice(0, 1000);

              const currentLine = model.getLineContent(position.lineNumber);
              const beforeCursor = currentLine.substring(0, position.column - 1);

              // 上下文不足时不请求补全
              if (prefix.trim().length < 1 && beforeCursor.trim().length < 1) {
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              // 判断行类型（注释/字符串/代码）
              const trimmedLine = currentLine.trim();
              const isCommentLine = trimmedLine.startsWith('//') ||
                  trimmedLine.startsWith('/*') ||
                  trimmedLine.startsWith('*') ||
                  trimmedLine.startsWith('#') ||
                  trimmedLine.startsWith('<!--');

              const inString = (beforeCursor.split('"').length - 1) % 2 === 1 ||
                  (beforeCursor.split("'").length - 1) % 2 === 1 ||
                  (beforeCursor.split('`').length - 1) % 2 === 1;

              const afterCursorText = currentLine.substring(position.column - 1);
              const fullSuffix = suffix + '\n' + afterCursorText;

              // 上下文分析
              const contextAnalysis = {
                lineType: isCommentLine ? 'comment' : (inString ? 'string' : 'code'),
                hasPrefix: beforeCursor.trim().length > 0,
                hasSuffix: afterCursorText.trim().length > 0,
                isLineComplete: currentLine.trim().endsWith(';') || currentLine.trim().endsWith('}') || currentLine.trim().endsWith('{'),
                wordCount: currentLine.split(/[\s\W]+/).filter(w => w.length > 1).length
              };

              // 构建AI请求体
              const body = {
                model: aiSettings.model,
                messages: [
                  {
                    role: 'system',
                    content: `你是高级AI代码补全引擎，使用Fill-in-the-Middle技术。提供上下文准确、非重复的补全，无缝连接前缀和后缀内容。`
                  },
                  {
                    role: 'user',
                    content: `CONTEXT ANALYSIS:
- Language: ${language}
- Line Type: ${contextAnalysis.lineType}
- Current Line: "${currentLine}"
- Cursor Position: Column ${position.column}
- Has Prefix: ${contextAnalysis.hasPrefix}
- Has Suffix: ${contextAnalysis.hasSuffix}
- Line Complete: ${contextAnalysis.isLineComplete}
- Word Count: ${contextAnalysis.wordCount}

FIM CONTEXT:
PREFIX (before cursor):
\`\`\`
${prefix}
\`\`\`

CURRENT LINE BEFORE CURSOR: "${beforeCursor}"
CURRENT LINE AFTER CURSOR: "${afterCursorText}"

SUFFIX (after cursor):
\`\`\`
${fullSuffix.slice(0, 500)}
\`\`\`

CRITICAL FILTERING RULES (MUST FOLLOW):
🚫 不要重复当前行中的任何单词
🚫 不要在注释行添加注释符号(//,/*,*/)
🚫 不要重复后缀中的内容
🚫 不要建议过长内容
🚫 不要重复前缀的最后一个单词

✅ COMPLETION STRATEGY:
1. 如果是注释行:
   - 如果注释描述了要实现的代码（如"实现二分查找"），建议实际代码实现
   - 否则，继续自然文本，不加符号
2. 如果是字符串: 自然补全字符串内容
3. 如果是代码: 适当补全语法/逻辑
4. 如果有后缀: 确保补全平滑连接前缀→后缀
5. 如果行看起来完整: 建议最少或不补全

返回仅补全文本（无解释，无代码块，无引号）。
如果没有好的补全，返回空字符串。
对于代码实现，适当鼓励多行补全。`
                  }
                ],
                temperature: 0.05,
                max_tokens: 1000,
                stream: false
              };

              // 发送AI请求
              const controller = new AbortController();
              const unsub = token.onCancellationRequested?.(() => controller.abort());

              const res = await fetch(`${aiSettings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
                method: 'POST',
                mode: 'cors',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${aiSettings.apiKey}`,
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify(body),
                signal: controller.signal
              });
              unsub?.dispose?.();

              if (!res.ok) {
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              const data = await res.json();
              let text = data?.choices?.[0]?.message?.content ?? '';

              // 处理补全文本
              let insert = (text || '')
                  .replace(/^```[\s\S]*?\n|```$/g, '')
                  .replace(/\r/g, '')
                  .trim();

              if (!insert || insert.length < 1) {
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              const trimmedInsert = insert.trim();
              const trimmedBeforeCursor = beforeCursor.trim();

              if (!trimmedInsert || trimmedInsert.length < 1) {
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              // 补全重试处理函数
              const scheduleRetryWithReason = (rejectionReason, filterName) => {
                setTimeout(async () => {
                  try {
                    const retryResult = await retryCompletionWithReason(model, position, context, token, rejectionReason, filterName);
                    if (retryResult && retryResult.items && retryResult.items.length > 0) {
                      const suggestion = retryResult.items[0].insertText;
                      const currentPosition = editorRef.current.getPosition();
                      retrySuggestionRef.current = {
                        text: suggestion,
                        position: {
                          lineNumber: currentPosition.lineNumber,
                          column: currentPosition.column
                        },
                        timestamp: Date.now()
                      };
                      editorRef.current.trigger('retry', 'editor.action.inlineSuggest.trigger', {});
                    }
                  } catch (error) {
                    // 忽略重试错误
                  }
                }, 2000);
              };

              // 带原因的补全重试
              const retryCompletionWithReason = async (model, position, context, token, rejectionReason, filterName) => {
                try {
                  const currentLine = model.getLineContent(position.lineNumber);
                  const beforeCursor = currentLine.substring(0, position.column - 1);
                  const afterCursorText = currentLine.substring(position.column - 1);

                  const existingWords = currentLine.toLowerCase().match(/\b\w+\b/g) || [];
                  const avoidWords = existingWords.join('、');

                  const language = model.getLanguageId();

                  const retryBody = {
                    model: aiSettings.model,
                    messages: [
                      {
                        role: 'system',
                        content: `你是高级AI代码补全引擎。之前的补全被${filterName}拒绝，原因: ${rejectionReason}。必须提供完全不同的补全，避免所有现有单词和内容。`
                      },
                      {
                        role: 'user',
                        content: `**CRITICAL RETRY REQUEST**

Previous rejection: ${rejectionReason}
Filter: ${filterName}

**STRICT REQUIREMENTS**:
1. 不要使用这些现有单词: ${avoidWords}
2. 不要重复当前行的任何内容: "${currentLine}"
3. 提供完全不同的、有创意的补全
4. 确保内容有意义且有价值

**Context**:
- Language: ${language}
- Before Cursor: "${beforeCursor}"
- After Cursor: "${afterCursorText}"

**Output Requirements**:
- 只返回要插入的代码
- 无解释或注释
- 确保语法正确和上下文匹配
- 提供有创意的、非重复的内容
- 最多50个字符`
                      }
                    ],
                    temperature: 0.1,
                    max_tokens: 200,
                    stream: false
                  };

                  const controller = new AbortController();
                  const res = await fetch(`${aiSettings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${aiSettings.apiKey}`,
                    },
                    body: JSON.stringify(retryBody),
                    signal: controller.signal
                  });

                  if (res.ok) {
                    const data = await res.json();
                    const retryText = data?.choices?.[0]?.message?.content ?? '';
                    const retryInsert = retryText.replace(/^```[\s\S]*?\n|```$/g, '').replace(/\r/g, '').trim();

                    if (retryInsert && retryInsert.length > 0) {
                      isCompletionActiveRef.current = false;
                      return {
                        items: [{
                          insertText: retryInsert,
                          range: {
                            startLineNumber: position.lineNumber,
                            startColumn: position.column,
                            endLineNumber: position.lineNumber,
                            endColumn: position.column
                          }
                        }]
                      };
                    }
                  }
                } catch (error) {
                  // 忽略错误
                }
              };

              // 补全过滤规则 - 1. 注释行不包含注释符号
              if (isCommentLine) {
                const commentSymbols = ['//', '/*', '*/', '*', '#'];
                const hasCommentSymbol = commentSymbols.some(symbol => trimmedInsert.includes(symbol));

                if (hasCommentSymbol) {
                  if (!(currentLine.trim() === '' && beforeCursor.trim() === '')) {
                    const rejectionReason = `在注释行中添加了注释符号 (${commentSymbols.filter(s => trimmedInsert.includes(s)).join(', ')})，这会造成重复`;
                    scheduleRetryWithReason(rejectionReason, 'Super Filter 1');
                    isCompletionActiveRef.current = false;
                    return { items: [] };
                  }
                }
              }

              // 补全过滤规则 - 2. 不重复当前行单词
              const currentLineWords = currentLine.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 1);
              const insertWords = trimmedInsert.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 1);

              for (const insertWord of insertWords) {
                if (insertWord.length >= 3) {
                  for (const lineWord of currentLineWords) {
                    if (lineWord.length >= 3 && (insertWord.includes(lineWord) || lineWord.includes(insertWord))) {
                      const rejectionReason = `建议的单词 "${insertWord}" 与当前行的单词 "${lineWord}" 存在重复或包含关系`;
                      scheduleRetryWithReason(rejectionReason, 'Super Filter 2b');
                      isCompletionActiveRef.current = false;
                      return { items: [] };
                    }
                  }
                }
              }

              // 补全过滤规则 - 3. 避免前缀重叠
              if (trimmedBeforeCursor.length >= 3 && trimmedInsert.length >= 3) {
                const beforeEnd = trimmedBeforeCursor.slice(-8).toLowerCase();
                const insertStart = trimmedInsert.slice(0, 8).toLowerCase();

                for (let len = Math.min(beforeEnd.length, insertStart.length); len >= 4; len--) {
                  if (beforeEnd.slice(-len) === insertStart.slice(0, len)) {
                    const overlap = beforeEnd.slice(-len);
                    const commonPatterns = ['const', 'function', 'return', 'console', 'this.', '.get', '.set', 'user.', 'data.'];
                    const isCommonPattern = commonPatterns.some(pattern => overlap.includes(pattern.toLowerCase()));

                    if (!isCommonPattern) {
                      const rejectionReason = `建议的开头 "${overlap}" 与光标前的文本末尾重复，造成了显著的前缀重叠`;
                      scheduleRetryWithReason(rejectionReason, 'Super Filter 3');
                      isCompletionActiveRef.current = false;
                      return { items: [] };
                    }
                  }
                }
              }

              // 补全过滤规则 - 4. 不重复后缀内容
              const afterCursorWords = afterCursorText.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 1);
              const afterCursorDuplicates = insertWords.filter(word => afterCursorWords.includes(word));
              if (afterCursorDuplicates.length > 0) {
                const rejectionReason = `建议中的单词 [${afterCursorDuplicates.join(', ')}] 与光标后的内容重复`;
                scheduleRetryWithReason(rejectionReason, 'Super Filter 4a');
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              if (afterCursorText.trim().length > 0 && trimmedInsert.length > 0) {
                const afterCursorTrimmed = afterCursorText.trim().toLowerCase();
                const insertTrimmed = trimmedInsert.trim().toLowerCase();

                if (afterCursorTrimmed.includes(insertTrimmed) || insertTrimmed.includes(afterCursorTrimmed)) {
                  const rejectionReason = `建议内容 "${insertTrimmed}" 与光标后的内容 "${afterCursorTrimmed}" 存在字符级重叠`;
                  scheduleRetryWithReason(rejectionReason, 'Super Filter 4b');
                  isCompletionActiveRef.current = false;
                  return { items: [] };
                }
              }

              // 补全过滤规则 - 5. 避免单词级重复
              if (trimmedBeforeCursor.length > 0 && trimmedInsert.length > 0) {
                const lastWordBefore = trimmedBeforeCursor.split(/[\s\W]+/).filter(w => w.length > 0).pop()?.toLowerCase() || '';
                const firstWordInsert = trimmedInsert.split(/[\s\W]+/).filter(w => w.length > 0)[0]?.toLowerCase() || '';

                if (lastWordBefore === firstWordInsert && lastWordBefore.length > 0) {
                  const rejectionReason = `光标前的最后一个单词 "${lastWordBefore}" 与建议的第一个单词完全相同`;
                  scheduleRetryWithReason(rejectionReason, 'Super Filter 5a');
                  isCompletionActiveRef.current = false;
                  return { items: [] };
                }

                if (lastWordBefore.length >= 2 && firstWordInsert.length >= 2) {
                  if (lastWordBefore.includes(firstWordInsert) || firstWordInsert.includes(lastWordBefore)) {
                    const rejectionReason = `单词边界存在包含关系: "${lastWordBefore}" 与 "${firstWordInsert}" 互相包含`;
                    scheduleRetryWithReason(rejectionReason, 'Super Filter 5b');
                    isCompletionActiveRef.current = false;
                    return { items: [] };
                  }
                }

                for (let len = Math.min(lastWordBefore.length, firstWordInsert.length); len >= 2; len--) {
                  if (lastWordBefore.slice(-len) === firstWordInsert.slice(0, len)) {
                    const rejectionReason = `字符级单词重叠: "${lastWordBefore.slice(-len)}" 在光标前后都出现`;
                    scheduleRetryWithReason(rejectionReason, 'Super Filter 5c');
                    isCompletionActiveRef.current = false;
                    return { items: [] };
                  }
                }
              }

              // 补全过滤规则 - 6. 注释行语义不重复
              if (isCommentLine && trimmedInsert.length > 3) {
                const similarity = calculateTextSimilarity(currentLine.toLowerCase(), trimmedInsert.toLowerCase());
                if (similarity > 0.3) {
                  const rejectionReason = `语义相似性过高 (${similarity.toFixed(2)})，建议内容与当前行过于相似`;
                  scheduleRetryWithReason(rejectionReason, 'Super Filter 6');
                  isCompletionActiveRef.current = false;
                  return { items: [] };
                }

                const currentCommentWords = currentLine.replace(/\/\/|\/\*|\*\/|\*/g, '').trim().toLowerCase().split(/\s+/).filter(w => w.length > 2);
                const insertCommentWords = trimmedInsert.toLowerCase().split(/\s+/).filter(w => w.length > 2);

                const commonWords = insertCommentWords.filter(word => currentCommentWords.includes(word));
                if (commonWords.length > 0) {
                  const rejectionReason = `注释关键词重叠: [${commonWords.join(', ')}] 在当前行和建议中都出现`;
                  scheduleRetryWithReason(rejectionReason, 'Super Filter 6b');
                  isCompletionActiveRef.current = false;
                  return { items: [] };
                }
              }

              // 补全过滤规则 - 7. 内容有效性检查
              if (trimmedInsert.length < 1) {
                const rejectionReason = '建议内容为空，没有提供有效的补全内容';
                scheduleRetryWithReason(rejectionReason, 'Super Filter 7b');
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              const meaningfulContent = /[a-zA-Z\u4e00-\u9fa5\d]/.test(trimmedInsert);
              if (!meaningfulContent) {
                const rejectionReason = '建议内容缺乏有意义的字符，只包含空白字符或标点符号';
                scheduleRetryWithReason(rejectionReason, 'Super Filter 7c');
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              const uniqueChars = new Set(trimmedInsert.toLowerCase().replace(/\s/g, ''));
              if (uniqueChars.size <= 2 && trimmedInsert.length > 5) {
                const rejectionReason = `建议内容过于重复，只包含 ${uniqueChars.size} 种不同字符但长度为 ${trimmedInsert.length}`;
                scheduleRetryWithReason(rejectionReason, 'Super Filter 7d');
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              // 文本相似度计算函数
              function calculateTextSimilarity(text1, text2) {
                const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
                const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

                if (words1.size === 0 && words2.size === 0) return 1;
                if (words1.size === 0 || words2.size === 0) return 0;

                const intersection = new Set([...words1].filter(x => words2.has(x)));
                const union = new Set([...words1, ...words2]);

                return intersection.size / union.size;
              }

              // 准备补全项
              inlineAcceptRef.current = {
                insertText: insert,
                lineNumber: position.lineNumber,
                column: position.column,
                versionId: model.getAlternativeVersionId()
              };

              const completionItem = {
                insertText: insert,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column
                },
                command: {
                  id: 'ai-inline-completion',
                  title: 'AI Inline Completion'
                },
                kind: monaco.languages.CompletionItemKind.Text,
                label: insert.substring(0, 20) + (insert.length > 20 ? '...' : ''),
                filterText: insert,
                sortText: '0000',
                preselect: true
              };

              return {
                items: [completionItem],
                enableForwardStability: true
              };
            } catch (error) {
              if (error.name === 'AbortError') {
                isCompletionActiveRef.current = false;
                return { items: [] };
              }
              isCompletionActiveRef.current = false;
              return { items: [] };
            }
          },
          freeInlineCompletions: () => {
            inlineAcceptRef.current = null;
            isCompletionActiveRef.current = false;
          }
        })
    );

    providerDisposablesRef.current = disposables;

    return () => {
      disposables.forEach(d => d?.dispose?.());
      if (apiRequestResetTimerRef.current) {
        clearTimeout(apiRequestResetTimerRef.current);
        apiRequestResetTimerRef.current = null;
      }
    };
  }, [aiSettings]);

  /**
   * 主题变化时更新编辑器主题
   * 区分mgtree文件和普通文件的主题处理
   */
  useEffect(() => {
    if (editorRef.current) {
      try {
        if (getCurrentTabFileName().endsWith('.mgtree')) {
          // mgtree文件使用专用主题
          const mgtreeTheme = isDarkMode ? 'mgtree-dark' : 'mgtree-light';
          try {
            monaco.editor.setTheme(mgtreeTheme);
          } catch (setError) {
            console.warn(`设置${mgtreeTheme}失败，尝试重新定义:`, setError);
            try {
              monaco.editor.defineTheme('mgtree-dark', mgtreeThemeConfig.dark);
              monaco.editor.defineTheme('mgtree-light', mgtreeThemeConfig.light);
              monaco.editor.setTheme(mgtreeTheme);
            } catch (redefineError) {
              console.error('重新定义mgtree主题失败:', redefineError);
              monaco.editor.setTheme(isDarkMode ? 'vs-dark' : 'vs');
            }
          }
        } else {
          // 其他文件使用Shiki主题
          const shikiTheme = isDarkMode ? 'one-dark-pro' : 'one-light';
          try {
            monaco.editor.setTheme(shikiTheme);
          } catch (shikiError) {
            console.error(`设置Shiki主题${shikiTheme}失败:`, shikiError);
            const basicTheme = isDarkMode ? 'vs-dark' : 'vs';
            monaco.editor.setTheme(basicTheme);
          }
        }
      } catch (error) {
        console.error('主题设置失败:', error);
        try {
          monaco.editor.setTheme('vs-dark');
        } catch (fallbackError) {
          console.error('基础主题设置也失败:', fallbackError);
        }
      }
    }
  }, [getEditorTheme, highlighterReady, isDarkMode, currentFile]);

  /**
   * 字体相关设置变化时更新编辑器
   */
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize,
        fontFamily,
        lineHeight,
      });
    }
  }, [fontSize, fontFamily, lineHeight]);

  /**
   * 编辑器行为设置变化时更新
   */
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        wordWrap,
        minimap,
        scrollBeyondLastLine,
        tabSize,
        insertSpaces,
        renderWhitespace,
        cursorBlinking,
        cursorStyle,
        lineNumbers,
        glyphMargin,
        folding,
        showFoldingControls,
        matchBrackets,
        autoIndent,
        formatOnPaste,
        formatOnType,
      });
    }
  }, [wordWrap, minimap, scrollBeyondLastLine, tabSize, insertSpaces, renderWhitespace, cursorBlinking, cursorStyle, lineNumbers, glyphMargin, folding, showFoldingControls, matchBrackets, autoIndent, formatOnPaste, formatOnType]);

  /**
   * 组件卸载时清理资源
   */
  useEffect(() => {
    return () => {
      providerDisposablesRef.current.forEach(d => d?.dispose?.());
      keydownDisposableRef.current?.dispose?.();
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      if (triggerTimeoutRef.current) {
        clearTimeout(triggerTimeoutRef.current);
        triggerTimeoutRef.current = null;
      }
      if (createGhostTimeoutRef.current) {
        clearTimeout(createGhostTimeoutRef.current);
        createGhostTimeoutRef.current = null;
      }
    };
  }, []);

  // 渲染编辑器组件
  return (
      <div className="editor-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
        {!currentFile && (
            <div className="editor-empty-overlay">
              <Empty
                  description="请打开一个文件开始编辑"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
        )}

        {/* Markdown预览模式 */}
        {actualShowMarkdownPreview && currentFile && isMarkdownFile() && (
            <div className="markdown-preview-overlay" style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent',
              zIndex: 1000
            }}>
              <MarkdownViewer
                  content={currentFile['content'] || ''}
                  onClose={handleCloseMarkdownPreview}
                  fileName={currentFile?.name}
                  currentFolder={(() => {
                    if (!currentFile?.path) return '';
                    const pathSeparator = currentFile['path'].includes('\\') ? '\\' : '/';
                    const pathParts = currentFile['path'].split(pathSeparator);
                    return pathParts.slice(0, -1).join(pathSeparator);
                  })()}
                  openFile={fileManager.setOpenFile}
                  isHeaderVisible={isHeaderVisible}
              />
            </div>
        )}

        <div
            ref={containerRef}
            className="code-editor"
            style={{
              width: '100%',
              height: '100%',
              minHeight: '400px',
              opacity: currentFile ? 1 : 0.3,
              border: 'none',
              display: actualShowMarkdownPreview ? 'none' : 'block'
            }}
        />

        {/* 返回顶部悬浮按钮 */}
        {showBackToTop && currentFile && !actualShowMarkdownPreview && (
            <FloatButton
                icon={<VerticalAlignTopOutlined />}
                onClick={() => {
                  if (editorRef.current) {
                    // 平滑滚动到顶部
                    const editor = editorRef.current;
                    const currentScrollTop = editor.getScrollTop();
                    const duration = 800;
                    const startTime = performance.now();

                    const animateScroll = (currentTime) => {
                      const elapsed = currentTime - startTime;
                      const progress = Math.min(elapsed / duration, 1);
                      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
                      const scrollTop = currentScrollTop * (1 - easeOutCubic);

                      editor.setScrollTop(scrollTop);
                      if (progress < 1) {
                        requestAnimationFrame(animateScroll);
                      }
                    };

                    requestAnimationFrame(animateScroll);
                  }
                }}
                style={{
                  position: 'absolute',
                  right: 20,
                  bottom: 16,
                  zIndex: 1000
                }}
            />
        )}
      </div>
  );
}

export default CodeEditor;
