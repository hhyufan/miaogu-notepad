import React, { useState, useEffect } from 'react';
import { Image } from 'antd';
import { imageProxyLoader } from '../utils/imageProxy';

/**
 * 支持代理加载的图片组件
 * 处理外部图片的代理加载，同时支持本地图片直接加载，并提供加载错误处理
 *
 * @component
 * @param {Object} props - 组件属性
 * @param {string} props.src - 图片源地址
 * @param {string} [props.alt=''] - 图片替代文本
 * @param {Object} [props.style] - 图片样式
 * @param {boolean|Object} [props.preview=true] - 图片预览配置，参考antd Image组件
 * @param {Object} [props...] - 其他传递给antd Image组件的属性
 * @returns {JSX.Element} 渲染的图片组件
 *
 * @example
 * <ProxyImage
 *   src="https://example.com/image.jpg"
 *   alt="示例图片"
 *   style={{ width: 200 }}
 * />
 */
const ProxyImage = ({ src, alt = '', style, preview = true, ...props }) => {
    /** 图片实际使用的源地址 */
    const [imageSrc, setImageSrc] = useState(src);
    /** 图片加载错误信息 */
    const [error, setError] = useState(null);

    /**
     * 根据图片源类型决定加载方式
     * 外部URL使用代理加载，本地资源直接加载
     */
    useEffect(() => {
        // 处理空地址或特殊协议地址（直接使用）
        if (!src || src.startsWith('data:') || src.startsWith('file:') || src.startsWith('asset:')) {
            setImageSrc(src);
            return;
        }

        // 检查是否为外部URL
        const isExternalUrl = src.startsWith('http://') || src.startsWith('https://');

        if (isExternalUrl) {
            // 外部URL使用代理加载
            setError(null);

            imageProxyLoader.loadImage(src)
                .then(dataUrl => {
                    setImageSrc(dataUrl);
                    setError(null);
                })
                .catch(err => {
                    console.warn('通过代理加载图片失败:', src, err);
                    setError(err);
                    // 代理加载失败时回退到原始URL
                    setImageSrc(src);
                });
        } else {
            // 本地或相对路径直接使用
            setImageSrc(src);
        }
    }, [src]);

    /**
     * 图片加载失败时显示的错误状态
     * 仅在有错误且无可用图片源时显示
     */
    if (error && !imageSrc) {
        return (
            <div style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100px',
                background: '#f5f5f5',
                borderRadius: '4px',
                color: '#999',
                fontSize: '14px'
            }}>
                图片加载失败
            </div>
        );
    }

    return (
        <Image
            src={imageSrc}
            alt={alt}
            style={style}
            preview={preview}
            {...props}
        />
    );
};

export default ProxyImage;
