/**
 * @fileoverview 树形编辑器组件 - 用于编辑和可视化树形结构数据
 * 支持节点的增删改查、拖拽排序、缩放等功能，适用于思维导图和知识图谱编辑
 * @author hhyufan
 * @version 1.3.0
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSelector} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {Button, Card, FloatButton, Input, message, Space, Tooltip, Tree, Typography,} from "antd";
import {
  CloseCircleOutlined,
  CodeOutlined,
  ExpandAltOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  OneToOneOutlined,
  PlusOutlined,
  ShrinkOutlined,
  VerticalAlignTopOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import "./TreeEditor.scss";

const {Text} = Typography;

/**
 * 解析树形文本为树形数据结构
 * 支持缩进表示层级关系，以及跳转语法（>language[index]、>language++等）
 * @param {string} text - 要解析的文本内容
 * @param {string} knowledgeMapTitle - 根节点标题，默认为'Knowledge Map'
 * @param {string} newNodeText - 新节点的默认文本，默认为'[新节点]'
 * @returns {Object} 解析后的树形数据结构
 */
const parseTreeText = (text, knowledgeMapTitle = 'Knowledge Map', newNodeText = '[新节点]') => {
    const lines = text.split("\n").filter((line) => line.trim());
    const root = {key: "root", title: knowledgeMapTitle, children: [], level: -1};
    const stack = [root];
    let keyCounter = 0;

    const lastJumpIndex = {};

    lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const level = line.length - line.trimStart().length;

        const cleanLine = trimmedLine.replace(/[\r\n]/g, "");

        const jumpMatchExplicit = cleanLine.match(/>([a-zA-Z]+)\[(\d+)]/);
        const jumpMatchJump = cleanLine.match(/>([a-zA-Z]+)\+=(\d+)/);
        const jumpMatchSame = cleanLine.match(/>([a-zA-Z]+)(?![\[+=])\s*$/);

        let jumpMatchIncrement = null;
        if (cleanLine.includes("++")) {
            const incrementMatch = cleanLine.match(/>([a-zA-Z]+)\+\+/);
            if (incrementMatch) {
                jumpMatchIncrement = incrementMatch;
            }
        }

        let hasJump = false;
        let jumpLanguage = null;
        let jumpIndex = null;

        if (jumpMatchExplicit) {
            hasJump = true;
            jumpLanguage = jumpMatchExplicit[1];
            jumpIndex = parseInt(jumpMatchExplicit[2]);
            lastJumpIndex[jumpLanguage] = jumpIndex;
        } else if (jumpMatchIncrement) {
            hasJump = true;
            jumpLanguage = jumpMatchIncrement[1];
            jumpIndex = (lastJumpIndex[jumpLanguage] || 0) + 1;
            lastJumpIndex[jumpLanguage] = jumpIndex;
        } else if (jumpMatchJump) {
            hasJump = true;
            jumpLanguage = jumpMatchJump[1];
            const jumpAmount = parseInt(jumpMatchJump[2]);
            jumpIndex = (lastJumpIndex[jumpLanguage] || 0) + jumpAmount;
            lastJumpIndex[jumpLanguage] = jumpIndex;
        } else if (jumpMatchSame) {
            hasJump = true;
            jumpLanguage = jumpMatchSame[1];
            jumpIndex = lastJumpIndex[jumpLanguage] || 1;
        }

        let cleanTitle = cleanLine;
        if (hasJump) {
            cleanTitle = cleanTitle
                .replace(/\s*>([a-zA-Z]+)\[(\d+)]\s*$/, "")
                .replace(/\s*>([a-zA-Z]+)\+=(\d+)\s*$/, "")
                .replace(/\s*>([a-zA-Z]+)\+\+\s*$/, "")
                .replace(/\s*>([a-zA-Z]+)\s*$/, "")
                .trim();
        }

        const finalTitle = cleanTitle === newNodeText ? "" : cleanTitle;

        const node = {
            key: `node-${keyCounter++}`,
            title: finalTitle,
            level: level,
            originalText: trimmedLine,
            hasJump: hasJump,
            isClickable: hasJump,
            jumpLanguage: jumpLanguage,
            jumpIndex: jumpIndex,
            children: [],
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
 * 将树形数据结构转换为文本格式
 * 使用缩进表示层级关系，保留原始文本格式
 * @param {Array} nodes - 树形节点数组
 * @param {number} level - 当前层级，默认为0
 * @param {string} newNodeText - 新节点的默认文本，默认为'[新节点]'
 * @returns {string} 转换后的文本内容
 */
const treeToText = (nodes, level = 0, newNodeText = '[新节点]') => {
    let result = "";

    nodes.forEach((node) => {
        if (node.originalText) {
            const indent = "  ".repeat(level);
            result += indent + node.originalText + "\n";
        } else {
            const indent = "  ".repeat(level);
            const nodeText = node.title || newNodeText;
            result += indent + nodeText + "\n";
        }

        if (node.children && node.children.length > 0) {
            result += treeToText(node.children, level + 1, newNodeText);
        }
    });

    return result;
};

/**
 * 树形编辑器主组件
 * 提供可视化的树形结构编辑功能，支持节点增删改查、拖拽排序等操作
 *
 * @component
 * @param {Object} props - 组件属性
 * @param {Object} props.fileManager - 文件管理器实例，包含以下方法和属性：
 *   @param {Object} fileManager.currentFile - 当前打开的文件对象
 *   @param {Function} fileManager.updateCode - 更新文件内容的方法
 * @param {boolean} props.isDarkMode - 是否为暗色主题
 * @param {boolean} props.isHeaderVisible - 是否显示头部
 * @returns {JSX.Element} 树形编辑器组件
 *
 * @example
 * <TreeEditor
 *   fileManager={fileManager}
 *   isDarkMode={false}
 *   isHeaderVisible={true}
 * />
 */
const TreeEditor = ({fileManager, isDarkMode, isHeaderVisible}) => {
    const {t} = useTranslation();
    const {backgroundEnabled, backgroundImage, fontSize} = useSelector((state) => state.theme);
    const hasBackground = backgroundEnabled && backgroundImage;

    /** 树形结构数据 */
    const [treeData, setTreeData] = useState([]);
    /** 展开的节点键数组 */
    const [expandedSections, setExpandedSections] = useState([]);
    /** 选中的节点键数组 */
    const [selectedKeys, setSelectedKeys] = useState([]);
    /** 当前正在编辑的节点键 */
    const [editingNode, setEditingNode] = useState(null);
    /** 编辑框中的值 */
    const [editValue, setEditValue] = useState("");
    /** 是否为内部操作标志，用于避免不必要的文件保存 */
    const [isInternalOperation, setIsInternalOperation] = useState(false);
    /** 当前悬停的节点键 */
    const [hoveredNode, setHoveredNode] = useState(null);
    /** 输入法组合状态 */
    const [_, setIsComposing] = useState(false);
    /** 缩放级别 */
    const [zoomLevel, setZoomLevel] = useState(1);
    /** 编辑输入框的引用 */
    const inputRef = useRef(null);
    /** 树容器的引用 */
    const treeContainerRef = useRef(null);
    /** 是否显示返回顶部按钮 */
    const [showBackToTop, setShowBackToTop] = useState(false);
    /** 调试模式标志 */
    const [debugMode, setDebugMode] = useState(false);
    /** 调试信息 */
    const [debugInfo, setDebugInfo] = useState({
        lastScrollEvent: null,
        scrollEvents: [],
        showBackToTopState: false,
        currentFileState: false
    });

    const {currentFile, updateCode} = fileManager;

    /**
     * 生成唯一的节点键
     * @returns {string} 唯一的节点键
     */
    const generateNodeKey = () => {
        const allKeys = [];
        const collectKeys = (nodes) => {
            nodes.forEach((node) => {
                allKeys.push(node.key);
                if (node.children) collectKeys(node.children);
            });
        };
        collectKeys(treeData);

        let counter = 1;
        while (allKeys.includes(`node-${counter}`)) {
            counter++;
        }
        return `node-${counter}`;
    };

    /**
     * 将树形数据保存到文件系统
     * @param {Array} data - 树形数据
     */
    const saveToFileSystem = useCallback(async (data) => {
        if (!currentFile || isInternalOperation) return;

        try {
            const textContent = treeToText(data, 0, t('tree.newNode'));
            updateCode(textContent);
        } catch (error) {
            console.error("保存到文件系统失败:", error);
        }
    }, [currentFile, updateCode, isInternalOperation, t]);

    /**
     * 当当前文件内容变化时，重新解析树形数据
     */
    useEffect(() => {
        if (currentFile && currentFile['content'] && !isInternalOperation) {
            try {
                const parsedData = parseTreeText(currentFile['content'], t('tree.knowledgeMap'), t('tree.newNode'));
                setTreeData(parsedData);
            } catch (error) {
                console.error("解析树形数据失败:", error);
                setTreeData([]);
            }
        }
    }, [currentFile?.content, isInternalOperation, t]);

    /**
     * 监听滚动事件，控制返回顶部按钮的显示状态
     * 同时处理缩放功能的滚轮事件
     */
    useEffect(() => {
        if (!currentFile) return;

        // 找到真正的滚动容器 - code-editor-container
        const codeEditorContainer = document.querySelector('.code-editor-container');

        if (!codeEditorContainer) {
            console.warn('TreeEditor: 未找到 .code-editor-container 元素');
            return;
        }

        // 创建滚动处理函数
        const handleScroll = (event) => {
            try {
                const scrollTop = event.target.scrollTop || 0;

                // 更新调试信息
                const eventInfo = {
                    time: new Date().toLocaleTimeString(),
                    container: 'code-editor-container',
                    scrollTop: scrollTop,
                    threshold: scrollTop > 100
                };

                setDebugInfo(prev => ({
                    ...prev,
                    lastScrollEvent: eventInfo,
                    scrollEvents: [...prev.scrollEvents.slice(-4), eventInfo],
                    showBackToTopState: scrollTop > 100,
                    currentFileState: !!currentFile
                }));

                // 更新按钮显示状态
                setShowBackToTop(scrollTop > 100);
            } catch (error) {
                console.error('TreeEditor: 滚动处理错误', error);
            }
        };

        // 绑定滚动事件
        codeEditorContainer.addEventListener('scroll', handleScroll, {passive: true});

        // 检查初始滚动位置
        const initialScrollTop = codeEditorContainer.scrollTop || 0;
        setShowBackToTop(initialScrollTop > 100);

        // 更新初始调试信息
        if (initialScrollTop > 100) {
            const initialEventInfo = {
                time: new Date().toLocaleTimeString(),
                container: 'code-editor-container (初始)',
                scrollTop: initialScrollTop,
                threshold: true
            };

            setDebugInfo(prev => ({
                ...prev,
                lastScrollEvent: initialEventInfo,
                scrollEvents: [initialEventInfo],
                showBackToTopState: true,
                currentFileState: !!currentFile
            }));
        }

        // 绑定缩放功能的滚轮事件
        const container = treeContainerRef.current;
        const scrollListeners = [];
        if (container) {
            const handleWheel = (e) => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    setZoomLevel(prev => {
                        const newZoom = prev + delta;
                        return Math.max(0.5, Math.min(3, newZoom));
                    });
                }
            };

            container.addEventListener('wheel', handleWheel, {passive: false});
            scrollListeners.push({element: container, handler: handleWheel, isWheel: true});
        }

        // 清理函数
        return () => {
            codeEditorContainer.removeEventListener('scroll', handleScroll);
            scrollListeners.forEach(({element, handler, isWheel}) => {
                if (isWheel) {
                    element.removeEventListener('wheel', handler);
                } else {
                    element.removeEventListener('scroll', handler);
                }
            });
        };
    }, [currentFile, treeData]);

    /**
     * 处理输入框变化（空实现，保留用于未来扩展）
     * @param {Event} _ - 事件对象
     */
    const handleInputChange = (_) => {
    };

    /**
     * 开始编辑节点
     * @param {Object} node - 要编辑的节点
     */
    const startEditNode = (node) => {
        setEditingNode(node.key);
        let value = node.originalText || node.title;
        if (value === t('treeEditor.placeholder.newNode')) {
            value = "";
        }
        setEditValue(value);
    };

    /**
     * 保存节点编辑内容
     */
    const saveEdit = async () => {
        if (!editingNode) return;

        const value = (inputRef.current?.input?.value || inputRef.current?.value || '').trim();
        if (!value) {
            message.error(t('message.warning.nodeContentEmpty'));
            return;
        }

        const jumpMatchExplicit = value.match(/^(.+?)\s*>([a-zA-Z]+)\[(\d+)]\s*$/);
        const jumpMatchIncrement = value.match(/^(.+?)\s*>([a-zA-Z]+)\+\+\s*$/);
        const jumpMatchJump = value.match(/^(.+?)\s*>([a-zA-Z]+)\+=(\d+)\s*$/);
        const jumpMatchSame = value.match(/^(.+?)\s*>([a-zA-Z]+)\s*$/);

        let title,
            jumpLanguage = null,
            jumpIndex = null,
            hasJump = false,
            originalText = value;

        if (jumpMatchExplicit) {
            title = jumpMatchExplicit[1].trim();
            jumpLanguage = jumpMatchExplicit[2];
            jumpIndex = parseInt(jumpMatchExplicit[3]);
            hasJump = true;
        } else if (jumpMatchIncrement) {
            title = jumpMatchIncrement[1].trim();
            jumpLanguage = jumpMatchIncrement[2];
            hasJump = true;
        } else if (jumpMatchJump) {
            title = jumpMatchJump[1].trim();
            jumpLanguage = jumpMatchJump[2];
            hasJump = true;
        } else if (jumpMatchSame) {
            title = jumpMatchSame[1].trim();
            jumpLanguage = jumpMatchSame[2];
            hasJump = true;
        } else {
            title = value;
        }

        const updateNodeRecursive = (nodes) => {
            return nodes.map((node) => {
                if (node.key === editingNode) {
                    return {
                        ...node,
                        title,
                        hasJump,
                        jumpLanguage,
                        jumpIndex,
                        originalText,
                    };
                }
                if (node.children) {
                    return {
                        ...node,
                        children: updateNodeRecursive(node.children),
                    };
                }
                return node;
            });
        };

        try {
            setIsInternalOperation(true);

            const newTreeData = updateNodeRecursive(treeData);
            setTreeData(newTreeData);
            setEditingNode(null);
            setEditValue("");

            await saveToFileSystem(newTreeData);
        } catch (error) {
            console.error("保存编辑失败:", error);
            message.error(t('message.error.saveEditFailed'));
        } finally {
            setIsInternalOperation(false);
        }
    };

    /**
     * 取消节点编辑
     */
    const cancelEdit = async () => {
        const currentValue = (inputRef.current?.input?.value || inputRef.current?.value || '').trim();
        if (editingNode && currentValue) {
            await saveEdit();
        } else {
            setEditingNode(null);
            setEditValue("");
        }
    };

    /**
     * 添加新节点
     * @param {string} parentKey - 父节点键，'root'表示根节点
     */
    const handleAddNode = async (parentKey) => {
        const newNodeKey = generateNodeKey();
        const newNode = {
            key: newNodeKey,
            title: "",
            hasJump: false,
            jumpLanguage: null,
            jumpIndex: null,
            originalText: "",
            children: [],
        };

        const addNodeRecursive = (nodes) => {
            return nodes.map((node) => {
                if (node.key === parentKey) {
                    return {
                        ...node,
                        children: [...(node.children || []), newNode],
                    };
                }
                if (node.children) {
                    return {
                        ...node,
                        children: addNodeRecursive(node.children),
                    };
                }
                return node;
            });
        };

        try {
            setIsInternalOperation(true);

            let newTreeData;
            if (parentKey === "root") {
                newTreeData = [...treeData, newNode];
                setTreeData(newTreeData);
            } else {
                newTreeData = addNodeRecursive(treeData);
                setTreeData(newTreeData);
            }

            if (parentKey !== "root") {
                setExpandedSections([...new Set([...expandedSections, parentKey])]);
            }

            setEditingNode(newNodeKey);
            setEditValue("");

            await saveToFileSystem(newTreeData);
        } catch (error) {
            console.error("添加节点失败:", error);
            message.error(t('message.error.addNodeFailed'));
        } finally {
            setIsInternalOperation(false);
        }
    };

    /**
     * 删除指定节点
     * @param {string} nodeKey - 要删除的节点键
     */
    const handleDeleteNode = async (nodeKey) => {
        try {
            setIsInternalOperation(true);

            const deleteNodeRecursive = (nodes) => {
                return nodes
                    .filter((node) => node.key !== nodeKey)
                    .map((node) => {
                        if (node.children) {
                            return {
                                ...node,
                                children: deleteNodeRecursive(node.children),
                            };
                        }
                        return node;
                    });
            };

            const newTreeData = deleteNodeRecursive(treeData);
            setTreeData(newTreeData);

            await saveToFileSystem(newTreeData);

            message.success(t('message.success.nodeDeleted'));
        } catch (error) {
            console.error("删除节点失败:", error);
            message.error(t('message.error.deleteNodeFailed'));
        } finally {
            setIsInternalOperation(false);
        }
    };

    /**
     * 渲染树形节点
     * @param {Object} node - 节点数据
     * @returns {Object} 渲染后的节点配置
     */
    const renderTreeNode = useCallback(
        (node) => {
            const isEditing = editingNode === node.key;

            if (isEditing) {
                const hasChildren = node.children && node.children.length > 0;
                const isExpanded = expandedSections.includes(node.key);
                const isClickable = node.hasJump;

                return {
                    key: node.key,
                    title: (
                        <div className="tree-node-editing" tabIndex={-1}>
                            {hasChildren ? (
                                isExpanded ? (
                                    <FolderOpenOutlined
                                        className="tree-icon folder-icon"
                                        style={{
                                            color: isClickable ? "#1890ff" : "#faad14",
                                        }}
                                    />
                                ) : (
                                    <FolderOutlined
                                        className="tree-icon folder-icon"
                                        style={{
                                            color: isClickable ? "#1890ff" : "#faad14",
                                        }}
                                    />
                                )
                            ) : isClickable ? (
                                <CodeOutlined
                                    className="tree-icon file-icon code-indicator"
                                    style={{
                                        color: "#1890ff",
                                    }}
                                />
                            ) : (
                                <FileTextOutlined className="tree-icon file-icon"/>
                            )}
                            <Input
                                ref={inputRef}
                                className="tree-node-input"
                                defaultValue={editValue}
                                onChange={handleInputChange}
                                onPressEnter={saveEdit}
                                onBlur={cancelEdit}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                }}
                                onCompositionStart={() => setIsComposing(true)}
                                onCompositionEnd={() => setIsComposing(false)}
                                autoFocus
                                size="small"
                                placeholder={t('treeEditor.placeholder.inputNodeContent')}
                            />
                        </div>
                    ),
                    children: node.children?.map(renderTreeNode) || [],
                };
            }

            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = expandedSections.includes(node.key);
            const isClickable = node.hasJump;
            return {
                key: node.key,
                title: (
                    <div
                        className={`tree-node-content ${isClickable ? "tree-node-clickable" : ""}`}
                        tabIndex={-1}
                        onMouseEnter={() => setHoveredNode(node.key)}
                        onMouseLeave={() => setHoveredNode(null)}
                    >
                        <Space size="small" tabIndex={-1}>
                            {hasChildren ? (
                                isExpanded ? (
                                    <FolderOpenOutlined
                                        className="tree-icon folder-icon"
                                        style={{
                                            color: isClickable ? "#1890ff" : "#faad14",
                                        }}
                                    />
                                ) : (
                                    <FolderOutlined
                                        className="tree-icon folder-icon"
                                        style={{
                                            color: isClickable ? "#1890ff" : "#faad14",
                                        }}
                                    />
                                )
                            ) : isClickable ? (
                                <CodeOutlined
                                    className="tree-icon file-icon code-indicator"
                                    style={{
                                        color: "#1890ff",
                                    }}
                                />
                            ) : (
                                <FileTextOutlined className="tree-icon file-icon"/>
                            )}
                            <Text
                                className={`tree-node-text ${node.hasJump ? "has-code" : ""}`}
                                onClick={() => startEditNode(node)}
                            >
                                {(() => {
                                    const text = node.title || t('treeEditor.placeholder.newNode');
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
                        <Space className="node-actions" tabIndex={-1}>
                            <Tooltip title={t('treeEditor.tooltip.addChildNode')} tabIndex={-1}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<PlusOutlined/>}
                                    tabIndex={-1}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddNode(node.key).catch();
                                    }}
                                />
                            </Tooltip>
                            <Tooltip title={t('treeEditor.tooltip.deleteNode')} tabIndex={-1}>
                                <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<CloseCircleOutlined/>}
                                    tabIndex={-1}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteNode(node.key).then();
                                    }}
                                />
                            </Tooltip>
                        </Space>
                    </div>
                ),
                children: node.children?.map(renderTreeNode) || [],
            };
        },
        [editingNode, editValue, expandedSections, hoveredNode, handleAddNode, handleDeleteNode, t]
    );

    /**
     * 生成树形组件所需的节点数据
     * @type {Array<Object>} 树形节点配置数组
     */
    const treeNodes = useMemo(() => {
        return treeData.map(renderTreeNode);
    }, [treeData, renderTreeNode]);

    /**
     * 处理树节点展开/收起
     * @param {Array<string>} expandedKeys - 展开的节点键数组
     */
    const handleExpand = (expandedKeys) => {
        setExpandedSections(expandedKeys);
    };

    /**
     * 处理树节点选择
     * @param {Array<string>} selectedKeys - 选中的节点键数组
     */
    const handleSelect = (selectedKeys) => {
        setSelectedKeys(selectedKeys);
    };

    /**
     * 展开所有节点
     */
    const expandAll = () => {
        const allKeys = [];
        const collectKeys = (nodes) => {
            nodes.forEach((node) => {
                if (node.children && node.children.length > 0) {
                    allKeys.push(node.key);
                    collectKeys(node.children);
                }
            });
        };
        collectKeys(treeData);
        setExpandedSections(allKeys);
    };

    /**
     * 收起所有节点
     */
    const collapseAll = () => {
        setExpandedSections([]);
    };

    // 限制字体大小：16以下固定为16，18以上固定为18
    const limitedFontSize = fontSize < 16 ? 16 : fontSize > 18 ? 18 : fontSize;

    return (
        <Card
            className={`tree-viewer-card ${isDarkMode ? 'dark' : 'light'} ${hasBackground ? 'with-background' : ''}`}
            data-theme={isDarkMode ? 'dark' : 'light'}
            style={{
                '--tree-font-size': `${limitedFontSize}px`
            }}
        >
            <div className="tree-header">
                <Space>
                    <Tooltip title={t('treeEditor.tooltip.addRootNode')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<PlusOutlined/>}
                            className="add-btn"
                            onClick={() => handleAddNode("root")}
                        />
                    </Tooltip>
                    <Tooltip title={t('treeEditor.tooltip.expandAll')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<ExpandAltOutlined/>}
                            onClick={expandAll}
                        />
                    </Tooltip>
                    <Tooltip title={t('treeEditor.tooltip.collapseAll')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<ShrinkOutlined/>}
                            onClick={collapseAll}
                        />
                    </Tooltip>
                    <Tooltip title={t('treeEditor.tooltip.zoomIn')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<ZoomInOutlined/>}
                            onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))}
                        />
                    </Tooltip>
                    <Tooltip title={t('treeEditor.tooltip.zoomOut')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<ZoomOutOutlined/>}
                            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.2))}
                        />
                    </Tooltip>
                    <Tooltip title={t('treeEditor.tooltip.resetZoom')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<OneToOneOutlined/>}
                            onClick={() => setZoomLevel(1)}
                        />
                    </Tooltip>
                </Space>
            </div>

            <div
                className="tree-container"
                ref={treeContainerRef}
                style={{
                    zoom: zoomLevel
                }}
            >
                {treeNodes.length > 0 ? (
                    <Tree
                        className="editable-tree"
                        treeData={treeNodes}
                        expandedKeys={expandedSections}
                        selectedKeys={selectedKeys}
                        onExpand={handleExpand}
                        onSelect={handleSelect}
                        showLine={{showLeafIcon: false}}
                        showIcon={false}
                        blockNode
                        tabIndex={-1}
                        switcherIcon={({expanded}) => (
                            <div
                                className={`custom-switcher ${expanded ? "expanded" : "collapsed"}`}
                                tabIndex={-1}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={`${limitedFontSize}px`}
                                    height={`${limitedFontSize}px`}
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
                    <div className="empty-tree">
                        <FileTextOutlined/>
                        <p>{t('treeEditor.empty.noContent')}</p>
                    </div>
                )}
            </div>

            {/* 返回顶部悬浮按钮 */}
            {showBackToTop && currentFile && (
                <FloatButton
                    icon={<VerticalAlignTopOutlined/>}
                    onClick={() => {
                        // 直接使用我们确认的正确滚动容器
                        const codeEditorContainer = document.querySelector('.code-editor-container');
                        if (codeEditorContainer) {
                            // 平滑滚动到顶部
                            codeEditorContainer.scrollTo({
                                top: 0,
                                behavior: 'smooth'
                            });

                            // 备用方案：直接设置scrollTop
                            setTimeout(() => {
                                if (codeEditorContainer.scrollTop > 0) {
                                    codeEditorContainer.scrollTop = 0;
                                }
                            }, 100);
                        } else {
                            console.warn('TreeEditor: 未找到 .code-editor-container 滚动容器');
                        }
                    }}
                    style={{
                        position: 'fixed',
                        right: 20,
                        bottom: 40,
                        zIndex: 1000
                    }}
                />
            )}
        </Card>
    );
};

export default TreeEditor;
