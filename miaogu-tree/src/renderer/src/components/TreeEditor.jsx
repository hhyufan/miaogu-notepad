import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
} from "@ant-design/icons";
import { useTheme } from "../theme/ThemeContext";
import AppHeader from "./AppHeader";
import {
  useAppDispatch,
  useCurrentFile,
  useTreeData,
  useExpandedSections,
  useSelectedKeys,
  useUnsavedContent,
} from "../store/hooks";
import {
  setCurrentFile,
  setTreeData,
  setExpandedSections,
  setSelectedKeys,
} from "../store/slices/editorSlice";
import stateManager from "../utils/stateManager";
import { exportWithHtml2Canvas } from "../utils/exportUtils";
import "./TreeEditor.scss";

const { Text, Title } = Typography;

// 解析树形文本
const parseTreeText = (text) => {
  const lines = text.split("\n").filter((line) => line.trim());
  const root = { key: "root", title: "知识点脉络", children: [], level: -1 };
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
    const finalTitle = cleanTitle === "[新节点]" ? "" : cleanTitle;

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
const treeToText = (nodes, level = 0) => {
  let result = "";

  nodes.forEach((node) => {
    // 优先使用originalText来保持原始格式
    if (node.originalText) {
      const indent = "  ".repeat(level);
      result += indent + node.originalText + "\n";
    } else {
      // 如果没有originalText，输出节点标题，如果标题为空则使用占位符
      const indent = "  ".repeat(level);
      const nodeText = node.title || "[新节点]";
      result += indent + nodeText + "\n";
    }

    if (node.children && node.children.length > 0) {
      result += treeToText(node.children, level + 1);
    }
  });

  return result;
};

const TreeEditor = () => {
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const dispatch = useAppDispatch();

  // Redux状态
  const currentFile = useCurrentFile();
  const treeData = useTreeData();
  const expandedSections = useExpandedSections();
  const selectedKeys = useSelectedKeys();
  const unsavedContent = useUnsavedContent();

  // 本地状态
  const [editingNode, setEditingNode] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isInternalOperation, setIsInternalOperation] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef(null);

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

  // 主题已由ThemeContext管理，无需额外处理

  // 使用非受控组件方式，避免受控组件与输入法的冲突
  const handleInputChange = (e) => {
    // 不更新state，让浏览器原生处理输入
    // setEditValue(e.target.value);
  };

  // 开始编辑节点
  const startEditNode = (node) => {
    setEditingNode(node.key);
    // 优先使用originalText保持原始格式，否则只使用title
    // 如果包含占位符，则显示空字符串
    let value = node.originalText || node.title;
    if (value === "[新节点]") {
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
      message.error("节点内容不能为空");
      return;
    }

    // 解析编辑内容，支持多种跳转语法格式
    const jumpMatchExplicit = value.match(/^(.+?)\s*>([a-zA-Z]+)\[(\d+)\]\s*$/);
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
      dispatch(setTreeData(newTreeData));
      setEditingNode(null);
      setEditValue("");

      // 实时保存到文件系统
      await saveToFileSystem(newTreeData);

      message.success("节点更新成功");
    } catch (error) {
      console.error("保存编辑失败:", error);
      message.error("保存编辑失败");
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
        dispatch(setTreeData(newTreeData));
      } else {
        newTreeData = addNodeRecursive(treeData);
        dispatch(setTreeData(newTreeData));
      }

      // 展开父节点
      if (parentKey !== "root") {
        dispatch(
          setExpandedSections([...new Set([...expandedSections, parentKey])]),
        );
      }

      // 立即设置编辑状态，无需延迟
      setEditingNode(newNodeKey);
      setEditValue("");

      // 实时保存到文件系统
      await saveToFileSystem(newTreeData);
    } catch (error) {
      console.error("添加节点失败:", error);
      message.error("添加节点失败");
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
      dispatch(setTreeData(newTreeData));

      // 实时保存到文件系统
      await saveToFileSystem(newTreeData);

      message.success("节点删除成功");
    } catch (error) {
      console.error("删除节点失败:", error);
      message.error("删除节点失败");
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
                placeholder="输入节点内容，支持跳转语法：标题 >language[index]"
              />
            </div>
          ),
          children: node.children?.map((child) => renderTreeNode(child)),
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
                    style={
                      isClickable
                        ? {
                            background:
                              "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                          }
                        : {}
                    }
                  />
                ) : (
                  <FolderOutlined
                    className="tree-icon folder-icon"
                    style={
                      isClickable
                        ? {
                            background:
                              "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                          }
                        : {}
                    }
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
              <span
                className={`node-title ${isClickable ? "has-code" : ""}`}
                onClick={() => startEditNode(node)}
              >
                {(() => {
                  const text = node.title || "(空节点)";
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

                    // 添加行内代码，根据是否为跳转节点使用不同样式
                    const codeStyle = isClickable
                      ? {
                          // 跳转节点：使用渐变色文字，背景样式与普通节点保持一致
                          backgroundColor: isDarkMode ? "#1e3a5f" : "#e6f3ff",
                          background:
                            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                          padding: "3px 6px",
                          margin: "0 6px",
                          borderRadius: "4px",
                          fontSize: "1em",
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: "500",
                          border: `1px solid ${isDarkMode ? "#2563eb" : "#93c5fd"}`,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        }
                      : {
                          // 普通节点：使用常规样式
                          backgroundColor: isDarkMode ? "#1e3a5f" : "#e6f3ff",
                          color: isDarkMode ? "#d1d5db" : "#374151",
                          padding: "3px 6px",
                          margin: "0 6px",
                          borderRadius: "4px",
                          fontSize: "1em",
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: "500",
                          border: `1px solid ${isDarkMode ? "#2563eb" : "#93c5fd"}`,
                          WebkitTextFillColor: "initial",
                          backgroundClip: "initial",
                          WebkitBackgroundClip: "initial",
                        };

                    parts.push(
                      <code key={match.index} style={codeStyle}>
                        {match[1]}
                      </code>,
                    );
                    lastIndex = codeRegex.lastIndex;
                  }

                  // 添加剩余的普通文本
                  if (lastIndex < text.length) {
                    parts.push(text.slice(lastIndex));
                  }

                  return parts;
                })()}
              </span>
            </Space>
            <Space className="node-actions" tabIndex={-1}>
              <Tooltip title="添加子节点" tabIndex={-1}>
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
              <Tooltip title="删除节点" tabIndex={-1}>
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
        children: node.children?.map((child) => renderTreeNode(child)),
      };
    },
    [editingNode, expandedSections, isDarkMode, setHoveredNode, handleInputChange, inputRef, isComposing],
  );

  // 处理文件加载
  const handleLoadFile = async () => {
    try {
      const result = await window.api.openFileDialog();
      if (result && !result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const content = await window.api.readFile(filePath);
        const parsedData = parseTreeText(content);
        dispatch(setTreeData(parsedData));
        dispatch(setCurrentFile(filePath));
        // 新文件打开时重置为全折叠状态
        dispatch(setExpandedSections([]));
        // 保存新的折叠状态
        await stateManager.saveExpandedSections([]);
        setIsNewFileLoad(true);
        message.success("文件加载成功");
      }
    } catch (error) {
      message.error("文件加载失败: " + error.message);
    }
  };

  // 直接加载指定文件路径的函数
  const loadSpecificFile = async (filePath) => {
    try {
      const content = await window.api.readFile(filePath);
      const parsedData = parseTreeText(content);
      dispatch(setTreeData(parsedData));
      dispatch(setCurrentFile(filePath));
      // 新文件打开时重置为全折叠状态
      dispatch(setExpandedSections([]));
      // 保存新的折叠状态
      await stateManager.saveExpandedSections([]);
      setIsNewFileLoad(true);
      message.success(`文件加载成功: ${filePath}`);
      return true;
    } catch (error) {
      message.error("文件加载失败: " + error.message);
      return false;
    }
  };

  // 暴露loadSpecificFile函数给外部组件使用
  useEffect(() => {
    window.treeEditor = {
      loadSpecificFile,
    };
    return () => {
      delete window.treeEditor;
    };
  }, []);

  // 移除复杂的焦点管理逻辑，使用Input组件的autoFocus属性即可

  // 输入法状态跟踪已在上方定义

  // 键盘快捷键监听器
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 如果正在编辑节点，不处理快捷键
      if (editingNode) {
        return;
      }

      // 如果正在使用输入法，不处理快捷键
      if (isComposing) {
        return;
      }

      // 如果焦点在输入框或文本区域，不处理快捷键
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
        return;
      }

      // Delete键：删除当前hover的节点
      if (event.key === 'Delete' && hoveredNode) {
        event.preventDefault();
        handleDeleteNode(hoveredNode);
      }

      // Tab键：阻止默认的焦点切换行为，只保留添加节点功能
      if (event.key === 'Tab') {
        event.preventDefault(); // 始终阻止Tab键的默认行为
        if (hoveredNode) {
          handleAddNode(hoveredNode);
        }
      }
    };

    // 添加事件监听器
    document.addEventListener('keydown', handleKeyDown);

    // 清理函数
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingNode, hoveredNode, handleDeleteNode, handleAddNode, isComposing]);

  // 状态恢复：仅在初始化时或文件切换时加载文件内容
  const [hasInitialized, setHasInitialized] = useState(false);
  const [lastLoadedFile, setLastLoadedFile] = useState(null);
  const [isNewFileLoad, setIsNewFileLoad] = useState(false); // 标记是否为新文件加载

  useEffect(() => {
    const restoreFileContent = async () => {
      // 只在以下情况下加载文件：
      // 1. 组件首次初始化且有currentFile
      // 2. currentFile发生变化（文件切换）
      const isFileChanged = currentFile !== lastLoadedFile;

      if (currentFile && (!hasInitialized || isFileChanged)) {
        try {
          const content = await window.api.readFile(currentFile);
          const parsedData = parseTreeText(content);
          dispatch(setTreeData(parsedData));
          setHasInitialized(true);
          setLastLoadedFile(currentFile);
          console.log(`状态恢复：成功加载文件 ${currentFile}`);
        } catch (error) {
          console.warn(
            `状态恢复失败：无法加载文件 ${currentFile}:`,
            error.message,
          );
          // 如果文件不存在，清除当前文件状态
          dispatch(setCurrentFile(null));
          setHasInitialized(true);
          setLastLoadedFile(null);
        }
      }
    };

    restoreFileContent();
  }, [currentFile, dispatch]); // 移除treeData依赖，避免删除后重新加载

  // 初始化时恢复状态
  useEffect(() => {
    const restoreInitialState = async () => {
      try {
        // 恢复当前文件
        const savedCurrentFile = await stateManager.loadCurrentFile();
        if (savedCurrentFile) {
          dispatch(setCurrentFile(savedCurrentFile));
          console.log("当前文件已恢复:", savedCurrentFile);

          // 只有在应用重启恢复文件时才恢复展开状态
          // 这里标记为应用重启恢复，而不是新文件加载
          const savedExpandedSections =
            await stateManager.loadExpandedSections();
          if (savedExpandedSections && savedExpandedSections.length > 0) {
            dispatch(setExpandedSections(savedExpandedSections));
            console.log("展开状态已恢复:", savedExpandedSections);
          }
        }
      } catch (error) {
        console.error("恢复初始状态失败:", error);
      }
    };

    restoreInitialState();
  }, []); // 只在组件初始化时执行一次

  // 文件监听和外部更改同步
  useEffect(() => {
    if (!currentFile) return;

    // 开始监听当前文件
    const startWatching = async () => {
      try {
        await window.api.watchFile(currentFile);
        console.log(`开始监听文件: ${currentFile}`);
      } catch (error) {
        console.error("启动文件监听失败:", error);
      }
    };

    // 设置文件更改监听器
    const removeFileChangeListener = window.api.onFileChanged(
      async (changedFilePath) => {
        if (changedFilePath === currentFile) {
          // 如果正在进行内部操作（如删除节点），忽略文件变化
          if (isInternalOperation) {
            console.log(`忽略内部操作期间的文件变化: ${changedFilePath}`);
            return;
          }

          console.log(`检测到外部文件更改: ${changedFilePath}`);
          try {
            // 重新读取文件内容
            const content = await window.api.readFile(currentFile);
            const parsedData = parseTreeText(content);
            dispatch(setTreeData(parsedData));
            message.info("文件已同步外部更改");
          } catch (error) {
            console.error("同步外部文件更改失败:", error);
            message.error("同步外部文件更改失败");
          }
        }
      },
    );

    startWatching();

    // 清理函数
    return () => {
      removeFileChangeListener();
    };
  }, [currentFile, dispatch]);

  // 自动保存当前文件到electron-store
  useEffect(() => {
    const saveCurrentFileState = async () => {
      try {
        await stateManager.saveCurrentFile(currentFile);
        console.log("当前文件已保存:", currentFile);
      } catch (error) {
        console.error("保存当前文件失败:", error);
      }
    };

    // 防抖保存，避免频繁写入
    const timeoutId = setTimeout(saveCurrentFileState, 100);
    return () => clearTimeout(timeoutId);
  }, [currentFile]);

  // 自动保存展开状态到electron-store
  useEffect(() => {
    const saveExpandedState = async () => {
      try {
        await stateManager.saveExpandedSections(expandedSections);
      } catch (error) {
        console.error("保存展开状态失败:", error);
      }
    };

    // 防抖保存，避免频繁写入
    const timeoutId = setTimeout(saveExpandedState, 200);
    return () => clearTimeout(timeoutId);
  }, [expandedSections]);

  // 实时保存到文件系统
  const saveToFileSystem = async (newTreeData = treeData) => {
    if (!currentFile) return;

    try {
      const content = treeToText(newTreeData);
      await window.api.writeFile(currentFile, content);
      console.log("文件已自动保存到:", currentFile);
    } catch (error) {
      console.error("自动保存失败:", error);
      message.error("自动保存失败: " + error.message);
    }
  };

  // 展开/折叠所有节点
  const handleExpandAll = () => {
    const getAllKeys = (nodes) => {
      let keys = [];
      nodes.forEach((node) => {
        keys.push(node.key);
        if (node.children) {
          keys = keys.concat(getAllKeys(node.children));
        }
      });
      return keys;
    };
    dispatch(setExpandedSections(getAllKeys(treeData)));
  };

  const handleCollapseAll = () => {
    dispatch(setExpandedSections([]));
  };

  // 导出树状图为PNG
  const handleExportToPNG = async () => {
    // 保存当前展开状态
    const originalExpandedSections = [...expandedSections];
    
    try {
      message.info('正在导出PNG...');
      
      // 临时展开所有节点
      const getAllKeys = (nodes) => {
        let keys = [];
        nodes.forEach((node) => {
          keys.push(node.key);
          if (node.children) {
            keys = keys.concat(getAllKeys(node.children));
          }
        });
        return keys;
      };
      
      // 展开所有节点
      const allKeys = getAllKeys(treeData);
      dispatch(setExpandedSections(allKeys));
      
      // 等待DOM更新
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 查找树容器元素
      const treeContainer = document.querySelector('.tree-container');
      if (!treeContainer) {
        message.error('未找到树状图容器');
        return;
      }
      
      // 保存原始样式
      const originalPaddingBottom = treeContainer.style.paddingBottom;
      
      // 添加导出样式类
      treeContainer.classList.add('exporting');
      
      // 添加底部空间防止文字截断
      treeContainer.style.paddingBottom = '40px';
      
      // 等待样式应用
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 生成默认文件名（基于mgtree名称）
      const defaultFilename = currentFile 
        ? `${currentFile.replace(/\.mgtree$/, '').split(/[\\/]/).pop()}.png`
        : 'tree-export.png';
      
      // 根据当前主题设置背景色
      const backgroundColor = theme.background.primary;
      
      // 导出为PNG
      const result = await exportWithHtml2Canvas(treeContainer, { 
        filename: defaultFilename,
        backgroundColor 
      });
      
      if (result.success) {
        message.success('PNG导出成功！');
      } else if (result.message === '用户取消了保存') {
        // 用户取消保存，不显示错误消息
      } else {
        message.error(`导出失败: ${result.message}`);
      }
      
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败: ' + error.message);
    } finally {
      // 确保清理样式和恢复状态
      const treeContainer = document.querySelector('.tree-container');
      if (treeContainer) {
        treeContainer.classList.remove('exporting');
        // 恢复原始的底部padding
        treeContainer.style.paddingBottom = originalPaddingBottom || '';
      }
      
      // 恢复原始展开状态
      dispatch(setExpandedSections(originalExpandedSections));
    }
  };

  // 处理节点展开/折叠
  const handleExpand = (keys, { expanded, node }) => {
    if (!expanded) {
      // 节点被折叠时，清除该节点所有子节点的展开状态
      const getAllChildKeys = (nodeData) => {
        let childKeys = [];
        if (nodeData.children) {
          nodeData.children.forEach(child => {
            childKeys.push(child.key);
            childKeys = childKeys.concat(getAllChildKeys(child));
          });
        }
        return childKeys;
      };

      // 找到被折叠的节点数据
      const findNodeInTree = (nodes, targetKey) => {
        for (const n of nodes) {
          if (n.key === targetKey) return n;
          if (n.children) {
            const found = findNodeInTree(n.children, targetKey);
            if (found) return found;
          }
        }
        return null;
      };

      const collapsedNode = findNodeInTree(treeData, node.key);
      if (collapsedNode) {
        const childKeysToRemove = getAllChildKeys(collapsedNode);
        // 从展开列表中移除所有子节点
        const filteredKeys = keys.filter(key => !childKeysToRemove.includes(key));
        dispatch(setExpandedSections(filteredKeys));
      } else {
        dispatch(setExpandedSections(keys));
      }
    } else {
      // 节点被展开时，正常处理
      dispatch(setExpandedSections(keys));
    }
  };

  // 树形数据
  const treeNodes = useMemo(() => {
    return treeData.map((node) => renderTreeNode(node));
  }, [treeData, renderTreeNode]);

  return (
    <div className={`tree-editor ${isDarkMode ? "dark" : "light"}`} tabIndex={-1}>
      <AppHeader
        onOpenFile={handleLoadFile}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onAddRootNode={async () => await handleAddNode("root")}
      />
      <div className="editor-content" tabIndex={-1}>
        <Card
          className={`tree-viewer-card ${isDarkMode ? "dark" : "light"}`}
          tabIndex={-1}
          title={
            <div className="tree-header" tabIndex={-1}>
              <Title level={4} style={{ margin: 0 }} tabIndex={-1}>
                📝 树形编辑器
              </Title>
              <Space tabIndex={-1}>
                <Tooltip title="展开所有" tabIndex={-1}>
                  <Button
                    onClick={handleExpandAll}
                    size="small"
                    icon={<ExpandAltOutlined />}
                    type="text"
                    tabIndex={-1}
                  />
                </Tooltip>
                <Tooltip title="折叠所有" tabIndex={-1}>
                  <Button
                    onClick={handleCollapseAll}
                    size="small"
                    icon={<ShrinkOutlined />}
                    type="text"
                    tabIndex={-1}
                  />
                </Tooltip>
                <Tooltip title="从文件加载" tabIndex={-1}>
                  <Button
                    onClick={handleLoadFile}
                    size="small"
                    icon={<FolderOpenOutlined />}
                    type="text"
                    tabIndex={-1}
                  />
                </Tooltip>

                <Tooltip title="添加根节点" tabIndex={-1}>
                  <Button
                    onClick={async () => await handleAddNode("root")}
                    size="small"
                    icon={<PlusOutlined />}
                    type="text"
                    tabIndex={-1}
                  />
                </Tooltip>
                <Tooltip title="导出为PNG" tabIndex={-1}>
                  <Button
                    onClick={handleExportToPNG}
                    size="small"
                    icon={<CameraOutlined />}
                    type="text"
                    tabIndex={-1}
                  />
                </Tooltip>
              </Space>
            </div>
          }
          size="small"
        >
          <div className="tree-container" tabIndex={-1}>
            {treeNodes.length > 0 ? (
              <Tree
                treeData={treeNodes}
                expandedKeys={expandedSections}
                selectedKeys={selectedKeys}
                onExpand={handleExpand}
                onSelect={(keys) => dispatch(setSelectedKeys(keys))}
                showLine={{ showLeafIcon: false }}
                showIcon={false}
                className="editable-tree"
                blockNode
                tabIndex={-1}
                switcherIcon={({ expanded }) => (
                  <div
                    className={`custom-switcher ${expanded ? "expanded" : "collapsed"}`}
                    tabIndex={-1}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
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
              <div className="empty-tree" tabIndex={-1}>
                <FileTextOutlined
                  style={{ fontSize: 48, color: "#434343", marginBottom: 16 }}
                />
                <p>暂无数据，点击"添加根节点"开始创建</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TreeEditor;
