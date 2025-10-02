/**
 * @fileoverview 主题状态切片 - 管理应用主题相关状态
 * 包含主题模式、字体设置、背景图片等主题相关配置
 * @author hhyufan
 * @version 1.3.0
 */

import {createSlice} from '@reduxjs/toolkit';

const initialState = {
    theme: 'light',
    fontSize: 20,
    fontFamily: 'JetBrains Mono',
    lineHeight: 1.2,
    backgroundImage: '',
    backgroundEnabled: true,
    backgroundTransparency: {
        dark: 80,
        light: 80
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
            const {theme, value} = action.payload;
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
