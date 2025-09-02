import { persistenceManager } from '../../utils/persistenceManager';

/**
 * 持久化中间件
 * 监听Redux状态变化并自动保存到Tauri Store
 */
const persistenceMiddleware = (store) => (next) => (action) => {
  // 执行action
  const result = next(action);

  // 获取更新后的状态
  const state = store.getState();

  // 需要持久化的action类型
  const persistableActions = [
    // 主题相关
    'theme/setTheme',
    'theme/setFontSize',
    'theme/setFontFamily',
    'theme/setLineHeight',
    'theme/setBackgroundImage',
    'theme/setBackgroundEnabled',
    'theme/setBackgroundTransparency',


    // 编辑器相关
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

    // 文件相关
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

  // 检查是否需要持久化
  if (persistableActions.includes(action.type)) {
    // 异步保存状态，不阻塞UI
    setTimeout(() => {
      persistenceManager.saveAppState(state).catch();
    }, 0);
  }

  return result;
};

export default persistenceMiddleware;
