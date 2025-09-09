import { useDispatch, useSelector } from 'react-redux';

// 类型安全的hooks
export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

// 便捷的选择器hooks
export const useCurrentFile = () => useAppSelector(state => state.editor.currentFile);
export const useTreeData = () => useAppSelector(state => state.editor.treeData);
export const useSelectedKeys = () => useAppSelector(state => state.editor.selectedKeys);
export const useExpandedSections = () => useAppSelector(state => state.editor.expandedSections);
export const useUnsavedContent = () => useAppSelector(state => state.editor.unsavedContent);

export const useEditorSettings = () => useAppSelector(state => state.editor.editorSettings);
export const useRecentFiles = () => useAppSelector(state => state.editor.recentFiles);