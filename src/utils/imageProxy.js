/**
 * 图片代理加载工具
 * 支持通过系统代理加载外部图片资源
 */

import {invoke} from '@tauri-apps/api/core';

/**
 * 代理配置类
 */
export class ProxyConfig {
    constructor(config = {}) {
        this.enabled = config.enabled || false;
        this.httpProxy = config.httpProxy || null;
        this.httpsProxy = config.httpsProxy || null;
        this.noProxy = config.noProxy || null;
    }

    /**
     * 从系统环境变量创建代理配置
     */
    static async fromSystem() {
        try {
            const systemProxy = await invoke('get_system_proxy');
            return new ProxyConfig({
                enabled: systemProxy.enabled,
                httpProxy: systemProxy.http_proxy,
                httpsProxy: systemProxy.https_proxy,
                noProxy: systemProxy.no_proxy
            });
        } catch (error) {
            console.warn('Failed to get system proxy:', error);
            return new ProxyConfig();
        }
    }

    /**
     * 转换为后端格式
     */
    toBackendFormat() {
        return {
            enabled: this.enabled,
            http_proxy: this.httpProxy,
            https_proxy: this.httpsProxy,
            no_proxy: this.noProxy
        };
    }
}

/**
 * 图片代理加载器
 */
export class ImageProxyLoader {
    constructor() {
        this.proxyConfig = new ProxyConfig();
        this.cache = new Map(); // 图片缓存
        this.loadingPromises = new Map(); // 防止重复加载
    }

    /**
     * 设置代理配置
     * @param {ProxyConfig} config 代理配置
     */
    setProxyConfig(config) {
        this.proxyConfig = config;
    }

    /**
     * 获取当前代理配置
     */
    getProxyConfig() {
        return this.proxyConfig;
    }

    /**
     * 加载图片
     * @param {string} url 图片URL
     * @param {Object} options 选项
     * @returns {Promise<string>} 返回图片的data URL
     */
    async loadImage(url, options = {}) {
        // 检查缓存
        if (this.cache.has(url) && !options.forceReload) {
            return this.cache.get(url);
        }

        // 检查是否正在加载
        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url);
        }

        /**
         * 创建加载Promise
         */
        const loadingPromise = this._loadImageInternal(url, options);
        this.loadingPromises.set(url, loadingPromise);

        try {
            const result = await loadingPromise;
            this.cache.set(url, result);
            return result;
        } finally {
            this.loadingPromises.delete(url);
        }
    }

    /**
     * 内部图片加载方法
     * @private
     */
    async _loadImageInternal(url, options) {
        try {
            // 如果是本地文件或data URL，直接返回
            if (url.startsWith('data:') || url.startsWith('file:') || url.startsWith('asset:')) {
                return url;
            }

            /**
             * 使用代理配置
             */
            const proxyConfig = options.useProxy !== false ? this.proxyConfig.toBackendFormat() : null;


            const result = await invoke('load_image_with_proxy', {
                url: url,
                proxyConfig: proxyConfig
            });

            if (result.success && result.data) {
                /**
                 * 构造data URL
                 */
                const contentType = result.content_type || 'image/jpeg';
                return `data:${contentType};base64,${result.data}`;
            } else {
                throw new Error(result.error || 'Failed to load image');
            }
        } catch (error) {
            console.warn('Failed to load image:', url, error);

            // 如果代理加载失败，尝试直接加载
            if (this.proxyConfig.enabled && options.fallbackToDirect !== false) {
                console.warn('Proxy loading failed, trying direct loading...');
                return this._loadImageDirect(url);
            }

            throw error;
        }
    }

    /**
     * 直接加载图片（不使用代理）
     * @private
     */
    async _loadImageDirect(url) {
        try {
            const result = await invoke('load_image_with_proxy', {
                url: url,
                proxyConfig: null
            });

            if (result.success && result.data) {
                const contentType = result.content_type || 'image/jpeg';
                return `data:${contentType};base64,${result.data}`;
            } else {
                throw new Error(result.error || 'Failed to load image directly');
            }
        } catch (error) {
            console.warn('Direct image loading also failed:', url, error);
            throw error;
        }
    }

    /**
     * 清除缓存
     * @param {string} url 可选，指定要清除的URL，不传则清除所有
     */
    clearCache(url) {
        if (url) {
            this.cache.delete(url);
        } else {
            this.cache.clear();
        }
    }

    /**
     * 预加载图片
     * @param {string[]} urls 图片URL数组
     */
    async preloadImages(urls) {
        const promises = urls.map(url => this.loadImage(url).catch(error => {
            console.warn(`Failed to preload image: ${url}`, error);
            return null;
        }));

        return Promise.all(promises);
    }
}

/**
 * 全局实例
 */
export const imageProxyLoader = new ImageProxyLoader();

/**
 * 初始化图片代理加载器
 * 自动检测并使用系统代理配置
 */
export async function initImageProxyLoader() {
    try {
        /**
         * 自动获取系统代理配置
         */
        const systemProxy = await ProxyConfig.fromSystem();
        imageProxyLoader.setProxyConfig(systemProxy);
    } catch (error) {
        console.warn('Failed to initialize image proxy loader:', error);
        // 如果获取系统代理失败，使用默认配置（不使用代理）
        imageProxyLoader.setProxyConfig(new ProxyConfig());
    }
}

/**
 * 便捷函数：加载图片
 * @param {string} url 图片URL
 * @param {Object} options 选项
 * @returns {Promise<string>} 图片data URL
 */
export function loadImageWithProxy(url, options = {}) {
    return imageProxyLoader.loadImage(url, options);
}

/**
 * 便捷函数：设置代理配置
 * @deprecated 不再需要手动设置代理，系统会自动检测
 * @param {Object} config 代理配置
 */
export async function setProxyConfig(config) {
    console.warn('setProxyConfig is deprecated. System proxy is detected automatically.');
    const proxyConfig = new ProxyConfig(config);
    imageProxyLoader.setProxyConfig(proxyConfig);

    // 保存到后端
    try {
        await invoke('set_proxy_config', {config: proxyConfig.toBackendFormat()});
    } catch (error) {
        console.warn('Failed to save proxy config:', error);
    }
}

/**
 * 便捷函数：获取系统代理配置
 */
export async function getSystemProxyConfig() {
    return ProxyConfig.fromSystem();
}

/**
 * 便捷函数：刷新系统代理配置
 * 重新检测系统代理设置并应用
 */
export async function refreshSystemProxy() {
    try {
        const systemProxy = await ProxyConfig.fromSystem();
        imageProxyLoader.setProxyConfig(systemProxy);
        return systemProxy;
    } catch (error) {
        console.warn('Failed to refresh system proxy:', error);
        throw error;
    }
}
