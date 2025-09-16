/**
 * @fileoverview 文件状态切片 - 管理文件相关状态
 * 包含文件打开、保存、切换、内容更新等文件操作相关状态
 * @author hhyufan
 * @version 1.2.0
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
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
  openedFiles: [],
  editorContent: '',
  defaultFileName: 'Untitled',
  isLoading: false,
  error: null
};

const getFileNameFromPath = (path) => {
  if (!path) return '';
  return path.split(/[\\/]/).pop() || '';
};

const fileSlice = createSlice({
  name: 'file',
  initialState,
  reducers: {
    openFile: (state, action) => {
      const { path, content, name, encoding = 'UTF-8', lineEnding = 'LF' } = action.payload;

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
        state.openedFiles[existingFileIndex] = fileData;
      } else {
        state.openedFiles.push(fileData);
      }

      state.currentFile = fileData;
      state.editorContent = '';
    },

    createFile: (state, action) => {
      const { name, content = '' } = action.payload;

      const newFile = {
        path: '',
        name,
        content,
        originalContent: content,
        isModified: false,
        isTemporary: true,
        encoding: 'UTF-8',
        lineEnding: 'LF'
      };

      state.openedFiles.push(newFile);
      state.currentFile = newFile;
      state.editorContent = '';
    },

    saveFile: (state, action) => {
      const { path, name, content } = action.payload;

      if (state.currentFile) {
        state.currentFile['path'] = path;
        state.currentFile['name'] = name || getFileNameFromPath(path);
        state.currentFile['content'] = content;
        state.currentFile['originalContent'] = content;
        state.currentFile['isModified'] = false;
        state.currentFile['isTemporary'] = false;
      }

      const fileIndex = state.openedFiles.findIndex(file =>
        file.path === path || (file.isTemporary && file === state.currentFile)
      );

      if (fileIndex >= 0) {
        state.openedFiles[fileIndex] = { ...state.currentFile };
      }

      state.editorContent = content;
    },

    closeFile: (state, action) => {
      const keyToClose = action.payload;

      let fileToClose = state.openedFiles.find(file => file.path === keyToClose);

      if (!fileToClose && keyToClose.startsWith('temp-')) {
        const tempFileName = keyToClose.replace('temp-', '');
        fileToClose = state.openedFiles.find(file =>
          file.isTemporary && file.name === tempFileName
        );
      }

      if (!fileToClose) return;

      state.openedFiles = state.openedFiles.filter(file => file !== fileToClose);

      if (state.currentFile === fileToClose) {
        if (state.openedFiles.length > 0) {
          state.currentFile = state.openedFiles[state.openedFiles.length - 1];
        } else {
          state.currentFile = initialState.currentFile;
          state.editorContent = '';
        }
      }
    },

    switchFile: (state, action) => {
      const key = action.payload;
      let file = state.openedFiles.find(f => f.path === key);

      if (!file && key.startsWith('temp-')) {
        const tempFileName = key.replace('temp-', '');
        file = state.openedFiles.find(f =>
          f.isTemporary && f.name === tempFileName
        );
      }

      if (file) {
        state.currentFile = file;
        state.editorContent = file.content || '';
      }
    },

    updateFileContent: (state, action) => {
      const { path, content } = action.payload;

      if (state.currentFile['path'] === path) {
        state.currentFile['content'] = content;
        state.currentFile['isModified'] = content !== state.currentFile['originalContent'];
      }

      const fileIndex = state.openedFiles.findIndex(file => file.path === path);
      if (fileIndex >= 0) {
        state.openedFiles[fileIndex].content = content;
        state.openedFiles[fileIndex].isModified = content !== state.openedFiles[fileIndex].originalContent;
      }
    },

    updateEditorContent: (state, action) => {
      state.editorContent = action.payload;

      if (state.currentFile && state.currentFile['isTemporary']) {
        state.currentFile['content'] = action.payload;
        state.currentFile['isModified'] = action.payload !== state.currentFile['originalContent'];

        const fileIndex = state.openedFiles.findIndex(file =>
          file.isTemporary && file === state.currentFile
        );
        if (fileIndex >= 0) {
          state.openedFiles[fileIndex].content = action.payload;
          state.openedFiles[fileIndex].isModified = action.payload !== state.openedFiles[fileIndex].originalContent;
        }
      }
    },

    updateDefaultFileName: (state, action) => {
      state.defaultFileName = action.payload;
    },

    renameFile: (state, action) => {
      const { oldPath, newPath, newName } = action.payload;

      if (state.currentFile['path'] === oldPath) {
        state.currentFile['path'] = newPath;
        state.currentFile['name'] = newName || getFileNameFromPath(newPath);
      }

      const fileIndex = state.openedFiles.findIndex(file => file.path === oldPath);
      if (fileIndex >= 0) {
        state.openedFiles[fileIndex].path = newPath;
        state.openedFiles[fileIndex].name = newName || getFileNameFromPath(newPath);
      }
    },

    refreshFileContent: (state, action) => {
      const { path, content } = action.payload;

      if (state.currentFile['path'] === path) {
        state.currentFile['content'] = content;
        state.currentFile['originalContent'] = content;
        state.currentFile['isModified'] = false;
      }

      const fileIndex = state.openedFiles.findIndex(file => file.path === path);
      if (fileIndex >= 0) {
        state.openedFiles[fileIndex].content = content;
        state.openedFiles[fileIndex].originalContent = content;
        state.openedFiles[fileIndex].isModified = false;
      }
    },

    getUnsavedFiles: (state) => {
      return state.openedFiles.filter(file => file.isModified);
    }
  }
});

export const {
  openFile,
  switchFile,
  updateEditorContent,
} = fileSlice.actions;

export default fileSlice.reducer;
