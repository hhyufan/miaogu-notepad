import { useDispatch, useSelector } from 'react-redux';
import { setTheme, setFontSize, setFontFamily, setLineHeight, setBackgroundImage, setBackgroundEnabled, setBackgroundTransparency, resetTheme } from '../store/slices/themeSlice';

// 类型化的 hooks
export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

// 主题相关的 hooks
export const useTheme = () => {
  const theme = useAppSelector((state) => state.theme);
  const dispatch = useAppDispatch();
  
  return {
    ...theme,
    setTheme: (value) => dispatch(setTheme(value)),
    setFontSize: (value) => dispatch(setFontSize(value)),
    setFontFamily: (value) => dispatch(setFontFamily(value)),
    setLineHeight: (value) => dispatch(setLineHeight(value)),
    setBackgroundImage: (value) => dispatch(setBackgroundImage(value)),
    setBackgroundEnabled: (value) => dispatch(setBackgroundEnabled(value)),
    setBackgroundTransparency: (theme, value) => dispatch(setBackgroundTransparency({ theme, value })),

    resetTheme: () => dispatch(resetTheme()),
  };
};

// 编辑器相关的 hooks
export const useEditor = () => {
  const editor = useAppSelector((state) => state.editor);
  const dispatch = useAppDispatch();
  
  return {
    ...editor,
    dispatch
  };
};

// UI 相关的 hooks
export const useUI = () => {
  const ui = useAppSelector((state) => state.ui);
  const dispatch = useAppDispatch();
  
  return {
    ...ui,
    dispatch
  };
};

// 组合 hook，获取所有状态
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