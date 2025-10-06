/**
 * @fileoverview View Transition API 工具函数
 * 提供流畅的UI过渡效果，支持主题切换、编辑器模式切换等场景
 * @author hhyufan
 * @version 1.3.1
 */

/**
 * 检查浏览器是否支持 View Transition API
 * @returns {boolean} 是否支持
 */
export const isViewTransitionSupported = () => {
    return 'startViewTransition' in document;
};

/**
 * 执行带有 View Transition 的状态更新
 * @param {Function} updateFunction - 执行状态更新的函数
 * @param {string} transitionName - 过渡动画名称（可选）
 * @returns {Promise} 过渡完成的Promise
 */
export const withViewTransition = async (updateFunction, transitionName = '') => {
    if (!isViewTransitionSupported()) {
        updateFunction();
        return Promise.resolve();
    }

    try {
        const transition = document.startViewTransition(() => {
            updateFunction();
        });

        if (transitionName && transition.ready) {
            await transition.ready;
            document.documentElement.setAttribute('data-transition', transitionName);
        }

        await transition.finished;

        if (transitionName) {
            document.documentElement.removeAttribute('data-transition');
        }

        return transition;
    } catch (error) {
        console.warn('View Transition failed, falling back to immediate update:', error);
        updateFunction();
        return Promise.resolve();
    }
};

/**
 * 为主题切换创建专用的过渡函数
 * @param {Function} themeUpdateFunction - 主题更新函数
 * @returns {Promise} 过渡完成的Promise
 */
export const withThemeTransition = (themeUpdateFunction) => {
    return withViewTransition(themeUpdateFunction, 'theme-change');
};

/**
 * 为编辑器模式切换创建专用的过渡函数
 * @param {Function} modeUpdateFunction - 编辑器模式更新函数
 * @returns {Promise} 过渡完成的Promise
 */
export const withEditorModeTransition = (modeUpdateFunction) => {
    return withViewTransition(modeUpdateFunction, 'editor-mode-change');
};

/**
 * 为文件切换创建专用的过渡函数
 * @param {Function} fileUpdateFunction - 文件切换更新函数
 * @returns {Promise} 过渡完成的Promise
 */
export const withFileTransition = (fileUpdateFunction) => {
    return withViewTransition(fileUpdateFunction, 'file-change');
};

/**
 * 预设的过渡配置
 */
export const TRANSITION_CONFIGS = {
    FAST: {
        duration: '0.2s',
        easing: 'ease-out'
    },
    MEDIUM: {
        duration: '0.3s',
        easing: 'ease-in-out'
    },
    SLOW: {
        duration: '0.5s',
        easing: 'ease-in-out'
    }
};
