/**
 * 懒加载的树形编辑器组件
 * 使用动态导入来减少主包大小，提高应用启动速度
 */
import React, { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';

// 懒加载 TreeEditor 组件
const TreeEditor = lazy(() => import('./TreeEditor'));

const LazyTreeEditor = (props) => {
    const { t } = useTranslation();

    return (
        <Suspense
            fallback={
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                </div>
            }
        >
            <TreeEditor {...props} />
        </Suspense>
    );
};

export default LazyTreeEditor;
