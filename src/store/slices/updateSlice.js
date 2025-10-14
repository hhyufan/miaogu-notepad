/**
 * @fileoverview 更新状态切片 - 管理应用更新相关状态
 * 包含更新检查、下载进度、更新提示等更新相关状态
 * @author hhyufan
 * @version 1.3.1
 */

import {createSlice} from '@reduxjs/toolkit';

const initialState = {
    // 更新检查状态
    isCheckingUpdate: false,
    hasUpdate: false,
    updateInfo: null,
    
    // 更新下载状态
    isDownloading: false,
    downloadProgress: 0,
    
    // 更新安装状态
    isInstalling: false,
    
    // 错误信息
    error: null,
    
    // 上次检查时间
    lastCheckTime: null,
    
    // 是否显示更新提示
    showUpdatePrompt: false,
};

const updateSlice = createSlice({
    name: 'update',
    initialState,
    reducers: {
        // 开始检查更新
        startCheckingUpdate: (state) => {
            state.isCheckingUpdate = true;
            state.error = null;
        },
        
        // 检查更新完成
        checkUpdateComplete: (state, action) => {
            state.isCheckingUpdate = false;
            state.hasUpdate = action.payload.hasUpdate;
            state.updateInfo = action.payload.updateInfo;
            state.lastCheckTime = new Date().toISOString();
            state.showUpdatePrompt = action.payload.hasUpdate;
        },
        
        // 检查更新失败
        checkUpdateFailed: (state, action) => {
            state.isCheckingUpdate = false;
            state.error = action.payload;
            state.lastCheckTime = new Date().toISOString();
        },
        
        // 开始下载更新
        startDownloading: (state) => {
            state.isDownloading = true;
            state.downloadProgress = 0;
            state.error = null;
        },
        
        // 更新下载进度
        updateDownloadProgress: (state, action) => {
            state.downloadProgress = action.payload;
        },
        
        // 下载完成
        downloadComplete: (state) => {
            state.isDownloading = false;
            state.downloadProgress = 100;
        },
        
        // 下载失败
        downloadFailed: (state, action) => {
            state.isDownloading = false;
            state.error = action.payload;
        },
        
        // 开始安装更新
        startInstalling: (state) => {
            state.isInstalling = true;
            state.error = null;
        },
        
        // 安装完成
        installComplete: (state) => {
            state.isInstalling = false;
        },
        
        // 安装失败
        installFailed: (state, action) => {
            state.isInstalling = false;
            state.error = action.payload;
        },
        
        // 隐藏更新提示
        hideUpdatePrompt: (state) => {
            state.showUpdatePrompt = false;
        },
        
        // 清除错误
        clearError: (state) => {
            state.error = null;
        },
        
        // 重置更新状态
        resetUpdateState: (state) => {
            return {
                ...initialState,
                lastCheckTime: state.lastCheckTime,
            };
        },
    },
});

export const {
    startCheckingUpdate,
    checkUpdateComplete,
    checkUpdateFailed,
    startDownloading,
    updateDownloadProgress,
    downloadComplete,
    downloadFailed,
    startInstalling,
    installComplete,
    installFailed,
    hideUpdatePrompt,
    clearError,
    resetUpdateState,
} = updateSlice.actions;

export default updateSlice.reducer;