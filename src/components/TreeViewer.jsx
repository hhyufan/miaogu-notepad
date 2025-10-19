/**
 * @fileoverview 树形视图组件 - 显示和管理树形结构数据
 * 支持解析树形文本、代码跳转、节点展开/折叠等功能
 * @author hhyufan
 * @version 1.4.0
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';
import {Button, Card, Space, Tooltip, Tree, Typography} from 'antd';
import {readTextFile} from '@tauri-apps/plugin-fs';
import {
    CodeOutlined,
    ExpandAltOutlined,
    FileTextOutlined,
    FolderOpenOutlined,
    FolderOutlined,
    ShrinkOutlined,
    SwitcherOutlined
} from '@ant-design/icons';
import {useI18n} from '../hooks/useI18n';
import './TreeViewer.scss';

const {Text} = Typography;

/**
 * 解析树形文本为树形数据结构
 * 支持多种跳转语法：>lang[index]、>lang++、>lang+=n、>lang
 * @param {string} text - 要解析的树形文本
 * @param {string} rootTitle - 根节点标题，默认为'Root'
 * @returns {Object[]} 解析后的树形数据结构数组
 */
const parseTreeText = (text, rootTitle = 'Root') => {
    const lines = text.split('\n').filter(line => line.trim());
    const root = {key: 'root', title: rootTitle, children: [], level: -1};
    const stack = [root];
    let keyCounter = 0;

    const lastJumpIndex = {};

    lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const leadingSpaces = line.length - line.trimStart().length;
        const level = Math.floor(leadingSpaces / 2);

        const cleanLine = trimmedLine.replace(/[\r\n]/g, '');

        const jumpMatchExplicit = cleanLine.match(/>([a-zA-Z]+)\[(\d+)]/);
        const jumpMatchIncrement = cleanLine.match(/>([a-zA-Z]+)\+\+/);
        const jumpMatchJump = cleanLine.match(/>([a-zA-Z]+)\+=(\d+)/);
        const jumpMatchSame = cleanLine.match(/>([a-zA-Z]+)(?![\[+])/);

        let isClickable = false;
        let jumpLanguage = null;
        let jumpIndex = null;

        if (jumpMatchExplicit) {
            isClickable = true;
            jumpLanguage = jumpMatchExplicit[1];
            jumpIndex = parseInt(jumpMatchExplicit[2]);
            lastJumpIndex[jumpLanguage] = jumpIndex;
        } else if (jumpMatchIncrement) {
            isClickable = true;
            jumpLanguage = jumpMatchIncrement[1];
            jumpIndex = (lastJumpIndex[jumpLanguage] || 0) + 1;
            lastJumpIndex[jumpLanguage] = jumpIndex;
        } else if (jumpMatchJump) {
            isClickable = true;
            jumpLanguage = jumpMatchJump[1];
            const jumpAmount = parseInt(jumpMatchJump[2]);
            jumpIndex = (lastJumpIndex[jumpLanguage] || 0) + jumpAmount;
            lastJumpIndex[jumpLanguage] = jumpIndex;
        } else if (jumpMatchSame) {
            isClickable = true;
            jumpLanguage = jumpMatchSame[1];
            jumpIndex = lastJumpIndex[jumpLanguage] || 1;
        }

        let cleanTitle = cleanLine;
        if (isClickable) {
            cleanTitle = cleanTitle
                .replace(/\s*>([a-zA-Z]+)\[(\d+)]\s*$/, '')
                .replace(/\s*>([a-zA-Z]+)\+\+\s*$/, '')
                .replace(/\s*>([a-zA-Z]+)\+=(\d+)\s*$/, '')
                .replace(/\s*>([a-zA-Z]+)(?![\[+])\s*$/, '')
                .trim();
        }

        const node = {
            key: `node-${keyCounter++}`,
            title: cleanTitle,
            level: level,
            isClickable: isClickable,
            jumpLanguage: jumpLanguage,
            jumpIndex: jumpIndex,
            children: []
        };

        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        const parent = stack[stack.length - 1];
        parent.children.push(node);
        stack.push(node);
    });

    return root.children;
};

/**
 * 渲染单个树形节点
 * @param {Object} node - 节点数据对象
 * @param {Function} onJumpToCode - 跳转到代码的回调函数
 * @param {boolean} isDarkMode - 是否为暗色模式
 * @param {string[]} expandedKeys - 已展开的节点key数组
 * @param {Function} onToggleExpand - 节点展开/折叠回调函数
 * @returns {Object} 渲染后的树形节点配置
 */
const renderTreeNode = (node, onJumpToCode, isDarkMode, expandedKeys, onToggleExpand) => {
    const isClickable = node.isClickable;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedKeys.includes(node.key);

    /**
     * 处理节点点击事件
     * @param {Event} e - 点击事件对象
     */
    const handleNodeClick = (e) => {
        if (isClickable && onJumpToCode) {
            e.stopPropagation();
            onJumpToCode(node.jumpLanguage, node.jumpIndex);
        } else if (hasChildren && !isClickable && onToggleExpand) {
            e.stopPropagation();
            onToggleExpand(node.key, isExpanded);
        }
    };

    return {
        key: node.key,
        title: (
            <div
                className={`tree-node-content ${isClickable ? 'tree-node-clickable' : ''}`}
                onClick={handleNodeClick}
            >
                <Space size="small">
                    {hasChildren ? (
                        isExpanded ? (
                            <FolderOpenOutlined
                                className="tree-icon folder-icon"
                                style={isClickable ? {
                                    background: 'linear-gradient(135deg, \#667eea 0%, \#764ba2 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                } : {}}
                            />
                        ) : (
                            <FolderOutlined
                                className="tree-icon folder-icon"
                                style={isClickable ? {
                                    background: 'linear-gradient(135deg, \#667eea 0%, \#764ba2 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                } : {}}
                            />
                        )
                    ) : (
                        isClickable ? (
                            <CodeOutlined
                                className="tree-icon file-icon code-indicator"
                                style={{
                                    color: '\#1890ff'
                                }}
                            />
                        ) : (
                            <FileTextOutlined className="tree-icon file-icon"/>
                        )
                    )}
                    <Text className={`tree-node-text ${isClickable ? 'has-code' : ''}`}>
                        {(() => {
                            const text = node.title;
                            const codeRegex = /`([^`]+)`/g;

                            // 如果文本中没有反引号，直接返回原始文本
                            if (!codeRegex.test(text)) {
                                return text;
                            }

                            // 重置正则表达式
                            codeRegex.lastIndex = 0;

                            const parts = [];
                            let lastIndex = 0;
                            let match;

                            while ((match = codeRegex.exec(text)) !== null) {
                                // 添加代码块前的普通文本
                                if (match.index > lastIndex) {
                                    parts.push(text.slice(lastIndex, match.index));
                                }

                                // 添加代码块
                                parts.push(
                                    <code key={match.index} className="inline-code">
                                        {match[1]}
                                    </code>
                                );

                                lastIndex = match.index + match[0].length;
                            }

                            // 添加剩余的普通文本
                            if (lastIndex < text.length) {
                                parts.push(text.slice(lastIndex));
                            }

                            return parts;
                        })()}
                    </Text>
                </Space>
            </div>
        ),
        children: hasChildren ? node.children.map(child => renderTreeNode(child, onJumpToCode, isDarkMode, expandedKeys, onToggleExpand)) : undefined
    };
};

/**
 * 树形视图组件
 * 显示树形结构数据，支持节点展开/折叠、代码跳转等功能
 *
 * @component
 * @param {Object} props - 组件属性
 * @param {string} [props.treeFilePath] - 树形文件路径
 * @param {string} [props.treeContent] - 树形内容文本（直接提供内容时使用）
 * @param {Function} [props.onJumpToCode] - 代码跳转回调函数，参数为(language, index)
 * @param {string} [props.currentFileName] - 当前文件名，用于保存展开状态
 * @param {string} [props.currentFolder] - 当前文件夹路径，用于定位树形文件
 * @param {number} [props.fontSize=16] - 字体大小
 * @param {boolean} [props.isAutoTree=false] - 是否为autoTreeH1渲染的自动树
 * @param {Function} [props.onOpenMgtree] - 打开mgtree文件的回调函数
 * @returns {JSX.Element} 树形视图组件
 *
 * @example
 * <TreeViewer
 *   treeFilePath="example.tree"
 *   currentFileName="example.txt"
 *   currentFolder="/documents"
 *   onJumpToCode={(lang, index) =>
 * />
 */
const TreeViewer = ({
                        treeFilePath,
                        treeContent,
                        onJumpToCode,
                        currentFileName,
                        currentFolder,
                        fontSize = 16,
                        isAutoTree = false,
                        onOpenMgtree
                    }) => {
    const {t} = useI18n();

    /** 树形数据 */
    const [treeData, setTreeData] = useState([]);
    /** 已展开的节点key数组 */
    const [expandedKeys, setExpandedKeys] = useState([]);
    /** 加载状态 */
    const [_, setLoading] = useState(false);
    /** 错误信息 */
    const [error, setError] = useState(null);
    /** 当前文件的key，用于检测文件切换 */
    const [currentFileKey, setCurrentFileKey] = useState(null);
    /** 是否为暗色模式 */
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    });

    /**
     * 监听主题变化
     */
    useEffect(() => {
        // 获取当前主题
        const getCurrentTheme = () => {
            const theme = document.documentElement.getAttribute('data-theme');
            return theme === 'dark';
        };

        setIsDarkMode(getCurrentTheme());

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    setIsDarkMode(getCurrentTheme());
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        return () => observer.disconnect();
    }, []);

    // 从Redux store获取背景设置
    const {backgroundEnabled, backgroundImage} = useSelector((state) => state.theme);
    const hasBackground = backgroundEnabled && backgroundImage;

    /**
     * 生成localStorage的key
     * @param {string} fileName - 文件名
     * @returns {string} localStorage的key
     */
    const getStorageKey = useCallback((fileName) => {
        return `treeViewer_expanded_${fileName || 'default'}`;
    }, []);

    /**
     * 保存展开状态到localStorage
     * @param {string[]} keys - 展开的节点key数组
     * @param {string} fileName - 文件名
     */
    const saveExpandedState = useCallback((keys, fileName) => {
        if (!fileName) return;
        try {
            const storageKey = getStorageKey(fileName);
            localStorage.setItem(storageKey, JSON.stringify(keys));
        } catch (error) {
            console.warn('保存树状图展开状态失败:', error);
        }
    }, [getStorageKey]);

    /**
     * 从localStorage恢复展开状态
     * @param {string} fileName - 文件名
     * @returns {string[]} 展开的节点key数组
     */
    const loadExpandedState = useCallback((fileName) => {
        if (!fileName) return [];
        try {
            const storageKey = getStorageKey(fileName);
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.warn('恢复树状图展开状态失败:', error);
            return [];
        }
    }, [getStorageKey]);

    /**
     * 处理树状数据
     * @param {string} text - 树形文本内容
     * @param {string} fileName - 文件名
     */
    const processTreeData = useCallback((text, fileName) => {
        try {
            const parsedData = parseTreeText(text, t('tree.knowledgeMap'));
            setTreeData(parsedData);

            // 检查是否是文件切换（排除初始化情况）
            const isFileChanged = currentFileKey !== null && currentFileKey !== fileName;

            if (isFileChanged) {
                // 文件切换时重置为全折叠状态
                setExpandedKeys([]);
                setCurrentFileKey(fileName);
                // 保存重置状态
                saveExpandedState([], fileName);
            } else {
                // 初始化或同一文件时恢复之前的展开状态
                const savedKeys = loadExpandedState(fileName);
                setExpandedKeys(savedKeys);
                setCurrentFileKey(fileName);
            }
        } catch (err) {
            console.error('TreeViewer: 解析树状数据失败:', err);
            setError(err.message);
        }
    }, [currentFileKey, loadExpandedState, saveExpandedState, t]);

    /**
     * 加载树状文件内容或处理直接传入的内容
     */
    useEffect(() => {
        if (treeContent) {
            // 直接使用传入的内容
            setLoading(false);
            setError(null);
            processTreeData(treeContent, currentFileName);
            return;
        }

        if (!treeFilePath) {
            return;
        }

        const loadTreeFile = async () => {
            setLoading(true);
            setError(null);

            try {
                let text;

                if (treeFilePath.startsWith('http')) {
                    // 处理HTTP URL
                    const response = await fetch(treeFilePath);
                    if (!response.ok) {
                        throw new Error(`无法加载文件: ${response.status}`);
                    }
                    text = await response.text();
                } else {
                    // 处理本地文件路径 - 使用Tauri的readTextFile API
                    const separator = navigator.platform.includes('Win') ? '\\' : '/';
                    let localPath = `${currentFolder}${separator}trees${separator}${treeFilePath}`;

                    // 规范化路径，确保使用正确的分隔符
                    localPath = localPath.replace(/[\/\\]+/g, separator);

                    try {
                        // 直接使用readTextFile读取文件内容
                        text = await readTextFile(localPath);
                    } catch (fetchError) {

                        try {
                            // 尝试使用相对于当前工作目录的路径
                            const relativePath = `trees/${treeFilePath}`;
                            text = await readTextFile(relativePath);
                        } catch (relativeError) {
                            throw new Error(`文件读取失败: ${fetchError.message || fetchError}`);
                        }
                    }
                }

                processTreeData(text, currentFileName);

            } catch (err) {
                console.error('TreeViewer: 加载树状文件失败:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadTreeFile().then();
    }, [treeFilePath, treeContent, processTreeData, currentFileName, currentFolder]);

    /**
     * 处理节点展开/折叠事件
     * @param {string[]} expandedKeysValue - 展开的节点key数组
     */
    const onExpand = (expandedKeysValue) => {
        setExpandedKeys(expandedKeysValue);
        saveExpandedState(expandedKeysValue, currentFileName);
    };

    /**
     * 切换单个节点的展开/折叠状态
     * @param {string} nodeKey - 节点key
     * @param {boolean} isCurrentlyExpanded - 当前是否展开
     */
    const onToggleExpand = (nodeKey, isCurrentlyExpanded) => {
        let newKeys;
        if (isCurrentlyExpanded) {
            newKeys = expandedKeys.filter(key => key !== nodeKey);
            setExpandedKeys(newKeys);
        } else {
            newKeys = [...expandedKeys, nodeKey];
            setExpandedKeys(newKeys);
        }
        saveExpandedState(newKeys, currentFileName);
    };

    /**
     * 渲染树形数据
     * @type {Object[]} 树形节点配置数组
     */
    const renderedTreeData = useMemo(() => {
        return treeData.map(node => renderTreeNode(node, onJumpToCode, isDarkMode, expandedKeys, onToggleExpand));
    }, [treeData, onJumpToCode, isDarkMode, expandedKeys, onToggleExpand]);

    /**
     * 展开所有节点
     */
    const expandAll = () => {
        const allKeys = [];
        const collectAllKeys = (nodes) => {
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) {
                    allKeys.push(node.key);
                    collectAllKeys(node.children);
                }
            });
        };
        collectAllKeys(treeData);
        setExpandedKeys(allKeys);
        saveExpandedState(allKeys, currentFileName);
    };

    /**
     * 折叠所有节点
     */
    const collapseAll = () => {
        setExpandedKeys([]);
        saveExpandedState([], currentFileName);
    };

    /**
     * 打开mgtree文件
     */
    const handleOpenMgtree = () => {
        if (onOpenMgtree && treeFilePath) {
            // 构建完整的mgtree文件路径
            let fullPath;
            if (currentFolder) {
                const separator = currentFolder.includes('\\') ? '\\' : '/';
                if (currentFolder.endsWith('trees') || currentFolder.endsWith('trees/') || currentFolder.endsWith('trees\\')) {
                    fullPath = `${currentFolder}${separator}${treeFilePath}`;
                } else {
                    fullPath = `${currentFolder}${separator}trees${separator}${treeFilePath}`;
                }
            } else {
                fullPath = `trees/${treeFilePath}`;
            }
            onOpenMgtree(fullPath);
        }
    };

    if (error) {
        return (
            <div className={`tree-error-container ${isDarkMode ? 'dark' : 'light'}`}>
                <div className="tree-error-content">
                    <div className="tree-error-line">{t('tree.loadFailed')}</div>
                    <div className="tree-error-line">{t('tree.pathNotExists')}</div>
                    <div className="tree-error-line">...</div>
                </div>
            </div>
        );
    }

    return (
        <Card
            className={`tree-viewer-card ${isDarkMode ? 'dark' : 'light'} ${hasBackground ? 'with-background' : ''}`}
            data-theme={isDarkMode ? 'dark' : 'light'}
            style={{
                '--tree-font-size': `${fontSize || 16}px`
            }}
        >
            <div className="tree-header">
                <Space>
                    <Tooltip title={t('tree.expandAll')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<ExpandAltOutlined/>}
                            onClick={expandAll}
                        />
                    </Tooltip>
                    <Tooltip title={t('tree.collapseAll')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<ShrinkOutlined/>}
                            onClick={collapseAll}
                        />
                    </Tooltip>
                    {isAutoTree && treeFilePath && onOpenMgtree && (
                        <Tooltip title={t('tree.openMgtreeFile')}>
                            <Button
                                type="text"
                                size="small"
                                icon={<SwitcherOutlined/>}
                                onClick={handleOpenMgtree}
                            />
                        </Tooltip>
                    )}
                </Space>
            </div>
            {/* 树形内容区域 */}
            <div className="tree-container">
                {treeData.length > 0 ? (
                    <Tree
                        treeData={renderedTreeData}
                        expandedKeys={expandedKeys}
                        onExpand={onExpand}
                        showLine={true}
                        showIcon={false}
                        switcherIcon={({expanded}) => (
                            <div
                                className={`custom-switcher ${expanded ? "expanded" : "collapsed"}`}
                                tabIndex={-1}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={`${fontSize || 16}px`}
                                    height={`${fontSize || 16}px`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </div>
                        )}
                    />
                ) : (
                    <div className="tree-viewer-empty">
                        <FileTextOutlined style={{fontSize: '48px', opacity: 0.3}}/>
                        <div>{t('common.noData')}</div>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default TreeViewer;
