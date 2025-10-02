/**
 * @fileoverview Monaco代码编辑器组件 - 支持语法高亮、AI补全、Markdown预览等功能
 * 集成Monaco Editor，提供代码编辑、语法高亮、智能补全、格式化等功能
 * 支持多种编程语言和主题，具备Markdown预览能力
 * @author hhyufan
 * @version 1.3.0
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

const themes = {
  'One': ['one-dark-pro', 'one-light']
};

/**
 * Monaco代码编辑器组件
 * @param {Object} props - 组件属性
 * @param {boolean} props.isDarkMode - 是否为暗色主题
 * @param {Object} props.fileManager - 文件管理器实例
 * @param {boolean} [props.showMarkdownPreview=false] - 是否显示Markdown预览
 * @param {Object} [props.languageRef] - 语言设置的ref，用于动态获取当前文件的语言类型
 * @returns {JSX.Element} 代码编辑器组件
 */
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

  // 暴露获取编辑器内容的方法给fileManager
  useEffect(() => {
    if (fileManager && editorRef.current) {
      // 确保 getEditorContent ref 存在
      if (!fileManager.getEditorContent) {
        fileManager.getEditorContent = { current: null };
      }
      fileManager.getEditorContent.current = () => {
        return editorRef.current.getValue();
      };
    }
  }, [fileManager, editorRef.current]);

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

  const apiRequestCountRef = useRef(0);
  const apiRequestResetTimerRef = useRef(null);
  const lastRequestTimeRef = useRef(0);
  const firstRequestTimeRef = useRef(0);

  const MAX_REQUESTS_PER_MINUTE = 6;

  // 从DOM标签页获取当前活动标签页的文件名
  const getCurrentTabFileName = useCallback(() => {
    try {
      // 查找aria-selected="true"的标签页按钮
      const activeTabBtn = document.querySelector('.ant-tabs-tab-btn[aria-selected="true"]');
      if (activeTabBtn) {
        // 获取按钮内的span元素
        const spanElement = activeTabBtn.querySelector('span');
        if (spanElement) {
          const fileName = spanElement.textContent || spanElement.innerText || '';
          if (fileName.trim()) {
            return fileName.trim();
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get current tab file name from DOM:', error);
    }
    return 'plaintext';
  }, [currentFile?.name]);

  const isMarkdownFile = useCallback(() => {
    // 直接使用getCurrentTabFileName获取文件名，不依赖currentFile
    const displayFileName = getCurrentTabFileName();

    if (!displayFileName) {
      return false;
    }

    const extension = displayFileName.toLowerCase().split('.').pop();
    return ['md', 'markdown', 'mgtree'].includes(extension);
  }, []);

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

  const handleCloseMarkdownPreview = useCallback(() => {
    setInternalShowMarkdownPreview(false);
  }, []);
  const REQUEST_RESET_INTERVAL = 10000;

  const retrySuggestionRef = useRef(null);

  const ghostTextsRef = useRef(new Map());
  const ghostTextCounterRef = useRef(0);
  const triggerTimeoutRef = useRef(null);
  const pendingGhostTextsRef = useRef([]);
  const createGhostTimeoutRef = useRef(null);

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
    }
  }, [setAiSettings]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadAiSettings();
    })();
    return () => { mounted = false; };
  }, [loadAiSettings]);

  useEffect(() => {
    const handler = () => { loadAiSettings().catch(); };
    window.addEventListener('ai-settings-changed', handler);
    return () => window.removeEventListener('ai-settings-changed', handler);
  }, [loadAiSettings]);

  const createGhostText = useCallback((text, range) => {
    if (!editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    if (!text || text.trim() === '' || /^\s*$/.test(text)) {
      return;
    }

    let leftGhost = null;
    let rightGhost = null;

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

    for (const [id, ghostData] of ghostTextsRef.current) {
      const ghostPos = ghostData.originalPosition;

      if (ghostPos.lineNumber === range.endLineNumber) {
        if (ghostPos.column === range.endColumn) {
          rightGhost = { id, ghostData };
        }
      } else if (ghostPos.lineNumber === range.endLineNumber + 1) {
        const lineContent = model.getLineContent(range.endLineNumber);
        const selectedText = model.getValueInRange(range);
        const hasNewline = selectedText.includes('\n');
        if ((hasNewline || range.endColumn > lineContent.length) && ghostPos.column === 1) {
          rightGhost = { id, ghostData };
        }
      }
    }

    if (leftGhost || rightGhost) {
      let mergedText = '';
      let mergedPosition = null;
      let ghostsToRemove = [];

      if (leftGhost && rightGhost) {
        let leftText = leftGhost.ghostData.originalText;
        let rightText = rightGhost.ghostData.originalText;

        if (leftGhost.ghostData.originalPosition.lineNumber < range.startLineNumber) {
          leftText = leftText + '\n';
        }

        if (range.endLineNumber < rightGhost.ghostData.originalPosition.lineNumber) {
          text = text + '\n';
        }

        mergedText = leftText + text + rightText;
        mergedPosition = leftGhost.ghostData.originalPosition;
        ghostsToRemove = [leftGhost.id, rightGhost.id];
      } else if (leftGhost) {
        let leftText = leftGhost.ghostData.originalText;

        if (leftGhost.ghostData.originalPosition.lineNumber < range.startLineNumber) {
          leftText = leftText + '\n';
        }

        mergedText = leftText + text;
        mergedPosition = leftGhost.ghostData.originalPosition;
        ghostsToRemove = [leftGhost.id];
      } else if (rightGhost) {
        let rightText = rightGhost.ghostData.originalText;

        if (range.endLineNumber < rightGhost.ghostData.originalPosition.lineNumber) {
          text = text + '\n';
        }

        mergedText = text + rightText;
        mergedPosition = { lineNumber: range.startLineNumber, column: range.startColumn };
        ghostsToRemove = [rightGhost.id];
      }

      for (const ghostId of ghostsToRemove) {
        const ghostData = ghostTextsRef.current.get(ghostId);
        if (ghostData) {
          if (ghostData.providerDisposable) {
            ghostData.providerDisposable.dispose();
          }
          ghostTextsRef.current.delete(ghostId);
        }
      }

      editorRef.current.executeEdits('ghost-text-creation', [{
        range: range,
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
        range: range,
        text: '',
        forceMoveMarkers: true
      }]);
    }

    const ghostId = `ghost-${++ghostTextCounterRef.current}`;

    const position = { lineNumber: range.startLineNumber, column: range.startColumn };

    ghostTextsRef.current.set(ghostId, {
      text: text,
      originalRange: range,
      currentPosition: position,
      originalPosition: { ...position },
      originalText: text
    });
    // -------
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
                if (userInput[i] === ghostData.originalText[i]) {
                  matchScore++;
                }
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

        if (relevantGhosts.length === 0) {
          return { items: [] };
        }

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
    // -------
    const currentLanguage = model.getLanguageId() || 'plaintext';
    ghostTextsRef.current.get(ghostId).providerDisposable = monaco.languages.registerInlineCompletionsProvider(currentLanguage, provider);

    if (triggerTimeoutRef.current) {
      clearTimeout(triggerTimeoutRef.current);
    }

    triggerTimeoutRef.current = setTimeout(() => {
      try {
        editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
      } catch (error) {
        if (!error.message?.includes('Canceled')) {
        }
      }
      triggerTimeoutRef.current = null;
    }, 20);

  }, []);

  const debouncedCreateGhostTexts = useCallback(() => {
    if (createGhostTimeoutRef.current) {
      clearTimeout(createGhostTimeoutRef.current);
    }

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
            ghostData.text = ghostData.text + pending.text;
            ghostData.originalText = ghostData.originalText + pending.text;
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

  useCallback((text, range) => {
    const shouldCreateGhost = () => {
      const hasPendingAtSamePosition = pendingGhostTextsRef.current.some(pending =>
        pending.range.startLineNumber === range.startLineNumber &&
        pending.range.startColumn === range.startColumn &&
        pending.range.endLineNumber === range.endLineNumber &&
        pending.range.endColumn === range.endColumn
      );

      if (hasPendingAtSamePosition) {
        return false;
      }

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



  const clearSpecificGhostText = useCallback((ghostId) => {
    if (!editorRef.current || !ghostTextsRef.current.has(ghostId)) return;

    const ghostData = ghostTextsRef.current.get(ghostId);

    if (ghostData.providerDisposable) {
      ghostData.providerDisposable.dispose();
    }

    ghostTextsRef.current.delete(ghostId);

    if (ghostTextsRef.current.size === 0) {
      const model = editorRef.current.getModel();
      if (model) {
        editorRef.current.trigger('clearGhostTexts', 'editor.action.inlineSuggest.hide', {});
      }
    }
  }, []);

  const clearAllGhostTexts = useCallback(() => {
    if (!editorRef.current) return;

    ghostTextsRef.current.forEach((ghostData, _) => {
      if (ghostData.providerDisposable) {
        ghostData.providerDisposable.dispose();
      }
    });

    ghostTextsRef.current.clear();

    const model = editorRef.current.getModel();
    if (model) {
      editorRef.current.trigger('clearGhostTexts', 'editor.action.inlineSuggest.hide', {});
    }

  }, []);

  useEffect(() => {
    const handleFileSaved = () => {
      clearAllGhostTexts();
    };

    window.addEventListener('file-saved', handleFileSaved);

    return () => {
      window.removeEventListener('file-saved', handleFileSaved);
    };
  }, [clearAllGhostTexts]);

  const restoreAllGhostTexts = useCallback(() => {
    if (!editorRef.current || ghostTextsRef.current.size === 0) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const edits = [];

    ghostTextsRef.current.forEach((ghostData, _) => {
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

      if (ghostData.providerDisposable) {
        ghostData.providerDisposable.dispose();
      }
    });

    editorRef.current.executeEdits('ghost-text-restoration', edits);

    ghostTextsRef.current.clear();

  }, []);

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

          let matchScore = 0;
          const minLength = Math.min(userInput.length, ghostData.originalText.length);

          for (let i = 0; i < minLength; i++) {
            if (userInput[i] === ghostData.originalText[i]) {
              matchScore++;
            }
          }

          if (userInput === ghostData.originalText) {
            ghostTextsRef.current.delete(ghostId);
            setTimeout(() => {
              editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
            }, 10);
          } else {
            const matchRatio = minLength > 0 ? matchScore / minLength : 1;
            if (matchRatio >= 0.7 || userInput.length === 0) {
              setTimeout(() => {
                editorRef.current?.trigger('ghost', 'editor.action.inlineSuggest.trigger', {});
              }, 10);
            }
          }
        } else if (changeEndPos.lineNumber < originalPos.lineNumber ||
          (changeEndPos.lineNumber === originalPos.lineNumber && changeEndPos.column <= originalPos.column)) {
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
      console.error('AI completion trigger failed:', error);
    }
  }, [aiSettings]);
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

  useCallback((fileName) => {
    if (!fileName) return '';
    return fileName.split('.').pop()?.toLowerCase() || '';
  }, []);

  const getEditorTheme = useCallback(() => {
    // 如果当前文件是mgtree文件，使用Monaco自定义主题

    if (currentFile?.name?.endsWith('.mgtree')) {
      return isDarkMode ? 'mgtree-dark' : 'mgtree-light';
    }
    // 其他文件使用带前缀的Shiki主题
    return isDarkMode ? 'shiki-one-dark-pro' : 'shiki-one-light';
  }, [isDarkMode, currentFile]);

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

  useEffect(() => {
    let mounted = true;

    const initializeThemesAndHighlighter = async () => {
      try {
        // 第一步：立即定义所有必需的Monaco原生主题，确保编辑器初始化时可用


        // 定义mgtree主题（独立于Shiki主题系统）
        try {
          monaco.editor.defineTheme('mgtree-dark', mgtreeThemeConfig.dark);
          monaco.editor.defineTheme('mgtree-light', mgtreeThemeConfig.light);

        } catch (themeError) {
          console.error('Failed to define mgtree themes:', themeError);
        }

        // 第二步：初始化Shiki高亮器（包含自定义语言和标准语言）

        const validLanguages = Object.entries(extensionToLanguage)
          .filter(([key]) => !key.startsWith('_'))
          .map(([, value]) => value);




        // 创建自定义主题对象，符合Shiki主题格式
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

        const highlighter = await createHighlighter({
          themes: [...Object.values(themes).flat(), ...mgtreeThemes],
          langs: [...new Set(validLanguages)]
        });

        // 第三步：加载mgtree自定义语言到Shiki

        try {
          await highlighter.loadLanguage(mgtreeTextMateGrammar);

        } catch (error) {
          console.warn('Failed to load mgtree language into Shiki:', error);
        }

        // 第四步：注册Monaco语言ID（为了Monaco编辑器识别）
        if (!monaco.languages.getLanguages().find(lang => lang.id === mgtreeLanguageConfig.id)) {


          monaco.languages.register({
            id: mgtreeLanguageConfig.id,
            extensions: mgtreeLanguageConfig.extensions,
            aliases: mgtreeLanguageConfig.aliases
          });


          // 设置语言配置
          monaco.languages.setLanguageConfiguration(mgtreeLanguageConfig.id, mgtreeLanguageConfig.configuration);


          // 🔥 注册 Monarch 语法规则
          try {
            monaco.languages.setMonarchTokensProvider(mgtreeLanguageConfig.id, mgtreeLanguageConfig.monarchLanguage);


            // 🔍 验证Monarch规则是否正确注册





          } catch (error) {
            console.error('❌ mgtree Monarch语法规则注册失败:', error);
          }
        } else {

        }




        // 使用shikiToMonaco函数注册主题，这是官方推荐的方式


        try {
          // 使用官方的shikiToMonaco函数注册主题
          shikiToMonaco(highlighter, monaco);


          // 验证主题是否已注册
          const registeredThemes = highlighter.getLoadedThemes();

        } catch (error) {
          console.error('Failed to register Shiki themes using shikiToMonaco:', error);

          // 降级到手动注册
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
              console.warn(`Failed to manually register theme ${themeName}:`, error);
            }
          });
        }

        if (mounted) {
          setHighlighterReady(true);
        }
      } catch (error) {
        console.error('Failed to initialize themes and highlighter:', error);
        if (mounted) {
          // 即使Shiki失败，也要设置为就绪，使用基础主题
          setHighlighterReady(true);
        }
      }
    };

    initializeThemesAndHighlighter().catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // 初始化编辑器
    if (containerRef.current && !editorRef.current && highlighterReady) {
      // 创建编辑器实例

      // 优先使用TabBar的languageRef，然后使用文件名推断语言
      const fileNameLanguage = getFileLanguage(getCurrentTabFileName());
      const initialLanguage = fileNameLanguage || 'plaintext';


      try {
        editorRef.current = monaco.editor.create(containerRef.current, {
          value: '', // 不设置默认内容，让文件管理器控制
          language: languageRef?.current || initialLanguage,
          theme: 'vs-dark', // 使用基础主题初始化
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

        if (!keydownDisposableRef.current) {
          keydownDisposableRef.current = editorRef.current.onKeyDown((e) => {
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
            else if (e.keyCode === monaco.KeyCode.KeyG && (e.ctrlKey || e.metaKey) && e.shiftKey) {
              restoreAllGhostTexts();
              e.preventDefault();
              e.stopPropagation();
            }
            else if (e.keyCode === monaco.KeyCode.KeyG && (e.ctrlKey || e.metaKey) && e.altKey) {
              acceptCurrentLineGhostText();
              e.preventDefault();
              e.stopPropagation();
            }
            else if (e.keyCode === monaco.KeyCode.KeyL && (e.ctrlKey || e.metaKey)) {
              ctrlLPressedRef.current = true;
              setTimeout(() => {
                ctrlLPressedRef.current = false;
              }, 1000);
            }
            else if (e.keyCode === monaco.KeyCode.Slash && (e.ctrlKey || e.metaKey)) {
              handleToggleMarkdownPreview();
              e.preventDefault();
              e.stopPropagation();
            }
          });
        }

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
          run: () => { },
          precondition: null
        });

        editorRef.current.addAction({
          id: 'ai-inline-completion',
          label: 'AI Inline Completion',
          run: () => {

          },
          precondition: null
        });

        // 添加鼠标点击事件处理器，用于处理超链接点击
        editorRef.current.onMouseDown((e) => {
          if (e.event.ctrlKey || e.event.metaKey) {
            const position = e.target.position;
            if (position) {
              const model = editorRef.current.getModel();
              const lineContent = model.getLineContent(position.lineNumber);

              // 检查点击位置是否在链接上
              const linkRegex = /https?:\/\/[^\s\)]+|\.\/[^\s\)]+|\.\.\/[^\s\)]+|[a-zA-Z0-9_-]+\.(md|txt|js|jsx|ts|tsx|py|java|cpp|c|h|css|scss|html|json|xml|yaml|yml)/g;
              let match;

              while ((match = linkRegex.exec(lineContent)) !== null) {
                const startCol = match.index + 1;
                const endCol = match.index + match[0].length + 1;

                if (position.column >= startCol && position.column <= endCol) {
                  const linkText = match[0];

                  // 使用linkUtils中的handleLinkClick函数处理链接
                  handleLinkClick(linkText, currentFile?.path, fileManager.setOpenFile);
                  break;
                }
              }
            }
          }
        });

        // 添加滚动监听器来控制返回顶部按钮的显示
        editorRef.current.onDidScrollChange((e) => {
          setShowBackToTop(e.scrollTop > 300);
        });

        // 设置核心监听器 - 每次Monaco初始化都必须添加
        const setupCoreListeners = () => {
          if (!editorRef.current) return [];

          const disposables = [];

          // 光标位置变化监听器
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

          // 内容变化监听器 - 实时更新字符数
          const contentDisposable = editorRef.current.onDidChangeModelContent(() => {
            if (editorRef.current && setCharacterCount) {
              const currentValue = editorRef.current.getValue();
              setCharacterCount(currentValue.length);
            }
          });
          disposables.push(contentDisposable);

          // 模型变化监听器
          const modelDisposable = editorRef.current.onDidChangeModel(() => {
            isCompletionActiveRef.current = false;

            // 当模型变化时，立即更新光标位置和字符数
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

        // 立即设置监听器
        const coreDisposables = setupCoreListeners();
        coreDisposablesRef.current = coreDisposables;

        // 编辑器初始化完成后，根据是否有文件来设置内容
        setTimeout(() => {
          if (editorRef.current && currentFile && currentFile['content'] !== undefined) {
            const fileContent = currentFile['content'];
            if (editorRef.current.getValue() !== fileContent) {
              editorRef.current.setValue(fileContent);
            }

            // 优先使用TabBar的languageRef，但对于mgtree文件特殊处理
            const tabBarLanguage = fileManager?.tabBarRef?.languageRef?.current;
            const fileNameLanguage = getFileLanguage(getCurrentTabFileName());

            // 🔥 特殊处理：对于.mgtree文件，优先使用文件名推断的语言
            let language;
            if (getCurrentTabFileName()?.endsWith('.mgtree')) {
              // mgtree文件优先使用文件名推断的语言，忽略TabBar设置
              language = fileNameLanguage || 'mgtree';

            } else {
              // 其他文件使用原有逻辑
              language = tabBarLanguage || fileNameLanguage || 'plaintext';
            }

            // 🔍 添加详细的调试日志







            monaco.editor.setModelLanguage(editorRef.current.getModel(), language);

            // 🔍 验证Monaco语言设置
            const currentModel = editorRef.current.getModel();
            const actualLanguage = currentModel.getLanguageId();


            // 🔍 检查Monaco是否识别mgtree语言
            const registeredLanguages = monaco.languages.getLanguages();
            const mgtreeLanguage = registeredLanguages.find(lang => lang.id === 'mgtree');

            if (mgtreeLanguage) {

            }

            // 初始化字符数统计 - 使用实际编辑器内容
            if (setCharacterCount) {
              const actualContent = editorRef.current.getValue();
              setCharacterCount(actualContent.length);
            }

            // 初始化光标位置
            if (setCursorPosition) {
              const position = editorRef.current.getPosition() || { lineNumber: 1, column: 1 };
              setCursorPosition(position);
            }
          } else if (editorRef.current) {
            // 如果没有文件，设置空内容
            editorRef.current.setValue('');
            monaco.editor.setModelLanguage(editorRef.current.getModel(), 'plaintext');

            // 重置状态栏信息
            if (setCharacterCount) {
              setCharacterCount(0);
            }

            if (setCursorPosition) {
              setCursorPosition({ lineNumber: 1, column: 1 });
            }
          }
        }, 0);

      } catch (error) {
      }
    }

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

        // 清理核心监听器
        if (coreDisposablesRef.current) {
          coreDisposablesRef.current.forEach(d => d?.dispose?.());
          coreDisposablesRef.current = [];
        }

        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [highlighterReady, createGhostText, restoreAllGhostTexts, acceptCurrentLineGhostText]);

  useEffect(() => {
    if (!editorRef.current || isInternalChange.current) return;      // 确保编辑器内容与文件内容同步
    const fileContent = currentFile['content'];
    if (editorRef.current.getValue() !== fileContent) {
      editorRef.current.setValue(fileContent);
    }

    // 优先使用TabBar的languageRef，但对于mgtree文件特殊处理
    const tabBarLanguage = fileManager?.tabBarRef?.languageRef?.current;
    const fileNameLanguage = getFileLanguage(getCurrentTabFileName());

    // 🔥 特殊处理：对于.mgtree文件，优先使用文件名推断的语言
    let language;
    if (getCurrentTabFileName()?.endsWith('.mgtree')) {
      // mgtree文件优先使用文件名推断的语言，忽略TabBar设置
      language = fileNameLanguage || 'mgtree';

    } else {
      // 其他文件使用原有逻辑
      language = tabBarLanguage || fileNameLanguage || 'plaintext';
    }

    monaco.editor.setModelLanguage(editorRef.current.getModel(), language);

    // 内容设置完成后，强制更新状态栏信息以确保与编辑器严格同步
    setTimeout(() => {
      if (editorRef.current) {
        // 更新字符数统计 - 严格使用当前编辑器内容
        if (setCharacterCount) {
          const actualContent = editorRef.current.getValue();
          setCharacterCount(actualContent.length);
        }

        // 更新光标位置 - 严格使用当前编辑器光标位置
        if (setCursorPosition) {
          const position = editorRef.current.getPosition() || { lineNumber: 1, column: 1 };
          setCursorPosition(position);
        }
      }
    }, 0);
  }, [currentFile, getFileLanguage, setCharacterCount, setCursorPosition]);

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

  useEffect(() => {
    if (!currentFile) return;

    if (wasModifiedRef.current && !currentFile['isModified']) {
      clearAllGhostTexts();
    }

    wasModifiedRef.current = currentFile['isModified'];
  }, [currentFile?.isModified, clearAllGhostTexts]);

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

          try {
            isCompletionActiveRef.current = true;

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

            if (!aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
              isCompletionActiveRef.current = false;
              return { items: [] };
            }
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

            const currentLine = model.getLineContent(position.lineNumber);
            const beforeCursor = currentLine.substring(0, position.column - 1);

            if (prefix.trim().length < 1 && beforeCursor.trim().length < 1) {
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

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
              temperature: 0.05,
              max_tokens: 1000,
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
              isCompletionActiveRef.current = false;
              return { items: [] };
            }

            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content ?? '';

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

                }
              }, 2000);
            };

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
                  } else {

                  }
                }
              }
            }

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



            function calculateTextSimilarity(text1, text2) {
              const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
              const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

              if (words1.size === 0 && words2.size === 0) return 1;
              if (words1.size === 0 || words2.size === 0) return 0;

              const intersection = new Set([...words1].filter(x => words2.has(x)));
              const union = new Set([...words1, ...words2]);

              return intersection.size / union.size;
            }

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

  useEffect(() => {
    if (editorRef.current && currentFile && !isInternalChange.current) {
      const currentValue = editorRef.current.getValue();
      const newValue = currentFile['content'] || '';

      if (currentValue !== newValue) {
        editorRef.current.setValue(newValue);
      }

      // 优先使用TabBar的languageRef，但对于mgtree文件特殊处理
      const tabBarLanguage = fileManager?.tabBarRef?.languageRef?.current;
      const fileNameLanguage = getFileLanguage(getCurrentTabFileName());

      // 🔥 特殊处理：对于.mgtree文件，优先使用文件名推断的语言
      let language;
      if (currentFile?.name?.endsWith('.mgtree')) {
        // mgtree文件优先使用文件名推断的语言，忽略TabBar设置
        language = fileNameLanguage || 'mgtree';

      } else {
        // 其他文件使用原有逻辑
        language = tabBarLanguage || fileNameLanguage || 'plaintext';
      }


      const model = editorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }

    if (currentFile && !isMarkdownFile() && internalShowMarkdownPreview) {
      setInternalShowMarkdownPreview(false);
    }
  }, [currentFile, getFileLanguage, showMarkdownPreview]);

  useEffect(() => {
    if (editorRef.current) {
      try {
        // 完全分离两个主题系统
        if (getCurrentTabFileName().endsWith('.mgtree')) {
          // mgtree文件使用Monaco原生主题系统
          const mgtreeTheme = isDarkMode ? 'mgtree-dark' : 'mgtree-light';

          // 确保主题存在后再设置
          try {



            monaco.editor.setTheme(mgtreeTheme);


          } catch (setError) {
            console.warn(`❌ 设置${mgtreeTheme}失败，尝试重新定义:`, setError);
            // 如果设置失败，重新定义主题
            try {

              monaco.editor.defineTheme('mgtree-dark', mgtreeThemeConfig.dark);
              monaco.editor.defineTheme('mgtree-light', mgtreeThemeConfig.light);


              monaco.editor.setTheme(mgtreeTheme);


            } catch (redefineError) {
              console.error('❌ 重新定义mgtree主题失败:', redefineError);
              // 最后降级到基础主题
              monaco.editor.setTheme(isDarkMode ? 'vs-dark' : 'vs');
            }
          }
        } else {
          // 其他文件使用Shiki主题：直接使用 one-dark-pro 和 one-light
          const shikiTheme = isDarkMode ? 'one-dark-pro' : 'one-light';


          try {
            // 设置Shiki主题（不带前缀）
            monaco.editor.setTheme(shikiTheme);

          } catch (shikiError) {
            console.error(`✗ Failed to set Shiki theme ${shikiTheme}:`, shikiError);
            // 降级到基础主题
            const basicTheme = isDarkMode ? 'vs-dark' : 'vs';
            monaco.editor.setTheme(basicTheme);

          }
        }
      } catch (error) {
        console.error('Failed to set theme:', error);
        // 主题设置失败时降级到最基础的主题
        try {
          monaco.editor.setTheme('vs-dark');

        } catch (fallbackError) {
          console.error('Even fallback theme failed:', fallbackError);
        }
      }
    }
  }, [getEditorTheme, highlighterReady, isDarkMode, currentFile]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: fontSize,
        fontFamily: fontFamily,
        lineHeight: lineHeight,
      });
    }
  }, [fontSize, fontFamily, lineHeight]);

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
              // 使用自定义的平滑滚动实现更慢的动画效果
              const editor = editorRef.current;
              const currentScrollTop = editor.getScrollTop();
              const duration = 800; // 动画持续时间800ms
              const startTime = performance.now();

              const animateScroll = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // 使用easeOutCubic缓动函数，让动画更自然
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
