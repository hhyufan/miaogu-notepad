import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Empty, message } from 'antd';
import '../monaco-worker';
import * as monaco from 'monaco-editor';
import { shikiToMonaco } from '@shikijs/monaco';
import { createHighlighter } from 'shiki';
import { useEditor, useTheme } from '../hooks/redux';
import tauriApi from '../utils/tauriApi';
const { file: fileApi, settings: settingsApi } = tauriApi;
// 内联主题配置，只保留使用的One主题
const themes = {
  'One': ['one-dark-pro', 'one-light']
};
import extensionToLanguage from '../configs/file-extensions.json';
import './CodeEditor.scss';

function CodeEditor({ isDarkMode, fileManager }) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const isInternalChange = useRef(false); // 防止循环更新
  const [highlighterReady, setHighlighterReady] = useState(false);
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
  const providerDisposablesRef = useRef([]);
  const keydownDisposableRef = useRef(null);

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
  const REQUEST_RESET_INTERVAL = 10000; // 10秒重置计数器

  // 重试建议存储
  const retrySuggestionRef = useRef(null);

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

  // 手动触发AI补全的函数 - 只在光标停留2秒不动时调用
  const triggerAICompletion = useCallback(async () => {
    if (!editorRef.current || !aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
      return;
    }

    // 额外检查：确保当前没有活跃的补全
    if (isCompletionActiveRef.current) {
      return;
    }

    try {
      // 触发内联补全
      await editorRef.current.trigger('auto-completion', 'editor.action.inlineSuggest.trigger', {});
    } catch (error) {
      console.warn('Failed to trigger AI completion:', error);
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
      message.success(result);
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
      message.success(result);
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
      message.success(result);
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
            suppressSuggestions: false,
            fontFamily: 'inherit',
            // 添加更多配置确保幽灵文本显示
            keepOnBlur: true,
            showToolbar: 'always'
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false
          },
          suggestOnTriggerCharacters: true
        });
        // Tab 接受内联建议（当存在时）
        if (!keydownDisposableRef.current) {
          keydownDisposableRef.current = editorRef.current.onKeyDown((e) => {
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
                  e.preventDefault();
                  e.stopPropagation();

                  // 可选：显示接受建议的提示
                  // message.success(t('settings.aiSettingsUpdated'), 1);
                } catch (error) {
                  console.warn('Failed to accept AI suggestion:', error);
                  inlineAcceptRef.current = null;
                }
              }
            }
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
        providerDisposablesRef.current.forEach(d => d?.dispose?.());
        providerDisposablesRef.current = [];
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [highlighterReady]);

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

    const disposable = editorRef.current.onDidChangeModelContent(() => {
      isInternalChange.current = true;
      const currentValue = editorRef.current.getValue();
      if (currentFile && updateContent) {
        updateContent(currentValue);
      }
      setTimeout(() => {
        isInternalChange.current = false;
      }, 0);
    });

    return () => {
      disposable.dispose();
    };
  }, [updateContent, currentFile]);

  // 监听光标位置变化，实现3秒未移动自动触发补全
  useEffect(() => {
    if (!editorRef.current) return;

    const disposables = [];

    // 监听光标位置变化 - 只在光标停留2秒不动时触发
    const cursorDisposable = editorRef.current.onDidChangeCursorPosition((e) => {
      const newPosition = {
        lineNumber: e.position.lineNumber,
        column: e.position.column
      };

      // 清除之前的定时器
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }

      // 更新光标位置
      cursorPositionRef.current = newPosition;

      // 设置2秒防抖定时器 - 只有光标真正停留2秒不动才触发
      cursorTimerRef.current = setTimeout(async () => {
        // 再次检查光标位置是否发生变化
        const currentPosition = editorRef.current?.getPosition();
        if (!currentPosition ||
          currentPosition.lineNumber !== newPosition.lineNumber ||
          currentPosition.column !== newPosition.column) {

          return;
        }

        // 检查是否有活跃的补全
        if (!isCompletionActiveRef.current && aiSettings.enabled) {
          // 检查API请求节流限制
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
            return;
          }


          await triggerAICompletion();
        }
      }, DEBOUNCE_DELAY);
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
              console.warn('AI completion request failed:', res.status, res.statusText);
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
            console.warn('AI completion error:', error);
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
  }, [currentFile, getFileLanguage]);

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
      <div
        ref={containerRef}
        className="code-editor"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          opacity: currentFile ? 1 : 0.3,
          border: 'none'
        }}
      />
    </div>
  );
}

export default CodeEditor;
