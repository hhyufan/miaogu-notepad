import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Breadcrumb, Button, Tooltip, Dropdown, message } from "antd";
import {
  FileOutlined,
  FolderOutlined,
} from "@ant-design/icons";
import "./StatusBar.scss";

const StatusBar = ({ currentFile }) => {
  const [pathSegments, setPathSegments] = useState([]);
  const [directoryContents, setDirectoryContents] = useState({});
  const [scrollState, setScrollState] = useState({
    canScroll: false,
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);

  const breadcrumbRef = useRef(null);
  const filePathRef = useRef(null);

  // 分割路径函数
  const splitPath = useCallback((path) => {
    if (!path || typeof path !== "string") return [];

    const segments = [];
    let current = "";
    let i = 0;

    // 处理Windows盘符
    if (path.length >= 2 && path[1] === ":") {
      segments.push(path.substring(0, 2) + "\\");
      i = 3; // 跳过 "C:\\"
    }

    // 单次遍历分割路径
    for (; i < path.length; i++) {
      const char = path[i];
      if (char === "\\" || char === "/") {
        if (current) {
          segments.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    // 添加最后一个段
    if (current) {
      segments.push(current);
    }

    return segments;
  }, []);

  // 目录内容过滤 - 只显示目录和.mgtree文件
  const filterDirectoryContents = useCallback((contents) => {
    return contents.filter((item) => {
      // 只返回目录和.mgtree文件
      if (item.isDirectory) return true;
      const ext = item.name.split(".").pop()?.toLowerCase();
      return ext === "mgtree";
    });
  }, []);

  // 获取目录内容
  const getDirectoryContents = useCallback(
    async (dirPath) => {
      try {
        // 使用Electron API获取目录内容
        if (window.api?.readDirectory) {
          const contents = await window.api.readDirectory(dirPath);
          return filterDirectoryContents(contents);
        } else {
          console.warn("Electron API不可用，返回空数组");
          return [];
        }
      } catch (error) {
        console.error("获取目录内容失败:", error);
        return [];
      }
    },
    [filterDirectoryContents],
  );

  // 构建完整路径
  const buildFullPath = useCallback(
    (index) => {
      if (index < 0 || !pathSegments.length) return "";

      // 对于Windows路径，特殊处理盘符
      if (pathSegments[0].endsWith("\\")) {
        const segments = [pathSegments[0], ...pathSegments.slice(1, index + 1)];
        return segments.join("\\");
      } else {
        return "/" + pathSegments.slice(0, index + 1).join("/");
      }
    },
    [pathSegments],
  );

  // 处理路径分段
  useEffect(() => {
    if (currentFile && typeof currentFile === 'string') {
      const segments = splitPath(currentFile);
      setPathSegments(segments);
      setDirectoryContents({});
    } else {
      setPathSegments([]);
    }
  }, [currentFile, splitPath]);

  // 检查滚动状态和更新滚动条
  const updateScrollState = useCallback(() => {
    if (breadcrumbRef.current && filePathRef.current) {
      const breadcrumb = breadcrumbRef.current;
      const container = filePathRef.current;

      const scrollWidth = breadcrumb.scrollWidth;
      const clientWidth = breadcrumb.clientWidth;
      const scrollLeft = breadcrumb.scrollLeft;
      const canScroll = scrollWidth > clientWidth;

      setScrollState({
        canScroll,
        scrollLeft,
        scrollWidth,
        clientWidth,
      });

      // 更新溢出状态的CSS类
      const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 1;
      const hasFile = currentFile;

      if (hasFile && canScroll && !isAtEnd) {
        container.classList.add("has-overflow");
      } else {
        container.classList.remove("has-overflow");
      }

      // 更新滚动条位置和宽度
      const thumbElement = container.querySelector(".scroll-thumb");
      if (thumbElement) {
        if (canScroll) {
          const scrollPercentage = scrollLeft / (scrollWidth - clientWidth);
          const thumbWidth = Math.max(20, (clientWidth / scrollWidth) * 100);
          const thumbLeft = scrollPercentage * (100 - thumbWidth);

          thumbElement.style.width = `${thumbWidth}%`;
          thumbElement.style.left = `${thumbLeft}%`;
        } else {
          thumbElement.style.width = "20%";
          thumbElement.style.left = "0%";
        }
      }
    }
  }, [currentFile]);

  // 监听面包屑内容变化
  useEffect(() => {
    const timer = setTimeout(updateScrollState, 100);
    return () => clearTimeout(timer);
  }, [pathSegments, updateScrollState]);

  // 组件挂载时立即更新滚动状态
  useEffect(() => {
    updateScrollState();
  }, [updateScrollState]);

  useEffect(() => {
    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateScrollState]);

  // 处理滚动条点击
  const handleScrollBarClick = useCallback(
    (e) => {
      if (!breadcrumbRef.current || !scrollState.canScroll || isDragging)
        return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const maxScroll = scrollState.scrollWidth - scrollState.clientWidth;
      breadcrumbRef.current.scrollLeft = percentage * maxScroll;
      updateScrollState();
    },
    [
      scrollState.canScroll,
      scrollState.scrollWidth,
      scrollState.clientWidth,
      isDragging,
      updateScrollState,
    ],
  );

  // 处理滚动条拖拽开始
  const handleThumbMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!breadcrumbRef.current || !scrollState.canScroll) return;

      setIsDragging(true);
      setDragStartX(e.clientX);
      setDragStartScrollLeft(breadcrumbRef.current.scrollLeft);

      if (filePathRef.current) {
        filePathRef.current.classList.add("dragging");
      }
    },
    [scrollState.canScroll],
  );

  // 处理鼠标移动（拖拽）
  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !breadcrumbRef.current || !filePathRef.current) return;

      const deltaX = e.clientX - dragStartX;
      const containerRect = filePathRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const maxScroll = scrollState.scrollWidth - scrollState.clientWidth;

      const sensitivity = 2.0;
      const scrollDelta = (deltaX / containerWidth) * maxScroll * sensitivity;
      breadcrumbRef.current.scrollLeft = Math.max(
        0,
        Math.min(maxScroll, dragStartScrollLeft + scrollDelta),
      );
      updateScrollState();
    },
    [
      isDragging,
      dragStartX,
      dragStartScrollLeft,
      scrollState.scrollWidth,
      scrollState.clientWidth,
      updateScrollState,
    ],
  );

  // 处理鼠标释放（拖拽结束）
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (filePathRef.current) {
      filePathRef.current.classList.remove("dragging");
    }
  }, []);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 处理面包屑滚动
  const handleBreadcrumbScroll = useCallback(() => {
    updateScrollState();
  }, [updateScrollState]);

  // 处理面包屑项点击
  const handleBreadcrumbClick = useCallback(
    async (index) => {
      const fullPath = buildFullPath(index);
      if (!fullPath) return;

      // 检查是否是最后一个路径段（可能是文件）
      const isLastSegment = index === pathSegments.length - 1;
      let dirPath = fullPath;
      
      // 如果是最后一个路径段且当前文件存在，则获取父目录
      if (isLastSegment && currentFile && fullPath.endsWith('.mgtree')) {
        // 获取父目录路径
        const lastSeparator = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        if (lastSeparator > 0) {
          dirPath = fullPath.substring(0, lastSeparator);
        }
      }

      const contents = await getDirectoryContents(dirPath);
      setDirectoryContents({ [index]: contents });
    },
    [buildFullPath, getDirectoryContents, pathSegments.length, currentFile],
  );

  // 处理文件或目录点击
  const handleFileClick = useCallback(
    async (filePath, isDirectory) => {
      if (!filePath) return;
      console.log("Navigate to:", filePath, "isDirectory:", isDirectory);

      // 如果是文件，显示文件信息
      if (!isDirectory) {
        // 检查是否是.mgtree文件
        if (filePath.endsWith(".mgtree")) {
          // 尝试在树编辑器中打开.mgtree文件
          if (window.treeEditor && window.treeEditor.loadSpecificFile) {
            window.treeEditor.loadSpecificFile(filePath);
            message.success(
              `在树编辑器中打开: ${filePath.split(/[\\/]/).pop()}`,
            );
          } else {
            message.warning("树编辑器未准备就绪，请稍后再试");
          }
        } else {
          message.info(`选择了文件: ${filePath}`);
        }
      } else {
        message.info(`选择了目录: ${filePath}`);
      }

      // 更新路径分段
      if (filePath) {
        const segments = splitPath(filePath);
        setPathSegments(segments);
        setDirectoryContents({});
      }
    },
    [splitPath],
  );

  // 生成面包屑下拉菜单项
  const getDropdownItems = useCallback(
    (index) => {
      const contents = directoryContents[index] || [];

      const sortedContents = [...contents].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return sortedContents.map((item) => ({
        key: item.path,
        label: item.name,
        icon: item.isDirectory ? <FolderOutlined /> : <FileOutlined />,
        onClick: () => handleFileClick(item.path, item.isDirectory),
      }));
    },
    [directoryContents, handleFileClick],
  );

  // 生成面包屑items
  const breadcrumbItems = useMemo(() => {
    return pathSegments.map((segment, index) => ({
      key: index,
      title: (
        <Dropdown
          menu={{ items: getDropdownItems(index) }}
          trigger={["click"]}
          placement="topLeft"
          overlayStyle={{
            maxHeight: "285px",
            overflow: "hidden",
          }}
          onOpenChange={(open) => {
            if (open) handleBreadcrumbClick(index).catch(console.error);
          }}
        >
          <span style={{ cursor: "pointer" }}>
            {/^[A-Z]:$/i.test(segment) ? segment : segment}
          </span>
        </Dropdown>
      ),
    }));
  }, [pathSegments, getDropdownItems, handleBreadcrumbClick]);

  // 处理目录项目点击
  const handleDirectoryItemClick = useCallback((item) => {
    console.log("Navigate to:", item.key, "Type:", item.type);
    // 这里可以添加打开文件或切换目录的逻辑
  }, []);



  return (
    <div className="status-bar">
      <div className="status-left">
        <div
          className="file-path"
          ref={filePathRef}
          onClick={handleScrollBarClick}
        >
          <div
            className={`scroll-thumb ${isDragging ? "dragging" : ""}`}
            onMouseDown={handleThumbMouseDown}
            style={{
              cursor: isDragging ? "grabbing" : "grab",
            }}
          ></div>
          {pathSegments.length > 0 ? (
            <div
              ref={breadcrumbRef}
              onScroll={handleBreadcrumbScroll}
              className="breadcrumb-container"
            >
              <Breadcrumb
                items={breadcrumbItems}
                separator={
                  <svg
                    className="icon"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    style={{ transform: "translateY(3px)" }}
                  >
                    <path
                      d="M704 514.368a52.864 52.864 0 0 1-15.808 37.888L415.872 819.2a55.296 55.296 0 0 1-73.984-2.752 52.608 52.608 0 0 1-2.816-72.512l233.6-228.928-233.6-228.992a52.736 52.736 0 0 1-17.536-53.056 53.952 53.952 0 0 1 40.192-39.424c19.904-4.672 40.832 1.92 54.144 17.216l272.32 266.88c9.92 9.792 15.616 23.04 15.808 36.8z"
                      fill="#1296db"
                      fillOpacity=".88"
                    ></path>
                  </svg>
                }
              />
            </div>
          ) : (
            <span style={{ color: 'var(--text-color-secondary)', fontSize: '12px' }}>未打开文件</span>
          )}
        </div>
      </div>

      <div className="status-right">
        {/* 状态栏右侧内容 */}
      </div>
    </div>
  );
};

export default StatusBar;
