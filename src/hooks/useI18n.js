/**
 * @fileoverview 国际化Hook - 提供翻译功能和语言切换功能
 * 封装react-i18next，提供更便捷的国际化操作接口
 * @author hhyufan
 * @version 1.3.0
 */

import {useTranslation} from 'react-i18next';
import {useCallback} from 'react';

/**
 * 自定义i18n hook
 * @returns {Object} 包含翻译函数和语言管理功能的对象
 * @returns {Function} returns.t - 翻译函数
 * @returns {Function} returns.changeLanguage - 切换语言函数
 * @returns {string} returns.currentLanguage - 当前语言代码
 * @returns {Array} returns.supportedLanguages - 支持的语言列表
 * @returns {Function} returns.getCurrentLanguageInfo - 获取当前语言信息
 * @returns {boolean} returns.isReady - i18n是否已初始化
 */
export const useI18n = () => {
    const {t, i18n} = useTranslation();

    const changeLanguage = useCallback(async (language) => {
        try {
            await i18n.changeLanguage(language);
            localStorage.setItem('miaogu-notepad-language', language);
        } catch (error) {
        }
    }, [i18n]);

    const currentLanguage = i18n.language;

    const supportedLanguages = [
        {code: 'zh-CN', name: '简体中文', nativeName: '简体中文'},
        {code: 'en-US', name: 'English', nativeName: 'English'}
    ];

    const getCurrentLanguageInfo = useCallback(() => {
        return supportedLanguages.find(lang => lang.code === currentLanguage) || supportedLanguages[0];
    }, [currentLanguage]);

    return {
        t,
        changeLanguage,
        currentLanguage,
        supportedLanguages,
        getCurrentLanguageInfo,
        isReady: i18n.isInitialized
    };
};

/**
 * 获取翻译文本的简化hook
 * @param {string} key - 翻译键
 * @param {object} options - 翻译选项
 * @returns {string} 翻译后的文本
 */
export const useT = (key, options = {}) => {
    const {t} = useTranslation();
    return t(key, options);
};

export default useI18n;
