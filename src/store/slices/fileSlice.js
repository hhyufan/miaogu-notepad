import { createSlice } from '@reduxjs/toolkit';

// 初始状态
const initialState = {
  // 当前打开的文件
  currentFile: {
    path: '',
    name: '',
    content: '',
    originalContent: '',
    isModified: false,
    isTemporary: false,
    encoding: 'UTF-8',
    lineEnding: 'LF'
  },
  // 打开的文件列表
  openedFiles: [],
  // 编辑器内容（用于未保存的新文件）
  editorContent: '',
  // 默认文件名
  defaultFileName: '未命名',
  // 文件操作状态
  isLoading: false,
  error: null
};

// 辅助函数：从路径获取文件名
const getFileNameFromPath = (path) => {
  if (!path) return '';
  return path.split(/[\\/]/).pop() || '';
};

// 文件管理 slice
const fileSlice = createSlice({
  name: 'file',
  initialState,
  reducers: {
    // 打开文件
    openFile: (state, action) => {
      const { path, content, name, encoding = 'UTF-8', lineEnding = 'LF' } = action.payload;

      // 检查文件是否已经打开
      const existingFileIndex = state.openedFiles.findIndex(file => file.path === path);

      const fileData = {
        path,
        name: name || getFileNameFromPath(path),
        content,
        originalContent: content,
        isModified: false,
        isTemporary: false,
        encoding,
        lineEnding
      };

      if (existingFileIndex >= 0) {
        // 文件已存在，更新内容
        state.openedFiles[existingFileIndex] = fileData;
      } else {
        // 新文件，添加到列表
        state.openedFiles.push(fileData);
      }

      // 设置为当前文件
      state.currentFile = fileData;
      // 清空编辑器内容（因为现在有具体文件了）
      state.editorContent = '';
    },

    // 创建新文件
    createFile: (state, action) => {
      const { name, content = '' } = action.payload;

      const newFile = {
        path: '', // 新文件暂时没有路径
        name,
        content,
        originalContent: content,
        isModified: false,
        isTemporary: true,
        encoding: 'UTF-8',
        lineEnding: 'LF'
      };

      // 添加到打开文件列表
      state.openedFiles.push(newFile);
      // 设置为当前文件
      state.currentFile = newFile;
      // 清空编辑器内容
      state.editorContent = '';
    },

    // 保存文件
    saveFile: (state, action) => {
      const { path, name, content } = action.payload;

      // 更新当前文件
      if (state.currentFile) {
        state.currentFile.path = path;
        state.currentFile.name = name || getFileNameFromPath(path);
        state.currentFile.content = content;
        state.currentFile.originalContent = content;
        state.currentFile.isModified = false;
        state.currentFile.isTemporary = false;
      }

      // 更新打开文件列表中的对应文件
      const fileIndex = state.openedFiles.findIndex(file =>
        file.path === path || (file.isTemporary && file === state.currentFile)
      );

      if (fileIndex >= 0) {
        state.openedFiles[fileIndex] = { ...state.currentFile };
      }

      // 同步更新编辑器内容
      state.editorContent = content;
    },

    // 关闭文件
    closeFile: (state, action) => {
      const keyToClose = action.payload;

      // 查找要关闭的文件
      let fileToClose = state.openedFiles.find(file => file.path === keyToClose);

      // 如果直接匹配失败，检查是否是临时文件的 key 格式
      if (!fileToClose && keyToClose.startsWith('temp-')) {
        const tempFileName = keyToClose.replace('temp-', '');
        fileToClose = state.openedFiles.find(file =>
          file.isTemporary && file.name === tempFileName
        );
      }

      if (!fileToClose) return;

      // 从打开文件列表中移除
      state.openedFiles = state.openedFiles.filter(file => file !== fileToClose);

      // 如果关闭的是当前文件，需要切换到其他文件或清空
      if (state.currentFile === fileToClose) {
        if (state.openedFiles.length > 0) {
          // 切换到最后一个文件
          state.currentFile = state.openedFiles[state.openedFiles.length - 1];
        } else {
          // 没有其他文件，重置为初始状态
          state.currentFile = initialState.currentFile;
          state.editorContent = '';
        }
      }
    },

    // 切换文件
    switchFile: (state, action) => {
      const key = action.payload;
      let file = state.openedFiles.find(f => f.path === key);

      // 如果直接匹配失败，检查是否是临时文件的 key 格式
      if (!file && key.startsWith('temp-')) {
        const tempFileName = key.replace('temp-', '');
        file = state.openedFiles.find(f =>
          f.isTemporary && f.name === tempFileName
        );
      }

      if (file) {
        state.currentFile = file;
        // 同步更新编辑器内容
        state.editorContent = file.content || '';
      }
    },

    // 更新文件内容
    updateFileContent: (state, action) => {
      const { path, content } = action.payload;

      // 更新当前文件
      if (state.currentFile.path === path) {
        state.currentFile.content = content;
        state.currentFile.isModified = content !== state.currentFile.originalContent;
      }

      // 更新打开文件列表中的对应文件
      const fileIndex = state.openedFiles.findIndex(file => file.path === path);
      if (fileIndex >= 0) {
        state.openedFiles[fileIndex].content = content;
        state.openedFiles[fileIndex].isModified = content !== state.openedFiles[fileIndex].originalContent;
      }
    },

    // 更新编辑器内容（用于未保存的新文件）
    updateEditorContent: (state, action) => {
      state.editorContent = action.payload;

      // 如果当前文件是临时文件，也要更新其修改状态
      if (state.currentFile && state.currentFile.isTemporary) {
        state.currentFile.content = action.payload;
        state.currentFile.isModified = action.payload !== state.currentFile.originalContent;

        // 同时更新openedFiles中的对应文件
        const fileIndex = state.openedFiles.findIndex(file =>
          file.isTemporary && file === state.currentFile
        );
        if (fileIndex >= 0) {
          state.openedFiles[fileIndex].content = action.payload;
          state.openedFiles[fileIndex].isModified = action.payload !== state.openedFiles[fileIndex].originalContent;
        }
      }
    },

    // 更新默认文件名
    updateDefaultFileName: (state, action) => {
      state.defaultFileName = action.payload;
    },

    // 重命名文件
    renameFile: (state, action) => {
      const { oldPath, newPath, newName } = action.payload;

      // 更新当前文件
      if (state.currentFile.path === oldPath) {
        state.currentFile.path = newPath;
        state.currentFile.name = newName || getFileNameFromPath(newPath);
      }

      // 更新打开文件列表
      const fileIndex = state.openedFiles.findIndex(file => file.path === oldPath);
      if (fileIndex >= 0) {
        state.openedFiles[fileIndex].path = newPath;
        state.openedFiles[fileIndex].name = newName || getFileNameFromPath(newPath);
      }
    },

    // 刷新文件内容
    refreshFileContent: (state, action) => {
      const { path, content } = action.payload;

      // 更新当前文件
      if (state.currentFile.path === path) {
        state.currentFile.content = content;
        state.currentFile.originalContent = content;
        state.currentFile.isModified = false;
      }

      // 更新打开文件列表
      const fileIndex = state.openedFiles.findIndex(file => file.path === path);
      if (fileIndex >= 0) {
        state.openedFiles[fileIndex].content = content;
        state.openedFiles[fileIndex].originalContent = content;
        state.openedFiles[fileIndex].isModified = false;
      }
    },

    // 获取未保存的文件列表
    getUnsavedFiles: (state) => {
      return state.openedFiles.filter(file => file.isModified);
    }
  }
});

// 导出 actions
export const {
  openFile,
  switchFile,
  updateEditorContent,
} = fileSlice.actions;

// 导出 reducer
export default fileSlice.reducer;
