/**
 * 懒加载的代码编辑器组件
 * 使用动态导入来减少主包大小，提高应用启动速度
 */
import React, { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';

// 懒加载 CodeEditor 组件
const CodeEditor = lazy(() => import('./CodeEditor'));

const LazyCodeEditor = (props) => {
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
            <CodeEditor {...props} />
        </Suspense>
    );
};

export default LazyCodeEditor;
