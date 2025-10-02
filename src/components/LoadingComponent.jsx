/**
 * @fileoverview 加载组件 - 显示应用加载状态
 * 用于在应用初始化或数据加载时显示加载提示
 * @author hhyufan
 * @version 1.3.0
 */

import React from 'react';
import {useTranslation} from 'react-i18next';

/**
 * 加载组件
 * 显示居中的加载文本提示
 * @returns {JSX.Element} 加载组件
 */
const LoadingComponent = () => {
    const {t} = useTranslation();

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontSize: '16px',
            color: '#666'
        }}>
            {t('common.loading')}
        </div>
    );
};

export default LoadingComponent;
