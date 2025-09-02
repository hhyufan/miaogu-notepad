import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // 文件管理状态
  openedFiles: [],
  currentFile: null,
  fileContent: '',
  isModified: false,

  // Monaco Editor 配置
  content: '',
  language: 'javascript',
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  renderWhitespace: 'selection',
  cursorBlinking: 'blink',
  cursorStyle: 'line',
  lineNumbers: 'on',
  glyphMargin: true,
  folding: true,
  showFoldingControls: 'mouseover',
  matchBrackets: 'always',
  autoIndent: 'advanced',
  formatOnPaste: true,
  formatOnType: false,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setLanguage: (state, action) => {
      state.language = action.payload;
    },
    setWordWrap: (state, action) => {
      state.wordWrap = action.payload;
    },
    setMinimap: (state, action) => {
      state.minimap = action.payload;
    },
    setScrollBeyondLastLine: (state, action) => {
      state.scrollBeyondLastLine = action.payload;
    },
    setTabSize: (state, action) => {
      state.tabSize = action.payload;
    },
    setInsertSpaces: (state, action) => {
      state.insertSpaces = action.payload;
    },
    setRenderWhitespace: (state, action) => {
      state.renderWhitespace = action.payload;
    },
    setCursorBlinking: (state, action) => {
      state.cursorBlinking = action.payload;
    },
    setCursorStyle: (state, action) => {
      state.cursorStyle = action.payload;
    },
    setLineNumbers: (state, action) => {
      state.lineNumbers = action.payload;
    },
    setGlyphMargin: (state, action) => {
      state.glyphMargin = action.payload;
    },
    setFolding: (state, action) => {
      state.folding = action.payload;
    },
    setShowFoldingControls: (state, action) => {
      state.showFoldingControls = action.payload;
    },
    setMatchBrackets: (state, action) => {
      state.matchBrackets = action.payload;
    },
    setAutoIndent: (state, action) => {
      state.autoIndent = action.payload;
    },
    setFormatOnPaste: (state, action) => {
      state.formatOnPaste = action.payload;
    },
    setFormatOnType: (state, action) => {
      state.formatOnType = action.payload;
    },
  },
});

export const {
  setLanguage,
  setWordWrap,
  setMinimap,
  setScrollBeyondLastLine,
  setTabSize,
  setInsertSpaces,
  setRenderWhitespace,
  setCursorBlinking,
  setCursorStyle,
  setLineNumbers,
  setGlyphMargin,
  setFolding,
  setShowFoldingControls,
  setMatchBrackets,
  setAutoIndent,
  setFormatOnPaste,
  setFormatOnType,
} = editorSlice.actions;

export default editorSlice.reducer;
