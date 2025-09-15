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

// 解析树形文本
const parseTreeText = (text, knowledgeMapTitle = 'Knowledge Map', newNodeText = '[新节点]') => {
  const lines = text.split("\n").filter((line) => line.trim());
  const root = { key: "root", title: knowledgeMapTitle, children: [], level: -1 };
  const stack = [root];
  let keyCounter = 0;

  // 跟踪每种语言的最后一个跳转索引
  const lastJumpIndex = {};

  lines.forEach((line, _) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // 计算缩进级别
    const level = line.length - line.trimStart().length; // 假设每个缩进是1个tab或若干空格

    // 检查是否包含跳转信息
    // 先清理可能存在的回车符和换行符
    const cleanLine = trimmedLine.replace(/[\r\n]/g, "");

    // 支持多种跳转语法：
    // 1. >java[1] - 指定索引
    // 2. >java++ - 递增（上一个+1）
    // 3. >java - 同上一个索引
    // 4. >java+=n - 跳跃增加（上一个+n）
    const jumpMatchExplicit = cleanLine.match(/>([a-zA-Z]+)\[(\d+)]/);
    const jumpMatchJump = cleanLine.match(/>([a-zA-Z]+)\+=(\d+)/);
    const jumpMatchSame = cleanLine.match(/>([a-zA-Z]+)(?!\[|\+|=)\s*$/);

    // 使用字符串方法检测递增语法
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
      // 显式指定索引：>java[1]
      hasJump = true;
      jumpLanguage = jumpMatchExplicit[1];
      jumpIndex = parseInt(jumpMatchExplicit[2]);
      lastJumpIndex[jumpLanguage] = jumpIndex;
    } else if (jumpMatchIncrement) {
      // 递增语法：>java++
      hasJump = true;
      jumpLanguage = jumpMatchIncrement[1];
      jumpIndex = (lastJumpIndex[jumpLanguage] || 0) + 1;
      lastJumpIndex[jumpLanguage] = jumpIndex;
    } else if (jumpMatchJump) {
      // 跳跃增加语法：>java+=n
      hasJump = true;
      jumpLanguage = jumpMatchJump[1];
      const jumpAmount = parseInt(jumpMatchJump[2]);
      jumpIndex = (lastJumpIndex[jumpLanguage] || 0) + jumpAmount;
      lastJumpIndex[jumpLanguage] = jumpIndex;
    } else if (jumpMatchSame) {
      // 同上一个索引：>java
      hasJump = true;
      jumpLanguage = jumpMatchSame[1];
      jumpIndex = lastJumpIndex[jumpLanguage] || 1; // 如果没有上一个，默认为1
      // 不更新lastJumpIndex，保持原值
    }

    // 清理标题，移除跳转信息但保留代码块标记
    let cleanTitle = cleanLine;
    if (hasJump) {
      // 移除所有类型的跳转语法，按照从具体到一般的顺序
      cleanTitle = cleanTitle
        .replace(/\s*>([a-zA-Z]+)\[(\d+)]\s*$/, "") // >java[1]
        .replace(/\s*>([a-zA-Z]+)\+=(\d+)\s*$/, "") // >java+=n
        .replace(/\s*>([a-zA-Z]+)\+\+\s*$/, "") // >java++
        .replace(/\s*>([a-zA-Z]+)\s*$/, "") // >java
        .trim();
    }

    // 处理占位符：如果title是"[新节点]"，则转换为空字符串
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

    // 找到正确的父节点
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    parent.children.push(node);
    stack.push(node);
  });

  return root.children;
};

// 将树形数据转换为文本
const treeToText = (nodes, level = 0, newNodeText = '[新节点]') => {
  let result = "";

  nodes.forEach((node) => {
    // 优先使用originalText来保持原始格式
    if (node.originalText) {
      const indent = "  ".repeat(level);
      result += indent + node.originalText + "\n";
    } else {
      // 如果没有originalText，输出节点标题，如果标题为空则使用占位符
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

const TreeEditor = ({ fileManager, isDarkMode }) => {
  const { t } = useTranslation();
  const { backgroundEnabled, backgroundImage, fontSize } = useSelector((state) => state.theme);
  const hasBackground = backgroundEnabled && backgroundImage;
  // 本地状态
  const [treeData, setTreeData] = useState([]);
  const [expandedSections, setExpandedSections] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isInternalOperation, setIsInternalOperation] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 缩放级别，1为默认大小
  const inputRef = useRef(null);

  const { currentFile, updateCode } = fileManager;

  // 生成新的节点key
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

  // 保存到文件系统
  const saveToFileSystem = useCallback(async (data) => {
    if (!currentFile || isInternalOperation) return;

    try {
      const textContent = treeToText(data, 0, t('tree.newNode'));
      updateCode(textContent);
    } catch (error) {
      console.error("保存到文件系统失败:", error);
    }
  }, [currentFile, updateCode, isInternalOperation]);

  // 从文件内容初始化树形数据
  useEffect(() => {
    if (currentFile && currentFile.content && !isInternalOperation) {
      try {
        const parsedData = parseTreeText(currentFile.content, t('tree.knowledgeMap'), t('tree.newNode'));
        setTreeData(parsedData);
      } catch (error) {
        console.error("解析树形数据失败:", error);
        setTreeData([]);
      }
    }
  }, [currentFile?.content, isInternalOperation]);

  // 鼠标滚轮缩放事件监听
  useEffect(() => {
    const handleWheel = (e) => {
      // 只有按住Ctrl键时才进行缩放
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1; // 向下滚动缩小，向上滚动放大
        setZoomLevel(prev => {
          const newZoom = prev + delta;
          // 限制缩放范围在0.5到3之间
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

  // 使用非受控组件方式，避免受控组件与输入法的冲突
  const handleInputChange = (e) => {
    // 不更新state，让浏览器原生处理输入
  };

  // 开始编辑节点
  const startEditNode = (node) => {
    setEditingNode(node.key);
    // 优先使用originalText保持原始格式，否则只使用title
    // 如果包含占位符，则显示空字符串
    let value = node.originalText || node.title;
    if (value === t('treeEditor.placeholder.newNode')) {
      value = "";
    }
    setEditValue(value);
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingNode) return;

    // 从DOM直接获取当前输入值，避免受控组件状态问题
    const value = (inputRef.current?.input?.value || inputRef.current?.value || '').trim();
    if (!value) {
      message.error(t('message.warning.nodeContentEmpty'));
      return;
    }

    // 解析编辑内容，支持多种跳转语法格式
    const jumpMatchExplicit = value.match(/^(.+?)\s*>([a-zA-Z]+)\[(\d+)]\s*$/);
    const jumpMatchIncrement = value.match(/^(.+?)\s*>([a-zA-Z]+)\+\+\s*$/);
    const jumpMatchJump = value.match(/^(.+?)\s*>([a-zA-Z]+)\+=(\d+)\s*$/);
    const jumpMatchSame = value.match(/^(.+?)\s*>([a-zA-Z]+)\s*$/);

    let title,
      jumpLanguage = null,
      jumpIndex = null,
      hasJump = false,
      originalText = value; // 保持原始输入格式

    if (jumpMatchExplicit) {
      title = jumpMatchExplicit[1].trim();
      jumpLanguage = jumpMatchExplicit[2];
      jumpIndex = parseInt(jumpMatchExplicit[3]);
      hasJump = true;
    } else if (jumpMatchIncrement) {
      title = jumpMatchIncrement[1].trim();
      jumpLanguage = jumpMatchIncrement[2];
      hasJump = true;
      // 对于++语法，不设置具体的jumpIndex，保持原始格式
    } else if (jumpMatchJump) {
      title = jumpMatchJump[1].trim();
      jumpLanguage = jumpMatchJump[2];
      hasJump = true;
      // 对于+=语法，不设置具体的jumpIndex，保持原始格式
    } else if (jumpMatchSame) {
      title = jumpMatchSame[1].trim();
      jumpLanguage = jumpMatchSame[2];
      hasJump = true;
      // 对于同索引语法，不设置具体的jumpIndex，保持原始格式
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
            originalText, // 保存原始文本格式
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

      // 实时保存到文件系统
      await saveToFileSystem(newTreeData);
    } catch (error) {
      console.error("保存编辑失败:", error);
      message.error(t('message.error.saveEditFailed'));
    } finally {
      // 立即重置标志，无需延迟
      setIsInternalOperation(false);
    }
  };

  // 取消编辑（自动保存）
  const cancelEdit = async () => {
    // 从DOM获取当前输入值
    const currentValue = (inputRef.current?.input?.value || inputRef.current?.value || '').trim();
    if (editingNode && currentValue) {
      await saveEdit();
    } else {
      setEditingNode(null);
      setEditValue("");
    }
  };

  // 添加子节点
  const handleAddNode = async (parentKey) => {
    const newNodeKey = generateNodeKey();
    const newNode = {
      key: newNodeKey,
      title: "",
      hasJump: false,
      jumpLanguage: null,
      jumpIndex: null,
      originalText: "", // 添加originalText属性
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

      // 展开父节点
      if (parentKey !== "root") {
        setExpandedSections([...new Set([...expandedSections, parentKey])]);
      }

      // 立即设置编辑状态，无需延迟
      setEditingNode(newNodeKey);
      setEditValue("");

      // 实时保存到文件系统
      await saveToFileSystem(newTreeData);
    } catch (error) {
      console.error("添加节点失败:", error);
      message.error(t('message.error.addNodeFailed'));
    } finally {
      // 立即重置标志，无需延迟
      setIsInternalOperation(false);
    }
  };

  // 删除节点
  const handleDeleteNode = async (nodeKey) => {
    try {
      // 设置内部操作标志，防止文件监听器干扰
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

      // 实时保存到文件系统
      await saveToFileSystem(newTreeData);

      message.success(t('message.success.nodeDeleted'));
    } catch (error) {
      console.error("删除节点失败:", error);
      message.error(t('message.error.deleteNodeFailed'));
    } finally {
      // 立即重置标志，无需延迟
      setIsInternalOperation(false);
    }
  };

  // 渲染树节点
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
                  // 阻止事件冒泡，防止被全局键盘监听器捕获
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