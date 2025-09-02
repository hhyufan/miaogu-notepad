import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

/**
 * 自定义i18n hook
 * 提供翻译功能和语言切换功能
 */
export const useI18n = () => {
  const { t, i18n } = useTranslation();

  // 切换语言
  const changeLanguage = useCallback(async (language) => {
    try {
      await i18n.changeLanguage(language);
      // 保存到localStorage
      localStorage.setItem('miaogu-notepad-language', language);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  }, [i18n]);

  // 获取当前语言
  const currentLanguage = i18n.language;

  // 获取支持的语言列表
  const supportedLanguages = [
    { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
    { code: 'en-US', name: 'English', nativeName: 'English' }
  ];

  // 获取当前语言信息
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
  const { t } = useTranslation();
  return t(key, options);
};

export default useI18n;