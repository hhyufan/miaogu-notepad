# Miaogu Notepad

**Language / 语言**: [中文](README.md) | English

![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri) ![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react) ![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-0.52.2-007ACC?logo=visualstudiocode) ![Vite](https://img.shields.io/badge/Vite-6.2.4-646CFF?logo=vite)![Ant Design](https://img.shields.io/badge/Ant_Design-5.10.0-0170FE?logo=antdesign)

**Miaogu Notepad** is an ultra-lightweight code-highlighted notepad built with Tauri + React + Monaco Editor. It combines the performance advantages of desktop applications with the flexibility of modern web technologies, providing a clean and smooth text editing experience.

> ⚡**Tauri Lightweight Advantage**: Based on Rust + System WebView architecture, packaged as a **single exe file**, size **< 16MB**
>
> **Why can Tauri generate a single exe file?**
>
> 1. **Static Compilation**: Rust compiles all dependencies into a single binary file
> 2. **System WebView**: Reuses the operating system's built-in browser engine, no need to package
> 3. **Resource Embedding**: Frontend resources are directly embedded into the Rust binary
> 4. **Zero Runtime**: No additional runtime environment required (such as Node.js, .NET)

## 🚀 Core Features

- **Code Highlighting**: Professional-grade syntax highlighting based on Monaco Editor, supporting multiple programming languages
- **Smart Completion**: Context-aware code completion and suggestions
- **Multi-tab Support**: Edit multiple files simultaneously with convenient tab management
- **File Management**: Complete file operation support (new, open, save, rename, etc.)
- **Theme Switching**: Built-in light/dark themes, adapting to different usage scenarios
- **Single File Deployment**: Packaged as a single exe file, no installation required, download and use
- **Ultra Lightweight**: Application size only **< 16MB**, 90%+ size reduction compared to Electron apps
- **Zero Dependency Runtime**: No need to pre-install Node.js, .NET Framework, or other runtime environments

## 📸 Screenshots

| Light Mode                        | Dark Mode                       |
| --------------------------------- | ------------------------------- |
| ![Light](images/theme_light_en.png) | ![Dark](images/theme_dark_en.png) |

## 🛠 Technical Architecture

| Layer                      | Technology Components              |
| -------------------------- | ---------------------------------- |
| **Desktop Layer**    | Tauri (Rust)                       |
| **Frontend Layer**   | React + Ant Design + Monaco Editor |
| **State Management** | Redux Toolkit + Redux Persist      |
| **File System**      | Tauri File System API              |
| **Build Tools**      | Vite + Tauri CLI                   |
| **Style Processing** | Sass + CSS Modules                 |

## 📂 Project Structure

```
miaogu-notepad/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   │   ├── AppHeader.jsx   # App header (menu bar)
│   │   ├── TabBar.jsx      # Tab management
│   │   ├── CodeEditor.jsx  # Monaco editor
│   │   ├── EditorStatusBar.jsx # Status bar
│   │   └── SettingsModal.jsx   # Settings modal
│   ├── hooks/              # Custom Hooks
│   │   ├── useFileManager.js   # File management logic
│   │   ├── useSessionRestore.js # Session restore
│   │   └── redux.js        # Redux related Hooks
│   ├── store/              # Redux state management
│   ├── utils/              # Utility functions
│   │   └── tauriApi.js     # Tauri API wrapper
│   ├── App.jsx             # Main app component
│   └── main.jsx            # App entry point
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/                # Rust source code
│   ├── icons/              # App icons
│   ├── Cargo.toml          # Rust dependency config
│   └── tauri.conf.json     # Tauri configuration
├── public/                 # Static assets
├── package.json            # Node.js dependencies
└── vite.config.js          # Vite build config
```

## 🛠️ Development Setup

### Requirements

- **Node.js** ≥ 18.0 (frontend build)
- **Rust** ≥ 1.70 (backend compilation)
- **System WebView**:
  - Windows: WebView2 (built-in on Win10+)
  - macOS: WebKit (system built-in)
  - Linux: WebKitGTK
- **System Requirements**: Windows 10+, macOS 10.15+, or modern Linux distributions

### Tauri Single File Packaging Principle

**Why can Tauri generate a single exe file?**

1. **Static Compilation**: Rust compiles all dependencies into a single binary file
2. **System WebView**: Reuses the operating system's built-in browser engine, no need to package
3. **Resource Embedding**: Frontend resources are directly embedded into the Rust binary
4. **Zero Runtime**: No additional runtime environment required (such as Node.js, .NET)

### Install Rust and Tauri CLI

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli
```

### Start Development Environment

```bash
# Clone project
git clone <repository-url>
cd miaogu-notepad

# Install frontend dependencies
npm install

# Start development mode (starts both frontend and Tauri)
npm run tauri:dev

# Or start separately
npm run dev          # Start frontend dev server
npm run tauri dev    # Start Tauri development mode
```

### Build and Package

```bash
# Build production version
npm run tauri:build

# Build results will be in src-tauri/target/release/bundle/ directory
```

## 🎯 Main Features

### File Operations

- New file (`Ctrl+N`)
- Open file (`Ctrl+O`)
- Save file (`Ctrl+S`)
- Save as (`Ctrl+Shift+S`)
- File rename (double-click tab title)

### Editing Features

- Syntax highlighting (supports JavaScript, TypeScript, HTML, CSS, JSON, Markdown, etc.)
- Code folding
- Auto indentation
- Bracket matching
- Multi-cursor editing
- Find and replace (`Ctrl+F`, `Ctrl+H`)

### Interface Features

- Multi-tab management
- Light/dark theme switching
- Responsive layout
- Status bar information display (line/column numbers, file type, encoding, etc.)

## 🔧 Configuration

Application settings are persistently stored via Tauri Store plugin, including:

- **Theme Settings**: Light/dark mode switching
- **Editor Configuration**: Font size, theme, auto-save, etc.
- **Session Management**: Automatically restore last opened files

## 🤝 Contributing

Welcome to submit PRs via GitHub:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Commit your code (`git commit -m 'feat: add some feature'`)
4. Push to the remote branch (`git push origin feature/your-feature-name`)
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Modern desktop app framework
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - VS Code's editor
- [React](https://reactjs.org/) - User interface library
- [Ant Design](https://ant.design/) - Enterprise-class UI design language

---

**Miaogu Notepad** - Making code editing simpler and more efficient! ✨
