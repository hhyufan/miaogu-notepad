import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  theme: 'light', // 'light' | 'dark'
  fontSize: 20,
  fontFamily: 'JetBrains Mono',
  lineHeight: 1.2,
  backgroundImage: '',
  backgroundEnabled: true,
  backgroundTransparency: {
    dark: 80,  // 深色主题透明度 (0-100)
    light: 80  // 浅色主题透明度 (0-100)
  },
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setFontSize: (state, action) => {
      state.fontSize = action.payload;
    },
    setFontFamily: (state, action) => {
      state.fontFamily = action.payload;
    },
    setLineHeight: (state, action) => {
      state.lineHeight = action.payload;
    },
    setBackgroundImage: (state, action) => {
      state.backgroundImage = action.payload;
    },
    setBackgroundEnabled: (state, action) => {
      state.backgroundEnabled = action.payload;
    },
    setBackgroundTransparency: (state, action) => {
      const { theme, value } = action.payload;
      state.backgroundTransparency[theme] = value;
    },

    resetTheme: (_) => {
      return initialState;
    },
  },
});

export const {
  setTheme,
  setFontSize,
  setFontFamily,
  setLineHeight,
  setBackgroundImage,
  setBackgroundEnabled,
  setBackgroundTransparency,
  resetTheme,
} = themeSlice.actions;

export default themeSlice.reducer;
