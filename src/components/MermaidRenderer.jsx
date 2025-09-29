/**
 * @fileoverview Mermaid图表渲染组件 - 渲染Mermaid语法的图表和流程图
 * 支持流程图、时序图、甘特图等多种图表类型，提供主题切换和错误处理
 * @author hhyufan
 * @version 1.3.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Skeleton } from 'antd';
import mermaid from 'mermaid';
import { useI18n } from '../hooks/useI18n';
import './MermaidRenderer.css';

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

/**
 * Mermaid图表渲染组件
 * 根据提供的Mermaid代码渲染对应的图表，支持主题切换和错误处理
 * @param {Object} props - 组件属性
 * @param {string} props.code - Mermaid图表代码
 * @param {boolean} props.isDarkMode - 是否为暗色主题，默认为false
 * @returns {JSX.Element} Mermaid图表渲染组件
 */
const MermaidRenderer = ({ code, isDarkMode = false }) => {
  const { t } = useI18n();
  const elementRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [svgContent, setSvgContent] = useState('');

  useEffect(() => {
    if (!code) return;

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        mermaid.initialize({
          theme: isDarkMode ? 'dark' : 'default',
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace'
        });

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        const { svg } = await mermaid.render(id, code);
        setSvgContent(svg);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to render Mermaid diagram');
        setLoading(false);
      }
    }, 500);

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
          message={t('mermaid.renderFailed')}
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
