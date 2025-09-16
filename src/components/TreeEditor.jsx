/**
 * @fileoverview 树形编辑器组件 - 用于编辑和可视化树形结构数据
 * 支持节点的增删改查、拖拽排序、缩放等功能，适用于思维导图和知识图谱编辑
 * @author hhyufan
 * @version 1.2.0
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Tree,
  Button,
  Input,
  Space,
  Typography,
  message,
  Tooltip,
  Card,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  FileTextOutlined,
  ExpandAltOutlined,
  ShrinkOutlined,
  CloseCircleOutlined,
  MoonFilled,
  SunOutlined,
  CodeOutlined,
  CameraOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  OneToOneOutlined,
} from "@ant-design/icons";
import "./TreeEditor.scss";

const { Text, Title } = Typography;

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
  const root = { key: "root", title: knowledgeMapTitle, children: [], level: -1 };
  const stack = [root];
  let keyCounter = 0;

  const lastJumpIndex = {};

  lines.forEach((line, _) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const level = line.length - line.trimStart().length;

    const cleanLine = trimmedLine.replace(/[\r\n]/g, "");

    const jumpMatchExplicit = cleanLine.match(/>([a-zA-Z]+)\[(\d+)]/);
    const jumpMatchJump = cleanLine.match(/>([a-zA-Z]+)\+=(\d+)/);
    const jumpMatchSame = cleanLine.match(/>([a-zA-Z]+)(?!\[|\+|=)\s*$/);

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
 * @param {Object} props - 组件属性
 * @param {Object} props.fileManager - 文件管理器实例
 * @param {boolean} props.isDarkMode - 是否为暗色主题
 * @returns {JSX.Element} 树形编辑器组件
 */
const TreeEditor = ({ fileManager, isDarkMode }) => {
  const { t } = useTranslation();
  const { backgroundEnabled, backgroundImage, fontSize } = useSelector((state) => state.theme);
  const hasBackground = backgroundEnabled && backgroundImage;
  const [treeData, setTreeData] = useState([]);
  const [expandedSections, setExpandedSections] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isInternalOperation, setIsInternalOperation] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const inputRef = useRef(null);

  const { currentFile, updateCode } = fileManager;

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

  const saveToFileSystem = useCallback(async (data) => {
    if (!currentFile || isInternalOperation) return;

    try {
      const textContent = treeToText(data, 0, t('tree.newNode'));
      updateCode(textContent);
    } catch (error) {
      console.error("保存到文件系统失败:", error);
    }
  }, [currentFile, updateCode, isInternalOperation]);

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
  }, [currentFile?.content, isInternalOperation]);

  useEffect(() => {
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

    const treeContainer = document.querySelector('.tree-container');
    if (treeContainer) {
      treeContainer.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        treeContainer.removeEventListener('wheel', handleWheel);
      };
    }
  }, []);

  const handleInputChange = (e) => {
  };

  const startEditNode = (node) => {
    setEditingNode(node.key);
    let value = node.originalText || node.title;
    if (value === t('treeEditor.placeholder.newNode')) {
      value = "";
    }
    setEditValue(value);
  };

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

  const cancelEdit = async () => {
    const currentValue = (inputRef.current?.input?.value || inputRef.current?.value || '').trim();
    if (editingNode && currentValue) {
      await saveEdit();
    } else {
      setEditingNode(null);
      setEditValue("");
    }
  };

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

  const handleDeleteNode = async (nodeKey) => {
    try {
      setIsInternalOperation(true);

      const deleteNodeRecursive = (nodes) => {
        return nodes
          .filter((node) => {
            if (node.key === nodeKey) {
              return false;
            }
            return true;
          })
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
                <FileTextOutlined className="tree-icon file-icon" />
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
      const isHovered = hoveredNode === node.key;

      return {
        key: node.key,
        title: (
          <div
            className={`tree-node-content ${isClickable ? "tree-node-clickable" : ""
              }`}
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
                <FileTextOutlined className="tree-icon file-icon" />
              )}
              <Text
                className={`tree-node-text ${node.hasJump ? "has-code" : ""
                  }`}
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
                  icon={<PlusOutlined />}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddNode(node.key);
                  }}
                />
              </Tooltip>
              <Tooltip title={t('treeEditor.tooltip.deleteNode')} tabIndex={-1}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNode(node.key);
                  }}
                />
              </Tooltip>
            </Space>
          </div>
        ),
        children: node.children?.map(renderTreeNode) || [],
      };
    },
    [editingNode, editValue, expandedSections, hoveredNode, handleAddNode, handleDeleteNode]
  );

  // 树形数据转换为Antd Tree组件需要的格式
  const treeNodes = useMemo(() => {
    return treeData.map(renderTreeNode);
  }, [treeData, renderTreeNode]);

  // 处理树节点展开/收起
  const handleExpand = (expandedKeys) => {
    setExpandedSections(expandedKeys);
  };

  // 处理树节点选择
  const handleSelect = (selectedKeys) => {
    setSelectedKeys(selectedKeys);
  };

  // 展开所有节点
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

  // 收起所有节点
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
              icon={<PlusOutlined />}
              className="add-btn"
              onClick={() => handleAddNode("root")}
            />
          </Tooltip>
          <Tooltip title={t('treeEditor.tooltip.expandAll')}>
            <Button
              type="text"
              size="small"
              icon={<ExpandAltOutlined />}
              onClick={expandAll}
            />
          </Tooltip>
          <Tooltip title={t('treeEditor.tooltip.collapseAll')}>
            <Button
              type="text"
              size="small"
              icon={<ShrinkOutlined />}
              onClick={collapseAll}
            />
          </Tooltip>
          <Tooltip title={t('treeEditor.tooltip.zoomIn')}>
            <Button
              type="text"
              size="small"
              icon={<ZoomInOutlined />}
              onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))}
            />
          </Tooltip>
          <Tooltip title={t('treeEditor.tooltip.zoomOut')}>
            <Button
              type="text"
              size="small"
              icon={<ZoomOutOutlined />}
              onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.2))}
            />
          </Tooltip>
          <Tooltip title={t('treeEditor.tooltip.resetZoom')}>
            <Button
              type="text"
              size="small"
              icon={<OneToOneOutlined />}
              onClick={() => setZoomLevel(1)}
            />
          </Tooltip>
        </Space>
      </div>

      <div
        className="tree-container"
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
            showLine={{ showLeafIcon: false }}
            showIcon={false}
            blockNode
            tabIndex={-1}
            switcherIcon={({ expanded }) => (
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
            <FileTextOutlined />
            <p>{t('treeEditor.empty.noContent')}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TreeEditor;
