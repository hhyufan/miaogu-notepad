import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Empty, message } from 'antd';
import '../monaco-worker';
import * as monaco from 'monaco-editor';
import { shikiToMonaco } from '@shikijs/monaco';
import { createHighlighter } from 'shiki';
import { useEditor, useTheme } from '../hooks/redux';
import tauriApi from '../utils/tauriApi';
import MarkdownViewer from './MarkdownViewer';
const { file: fileApi, settings: settingsApi } = tauriApi;
// 内联主题配置，只保留使用的One主题
const themes = {
  'One': ['one-dark-pro', 'one-light']
};
import extensionToLanguage from '../configs/file-extensions.json';
import './CodeEditor.scss';

function CodeEditor({ isDarkMode, fileManager, showMarkdownPreview = false }) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const isInternalChange = useRef(false); // 防止循环更新
  const [highlighterReady, setHighlighterReady] = useState(false);
  const [internalShowMarkdownPreview, setInternalShowMarkdownPreview] = useState(false);

  // 使用外部传入的showMarkdownPreview或内部状态
  const actualShowMarkdownPreview = showMarkdownPreview || internalShowMarkdownPreview;
  const { fontSize, fontFamily, lineHeight } = useTheme();
  const { wordWrap, scrollBeyondLastLine, tabSize, insertSpaces, minimap, lineNumbers, folding, matchBrackets, autoIndent, formatOnPaste, formatOnType, renderWhitespace, cursorBlinking, cursorStyle, glyphMargin, showFoldingControls } = useEditor();
  const { currentFile, updateCode: updateContent } = fileManager;
  // AI 设置
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
  const ctrlLPressedRef = useRef(false);

  // 光标位置监听和自动补全相关状态
  const cursorPositionRef = useRef(null);
  const cursorTimerRef = useRef(null);
  const isCompletionActiveRef = useRef(false);

  // API请求节流相关状态
  const apiRequestCountRef = useRef(0);
  const apiRequestResetTimerRef = useRef(null);
  const lastRequestTimeRef = useRef(0);
  const firstRequestTimeRef = useRef(0); // 记录第一次请求的时间
  const DEBOUNCE_DELAY = 2000; // 2秒防抖
  const MAX_REQUESTS_PER_MINUTE = 6; // 10秒内最多6次请求

  // 判断是否为Markdown文件（直接从AppHeader DOM获取显示的文件名）
  const isMarkdownFile = useCallback(() => {
    // 从AppHeader的DOM元素获取实际显示的文件名
    let displayFileName = '';

    try {
      const element = document.querySelector('h4.ant-typography');
      if (element && element.textContent && element.textContent.trim()) {
        displayFileName = element.textContent.trim();
        console.log(`成功从AppHeader获取文件名: ${displayFileName}`);
      }
    } catch (error) {
      console.log('无法从DOM获取文件名', error);
      return false;
    }

    if (!displayFileName) {
      console.log('isMarkdownFile: 未获取到文件名');
      return false;
    }

    const extension = displayFileName.toLowerCase().split('.').pop();
    const isMarkdown = ['md', 'markdown', 'mgtree'].includes(extension);
    console.log('isMarkdownFile 检测:', {
      displayFileName,
      extension,
      isMarkdown
    });
    return isMarkdown;
  }, []);

  // 切换Markdown预览
  const handleToggleMarkdownPreview = useCallback(() => {
    if (!currentFile) {
      message.warning('请先打开一个文件');
      return;
    }

    if (!isMarkdownFile()) {
      message.warning('只有Markdown文件支持预览功能');
      return;
    }
    setInternalShowMarkdownPreview(prev => !prev);
  }, [isMarkdownFile, currentFile]);

  // 关闭Markdown预览
  const handleCloseMarkdownPreview = useCallback(() => {
    setInternalShowMarkdownPreview(false);
  }, []);
  const REQUEST_RESET_INTERVAL = 10000; // 10秒重置计数器

  // 重试建议存储
  const retrySuggestionRef = useRef(null);

  // 幽灵文本管理
  const ghostTextsRef = useRef(new Map()); // 存储幽灵文本 {id: {text, range, decorationId}}
  const ghostTextCounterRef = useRef(0); // 幽灵文本ID计数器
  const triggerTimeoutRef = useRef(null); // 触发延迟管理
  const pendingGhostTextsRef = useRef([]); // 待创建的幽灵文本缓存
  const createGhostTimeoutRef = useRef(null); // 创建幽灵文本的防抖定时器
  // ghostDecorationsRef 已移除，改用内联建议提供器

  // 提取：读取 AI 设置
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
      // ignore
    }
  }, [setAiSettings]);

  // 读取 AI 设置（从存储）
  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadAiSettings();
    })();
    return () => { mounted = false; };
  }, [loadAiSettings]);

  // 监听设置页面保存事件，实时更新 AI 设置
  useEffect(() => {
    const handler = () => { loadAiSettings().catch(); };
    window.addEventListener('ai-settings-changed', handler);
    return () => window.removeEventListener('ai-settings-changed', handler);
  }, [loadAiSettings]);

  // 计算幽灵文本结束位置的辅助函数
  // 计算幽灵文本结束位置的辅助函数（普通函数，避免Hook调用错误）
  const calculateGhostEndPosition = (startPos, text) => {
    const lines = text.split('\n');
    if (lines.length === 1) {
      // 单行文本
      return {
        lineNumber: startPos.lineNumber,
        column: startPos.column + text.length
      };
    } else {
      // 多行文本
      return {
        lineNumber: startPos.lineNumber + lines.length - 1,
        column: lines[lines.length - 1].length + 1
      };
    }
  };

  // 创建幽灵文本
  const createGhostText = useCallback((text, range) => {
    if (!editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    // 过滤只包含换行符的文本
    if (!text || text.trim() === '' || /^\s*$/.test(text)) {
      return;
    }

    // 检查选中文本的左右是否存在幽灵文本，如果存在则追加而不是新建
    let leftGhost = null;
    let rightGhost = null;

    // 查找左侧相邻的幽灵文本（选中文本开始位置的左侧）
    for (const [id, ghostData] of ghostTextsRef.current) {
      const ghostPos = ghostData.originalPosition;

      // 检查是否在选中文本的左侧且相邻（考虑换行情况）
      if (ghostPos.lineNumber === range.startLineNumber) {
        // 同行情况：幽灵文本结束位置紧邻选中文本开始位置
        const ghostEndColumn = ghostPos.column + ghostData.originalText.length;
        if (ghostEndColumn === range.startColumn) {
          leftGhost = { id, ghostData };
        }
      } else if (ghostPos.lineNumber === range.startLineNumber - 1) {
        // 上一行情况：幽灵文本在上一行末尾，选中文本在下一行开头
        const lineContent = model.getLineContent(ghostPos.lineNumber);
        const ghostEndColumn = ghostPos.column + ghostData.originalText.length;
        // 检查幽灵文本是否包含换行符或者在行末尾
        const hasNewline = ghostData.originalText.includes('\n');
        if ((hasNewline || ghostEndColumn > lineContent.length) && range.startColumn === 1) {
          leftGhost = { id, ghostData };
        }
      }
    }

    // 查找右侧相邻的幽灵文本（选中文本结束位置的右侧）
    for (const [id, ghostData] of ghostTextsRef.current) {
      const ghostPos = ghostData.originalPosition;

      // 检查是否在选中文本的右侧且相邻（考虑换行情况）
      if (ghostPos.lineNumber === range.endLineNumber) {
        // 同行情况：幽灵文本开始位置紧邻选中文本结束位置
        if (ghostPos.column === range.endColumn) {
          rightGhost = { id, ghostData };
        }
      } else if (ghostPos.lineNumber === range.endLineNumber + 1) {
        // 下一行情况：选中文本在当前行末尾，幽灵文本在下一行开头
        const lineContent = model.getLineContent(range.endLineNumber);
        // 检查选中文本是否包含换行符或者在行末尾
        const selectedText = model.getValueInRange(range);
        const hasNewline = selectedText.includes('\n');
        if ((hasNewline || range.endColumn > lineContent.length) && ghostPos.column === 1) {
          rightGhost = { id, ghostData };
        }
      }
    }

    // 如果找到相邻的幽灵文本，进行合并而不是新建
    if (leftGhost || rightGhost) {
      let mergedText = '';
      let mergedPosition = null;
      let ghostsToRemove = [];

      if (leftGhost && rightGhost) {
        // 左右都有幽灵文本：左幽灵文本 + 选中文本 + 右幽灵文本
        // 检查是否需要在连接处添加换行符
        let leftText = leftGhost.ghostData.originalText;
        let rightText = rightGhost.ghostData.originalText;

        // 如果左幽灵文本和选中文本之间跨行，需要添加换行符
        if (leftGhost.ghostData.originalPosition.lineNumber < range.startLineNumber) {
          leftText = leftText + '\n';
        }

        // 如果选中文本和右幽灵文本之间跨行，需要添加换行符
        if (range.endLineNumber < rightGhost.ghostData.originalPosition.lineNumber) {
          text = text + '\n';
        }

        mergedText = leftText + text + rightText;
        mergedPosition = leftGhost.ghostData.originalPosition;
        ghostsToRemove = [leftGhost.id, rightGhost.id];
      } else if (leftGhost) {
        // 只有左侧幽灵文本：左幽灵文本 + 选中文本
        let leftText = leftGhost.ghostData.originalText;

        // 如果左幽灵文本和选中文本之间跨行，需要添加换行符
        if (leftGhost.ghostData.originalPosition.lineNumber < range.startLineNumber) {
          leftText = leftText + '\n';
        }

        mergedText = leftText + text;
        mergedPosition = leftGhost.ghostData.originalPosition;
        ghostsToRemove = [leftGhost.id];
      } else if (rightGhost) {
        // 只有右侧幽灵文本：选中文本 + 右幽灵文本
        let rightText = rightGhost.ghostData.originalText;

        // 如果选中文本和右幽灵文本之间跨行，需要添加换行符
        if (range.endLineNumber < rightGhost.ghostData.originalPosition.lineNumber) {
          text = text + '\n';
        }

        mergedText = text + rightText;
        mergedPosition = { lineNumber: range.startLineNumber, column: range.startColumn };
        ghostsToRemove = [rightGhost.id];
      }

      // 清除要合并的幽灵文本
      for (const ghostId of ghostsToRemove) {
        const ghostData = ghostTextsRef.current.get(ghostId);
        if (ghostData) {
          // 清除提供器
          if (ghostData.providerDisposable) {
            ghostData.providerDisposable.dispose();
          }
          ghostTextsRef.current.delete(ghostId);
        }
      }

      // 删除选中的文本
      editorRef.current.executeEdits('ghost-text-creation', [{
        range: range,
        text: '',
        forceMoveMarkers: true
      }]);

      // 使用合并后的文本和位置创建新的幽灵文本
      text = mergedText;
      range = new monaco.Range(
        mergedPosition.lineNumber, mergedPosition.column,
        mergedPosition.lineNumber, mergedPosition.column
      );
    } else {
      // 没有相邻幽灵文本，正常删除选中文本
      editorRef.current.executeEdits('ghost-text-creation', [{
        range: range,
        text: '',
        forceMoveMarkers: true
      }]);
    }

    // 生成唯一ID
    const ghostId = `ghost-${++ghostTextCounterRef.current}`;

    // 获取删除后的位置
    const position = { lineNumber: range.startLineNumber, column: range.startColumn };

    // 存储幽灵文本信息
    ghostTextsRef.current.set(ghostId, {
      text: text,
      originalRange: range,
      currentPosition: position,
      originalPosition: { ...position }, // 保存原始位置
      originalText: text // 保存原始文本用于匹配
    });

    // 创建自定义内联建议提供器
    const provider = {
      provideInlineCompletions: async (model, position, context, token) => {
        // 收集当前位置相关的所有幽灵文本
        const relevantGhosts = [];

        for (const [id, ghostData] of ghostTextsRef.current) {
          const originalPos = ghostData.originalPosition;

          // 检查当前位置是否在幽灵文本区域内或之后
          const isInGhostArea = position.lineNumber > originalPos.lineNumber ||
            (position.lineNumber === originalPos.lineNumber && position.column >= originalPos.column);

          if (isInGhostArea) {
            // 获取用户已输入的文本（支持多行）
            let userInput = '';

            if (position.lineNumber === originalPos.lineNumber) {
              // 同一行的情况
              const lineContent = model.getLineContent(position.lineNumber);
              userInput = lineContent.substring(originalPos.column - 1, position.column - 1);
            } else {
              // 跨行的情况，需要拼接多行文本
              for (let lineNum = originalPos.lineNumber; lineNum <= position.lineNumber; lineNum++) {
                const lineContent = model.getLineContent(lineNum);
                if (lineNum === originalPos.lineNumber) {
                  // 第一行：从原始位置开始
                  userInput += lineContent.substring(originalPos.column - 1);
                } else if (lineNum === position.lineNumber) {
                  // 最后一行：到当前位置
                  userInput += '\n' + lineContent.substring(0, position.column - 1);
                } else {
                  // 中间行：完整行
                  userInput += '\n' + lineContent;
                }
              }
            }

            // 更宽容的匹配逻辑：允许部分错误输入
            if (userInput.length < ghostData.originalText.length) {
              // 计算匹配度
              let matchScore = 0;
              const minLength = Math.min(userInput.length, ghostData.originalText.length);

              for (let i = 0; i < minLength; i++) {
                if (userInput[i] === ghostData.originalText[i]) {
                  matchScore++;
                }
              }

              // 更宽松的显示逻辑：光标在幽灵文本位置时就显示
              // 只要用户输入长度不超过幽灵文本长度，就显示幽灵文本
              relevantGhosts.push({
                ghostData,
                userInput,
                remainingText: ghostData.originalText.substring(userInput.length),
                originalPos
              });
            }
          }
        }

        if (relevantGhosts.length === 0) {
          return { items: [] };
        }

        // 按位置排序幽灵文本
        relevantGhosts.sort((a, b) => {
          if (a.originalPos.lineNumber !== b.originalPos.lineNumber) {
            return a.originalPos.lineNumber - b.originalPos.lineNumber;
          }
          return a.originalPos.column - b.originalPos.column;
        });

        // 只显示当前位置最相关的幽灵文本，避免错误合并
        let bestGhost = null;
        let bestScore = -1;

        for (const ghost of relevantGhosts) {
          // 计算与当前位置的匹配度
          let score = 0;

          // 位置匹配度：优先显示当前光标位置对应的幽灵文本
          if (ghost.originalPos.lineNumber === position.lineNumber &&
            ghost.originalPos.column <= position.column) {
            score += 100; // 同行且位置合适的幽灵文本优先级最高
          } else if (ghost.originalPos.lineNumber < position.lineNumber) {
            score += 50; // 前面行的幽灵文本次优先级
          }

          // 用户输入匹配度
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

        const mergedText = bestGhost ? bestGhost.remainingText : '';

        return {
          items: [{
            insertText: mergedText,
            range: new monaco.Range(
              position.lineNumber, position.column,
              position.lineNumber, position.column
            )
          }]
        };
      },
      freeInlineCompletions: () => { },
      handleItemDidShow: () => { },
      handlePartialAccept: () => { }
    };

    // 只为当前文件的语言注册提供器，避免全局冲突
    const currentLanguage = model.getLanguageId() || 'plaintext';
    const disposable = monaco.languages.registerInlineCompletionsProvider(currentLanguage, provider);

    // 存储提供器的disposable
    ghostTextsRef.current.get(ghostId).providerDisposable = disposable;

    // 防抖触发内联建议，避免频繁操作导致取消错误
    if (triggerTimeoutRef.current) {
      clearTimeout(triggerTimeoutRef.current);
    }

    triggerTimeoutRef.current = setTimeout(() => {
      try {
        // 移除不必要的setPosition调用，避免光标跳转
        editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
      } catch (error) {
        // 忽略取消错误，这是正常的编辑器行为
        if (!error.message?.includes('Canceled')) {
          // 忽略内联建议触发错误
        }
      }
      triggerTimeoutRef.current = null;
    }, 20);

    // 幽灵文本创建成功（静默）
  }, []);

  // 防抖创建幽灵文本函数
  const debouncedCreateGhostTexts = useCallback(() => {
    if (createGhostTimeoutRef.current) {
      clearTimeout(createGhostTimeoutRef.current);
    }

    createGhostTimeoutRef.current = setTimeout(() => {
      const pendingTexts = [...pendingGhostTextsRef.current];
      pendingGhostTextsRef.current = [];

      if (pendingTexts.length === 0) return;

      // 处理待创建的幽灵文本，避免错误合并
      const mergedTexts = [];
      for (const pending of pendingTexts) {
        // 检查是否有已存在的幽灵文本在完全相同的位置
        let foundExistingGhost = false;
        for (const [ghostId, ghostData] of ghostTextsRef.current) {
          const ghostPos = ghostData.originalPosition;
          // 只有在完全相同的位置且是安全删除产生的情况下才拼接
          if (ghostPos.lineNumber === pending.range.startLineNumber &&
            ghostPos.column === pending.range.startColumn &&
            pending.range.startColumn === pending.range.endColumn) { // 确保是插入操作，不是替换操作
            // 拼接文本到已存在的幽灵文本
            ghostData.text = ghostData.text + pending.text;
            ghostData.originalText = ghostData.originalText + pending.text;
            foundExistingGhost = true;
            break;
          }
        }

        if (!foundExistingGhost) {
          // 没有找到可拼接的幽灵文本，进行常规合并
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

      // 批量创建幽灵文本
      for (const { text, range } of mergedTexts) {
        createGhostText(text, range);
      }
    }, 100); // 优化防抖延迟从300ms减少到100ms
  }, []);

  // 添加文本到待创建缓存
  const addToPendingGhostTexts = useCallback((text, range) => {
    // 检查是否应该创建幽灵文本，避免重复创建
    const shouldCreateGhost = () => {
      // 检查待创建缓存中是否已有相同位置的文本
      const hasPendingAtSamePosition = pendingGhostTextsRef.current.some(pending =>
        pending.range.startLineNumber === range.startLineNumber &&
        pending.range.startColumn === range.startColumn &&
        pending.range.endLineNumber === range.endLineNumber &&
        pending.range.endColumn === range.endColumn
      );

      if (hasPendingAtSamePosition) {
        return false;
      }

      // 检查已存在的幽灵文本中是否有相同位置的
      for (const [id, ghostData] of ghostTextsRef.current) {
        const ghostPos = ghostData.originalPosition;
        // 如果在相同位置或重叠位置已有幽灵文本，不创建新的
        if (ghostPos.lineNumber === range.startLineNumber &&
          Math.abs(ghostPos.column - range.startColumn) <= 1) {
          return false;
        }
      }

      // 检查文本内容是否为空（但允许空白字符如换行符、空格等）
      if (!text) {
        return false;
      }

      return true;
    };

    if (shouldCreateGhost()) {
      pendingGhostTextsRef.current.push({ text, range });
      debouncedCreateGhostTexts();
    }
  }, [debouncedCreateGhostTexts]);



  // 清除特定的幽灵文本
  const clearSpecificGhostText = useCallback((ghostId) => {
    if (!editorRef.current || !ghostTextsRef.current.has(ghostId)) return;

    const ghostData = ghostTextsRef.current.get(ghostId);

    // 清理该幽灵文本的提供器
    if (ghostData.providerDisposable) {
      ghostData.providerDisposable.dispose();
    }

    // 从存储中移除该幽灵文本
    ghostTextsRef.current.delete(ghostId);

    // 如果没有其他幽灵文本，清空编辑器中的内联补全
    if (ghostTextsRef.current.size === 0) {
      const model = editorRef.current.getModel();
      if (model) {
        editorRef.current.trigger('clearGhostTexts', 'editor.action.inlineSuggest.hide', {});
      }
    }
  }, []);

  // 清空所有幽灵文本（保存时使用）
  const clearAllGhostTexts = useCallback(() => {
    if (!editorRef.current) return;

    // 清理所有幽灵文本提供器
    ghostTextsRef.current.forEach((ghostData, ghostId) => {
      if (ghostData.providerDisposable) {
        ghostData.providerDisposable.dispose();
      }
    });

    // 清空幽灵文本存储
    ghostTextsRef.current.clear();

    // 清空编辑器中的内联补全
    const model = editorRef.current.getModel();
    if (model) {
      // 触发模型内容变化，清除所有内联补全
      editorRef.current.trigger('clearGhostTexts', 'editor.action.inlineSuggest.hide', {});
    }

    // 幽灵文本已清空（静默）
  }, []);

  // 监听文件保存事件，保存成功后清空幽灵文本
  useEffect(() => {
    const handleFileSaved = () => {
      clearAllGhostTexts();
    };

    // 监听自定义的文件保存事件
    window.addEventListener('file-saved', handleFileSaved);

    return () => {
      window.removeEventListener('file-saved', handleFileSaved);
    };
  }, [clearAllGhostTexts]);

  // 还原所有幽灵文本
  const restoreAllGhostTexts = useCallback(() => {
    if (!editorRef.current || ghostTextsRef.current.size === 0) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const edits = [];

    // 收集所有需要还原的文本并清理提供器
    ghostTextsRef.current.forEach((ghostData, ghostId) => {
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

      // 清理内联建议提供器
      if (ghostData.providerDisposable) {
        ghostData.providerDisposable.dispose();
      }
    });

    // 执行文本还原
    editorRef.current.executeEdits('ghost-text-restoration', edits);

    // 清空幽灵文本存储
    const count = ghostTextsRef.current.size;
    ghostTextsRef.current.clear();

    // 幽灵文本已还原（静默）
  }, []);

  // 补充当前行的幽灵文本
  const acceptCurrentLineGhostText = useCallback(() => {
    if (!editorRef.current || ghostTextsRef.current.size === 0) {
      message.warning('没有可用的幽灵文本', 1);
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) return;

    const position = editorRef.current.getPosition();
    if (!position) return;

    // 调试信息已移除

    // 查找当前光标位置相关的幽灵文本
    for (const [ghostId, ghostData] of ghostTextsRef.current) {
      const originalPos = ghostData.originalPosition;
      // 调试信息已移除

      // 更宽松的区域检查：只要在幽灵文本起始位置之后即可
      const isInGhostArea = position.lineNumber > originalPos.lineNumber ||
        (position.lineNumber === originalPos.lineNumber && position.column >= originalPos.column);

      if (isInGhostArea) {
        // 光标在幽灵文本区域内

        // 获取用户已输入的文本
        let userInput = '';

        if (position.lineNumber === originalPos.lineNumber) {
          // 同一行的情况
          const lineContent = model.getLineContent(position.lineNumber);
          userInput = lineContent.substring(originalPos.column - 1, position.column - 1);
        } else {
          // 跨行的情况，需要拼接多行文本
          for (let lineNum = originalPos.lineNumber; lineNum <= position.lineNumber; lineNum++) {
            const lineContent = model.getLineContent(lineNum);
            if (lineNum === originalPos.lineNumber) {
              // 第一行：从原始位置开始
              userInput += lineContent.substring(originalPos.column - 1);
            } else if (lineNum === position.lineNumber) {
              // 最后一行：到当前位置
              userInput += '\n' + lineContent.substring(0, position.column - 1);
            } else {
              // 中间行：完整行
              userInput += '\n' + lineContent;
            }
          }
        }

        // 用户输入检测

        // 找到当前行在幽灵文本中的位置
        const ghostTextLines = ghostData.originalText.split('\n');
        const userInputLines = userInput.split('\n');
        const currentLineIndex = userInputLines.length - 1;

        // 行索引计算

        if (currentLineIndex < ghostTextLines.length) {
          const currentGhostLine = ghostTextLines[currentLineIndex];
          const currentUserLine = userInputLines[currentLineIndex] || '';

          // 行内容比较

          // 如果当前行还有未输入的内容，补充到行尾
          if (currentUserLine.length < currentGhostLine.length) {
            const remainingText = currentGhostLine.substring(currentUserLine.length);
            // 剩余文本计算

            // 插入剩余的当前行文本
            editorRef.current.executeEdits('ghost-line-accept', [{
              range: new monaco.Range(
                position.lineNumber, position.column,
                position.lineNumber, position.column
              ),
              text: remainingText,
              forceMoveMarkers: true
            }]);

            // 移动光标到行尾
            const newPosition = {
              lineNumber: position.lineNumber,
              column: position.column + remainingText.length
            };
            editorRef.current.setPosition(newPosition);

            // 检查是否已完全补充整个幽灵文本
            setTimeout(() => {
              const updatedPosition = editorRef.current.getPosition();
              if (updatedPosition) {
                // 获取从幽灵文本起始位置到当前位置的所有文本
                let completedInput = '';

                if (updatedPosition.lineNumber === originalPos.lineNumber) {
                  // 同一行的情况
                  const lineContent = model.getLineContent(originalPos.lineNumber);
                  completedInput = lineContent.substring(originalPos.column - 1, updatedPosition.column - 1);
                } else {
                  // 跨行的情况
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

                // 如果完全匹配幽灵文本，只清除当前这个幽灵文本
                if (completedInput === ghostData.originalText) {
                  clearSpecificGhostText(ghostId);
                }
              }
            }, 50);

            // 当前行幽灵文本已补充（静默）
            return;
          } else {
            message.info('当前行已完整输入', 1);
            return;
          }
        } else {
          message.info('已超出幽灵文本范围', 1);
          return;
        }
      }
    }

    message.warning('当前位置没有可补充的幽灵文本', 1);
  }, []);

  // 处理文本变化时的幽灵文本智能匹配
  const updateGhostTextsOnChange = useCallback((changeEvent) => {
    if (!editorRef.current || ghostTextsRef.current.size === 0) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    // 遍历所有变化
    changeEvent.changes.forEach(change => {
      const { range, text } = change;

      // 检查是否有幽灵文本受到影响
      ghostTextsRef.current.forEach((ghostData, ghostId) => {
        const originalPos = ghostData.originalPosition;

        // 检查变化是否影响幽灵文本区域
        const changeStartPos = { lineNumber: range.startLineNumber, column: range.startColumn };
        const changeEndPos = { lineNumber: range.endLineNumber, column: range.endColumn };

        // 判断变化是否在幽灵文本起始位置之后
        const isAfterGhostStart = changeStartPos.lineNumber > originalPos.lineNumber ||
          (changeStartPos.lineNumber === originalPos.lineNumber && changeStartPos.column >= originalPos.column);

        if (isAfterGhostStart) {
          // 获取从幽灵文本原始位置到当前变化结束位置的所有文本
          let userInput = '';

          if (changeEndPos.lineNumber === originalPos.lineNumber) {
            // 同一行的情况
            const lineText = model.getLineContent(originalPos.lineNumber);
            userInput = lineText.substring(originalPos.column - 1, changeEndPos.column + text.length - 1);
          } else {
            // 跨行的情况，需要拼接多行文本
            for (let lineNum = originalPos.lineNumber; lineNum <= changeEndPos.lineNumber; lineNum++) {
              const lineText = model.getLineContent(lineNum);
              if (lineNum === originalPos.lineNumber) {
                // 第一行：从原始位置开始
                userInput += lineText.substring(originalPos.column - 1);
              } else if (lineNum === changeEndPos.lineNumber) {
                // 最后一行：到变化结束位置
                userInput += '\n' + lineText.substring(0, changeEndPos.column + text.length - 1);
              } else {
                // 中间行：完整行
                userInput += '\n' + lineText;
              }
            }
          }

          // 计算匹配度用于触发内联建议更新
          let matchScore = 0;
          const minLength = Math.min(userInput.length, ghostData.originalText.length);

          for (let i = 0; i < minLength; i++) {
            if (userInput[i] === ghostData.originalText[i]) {
              matchScore++;
            }
          }

          // 检查是否完全匹配幽灵文本
          if (userInput === ghostData.originalText) {
            // 用户输入完全匹配幽灵文本，删除该幽灵文本
            ghostTextsRef.current.delete(ghostId);
            // 触发内联建议更新以清除显示
            setTimeout(() => {
              editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
            }, 10);
          } else {
            // 如果匹配度足够高或用户输入为空，触发内联建议更新
            const matchRatio = minLength > 0 ? matchScore / minLength : 1;
            if (matchRatio >= 0.7 || userInput.length === 0) {
              // 用户输入仍匹配，触发内联建议更新
              setTimeout(() => {
                editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
              }, 10);
            }
          }
        } else if (changeEndPos.lineNumber < originalPos.lineNumber ||
          (changeEndPos.lineNumber === originalPos.lineNumber && changeEndPos.column <= originalPos.column)) {
          // 在幽灵文本前面的变化，调整原始位置
          if (changeEndPos.lineNumber === originalPos.lineNumber) {
            const columnDelta = text.length - (range.endColumn - range.startColumn);
            ghostData.originalPosition.column += columnDelta;
          } else {
            // 跨行变化可能影响行号
            const lineDelta = (range.endLineNumber - range.startLineNumber) - (text.split('\n').length - 1);
            if (lineDelta !== 0) {
              ghostData.originalPosition.lineNumber -= lineDelta;
            }
          }
        }
      });
    });
  }, []);

  // 手动触发AI补全的函数 - 只在光标停留2秒不动时调用
  const triggerAICompletion = useCallback(async () => {
    console.log('triggerAICompletion called', {
      hasEditor: !!editorRef.current,
      aiSettings: aiSettings,
      isCompletionActive: isCompletionActiveRef.current
    });

    if (!editorRef.current || !aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
      console.log('AI completion skipped - missing requirements');
      return;
    }

    // 额外检查：确保当前没有活跃的补全
    if (isCompletionActiveRef.current) {
      console.log('AI completion skipped - already active');
      return;
    }

    try {
      console.log('Triggering AI completion...');
      // 触发内联补全
      await editorRef.current.trigger(null, 'editor.action.inlineSuggest.trigger', {});
    } catch (error) {
      console.error('AI completion trigger failed:', error);
    }
  }, [aiSettings]);
  // 处理执行文件
  const handleExecuteFile = useCallback(async () => {
    if (!currentFile?.path) {
      message.warning('请先保存文件');
      return;
    }

    try {
      const result = await fileApi.executeFile(currentFile.path);
      // AI补全成功（静默）
    } catch (error) {
      message.error(`执行失败: ${error}`);
    }
  }, [currentFile]);

  // 处理在终端中打开
  const handleOpenInTerminal = useCallback(async () => {
    if (!currentFile?.path) {
      message.warning('请先保存文件');
      return;
    }

    try {
      const result = await fileApi.openInTerminal(currentFile.path);
      // AI补全成功（静默）
    } catch (error) {
      message.error(`打开终端失败: ${error}`);
    }
  }, [currentFile]);

  // 处理在资源管理器中显示
  const handleShowInExplorer = useCallback(async () => {
    if (!currentFile?.path) {
      message.warning('请先保存文件');
      return;
    }

    try {
      const result = await fileApi.showInExplorer(currentFile.path);
      // AI补全成功（静默）
    } catch (error) {
      message.error(`打开资源管理器失败: ${error}`);
    }
  }, [currentFile]);

  // 获取文件扩展名
  const getLanguageFromExtension = useCallback((fileName) => {
    if (!fileName) return '';
    return fileName.split('.').pop()?.toLowerCase() || '';
  }, []);

  // 获取编辑器主题 - 固定使用One主题
  const getEditorTheme = useCallback(() => {
    // 直接使用内联的主题配置
    return isDarkMode ? 'one-dark-pro' : 'one-light';
  }, [isDarkMode]);

  // 获取文件语言
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
      'txt': 'plaintext'
    };

    return languageMap[ext] || 'plaintext';
  }, []);

  // 初始化Shiki高亮器
  useEffect(() => {
    let mounted = true;

    const initializeHighlighter = async () => {
      try {


        const highlighter = await createHighlighter({
          themes: Object.values(themes).flat(),
          langs: [...new Set(Object.values(extensionToLanguage))]
        });

        // 将Shiki主题应用到Monaco
        shikiToMonaco(highlighter, monaco);

        if (mounted) {

          setHighlighterReady(true);
        }
      } catch (error) {
        // 静默处理Shiki高亮器初始化错误
        // 即使Shiki初始化失败，也允许编辑器正常工作
        if (mounted) {
          setHighlighterReady(true);
        }
      }
    };

    initializeHighlighter().catch();

    return () => {
      mounted = false;
    };
  }, []);

  // 创建编辑器
  useEffect(() => {

    if (containerRef.current && !editorRef.current && highlighterReady) {

      try {
        editorRef.current = monaco.editor.create(containerRef.current, {
          value: '// Monaco Editor is working!\nconsole.log("Hello World");',
          language: 'javascript',
          theme: getEditorTheme(),
          fontSize: fontSize,
          fontFamily: fontFamily,
          lineHeight: lineHeight,
          wordWrap: wordWrap,
          minimap: minimap,
          scrollBeyondLastLine: scrollBeyondLastLine,
          automaticLayout: true,
          tabSize: tabSize,
          insertSpaces: insertSpaces,
          renderWhitespace: renderWhitespace,
          cursorBlinking: cursorBlinking,
          cursorStyle: cursorStyle,
          lineNumbers: lineNumbers,
          glyphMargin: glyphMargin,
          folding: folding,
          showFoldingControls: showFoldingControls,
          matchBrackets: matchBrackets,
          autoIndent: autoIndent,
          formatOnPaste: formatOnPaste,
          formatOnType: formatOnType,
          selectOnLineNumbers: true,
          roundedSelection: false,
          readOnly: false,
          cursorSmoothCaretAnimation: 'on',
          contextmenu: false, // 禁用默认右键菜单
          mouseWheelZoom: true,
          smoothScrolling: true,
          multiCursorModifier: 'ctrlCmd',
          accessibilitySupport: 'auto',
          inlineSuggest: {
            enabled: true,
            mode: 'prefix',
            suppressSuggestions: true, // 禁用默认建议，避免与自定义幽灵文本冲突
            fontFamily: 'inherit',
            // 添加更多配置确保幽灵文本显示
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
        // 添加内联建议接受监听器（只在AI建议被接受时清除）
        inlineSuggestDisposableRef.current = editorRef.current.onDidChangeModelContent((e) => {
          // 检查是否是由内联建议接受导致的变化
          if (e.changes && e.changes.length > 0) {
            const change = e.changes[0];

            // 检查是否有AI建议需要清除
            if (inlineAcceptRef.current && change.text) {
              const pending = inlineAcceptRef.current;
              // 检查插入的文本是否匹配待接受的建议
              if (change.text === pending.insertText || pending.insertText.startsWith(change.text)) {
                // 清除待接受的建议
                inlineAcceptRef.current = null;

                // AI补全被接受时，清除所有幽灵文本
                if (ghostTextsRef.current.size > 0) {
                  clearAllGhostTexts();
                }
              }
            }

            // 移除自动清除逻辑 - 不再在用户输入时自动清除幽灵文本
            // 只在保存文件或建议被完全应用时清除
          }
        });

        // Tab 接受内联建议（当存在时）
        if (!keydownDisposableRef.current) {
          keydownDisposableRef.current = editorRef.current.onKeyDown((e) => {
            // Tab键：接受内联建议
            if (e.keyCode === monaco.KeyCode.Tab) {
              const model = editorRef.current?.getModel();
              const position = editorRef.current?.getPosition();
              const pending = inlineAcceptRef.current;

              // 检查是否有待接受的内联建议
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

                  // 补全后删除所有幽灵文本
                  clearAllGhostTexts();

                  e.preventDefault();
                  e.stopPropagation();

                  // 可选：显示接受建议的提示
                  // message.success(t('settings.aiSettingsUpdated'), 1);
                } catch (error) {
                  // AI建议接受失败（静默）
                  inlineAcceptRef.current = null;
                }
              }
            }
            // 右箭头键：接受内联建议的下一个单词
            else if (e.keyCode === monaco.KeyCode.RightArrow && !e.shiftKey && !e.ctrlKey && !e.altKey) {
              const model = editorRef.current?.getModel();
              const position = editorRef.current?.getPosition();
              const pending = inlineAcceptRef.current;

              // 检查是否有待接受的内联建议
              if (model && position && pending &&
                pending.lineNumber === position.lineNumber &&
                pending.column === position.column &&
                pending.versionId === model.getAlternativeVersionId()) {

                // 接受建议的第一个单词或字符
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

                    // 更新待接受建议
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
                      // 完全接受后删除所有幽灵文本
                      clearAllGhostTexts();
                    }

                    e.preventDefault();
                    e.stopPropagation();
                  } catch (error) {
                    // AI建议接受失败（静默）
                    inlineAcceptRef.current = null;
                  }
                }
              }
            }
            // End键：接受整个内联建议
            else if (e.keyCode === monaco.KeyCode.End && !e.shiftKey && !e.ctrlKey && !e.altKey) {
              const model = editorRef.current?.getModel();
              const position = editorRef.current?.getPosition();
              const pending = inlineAcceptRef.current;

              // 检查是否有待接受的内联建议
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

                  // 补全后删除所有幽灵文本
                  clearAllGhostTexts();

                  e.preventDefault();
                  e.stopPropagation();
                } catch (error) {
                  // AI建议接受失败（静默）
                  inlineAcceptRef.current = null;
                }
              }
            }
            // Ctrl+G：将选中文本转换为幽灵建议文本
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
            // Ctrl+Shift+G：还原所有幽灵文本
            else if (e.keyCode === monaco.KeyCode.KeyG && (e.ctrlKey || e.metaKey) && e.shiftKey) {
              restoreAllGhostTexts();
              e.preventDefault();
              e.stopPropagation();
            }
            // Ctrl+Alt+G：补充当前行的幽灵文本
            else if (e.keyCode === monaco.KeyCode.KeyG && (e.ctrlKey || e.metaKey) && e.altKey) {
              acceptCurrentLineGhostText();
              e.preventDefault();
              e.stopPropagation();
            }
            // Ctrl+L：标记按下状态
            else if (e.keyCode === monaco.KeyCode.KeyL && (e.ctrlKey || e.metaKey)) {
              ctrlLPressedRef.current = true;
              // 设置一个短暂的超时来重置状态，防止状态一直保持
              setTimeout(() => {
                ctrlLPressedRef.current = false;
              }, 1000);
            }
            // Ctrl+/：切换Markdown预览
            else if (e.keyCode === monaco.KeyCode.Slash && (e.ctrlKey || e.metaKey)) {
              handleToggleMarkdownPreview();
              e.preventDefault();
              e.stopPropagation();
            }
            // Backspace键使用默认行为
          });
        }

        // 添加自定义右键菜单
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

        // 添加分隔符
        editorRef.current.addAction({
          id: 'separator-1',
          label: '',
          contextMenuGroupId: 'file-operations',
          contextMenuOrder: 4,
          run: () => { },
          precondition: null
        });

        // 注册AI内联补全命令
        editorRef.current.addAction({
          id: 'ai-inline-completion',
          label: 'AI Inline Completion',
          run: () => {
            // 这个命令主要用于内联补全项的标识，不需要具体实现

          },
          precondition: null
        });



      } catch (error) {
        // 静默处理Monaco编辑器创建错误
      }
    }

    // 清理函数
    return () => {
      if (editorRef.current) {
        if (keydownDisposableRef.current) {
          keydownDisposableRef.current.dispose?.();
          keydownDisposableRef.current = null;
        }
        if (inlineSuggestDisposableRef.current) {
          inlineSuggestDisposableRef.current.dispose?.();
          inlineSuggestDisposableRef.current = null;
        }
        providerDisposablesRef.current.forEach(d => d?.dispose?.());
        providerDisposablesRef.current = [];
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [highlighterReady, createGhostText, restoreAllGhostTexts, acceptCurrentLineGhostText]);

  // 监听文件变化，更新编辑器内容
  useEffect(() => {
    if (!editorRef.current || isInternalChange.current) return;

    if (currentFile && currentFile.content !== undefined) {
      // 更新编辑器内容
      editorRef.current.setValue(currentFile.content);
      // 更新语言
      const language = getFileLanguage(currentFile.name);
      monaco.editor.setModelLanguage(editorRef.current.getModel(), language);
    } else {
      // 没有文件时显示默认内容
      editorRef.current.setValue('// Monaco Editor is working!\nconsole.log("Hello World");');
      monaco.editor.setModelLanguage(editorRef.current.getModel(), 'javascript');
    }
  }, [currentFile, getFileLanguage]);

  // 监听内容变化 - 单独的useEffect避免编辑器重建
  useEffect(() => {
    if (!editorRef.current) return;

    const disposable = editorRef.current.onDidChangeModelContent((e) => {
      isInternalChange.current = true;
      const currentValue = editorRef.current.getValue();
      if (currentFile && updateContent) {
        updateContent(currentValue);
      }

      // 处理幽灵文本的智能匹配
      updateGhostTextsOnChange(e);

      setTimeout(() => {
        isInternalChange.current = false;
      }, 0);
    });

    return () => {
      disposable.dispose();
    };
  }, [updateContent, currentFile, updateGhostTextsOnChange]);

  // 监听文件保存事件，保存时清空幽灵文本
  useEffect(() => {
    if (!currentFile) return;

    // 监听文件的 isModified 状态变化
    // 当文件从 modified 变为 unmodified 时，说明文件被保存了
    if (wasModifiedRef.current && !currentFile.isModified) {
      // 文件刚刚被保存，清空幽灵文本
      clearAllGhostTexts();
    }

    wasModifiedRef.current = currentFile.isModified;
  }, [currentFile?.isModified, clearAllGhostTexts]);

  // 监听光标位置变化，立即触发AI补全（无防抖）
  useEffect(() => {
    if (!editorRef.current) return;

    const disposables = [];

    // 监听光标位置变化 - 立即检查幽灵文本并触发AI补全
    const cursorDisposable = editorRef.current.onDidChangeCursorPosition(async (e) => {
      const newPosition = {
        lineNumber: e.position.lineNumber,
        column: e.position.column
      };

      // 更新光标位置
      cursorPositionRef.current = newPosition;

      // 立即检查光标后面是否有幽灵文本并触发显示
      if (ghostTextsRef.current.size > 0) {
        for (const [id, ghostData] of ghostTextsRef.current) {
          const originalPos = ghostData.originalPosition;
          const isAtGhostPosition = newPosition.lineNumber === originalPos.lineNumber &&
            newPosition.column <= originalPos.column;

          if (isAtGhostPosition) {
            setTimeout(() => {
              editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
            }, 10);
            break;
          }
        }
      }

      // 立即显示现有的内联补全建议（如果有的话）
      // 光标移动时只显示已有建议，不触发新的AI补全请求
      setTimeout(() => {
        editorRef.current?.trigger('cursor-move', 'editor.action.inlineSuggest.trigger', {});
      }, 50);

      // 注意：光标移动时不再触发新的AI补全请求，避免补全建议闪烁消失
      // AI补全只在用户输入时触发，保持补全建议的稳定性
    });

    // 监听内联补全显示/隐藏状态
    const completionDisposable = editorRef.current.onDidChangeModel(() => {
      // 当模型变化时，重置补全状态
      isCompletionActiveRef.current = false;
    });

    disposables.push(cursorDisposable, completionDisposable);

    return () => {
      disposables.forEach(d => d?.dispose?.());
      // 清理光标定时器
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      // 清理API节流定时器
      if (apiRequestResetTimerRef.current) {
        clearTimeout(apiRequestResetTimerRef.current);
        apiRequestResetTimerRef.current = null;
      }
    };
  }, [aiSettings.enabled, triggerAICompletion]);

  // 注册/更新 AI 内联补全提供器
  useEffect(() => {
    if (!editorRef.current) return;

    providerDisposablesRef.current.forEach(d => d?.dispose?.());
    providerDisposablesRef.current = [];
    inlineAcceptRef.current = null;

    if (!aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
      editorRef.current.updateOptions({ inlineSuggest: { enabled: true } });
      return;
    }

    editorRef.current.updateOptions({ inlineSuggest: { enabled: true } });

    const allLangs = monaco.languages.getLanguages().map(l => l.id);
    const disposables = allLangs.map(langId =>
      monaco.languages.registerInlineCompletionsProvider(langId, {
        provideInlineCompletions: async (model, position, context, token) => {
          console.log('provideInlineCompletions called', { position, context });
          try {
            // 标记补全开始
            isCompletionActiveRef.current = true;

            // 优先检查是否有重试建议
            if (retrySuggestionRef.current) {
              const retrySuggestion = retrySuggestionRef.current;
              const currentPos = position;

              // 检查重试建议是否仍然有效（位置匹配且时间不超过30秒）
              if (retrySuggestion.position.lineNumber === currentPos.lineNumber &&
                retrySuggestion.position.column === currentPos.column &&
                Date.now() - retrySuggestion.timestamp < 30000) {



                // 清除重试建议（一次性使用）
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
                // 重试建议已过期或位置不匹配，清除它
                retrySuggestionRef.current = null;
              }
            }

            // 优化：检查当前位置是否已存在以此光标为开头的幽灵文本
            const hasGhostTextAtCursor = Array.from(ghostTextsRef.current.values()).some(ghostData => {
              const ghostPos = ghostData.originalPosition || ghostData.currentPosition;
              return ghostPos &&
                ghostPos.lineNumber === position.lineNumber &&
                ghostPos.column === position.column;
            });

            if (hasGhostTextAtCursor) {
              // 当前位置已有幽灵文本，跳过API调用以优化访问次数
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            // 检查AI设置是否完整
            if (!aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
              isCompletionActiveRef.current = false;
              return { items: [] };
            }
            // API请求节流检查
            const now = Date.now();

            // 智能重置：如果距离上次请求超过10秒，立即重置计数器
            if (apiRequestCountRef.current > 0 && now - lastRequestTimeRef.current > 10000) {
              apiRequestCountRef.current = 0;
              firstRequestTimeRef.current = 0;

              // 清除旧的重置定时器
              if (apiRequestResetTimerRef.current) {
                clearTimeout(apiRequestResetTimerRef.current);
                apiRequestResetTimerRef.current = null;
              }
            }

            if (apiRequestCountRef.current >= MAX_REQUESTS_PER_MINUTE) {


              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            // 增加API请求计数
            apiRequestCountRef.current++;
            lastRequestTimeRef.current = now;

            // 记录第一次请求的时间
            if (apiRequestCountRef.current === 1) {
              firstRequestTimeRef.current = now;
            }

            // 设置或重置1分钟计数器重置定时器（基于第一次请求时间）
            if (apiRequestResetTimerRef.current) {
              clearTimeout(apiRequestResetTimerRef.current);
            }
            const timeElapsed = now - firstRequestTimeRef.current;
            const timeRemaining = Math.max(0, REQUEST_RESET_INTERVAL - timeElapsed);
            apiRequestResetTimerRef.current = setTimeout(() => {
              apiRequestCountRef.current = 0;
              firstRequestTimeRef.current = 0;

            }, timeRemaining);



            const before = model.getValueInRange(new monaco.Range(1, 1, position.lineNumber, position.column));
            const after = model.getValueInRange(new monaco.Range(position.lineNumber, position.column, model.getLineCount(), model.getLineMaxColumn(model.getLineCount())));
            const language = model.getLanguageId();

            const maxContext = 4000;
            const prefix = before.slice(-maxContext);
            const suffix = after.slice(0, 1000);

            // 获取当前行和光标前的内容
            const currentLine = model.getLineContent(position.lineNumber);
            const beforeCursor = currentLine.substring(0, position.column - 1);

            // 更宽松的触发条件：只要有一些文本内容就可以触发
            if (prefix.trim().length < 1 && beforeCursor.trim().length < 1) {
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            // 分析当前行内容，判断补全类型
            const trimmedLine = currentLine.trim();
            // 判断是否为注释行
            const isCommentLine = trimmedLine.startsWith('//') ||
              trimmedLine.startsWith('/*') ||
              trimmedLine.startsWith('*') ||
              trimmedLine.startsWith('#') ||
              trimmedLine.startsWith('<!--');

            // 判断是否在字符串内
            const inString = (beforeCursor.split('"').length - 1) % 2 === 1 ||
              (beforeCursor.split("'").length - 1) % 2 === 1 ||
              (beforeCursor.split('`').length - 1) % 2 === 1;

            // 获取更多上下文信息用于FIM
            const afterCursorText = currentLine.substring(position.column - 1);
            const fullSuffix = suffix + '\n' + afterCursorText;


            // 构建高级上下文感知提示 - 基于JetBrains和Sourcegraph最佳实践
            const contextAnalysis = {
              lineType: isCommentLine ? 'comment' : (inString ? 'string' : 'code'),
              hasPrefix: beforeCursor.trim().length > 0,
              hasSuffix: afterCursorText.trim().length > 0,
              isLineComplete: currentLine.trim().endsWith(';') || currentLine.trim().endsWith('}') || currentLine.trim().endsWith('{'),
              wordCount: currentLine.split(/[\s\W]+/).filter(w => w.length > 1).length
            };

            const body = {
              model: aiSettings.model,
              messages: [
                {
                  role: 'system',
                  content: `You are an advanced AI code completion engine using Fill-in-the-Middle (FIM) technology. Your primary goal is to provide contextually accurate, non-repetitive completions that seamlessly bridge prefix and suffix content.`
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
🚫 NEVER repeat any word that exists in the current line
🚫 NEVER add comment symbols (//,/*,*/) in comment lines
🚫 NEVER duplicate content that exists in suffix
🚫 NEVER suggest excessively long content (removed length limit for multi-line support)
🚫 NEVER repeat the last word from prefix

✅ COMPLETION STRATEGY:
1. If line type is 'comment':
   - If comment describes code to implement (e.g., "实现二分查找"), suggest actual code implementation
   - Otherwise, continue with plain text, no symbols
2. If line type is 'string': Complete string content naturally
3. If line type is 'code': Complete syntax/logic appropriately
4. If suffix exists: Ensure completion bridges prefix→suffix smoothly
5. If line seems complete: Suggest minimal or no completion

EXAMPLES:
✅ GOOD:
- Prefix: "// 实现二分查找", Suffix: "" → "\nfunction binarySearch(arr, target) {"
- Prefix: "// Calculate the", Suffix: "" → "sum of numbers"
- Prefix: "function get", Suffix: "() {}" → "UserName"
- Prefix: "const msg = \"Hello", Suffix: "\";" → " World"
- Prefix: "if (user.", Suffix: ") {" → "isActive"

❌ BAD (AVOID):
- Prefix: "// hello world", Contains "hello" → DON'T suggest "hello"
- Prefix: "//", In comment → DON'T suggest "// comment"
- Prefix: "function test", Suffix: "() {}" → DON'T suggest "() {}"

RESPONSE FORMAT:
Return ONLY the completion text (no explanations, no code blocks, no quotes).
If no good completion exists, return empty string.
For code implementations, multi-line completions are encouraged when appropriate.`
                }
              ],
              temperature: 0.05, // 更低的温度以提高一致性
              max_tokens: 1000,  // 不受限制的token数量，支持长代码补全
              stream: false
            };

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
              // 静默处理API错误，避免频繁弹窗
              // AI补全请求失败（静默）
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content ?? '';

            // 清理返回的文本，移除代码块标记和多余的空白
            let insert = (text || '')
              .replace(/^```[\s\S]*?\n|```$/g, '') // 移除代码块标记
              .replace(/\r/g, '') // 移除回车符
              .trim();

            // 如果建议为空，不显示
            if (!insert || insert.length < 1) {
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            // 超级智能过滤系统 - 基于Supermaven本地过滤模型和零容忍重复检测
            const trimmedInsert = insert.trim();
            const trimmedBeforeCursor = beforeCursor.trim();

            // 预过滤：基本质量检查
            if (!trimmedInsert || trimmedInsert.length < 1) {
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            // 重试机制：当过滤器拒绝时，2秒后重新请求并告知AI拒绝原因
            const scheduleRetryWithReason = (rejectionReason, filterName) => {

              setTimeout(async () => {
                try {

                  const retryResult = await retryCompletionWithReason(model, position, context, token, rejectionReason, filterName);
                  if (retryResult && retryResult.items && retryResult.items.length > 0) {
                    // 将重试建议存储到ref中，供内联补全提供者使用
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


                    // 触发内联建议显示
                    editorRef.current.trigger('retry', 'editor.action.inlineSuggest.trigger', {});
                  }
                } catch (error) {

                }
              }, 2000);
            };

            // 重试补全函数，包含拒绝原因
            const retryCompletionWithReason = async (model, position, context, token, rejectionReason, filterName) => {
              try {
                // 重新获取上下文信息
                const currentLine = model.getLineContent(position.lineNumber);
                const beforeCursor = currentLine.substring(0, position.column - 1);
                const afterCursorText = currentLine.substring(position.column - 1);

                // 提取当前行已有的关键词
                const existingWords = currentLine.toLowerCase().match(/\b\w+\b/g) || [];
                const avoidWords = existingWords.join('、');

                // 获取语言信息
                const language = model.getLanguageId();

                // 构建包含拒绝原因的重试请求
                const retryBody = {
                  model: aiSettings.model,
                  messages: [
                    {
                      role: 'system',
                      content: `You are an advanced AI code completion engine. The previous completion was rejected by ${filterName} because: ${rejectionReason}. You MUST provide a completely different completion that avoids ALL existing words and content.`
                    },
                    {
                      role: 'user',
                      content: `**CRITICAL RETRY REQUEST**

Previous rejection: ${rejectionReason}
Filter: ${filterName}

**STRICT REQUIREMENTS**:
1. NEVER use these existing words: ${avoidWords}
2. NEVER repeat any content from current line: "${currentLine}"
3. Provide completely different, creative completion
4. Ensure meaningful and valuable content

**Context**:
- Language: ${language}
- Before Cursor: "${beforeCursor}"
- After Cursor: "${afterCursorText}"

**Output Requirements**:
- Only return the code to insert
- No explanations or comments
- Ensure correct syntax and context fit
- Provide creative, non-repetitive content
- Maximum 50 characters`
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
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                  },
                  body: JSON.stringify(retryBody),
                  signal: controller.signal
                });

                if (res.ok) {
                  const data = await res.json();
                  const retryText = data?.choices?.[0]?.message?.content ?? '';
                  const retryInsert = retryText.replace(/^```[\s\S]*?\n|```$/g, '').replace(/\r/g, '').trim();

                  if (retryInsert && retryInsert.length > 0) {

                    // 直接返回重试的建议作为补全结果
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

              }
            };

            // 超级智能过滤器1: 注释符号重复检测 (基于Supermaven本地过滤模型)
            if (isCommentLine) {
              // 检测任何注释符号的添加
              const commentSymbols = ['//', '/*', '*/', '*', '#'];
              const hasCommentSymbol = commentSymbols.some(symbol => trimmedInsert.includes(symbol));

              if (hasCommentSymbol) {
                // 只有在完全空行且光标在行首时才允许
                if (!(currentLine.trim() === '' && beforeCursor.trim() === '')) {
                  const rejectionReason = `在注释行中添加了注释符号 (${commentSymbols.filter(s => trimmedInsert.includes(s)).join(', ')})，这会造成重复`;

                  scheduleRetryWithReason(rejectionReason, 'Super Filter 1');
                  isCompletionActiveRef.current = false;
                  return { items: [] };
                }
              }
            }

            // 超级智能过滤器2: 零容忍重复检测 (基于Supermaven用户行为分析)
            const currentLineWords = currentLine.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 1);
            const insertWords = trimmedInsert.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 1);

            // 检查部分单词重复（3个字符以上的子串）
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

            // 超级智能过滤器3: 智能前缀重复检测（优化版）
            if (trimmedBeforeCursor.length >= 3 && trimmedInsert.length >= 3) {
              // 检查前缀末尾和建议开头的精确匹配
              const beforeEnd = trimmedBeforeCursor.slice(-8).toLowerCase(); // 检查最后8个字符
              const insertStart = trimmedInsert.slice(0, 8).toLowerCase();   // 检查前8个字符

              // 只拒绝4个字符以上的重叠，且不是常见的编程模式
              for (let len = Math.min(beforeEnd.length, insertStart.length); len >= 4; len--) {
                if (beforeEnd.slice(-len) === insertStart.slice(0, len)) {
                  // 允许常见的编程模式（如变量名、函数名的合理延续）
                  const overlap = beforeEnd.slice(-len);
                  const commonPatterns = ['const', 'function', 'return', 'console', 'this.', '.get', '.set', 'user.', 'data.'];
                  const isCommonPattern = commonPatterns.some(pattern => overlap.includes(pattern.toLowerCase()));

                  if (!isCommonPattern) {
                    const rejectionReason = `建议的开头 "${overlap}" 与光标前的文本末尾重复，造成了显著的前缀重叠`;

                    scheduleRetryWithReason(rejectionReason, 'Super Filter 3');
                    isCompletionActiveRef.current = false;
                    return { items: [] };
                  } else {

                  }
                }
              }
            }

            // 超级智能过滤器4: FIM核心 - 后缀零重复检测
            const afterCursorWords = afterCursorText.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 1);
            // 零容忍：与afterCursor的任何重复都拒绝
            const afterCursorDuplicates = insertWords.filter(word => afterCursorWords.includes(word));
            if (afterCursorDuplicates.length > 0) {
              const rejectionReason = `建议中的单词 [${afterCursorDuplicates.join(', ')}] 与光标后的内容重复`;

              scheduleRetryWithReason(rejectionReason, 'Super Filter 4a');
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            // 检查与后缀的字符级重复
            if (afterCursorText.trim().length > 0 && trimmedInsert.length > 0) {
              const afterCursorTrimmed = afterCursorText.trim().toLowerCase();
              const insertTrimmed = trimmedInsert.trim().toLowerCase();

              // 如果建议的内容在后缀中出现，直接拒绝
              if (afterCursorTrimmed.includes(insertTrimmed) || insertTrimmed.includes(afterCursorTrimmed)) {
                const rejectionReason = `建议内容 "${insertTrimmed}" 与光标后的内容 "${afterCursorTrimmed}" 存在字符级重叠`;

                scheduleRetryWithReason(rejectionReason, 'Super Filter 4b');
                isCompletionActiveRef.current = false;
                return { items: [] };
              }
            }

            // 超级智能过滤器5: 单词边界零重复检测
            if (trimmedBeforeCursor.length > 0 && trimmedInsert.length > 0) {
              const lastWordBefore = trimmedBeforeCursor.split(/[\s\W]+/).filter(w => w.length > 0).pop()?.toLowerCase() || '';
              const firstWordInsert = trimmedInsert.split(/[\s\W]+/).filter(w => w.length > 0)[0]?.toLowerCase() || '';

              // 零容忍：任何单词边界重复都拒绝
              if (lastWordBefore === firstWordInsert && lastWordBefore.length > 0) {
                const rejectionReason = `光标前的最后一个单词 "${lastWordBefore}" 与建议的第一个单词完全相同`;

                scheduleRetryWithReason(rejectionReason, 'Super Filter 5a');
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              // 检查单词包含关系
              if (lastWordBefore.length >= 2 && firstWordInsert.length >= 2) {
                if (lastWordBefore.includes(firstWordInsert) || firstWordInsert.includes(lastWordBefore)) {
                  const rejectionReason = `单词边界存在包含关系: "${lastWordBefore}" 与 "${firstWordInsert}" 互相包含`;

                  scheduleRetryWithReason(rejectionReason, 'Super Filter 5b');
                  isCompletionActiveRef.current = false;
                  return { items: [] };
                }
              }

              // 检查字符级重叠（任何2个字符以上的重叠）
              for (let len = Math.min(lastWordBefore.length, firstWordInsert.length); len >= 2; len--) {
                if (lastWordBefore.slice(-len) === firstWordInsert.slice(0, len)) {
                  const rejectionReason = `字符级单词重叠: "${lastWordBefore.slice(-len)}" 在光标前后都出现`;

                  scheduleRetryWithReason(rejectionReason, 'Super Filter 5c');
                  isCompletionActiveRef.current = false;
                  return { items: [] };
                }
              }
            }

            // 超级智能过滤器6: 语义相似性零容忍检测
            if (isCommentLine && trimmedInsert.length > 3) {
              const similarity = calculateTextSimilarity(currentLine.toLowerCase(), trimmedInsert.toLowerCase());
              if (similarity > 0.3) { // 更严格的阈值
                const rejectionReason = `语义相似性过高 (${similarity.toFixed(2)})，建议内容与当前行过于相似`;

                scheduleRetryWithReason(rejectionReason, 'Super Filter 6');
                isCompletionActiveRef.current = false;
                return { items: [] };
              }

              // 额外检查：注释内容的关键词重复
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

            // 超级智能过滤器7: 质量控制 (已取消长度限制，支持任意行数补全)
            // 长度限制已移除，允许多行补全建议

            if (trimmedInsert.length < 1) {
              const rejectionReason = '建议内容为空，没有提供有效的补全内容';

              scheduleRetryWithReason(rejectionReason, 'Super Filter 7b');
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            // 检查是否只包含空白字符或标点
            const meaningfulContent = /[a-zA-Z\u4e00-\u9fa5\d]/.test(trimmedInsert);
            if (!meaningfulContent) {
              const rejectionReason = '建议内容缺乏有意义的字符，只包含空白字符或标点符号';

              scheduleRetryWithReason(rejectionReason, 'Super Filter 7c');
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            // 新增：检查是否只是重复的字符
            const uniqueChars = new Set(trimmedInsert.toLowerCase().replace(/\s/g, ''));
            if (uniqueChars.size <= 2 && trimmedInsert.length > 5) {
              const rejectionReason = `建议内容过于重复，只包含 ${uniqueChars.size} 种不同字符但长度为 ${trimmedInsert.length}`;

              scheduleRetryWithReason(rejectionReason, 'Super Filter 7d');
              isCompletionActiveRef.current = false;
              return { items: [] };
            }



            // 文本相似性计算函数（简单的Jaccard相似度）
            function calculateTextSimilarity(text1, text2) {
              const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
              const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

              if (words1.size === 0 && words2.size === 0) return 1;
              if (words1.size === 0 || words2.size === 0) return 0;

              const intersection = new Set([...words1].filter(x => words2.has(x)));
              const union = new Set([...words1, ...words2]);

              return intersection.size / union.size;
            }

            // 存储待接受的建议
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
              // 添加必要的属性以确保幽灵文本正确显示
              command: {
                id: 'ai-inline-completion',
                title: 'AI Inline Completion'
              },
              // 确保这是一个有效的内联补全项
              kind: monaco.languages.CompletionItemKind.Text,
              // 添加标签以便调试
              label: insert.substring(0, 20) + (insert.length > 20 ? '...' : ''),
              // 添加更多属性确保幽灵文本显示
              filterText: insert,
              sortText: '0000',
              preselect: true
            };



            return {
              items: [completionItem],
              // 确保启用内联补全
              enableForwardStability: true
            };
          } catch (error) {
            // 专门处理AbortError，这是正常的取消操作
            if (error.name === 'AbortError') {
              // AbortError是正常的取消操作，不需要记录警告
              isCompletionActiveRef.current = false;
              return { items: [] };
            }
            // 其他错误才记录警告
            // AI补全错误（静默）
            isCompletionActiveRef.current = false;
            return { items: [] };
          }
        },
        freeInlineCompletions: () => {
          // 清理资源
          inlineAcceptRef.current = null;
          // 重置补全状态
          isCompletionActiveRef.current = false;
        }
      })
    );

    providerDisposablesRef.current = disposables;

    return () => {
      disposables.forEach(d => d?.dispose?.());
      // 清理API节流相关定时器
      if (apiRequestResetTimerRef.current) {
        clearTimeout(apiRequestResetTimerRef.current);
        apiRequestResetTimerRef.current = null;
      }
    };
  }, [aiSettings]);

  // 更新文件内容和语言
  useEffect(() => {
    if (editorRef.current && currentFile && !isInternalChange.current) {
      const currentValue = editorRef.current.getValue();
      const newValue = currentFile.content || '';

      if (currentValue !== newValue) {
        editorRef.current.setValue(newValue);
      }

      // 更新语言
      const language = getFileLanguage(currentFile.name);
      const model = editorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }

    // 重置Markdown预览状态 - 只有当文件不是Markdown时才关闭预览
    if (currentFile && !isMarkdownFile() && internalShowMarkdownPreview) {
      setInternalShowMarkdownPreview(false);
    }
  }, [currentFile, getFileLanguage, showMarkdownPreview]);

  // 更新编辑器主题
  useEffect(() => {
    if (editorRef.current && highlighterReady) {
      monaco.editor.setTheme(getEditorTheme());
    }
  }, [getEditorTheme, highlighterReady]);

  // 更新字体设置
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: fontSize,
        fontFamily: fontFamily,
        lineHeight: lineHeight,
      });
    }
  }, [fontSize, fontFamily, lineHeight]);

  // 更新编辑器配置
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        wordWrap: wordWrap,
        minimap: minimap,
        scrollBeyondLastLine: scrollBeyondLastLine,
        tabSize: tabSize,
        insertSpaces: insertSpaces,
        renderWhitespace: renderWhitespace,
        cursorBlinking: cursorBlinking,
        cursorStyle: cursorStyle,
        lineNumbers: lineNumbers,
        glyphMargin: glyphMargin,
        folding: folding,
        showFoldingControls: showFoldingControls,
        matchBrackets: matchBrackets,
        autoIndent: autoIndent,
        formatOnPaste: formatOnPaste,
        formatOnType: formatOnType,
      });
    }
  }, [wordWrap, minimap, scrollBeyondLastLine, tabSize, insertSpaces, renderWhitespace, cursorBlinking, cursorStyle, lineNumbers, glyphMargin, folding, showFoldingControls, matchBrackets, autoIndent, formatOnPaste, formatOnType]);

  // 清理资源
  useEffect(() => {
    return () => {
      providerDisposablesRef.current.forEach(d => d?.dispose?.());
      keydownDisposableRef.current?.dispose?.();
      // 清理光标定时器
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      // 清理触发延迟定时器
      if (triggerTimeoutRef.current) {
        clearTimeout(triggerTimeoutRef.current);
        triggerTimeoutRef.current = null;
      }
      // 清理创建幽灵文本的防抖定时器
      if (createGhostTimeoutRef.current) {
        clearTimeout(createGhostTimeoutRef.current);
        createGhostTimeoutRef.current = null;
      }
    };
  }, []);

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
            content={currentFile.content || ''}
            onClose={handleCloseMarkdownPreview}
            fileName={currentFile?.name}
            currentFolder={(() => {
              console.log('CodeEditor - currentFile.path:', currentFile?.path);
              if (!currentFile?.path) return '';
              // 处理Windows和Unix路径分隔符
              const pathSeparator = currentFile.path.includes('\\') ? '\\' : '/';
              const pathParts = currentFile.path.split(pathSeparator);
              const folderPath = pathParts.slice(0, -1).join(pathSeparator);
              console.log('CodeEditor - extracted currentFolder:', folderPath);
              return folderPath;
            })()}
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
    </div>
  );
}

export default CodeEditor;
