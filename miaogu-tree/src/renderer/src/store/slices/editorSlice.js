import { createSlice } from '@reduxjs/toolkit';

// 初始状态
const initialState = {
  // 当前打开的文件
  currentFile: null,
  
  // 未保存的内容
  unsavedContent: {},
  
  // 展开的章节状态
  expandedSections: [],
  
  // 树形结构数据
  treeData: [],
  
  // 选中的节点
  selectedKeys: [],
  
  // 编辑器设置
  editorSettings: {
    fontSize: 14,
    theme: 'light'
  },
  

  
  // 最近打开的文件列表
  recentFiles: []
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    // 设置当前文件
    setCurrentFile: (state, action) => {
      state.currentFile = action.payload;
      // 添加到最近文件列表
      if (action.payload && !state.recentFiles.includes(action.payload)) {
        state.recentFiles.unshift(action.payload);
        // 限制最近文件数量为10个
        if (state.recentFiles.length > 10) {
          state.recentFiles = state.recentFiles.slice(0, 10);
        }
      }
    },
    
    // 设置树形数据
    setTreeData: (state, action) => {
      state.treeData = action.payload;
    },
    
    // 设置选中的节点
    setSelectedKeys: (state, action) => {
      state.selectedKeys = action.payload;
    },
    
    // 设置展开的章节
    setExpandedSections: (state, action) => {
      state.expandedSections = action.payload;
    },
    
    // 添加展开的章节
    addExpandedSection: (state, action) => {
      if (!state.expandedSections.includes(action.payload)) {
        state.expandedSections.push(action.payload);
      }
    },
    
    // 移除展开的章节
    removeExpandedSection: (state, action) => {
      state.expandedSections = state.expandedSections.filter(
        section => section !== action.payload
      );
    },
    
    // 设置未保存的内容
    setUnsavedContent: (state, action) => {
      const { filePath, content } = action.payload;
      if (content === null || content === undefined) {
        delete state.unsavedContent[filePath];
      } else {
        state.unsavedContent[filePath] = content;
      }
    },
    
    // 清除未保存的内容
    clearUnsavedContent: (state, action) => {
      const filePath = action.payload;
      if (filePath) {
        delete state.unsavedContent[filePath];
      } else {
        state.unsavedContent = {};
      }
    },
    

    
    // 更新编辑器设置
    updateEditorSettings: (state, action) => {
      state.editorSettings = {
        ...state.editorSettings,
        ...action.payload
      };
    },
    
    // 重置编辑器状态
    resetEditorState: (state) => {
      state.currentFile = null;
      state.treeData = [];
      state.selectedKeys = [];
      // 保留展开状态、未保存内容和设置
    },
    
    // 完全重置状态（用于新项目）
    resetAllState: () => initialState
  }
});

// 导出actions
export const {
  setCurrentFile,
  setTreeData,
  setSelectedKeys,
  setExpandedSections,
  addExpandedSection,
  removeExpandedSection,
  setUnsavedContent,
  clearUnsavedContent,
  updateEditorSettings,
  resetEditorState,
  resetAllState
} = editorSlice.actions;

// 导出reducer
export default editorSlice.reducer;

// 选择器
export const selectCurrentFile = (state) => state.editor.currentFile;
export const selectTreeData = (state) => state.editor.treeData;
export const selectSelectedKeys = (state) => state.editor.selectedKeys;
export const selectExpandedSections = (state) => state.editor.expandedSections;
export const selectUnsavedContent = (state) => state.editor.unsavedContent;

export const selectEditorSettings = (state) => state.editor.editorSettings;
export const selectRecentFiles = (state) => state.editor.recentFiles;