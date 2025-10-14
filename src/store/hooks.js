/**
 * @fileoverview Redux Store Hooks - 提供类型化的Redux hooks
 * 封装常用的状态选择器，提供更便捷的状态访问
 * @author hhyufan
 * @version 1.3.1
 */

import {useDispatch, useSelector} from 'react-redux';

export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

export const useCurrentFile = () => useAppSelector(state => state.editor.currentFile);
export const useTreeData = () => useAppSelector(state => state.editor.treeData);
export const useSelectedKeys = () => useAppSelector(state => state.editor.selectedKeys);
export const useExpandedSections = () => useAppSelector(state => state.editor.expandedSections);
export const useUnsavedContent = () => useAppSelector(state => state.editor.unsavedContent);

export const useEditorSettings = () => useAppSelector(state => state.editor.editorSettings);
export const useRecentFiles = () => useAppSelector(state => state.editor.recentFiles);

// 更新相关hooks
export const useUpdateState = () => useAppSelector(state => state.update);
export const useHasUpdate = () => useAppSelector(state => state.update.hasUpdate);
export const useShowUpdatePrompt = () => useAppSelector(state => state.update.showUpdatePrompt);
export const useUpdateProgress = () => useAppSelector(state => ({
    isDownloading: state.update.isDownloading,
    downloadProgress: state.update.downloadProgress,
    isInstalling: state.update.isInstalling,
}));
