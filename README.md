# 喵咕记事本 (Miaogu Notepad)

![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri) ![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react) ![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-0.52.2-007ACC?logo=visualstudiocode) ![Vite](https://img.shields.io/badge/Vite-6.2.4-646CFF?logo=vite) ![Ant Design](https://img.shields.io/badge/Ant_Design-5.10.0-0170FE?logo=antdesign)

**喵咕记事本** 是一款基于 Tauri + React + Monaco Editor 构建的超轻量化代码高亮记事本。结合了桌面应用的性能优势和现代 Web 技术的灵活性，提供简洁、流畅的文本编辑体验。

>  ⚡**Tauri 轻量化优势**：基于 Rust + 系统 WebView 架构，打包生成 **单个 exe 文件**，体积 **< 16MB**
>
>  **为什么 Tauri 能生成单个 exe 文件？**
> 1. **静态编译**：Rust 将所有依赖编译成单个二进制文件
> 2. **系统 WebView**：复用操作系统内置的浏览器引擎，无需打包
> 3. **资源嵌入**：前端资源直接嵌入到 Rust 二进制中
> 4. **零运行时**：无需额外的运行时环境（如 Node.js、.NET）

## 🚀 核心特性

- **代码高亮**：基于 Monaco Editor 的专业级语法高亮，支持多种编程语言
- **智能补全**：提供上下文感知的代码补全和建议
- **多标签页**：支持同时编辑多个文件，便捷的标签页管理
- **文件管理**：完整的文件操作支持（新建、打开、保存、重命名等）
- **主题切换**：内置明暗主题，适配不同使用场景
- **单文件部署**：打包生成单个 exe 文件，无需安装，即下即用
- **极致轻量**：应用体积仅 **< 16MB**，相比 Electron 应用减少 90%+ 体积
- **零依赖运行**：无需预装 Node.js、.NET Framework 等运行时环境

## 📸 页面截图展示

| 浅色模式                      | 深色模式                     |
| ----------------------------- | ---------------------------- |
| ![浅色](images/theme_light.png) | ![深色](images/theme_dark.png) |

## 🛠 技术架构

| 层级               | 技术组件                           |
| ------------------ | ---------------------------------- |
| **桌面层**   | Tauri (Rust)                       |
| **前端层**   | React + Ant Design + Monaco Editor |
| **状态管理** | Redux Toolkit + Redux Persist      |
| **文件系统** | Tauri File System API              |
| **构建工具** | Vite + Tauri CLI                   |
| **样式处理** | Sass + CSS Modules                 |

## 📂 项目结构

```
miaogu-notepad/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   │   ├── AppHeader.jsx   # 应用头部（菜单栏）
│   │   ├── TabBar.jsx      # 标签页管理
│   │   ├── CodeEditor.jsx  # Monaco 编辑器
│   │   ├── EditorStatusBar.jsx # 状态栏
│   │   └── SettingsModal.jsx   # 设置弹窗
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useFileManager.js   # 文件管理逻辑
│   │   ├── useSessionRestore.js # 会话恢复
│   │   └── redux.js        # Redux 相关 Hooks
│   ├── store/              # Redux 状态管理
│   ├── utils/              # 工具函数
│   │   └── tauriApi.js     # Tauri API 封装
│   ├── App.jsx             # 主应用组件
│   └── main.jsx            # 应用入口
├── src-tauri/              # Tauri 后端（Rust）
│   ├── src/                # Rust 源码
│   ├── icons/              # 应用图标
│   ├── Cargo.toml          # Rust 依赖配置
│   └── tauri.conf.json     # Tauri 配置
├── public/                 # 静态资源
├── package.json            # Node.js 依赖
└── vite.config.js          # Vite 构建配置
```

## 🛠️ 开发准备

### 环境要求

- **Node.js** ≥ 18.0 (前端构建)
- **Rust** ≥ 1.70 (后端编译)
- **系统 WebView**：
  - Windows: WebView2 (Win10+ 自带)
  - macOS: WebKit (系统自带)
  - Linux: WebKitGTK
- **系统要求**：Windows 10+, macOS 10.15+, 或现代 Linux 发行版

### Tauri 单文件打包原理

**为什么 Tauri 能生成单个 exe 文件？**

1. **静态编译**：Rust 将所有依赖编译成单个二进制文件
2. **系统 WebView**：复用操作系统内置的浏览器引擎，无需打包
3. **资源嵌入**：前端资源直接嵌入到 Rust 二进制中
4. **零运行时**：无需额外的运行时环境（如 Node.js、.NET）

### 安装 Rust 和 Tauri CLI

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
cargo install tauri-cli
```

### 启动开发环境

```bash
# 克隆项目
git clone <repository-url>
cd miaogu-notepad

# 安装前端依赖
npm install

# 启动开发模式（同时启动前端和 Tauri）
npm run tauri:dev

# 或者分别启动
npm run dev          # 启动前端开发服务器
npm run tauri dev    # 启动 Tauri 开发模式
```

### 构建打包

```bash
# 构建生产版本
npm run tauri:build

# 构建结果将在 src-tauri/target/release/bundle/ 目录下
```

## 🎯 主要功能

### 文件操作

- 新建文件 (`Ctrl+N`)
- 打开文件 (`Ctrl+O`)
- 保存文件 (`Ctrl+S`)
- 另存为 (`Ctrl+Shift+S`)
- 文件重命名（双击标签页标题）

### 编辑功能

- 语法高亮（支持 JavaScript、TypeScript、HTML、CSS、JSON、Markdown 等）
- 代码折叠
- 自动缩进
- 括号匹配
- 多光标编辑
- 查找替换 (`Ctrl+F`, `Ctrl+H`)

### 界面特性

- 多标签页管理
- 明暗主题切换
- 响应式布局
- 状态栏信息显示（行列号、文件类型、编码等）

## 🔧 配置说明

应用设置通过 Tauri Store 插件持久化存储，包括：

- **主题设置**：明暗模式切换
- **编辑器配置**：字体大小、主题、自动保存等
- **会话管理**：自动恢复上次打开的文件

## 🤝 贡献指南

欢迎通过 GitHub 提交 PR：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/你的特性名称`)
3. 提交你的代码 (`git commit -m 'feat: 添加了某某特性'`)
4. 推送到远端分支 (`git push origin feature/你的特性名称`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Tauri](https://tauri.app/) - 现代桌面应用框架
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - VS Code 同款编辑器
- [React](https://reactjs.org/) - 用户界面库
- [Ant Design](https://ant.design/) - 企业级 UI 设计语言

---

**喵咕记事本** - 让代码编辑更简单、更高效！ ✨
