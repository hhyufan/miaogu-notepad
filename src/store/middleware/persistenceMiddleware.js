/**
 * @fileoverview 持久化中间件 - 自动保存Redux状态到Tauri Store
 * 监听特定的Redux action，自动将状态变化持久化到本地存储
 * @author hhyufan
 * @version 1.2.0
 */

import { persistenceManager } from '../../utils/persistenceManager';

/**
 * 持久化中间件
 * 监听Redux状态变化并自动保存到Tauri Store
 */
const persistenceMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  const state = store.getState();

  const persistableActions = [
    'theme/setTheme',
    'theme/setFontSize',
    'theme/setFontFamily',
    'theme/setLineHeight',
    'theme/setBackgroundImage',
    'theme/setBackgroundEnabled',
    'theme/setBackgroundTransparency',


    'editor/setLanguage',
    'editor/setWordWrap',
    'editor/setMinimap',
    'editor/setScrollBeyondLastLine',
    'editor/setTabSize',
    'editor/setInsertSpaces',
    'editor/setRenderWhitespace',
    'editor/setCursorBlinking',
    'editor/setCursorStyle',
    'editor/setLineNumbers',
    'editor/setGlyphMargin',
    'editor/setFolding',
    'editor/setShowFoldingControls',
    'editor/setMatchBrackets',
    'editor/setAutoIndent',
    'editor/setFormatOnPaste',
    'editor/setFormatOnType',

    'file/openFile',
    'file/createFile',
    'file/saveFile',
    'file/closeFile',
    'file/switchFile',
    'file/updateFileContent',
    'file/updateEditorContent',
    'file/updateDefaultFileName',
    'file/renameFile',
  ];

  if (persistableActions.includes(action.type)) {
    setTimeout(() => {
      persistenceManager.saveAppState(state).catch();
    }, 0);
  }

  return result;
};

export default persistenceMiddleware;
