import React, { useEffect, useRef, useState } from 'react';
import { Spin, Alert, Skeleton } from 'antd';
import mermaid from 'mermaid';
import './MermaidRenderer.css';

// 初始化 Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
  fontSize: 14,
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis'
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
    mirrorActors: true,
    bottomMarginAdj: 1,
    useMaxWidth: true,
    rightAngles: false,
    showSequenceNumbers: false
  },
  gantt: {
    titleTopMargin: 25,
    barHeight: 20,
    fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
    fontSize: 11,
    fontWeight: 'normal',
    gridLineStartPadding: 35,
    bottomPadding: 25,
    leftPadding: 75,
    topPadding: 50,
    rightPadding: 25
  }
});

const MermaidRenderer = ({ code, isDarkMode = false }) => {
  const elementRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [svgContent, setSvgContent] = useState('');

  useEffect(() => {
    if (!code) return;

    setLoading(true);
    setError(null);

    // 添加延迟渲染，参考miaogu-markdown的实现
    const timer = setTimeout(async () => {
      try {
        // 更新主题
        mermaid.initialize({
          theme: isDarkMode ? 'dark' : 'default',
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace'
        });

        // 生成唯一ID
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 直接渲染图表，不使用parse验证（参考miaogu-markdown实现）
        const { svg } = await mermaid.render(id, code);
        setSvgContent(svg);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to render Mermaid diagram');
        setLoading(false);
      }
    }, 500); // 500ms延迟，参考miaogu-markdown

    return () => {
      clearTimeout(timer);
    };
  }, [code, isDarkMode]);

  if (loading) {
    return (
      <div 
        className={`mermaid-container ${isDarkMode ? 'dark' : 'light'}`} 
        style={{ padding: '16px' }}
      >
        <div className={`skeleton-wrapper ${isDarkMode ? 'dark' : 'light'}`}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mermaid-container">
        <Alert
          message="图表渲染失败"
          description={error}
          type="error"
          showIcon
          style={{
            backgroundColor: isDarkMode ? '#21262d' : '#fff2f0',
            borderColor: isDarkMode ? '#f85149' : '#ffccc7',
            color: isDarkMode ? '#f85149' : '#ff4d4f'
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`mermaid-container ${isDarkMode ? 'dark' : 'light'}`}
      ref={elementRef}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{
        textAlign: 'center',
        padding: '16px',
        backgroundColor: isDarkMode ? '#0d1117' : '#ffffff',
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? '#30363d' : '#e1e4e8'}`
      }}
    />
  );
};

export default MermaidRenderer;