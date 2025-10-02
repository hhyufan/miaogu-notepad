import React, { useState, useEffect } from 'react';
import { Image } from 'antd';
import { imageProxyLoader } from '../utils/imageProxy';

/**
 * 支持代理加载的图片组件
 */
const ProxyImage = ({ src, alt, style, preview, ...props }) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 如果是本地文件或data URL，直接使用
    if (!src || src.startsWith('data:') || src.startsWith('file:') || src.startsWith('asset:')) {
      setImageSrc(src);
      return;
    }

    // 检查是否是外部URL
    const isExternalUrl = src.startsWith('http://') || src.startsWith('https://');
    
    if (isExternalUrl) {
      // 外部URL，使用代理加载
      setError(null);
      
      imageProxyLoader.loadImage(src)
        .then(dataUrl => {
          setImageSrc(dataUrl);
          setError(null);
        })
        .catch(err => {
          console.warn('Failed to load image via proxy:', src, err);
          setError(err);
          // 如果代理加载失败，回退到原始URL
          setImageSrc(src);
        });
    } else {
      // 本地或相对路径，直接使用
      setImageSrc(src);
    }
  }, [src]);

  // 如果有错误且没有回退的图片源，显示错误状态
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