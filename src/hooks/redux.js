/**
 * @fileoverview Redux Hooks - 提供类型化的Redux hooks和状态管理功能
 * 封装Redux的useDispatch和useSelector，提供更便捷的状态管理接口
 * @author hhyufan
 * @version 1.2.0
 */

import { useDispatch, useSelector } from 'react-redux';
import { setTheme, setFontFamily, setLineHeight, setBackgroundImage, setBackgroundEnabled, setBackgroundTransparency, resetTheme } from '../store/slices/themeSlice';

/**
 * 类型化的dispatch hook
 * @returns {Function} dispatch函数
 */
export const useAppDispatch = () => useDispatch();

/**
 * 类型化的selector hook
 */
export const useAppSelector = useSelector;

/**
 * 主题相关的hook
 * @returns {Object} 主题状态和操作函数
 */
export const useTheme = () => {
  const theme = useAppSelector((state) => state.theme);
  const dispatch = useAppDispatch();

  return {
    ...theme,
    setTheme: (value) => dispatch(setTheme(value)),
    setFontFamily: (value) => dispatch(setFontFamily(value)),
    setLineHeight: (value) => dispatch(setLineHeight(value)),
    setBackgroundImage: (value) => dispatch(setBackgroundImage(value)),
    setBackgroundEnabled: (value) => dispatch(setBackgroundEnabled(value)),
    setBackgroundTransparency: (theme, value) => dispatch(setBackgroundTransparency({ theme, value })),

    resetTheme: () => dispatch(resetTheme()),
  };
};

/**
 * 编辑器相关的 Hook
 * 提供编辑器状态和配置管理功能
 * @returns {Object} 编辑器状态和操作函数
 */
export const useEditor = () => {
  const editor = useAppSelector((state) => state.editor);
  const dispatch = useAppDispatch();

  return {
    ...editor,

    dispatch
  };
};

/**
 * UI相关的 Hook
 * 提供UI状态管理功能
 * @returns {Object} UI状态和操作函数
 */
export const useUI = () => {
  const ui = useAppSelector((state) => state.ui);
  const dispatch = useAppDispatch();

  return {
    ...ui,
    dispatch
  };
};

/**
 * 应用状态聚合 Hook
 * 提供所有状态的统一访问接口
 * @returns {Object} 包含所有状态和dispatch函数的对象
 */
export const useAppState = () => {
  const theme = useAppSelector((state) => state.theme);
  const editor = useAppSelector((state) => state.editor);
  const ui = useAppSelector((state) => state.ui);
  const dispatch = useAppDispatch();

  return {
    theme,
    editor,
    ui,
    dispatch
  };
};
