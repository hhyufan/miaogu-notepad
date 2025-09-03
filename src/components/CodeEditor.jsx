import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Empty, message } from 'antd';
import '../monaco-worker';
import * as monaco from 'monaco-editor';
import { shikiToMonaco } from '@shikijs/monaco';
import { createHighlighter } from 'shiki';
import { useEditor, useTheme } from '../hooks/redux';
import tauriApi from '../utils/tauriApi';
const { file: fileApi } = tauriApi;
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
  const getFileExtension = useCallback((fileName) => {
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
        });

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



      } catch (error) {
        // 静默处理Monaco编辑器创建错误
      }
    }

    // 清理函数
    return () => {
      if (editorRef.current) {

        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [highlighterReady]);

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
