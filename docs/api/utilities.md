# 工具函数 API 文档

## 概述

本文档详细介绍了喵咕记事本中的所有工具函数，包括Tauri API封装、路径处理、链接处理等实用工具。

---

## Tauri API 封装 (tauriApi.js)

### 存储初始化

#### initStore - 初始化存储

初始化Tauri Store或使用localStorage作为后备。

```javascript
async function initStore()
```

#### 返回值

| 类型       | 描述     |
|----------|--------|
| `Object` | 存储实例对象 |

#### 使用示例

```javascript
import { initStore } from '@/utils/tauriApi';

// 初始化存储
const store = await initStore();
console.log('存储初始化完成');
```

---

### 文件操作 API

#### fileApi 对象结构

| 方法                     | 描述        | 参数                                                 | 返回值                         |
|------------------------|-----------|----------------------------------------------------|-----------------------------|
| `openDialog`           | 打开文件选择对话框 | `options?`                                         | `Promise<string[]>`         |
| `saveDialog`           | 打开保存文件对话框 | `options?`                                         | `Promise<string>`           |
| `readFile`             | 读取文件内容    | `path: string`                                     | `Promise<FileResult>`       |
| `writeFile`            | 写入文件内容    | `path: string, content: string`                    | `Promise<void>`             |
| `saveFile`             | 保存文件（带编码） | `path: string, content: string, encoding?: string` | `Promise<FileResult>`       |
| `exists`               | 检查文件是否存在  | `path: string`                                     | `Promise<boolean>`          |
| `getInfo`              | 获取文件信息    | `path: string`                                     | `Promise<FileInfo>`         |
| `getDirectoryContents` | 获取目录内容    | `path: string`                                     | `Promise<FileInfo[]>`       |
| `rename`               | 重命名文件     | `oldPath: string, newPath: string`                 | `Promise<FileResult>`       |
| `execute`              | 执行文件      | `path: string`                                     | `Promise<string>`           |
| `openInTerminal`       | 在终端中打开    | `path: string`                                     | `Promise<string>`           |
| `showInExplorer`       | 在文件管理器中显示 | `path: string`                                     | `Promise<string>`           |
| `startWatching`        | 开始文件监控    | `path: string`                                     | `Promise<boolean>`          |
| `stopWatching`         | 停止文件监控    | `path: string`                                     | `Promise<boolean>`          |
| `checkExternalChanges` | 检查外部变化    | `path: string`                                     | `Promise<FileChangeEvent?>` |
| `updateLineEnding`     | 更新行尾格式    | `path: string, ending: string`                     | `Promise<FileResult>`       |

#### 数据类型定义

```javascript
// 文件操作结果
interface FileResult {
  success: boolean;
  message: string;
  content?: string;
  file_path?: string;
  file_name?: string;
  encoding?: string;
  line_ending?: string;
}

// 文件信息
interface FileInfo {
  name: string;
  path: string;
  size: number;
  is_file: boolean;
  is_dir: boolean;
  modified: number;
}

// 文件变化事件
interface FileChangeEvent {
  file_path: string;
  event_type: 'modified' | 'created' | 'deleted';
  timestamp: number;
}
```

#### 使用示例

##### 1. 文件对话框操作

```javascript
import { fileApi } from '@/utils/tauriApi';

// 打开文件选择对话框
async function selectFiles() {
  try {
    const files = await fileApi.openDialog({
      multiple: true,
      filters: [
        { name: '文本文件', extensions: ['txt', 'md'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    console.log('选择的文件:', files);
    return files;
  } catch (error) {
    console.error('选择文件失败:', error);
    throw error;
  }
}

// 保存文件对话框
async function selectSaveLocation() {
  try {
    const savePath = await fileApi.saveDialog({
      defaultPath: 'untitled.txt',
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: 'Markdown文件', extensions: ['md'] }
      ]
    });
    
    console.log('保存路径:', savePath);
    return savePath;
  } catch (error) {
    console.error('选择保存位置失败:', error);
    throw error;
  }
}
```

##### 2. 文件读写操作

```javascript
// 读取文件
async function loadFile(filePath) {
  try {
    const result = await fileApi.readFile(filePath);
    
    if (result.success) {
      return {
        content: result.content,
        encoding: result.encoding,
        lineEnding: result.line_ending,
        fileName: result.file_name
      };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('读取文件失败:', error);
    throw error;
  }
}

// 写入文件
async function saveFileContent(filePath, content) {
  try {
    await fileApi.writeFile(filePath, content);
    console.log('文件保存成功');
  } catch (error) {
    console.error('保存文件失败:', error);
    throw error;
  }
}

// 保存文件（带编码）
async function saveWithEncoding(filePath, content, encoding = 'UTF-8') {
  try {
    const result = await fileApi.saveFile(filePath, content, encoding);
    
    if (result.success) {
      console.log('文件保存成功:', result.message);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('保存文件失败:', error);
    throw error;
  }
}
```

##### 3. 文件信息和目录操作

```javascript
// 检查文件是否存在
async function checkFileExists(filePath) {
  try {
    const exists = await fileApi.exists(filePath);
    return exists;
  } catch (error) {
    console.error('检查文件存在性失败:', error);
    return false;
  }
}

// 获取文件信息
async function getFileDetails(filePath) {
  try {
    const info = await fileApi.getInfo(filePath);
    
    return {
      name: info.name,
      path: info.path,
      size: info.size,
      isFile: info.is_file,
      isDirectory: info.is_dir,
      lastModified: new Date(info.modified * 1000)
    };
  } catch (error) {
    console.error('获取文件信息失败:', error);
    throw error;
  }
}

// 获取目录内容
async function listDirectory(dirPath) {
  try {
    const contents = await fileApi.getDirectoryContents(dirPath);
    
    return contents.map(item => ({
      name: item.name,
      path: item.path,
      size: item.size,
      isFile: item.is_file,
      isDirectory: item.is_dir,
      lastModified: new Date(item.modified * 1000)
    }));
  } catch (error) {
    console.error('获取目录内容失败:', error);
    throw error;
  }
}
```

##### 4. 文件系统操作

```javascript
// 重命名文件
async function renameFile(oldPath, newPath) {
  try {
    const result = await fileApi.rename(oldPath, newPath);
    
    if (result.success) {
      console.log('重命名成功:', result.message);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('重命名失败:', error);
    throw error;
  }
}

// 执行文件
async function runFile(filePath) {
  try {
    const result = await fileApi.execute(filePath);
    console.log('执行结果:', result);
  } catch (error) {
    console.error('执行文件失败:', error);
    throw error;
  }
}

// 在终端中打开
async function openTerminal(path) {
  try {
    const result = await fileApi.openInTerminal(path);
    console.log('终端打开成功:', result);
  } catch (error) {
    console.error('打开终端失败:', error);
    throw error;
  }
}

// 在文件管理器中显示
async function showInFileManager(path) {
  try {
    const result = await fileApi.showInExplorer(path);
    console.log('文件管理器打开成功:', result);
  } catch (error) {
    console.error('打开文件管理器失败:', error);
    throw error;
  }
}
```

##### 5. 文件监控

```javascript
import { listen } from '@tauri-apps/api/event';

// 开始文件监控
async function startFileMonitoring(filePath) {
  try {
    // 开始监控
    const success = await fileApi.startWatching(filePath);
    
    if (success) {
      console.log('文件监控已启动');
      
      // 监听文件变化事件
      const unlisten = await listen('file-changed', (event) => {
        const changeEvent = event.payload;
        handleFileChange(changeEvent);
      });
      
      return unlisten;
    } else {
      throw new Error('启动文件监控失败');
    }
  } catch (error) {
    console.error('启动文件监控失败:', error);
    throw error;
  }
}

// 停止文件监控
async function stopFileMonitoring(filePath) {
  try {
    const success = await fileApi.stopWatching(filePath);
    
    if (success) {
      console.log('文件监控已停止');
    } else {
      console.warn('停止文件监控失败');
    }
  } catch (error) {
    console.error('停止文件监控失败:', error);
    throw error;
  }
}

// 检查文件外部变化
async function checkFileChanges(filePath) {
  try {
    const changeEvent = await fileApi.checkExternalChanges(filePath);
    
    if (changeEvent) {
      return {
        filePath: changeEvent.file_path,
        eventType: changeEvent.event_type,
        timestamp: new Date(changeEvent.timestamp * 1000)
      };
    }
    
    return null;
  } catch (error) {
    console.error('检查文件变化失败:', error);
    throw error;
  }
}

// 处理文件变化
function handleFileChange(changeEvent) {
  const { file_path, event_type, timestamp } = changeEvent;
  
  switch (event_type) {
    case 'modified':
      showNotification(`文件已被外部修改: ${file_path}`);
      break;
    case 'deleted':
      showNotification(`文件已被删除: ${file_path}`);
      break;
    case 'created':
      showNotification(`文件已被创建: ${file_path}`);
      break;
  }
}
```

##### 6. 行尾格式处理

```javascript
// 更新文件行尾格式
async function changeLineEnding(filePath, lineEnding) {
  try {
    const result = await fileApi.updateLineEnding(filePath, lineEnding);
    
    if (result.success) {
      console.log('行尾格式更新成功');
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('更新行尾格式失败:', error);
    throw error;
  }
}

// 支持的行尾格式
const LINE_ENDINGS = {
  LF: 'LF',     // Unix/Linux/macOS
  CRLF: 'CRLF', // Windows
  CR: 'CR'      // 经典Mac OS
};

// 使用示例
changeLineEnding('example.txt', LINE_ENDINGS.LF);
```

---

### 设置管理 API

#### settingsApi 对象结构

| 方法        | 描述       | 参数                                | 返回值                        |
|-----------|----------|-----------------------------------|----------------------------|
| `get`     | 获取设置值    | `key: string, defaultValue?: any` | `Promise<any>`             |
| `set`     | 设置值      | `key: string, value: any`         | `Promise<void>`            |
| `remove`  | 删除设置     | `key: string`                     | `Promise<void>`            |
| `clear`   | 清空所有设置   | -                                 | `Promise<void>`            |
| `has`     | 检查设置是否存在 | `key: string`                     | `Promise<boolean>`         |
| `keys`    | 获取所有设置键  | -                                 | `Promise<string[]>`        |
| `entries` | 获取所有设置条目 | -                                 | `Promise<[string, any][]>` |

#### 使用示例

```javascript
import {settingsApi} from '@/utils/tauriApi';

// 获取设置
async function getThemeSetting() {
    try {
        const theme = await settingsApi.get('theme', 'light');
        console.log('当前主题:', theme);
        return theme;
    } catch (error) {
        console.error('获取主题设置失败:', error);
        return 'light'; // 默认值
    }
}

// 保存设置
async function saveThemeSetting(theme) {
    try {
        await settingsApi.set('theme', theme);
        console.log('主题设置已保存:', theme);
    } catch (error) {
        console.error('保存主题设置失败:', error);
        throw error;
    }
}

// 获取编辑器设置
async function getEditorSettings() {
    try {
        const settings = {
            fontSize: await settingsApi.get('editor.fontSize', 14),
            fontFamily: await settingsApi.get('editor.fontFamily', 'Monaco'),
            tabSize: await settingsApi.get('editor.tabSize', 2),
            wordWrap: await settingsApi.get('editor.wordWrap', true),
            lineNumbers: await settingsApi.get('editor.lineNumbers', true)
        };

        return settings;
    } catch (error) {
        console.error('获取编辑器设置失败:', error);
        throw error;
    }
}

// 保存编辑器设置
async function saveEditorSettings(settings) {
    try {
        await Promise.all([
            settingsApi.set('editor.fontSize', settings.fontSize),
            settingsApi.set('editor.fontFamily', settings.fontFamily),
            settingsApi.set('editor.tabSize', settings.tabSize),
            settingsApi.set('editor.wordWrap', settings.wordWrap),
            settingsApi.set('editor.lineNumbers', settings.lineNumbers)
        ]);

        console.log('编辑器设置已保存');
    } catch (error) {
        console.error('保存编辑器设置失败:', error);
        throw error;
    }
}

// 检查设置是否存在
async function hasCustomSettings() {
    try {
        const hasTheme = await settingsApi.has('theme');
        const hasEditor = await settingsApi.has('editor.fontSize');

        return hasTheme || hasEditor;
    } catch (error) {
        console.error('检查设置失败:', error);
        return false;
    }
}

// 获取所有设置
async function getAllSettings() {
    try {
        const entries = await settingsApi.entries();
        const settings = Object.fromEntries(entries);

        console.log('所有设置:', settings);
        return settings;
    } catch (error) {
        console.error('获取所有设置失败:', error);
        return {};
    }
}

// 重置设置
async function resetSettings() {
    try {
        await settingsApi.clear();
        console.log('设置已重置');
    } catch (error) {
        console.error('重置设置失败:', error);
        throw error;
    }
}
```

---

### 应用程序 API

#### appApi 对象结构

| 方法                      | 描述      | 参数             | 返回值                 |
|-------------------------|---------|----------------|---------------------|
| `greet`                 | 问候函数    | `name: string` | `Promise<string>`   |
| `getCliArgs`            | 获取命令行参数 | -              | `Promise<string[]>` |
| `openUrl`               | 打开URL   | `url: string`  | `Promise<void>`     |
| `enablePreventSleep`    | 启用防休眠   | -              | `Promise<string>`   |
| `disablePreventSleep`   | 禁用防休眠   | -              | `Promise<string>`   |
| `getPreventSleepStatus` | 获取防休眠状态 | -              | `Promise<boolean>`  |

#### 使用示例

```javascript
import { appApi } from '@/utils/tauriApi';

// 问候函数
async function greetUser(userName) {
  try {
    const greeting = await appApi.greet(userName);
    console.log(greeting);
    return greeting;
  } catch (error) {
    console.error('问候失败:', error);
    throw error;
  }
}

// 获取命令行参数
async function handleStartupArgs() {
  try {
    const args = await appApi.getCliArgs();
    
    if (args.length > 0) {
      console.log('启动参数:', args);
      
      // 处理文件参数
      const fileArgs = args.filter(arg => 
        arg.endsWith('.txt') || 
        arg.endsWith('.md') || 
        arg.endsWith('.js')
      );
      
      // 自动打开文件
      for (const filePath of fileArgs) {
        await openFile(filePath);
      }
    }
  } catch (error) {
    console.error('处理启动参数失败:', error);
  }
}

// 打开外部链接
async function openExternalLink(url) {
  try {
    await appApi.openUrl(url);
    console.log('链接已打开:', url);
  } catch (error) {
    console.error('打开链接失败:', error);
    throw error;
  }
}

// 防休眠管理
class SleepManager {
  constructor() {
    this.isEnabled = false;
  }
  
  async enable() {
    try {
      const result = await appApi.enablePreventSleep();
      this.isEnabled = true;
      console.log('防休眠已启用:', result);
    } catch (error) {
      console.error('启用防休眠失败:', error);
      throw error;
    }
  }
  
  async disable() {
    try {
      const result = await appApi.disablePreventSleep();
      this.isEnabled = false;
      console.log('防休眠已禁用:', result);
    } catch (error) {
      console.error('禁用防休眠失败:', error);
      throw error;
    }
  }
  
  async getStatus() {
    try {
      const status = await appApi.getPreventSleepStatus();
      this.isEnabled = status;
      return status;
    } catch (error) {
      console.error('获取防休眠状态失败:', error);
      return false;
    }
  }
  
  async toggle() {
    const currentStatus = await this.getStatus();
    
    if (currentStatus) {
      await this.disable();
    } else {
      await this.enable();
    }
    
    return !currentStatus;
  }
}

// 使用示例
const sleepManager = new SleepManager();

// 在长时间操作前启用防休眠
async function startLongOperation() {
  await sleepManager.enable();
  
  try {
    // 执行长时间操作
    await performLongTask();
  } finally {
    // 操作完成后禁用防休眠
    await sleepManager.disable();
  }
}
```

---

## 路径处理工具 (pathUtils.js)

### splitPath - 分割路径

将文件路径分割为各个组成部分。

#### 函数签名

```javascript
function splitPath(filePath)
```

#### 参数

| 参数         | 类型       | 必需 | 描述       |
|------------|----------|----|----------|
| `filePath` | `string` | ✅  | 要分割的文件路径 |

#### 返回值

| 字段          | 类型         | 描述         |
|-------------|------------|------------|
| `directory` | `string`   | 目录路径       |
| `fileName`  | `string`   | 文件名（含扩展名）  |
| `baseName`  | `string`   | 文件名（不含扩展名） |
| `extension` | `string`   | 文件扩展名      |
| `segments`  | `string[]` | 路径段数组      |

#### 使用示例

```javascript
import { splitPath } from '@/utils/pathUtils';

// Windows路径
const windowsPath = 'C:\\Users\\Documents\\example.txt';
const winResult = splitPath(windowsPath);
console.log(winResult);
// {
//   directory: 'C:\\Users\\Documents',
//   fileName: 'example.txt',
//   baseName: 'example',
//   extension: '.txt',
//   segments: ['C:', 'Users', 'Documents', 'example.txt']
// }

// Unix路径
const unixPath = '/home/user/documents/readme.md';
const unixResult = splitPath(unixPath);
console.log(unixResult);
// {
//   directory: '/home/user/documents',
//   fileName: 'readme.md',
//   baseName: 'readme',
//   extension: '.md',
//   segments: ['home', 'user', 'documents', 'readme.md']
// }

// 实际应用示例
function getFileTypeIcon(filePath) {
  const { extension } = splitPath(filePath);
  
  switch (extension.toLowerCase()) {
    case '.txt':
      return 'text-icon';
    case '.md':
      return 'markdown-icon';
    case '.js':
      return 'javascript-icon';
    case '.json':
      return 'json-icon';
    default:
      return 'file-icon';
  }
}

function generateBackupFileName(originalPath) {
  const { directory, baseName, extension } = splitPath(originalPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return buildFullPath(directory, `${baseName}_backup_${timestamp}${extension}`);
}
```

---

### buildFullPath - 构建完整路径

将目录和文件名组合成完整路径。

#### 函数签名

```javascript
function buildFullPath(directory, fileName)
```

#### 参数

| 参数          | 类型       | 必需 | 描述   |
|-------------|----------|----|------|
| `directory` | `string` | ✅  | 目录路径 |
| `fileName`  | `string` | ✅  | 文件名  |

#### 返回值

| 类型       | 描述      |
|----------|---------|
| `string` | 完整的文件路径 |

#### 使用示例

```javascript
import { buildFullPath } from '@/utils/pathUtils';

// Windows路径构建
const winDir = 'C:\\Users\\Documents';
const winFile = 'example.txt';
const winPath = buildFullPath(winDir, winFile);
console.log(winPath); // 'C:\\Users\\Documents\\example.txt'

// Unix路径构建
const unixDir = '/home/user/documents';
const unixFile = 'readme.md';
const unixPath = buildFullPath(unixDir, unixFile);
console.log(unixPath); // '/home/user/documents/readme.md'

// 实际应用示例
function createTempFile(originalPath, suffix = '.tmp') {
  const { directory, baseName } = splitPath(originalPath);
  const tempFileName = `${baseName}_${Date.now()}${suffix}`;
  
  return buildFullPath(directory, tempFileName);
}

function moveFileToBackupFolder(filePath, backupDir) {
  const { fileName } = splitPath(filePath);
  return buildFullPath(backupDir, fileName);
}

// 批量文件操作
function processFiles(directory, fileNames, processor) {
  return fileNames.map(fileName => {
    const fullPath = buildFullPath(directory, fileName);
    return processor(fullPath);
  });
}

// 使用示例
const files = ['file1.txt', 'file2.md', 'file3.js'];
const results = processFiles('/project/src', files, (path) => {
  return {
    path,
    size: getFileSize(path),
    type: getFileType(path)
  };
});
```

---

### 路径工具组合使用

```javascript
import { splitPath, buildFullPath } from '@/utils/pathUtils';

// 文件重命名工具
function renameFile(originalPath, newBaseName) {
  const { directory, extension } = splitPath(originalPath);
  return buildFullPath(directory, `${newBaseName}${extension}`);
}

// 文件复制工具
function createCopyPath(originalPath, copyNumber = 1) {
  const { directory, baseName, extension } = splitPath(originalPath);
  const copyName = `${baseName} (${copyNumber})${extension}`;
  return buildFullPath(directory, copyName);
}

// 相对路径转换
function getRelativePath(fullPath, basePath) {
  const fullSegments = splitPath(fullPath).segments;
  const baseSegments = splitPath(basePath).segments;
  
  // 找到共同前缀
  let commonLength = 0;
  while (
    commonLength < Math.min(fullSegments.length, baseSegments.length) &&
    fullSegments[commonLength] === baseSegments[commonLength]
  ) {
    commonLength++;
  }
  
  // 构建相对路径
  const upLevels = baseSegments.length - commonLength;
  const downPath = fullSegments.slice(commonLength);
  
  const relativeParts = [
    ...Array(upLevels).fill('..'),
    ...downPath
  ];
  
  return relativeParts.join('/');
}

// 路径验证
function isValidPath(path) {
  try {
    const { directory, fileName } = splitPath(path);
    
    // 检查路径格式
    if (!directory || !fileName) {
      return false;
    }
    
    // 检查非法字符
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(fileName)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// 使用示例
console.log(renameFile('/path/to/old.txt', 'new')); // '/path/to/new.txt'
console.log(createCopyPath('/path/to/file.txt', 2)); // '/path/to/file (2).txt'
console.log(getRelativePath('/a/b/c/d.txt', '/a/b')); // 'c/d.txt'
console.log(isValidPath('/valid/path.txt')); // true
console.log(isValidPath('/invalid/path<>.txt')); // false
```

---

## 链接处理工具 (linkUtils.js)

### isExternalLink - 检查外部链接

检查给定的URL是否为外部链接。

#### 函数签名

```javascript
function isExternalLink(url)
```

#### 参数

| 参数    | 类型       | 必需 | 描述      |
|-------|----------|----|---------|
| `url` | `string` | ✅  | 要检查的URL |

#### 返回值

| 类型        | 描述      |
|-----------|---------|
| `boolean` | 是否为外部链接 |

#### 支持的协议

| 协议         | 描述      | 示例                        |
|------------|---------|---------------------------|
| `http://`  | HTTP协议  | `http://example.com`      |
| `https://` | HTTPS协议 | `https://example.com`     |
| `ftp://`   | FTP协议   | `ftp://files.example.com` |
| `mailto:`  | 邮件协议    | `mailto:user@example.com` |
| `tel:`     | 电话协议    | `tel:+1234567890`         |

#### 使用示例

```javascript
import { isExternalLink } from '@/utils/linkUtils';

// 测试各种链接类型
const links = [
  'https://github.com/miaogu-notepad',  // true - 外部HTTPS链接
  'http://example.com',                 // true - 外部HTTP链接
  'ftp://files.example.com',           // true - FTP链接
  'mailto:contact@example.com',        // true - 邮件链接
  'tel:+1234567890',                   // true - 电话链接
  '/local/path/file.txt',              // false - 本地路径
  'file.md',                           // false - 相对路径
  '#section',                          // false - 锚点链接
  'javascript:alert("test")'           // false - JavaScript协议
];

links.forEach(link => {
  console.log(`${link}: ${isExternalLink(link)}`);
});

// 实际应用示例
function handleLinkClick(url) {
  if (isExternalLink(url)) {
    // 外部链接 - 在浏览器中打开
    openExternalUrl(url);
  } else {
    // 本地链接 - 在应用内处理
    navigateToLocalPath(url);
  }
}

// 链接安全检查
function isSafeExternalLink(url) {
  if (!isExternalLink(url)) {
    return true; // 本地链接认为是安全的
  }
  
  // 检查是否为安全协议
  const safeProtocols = ['https:', 'http:', 'mailto:', 'tel:'];
  try {
    const urlObj = new URL(url);
    return safeProtocols.includes(urlObj.protocol);
  } catch (error) {
    return false;
  }
}

// Markdown链接处理
function processMarkdownLinks(content) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  return content.replace(linkRegex, (match, text, url) => {
    if (isExternalLink(url)) {
      // 外部链接添加target="_blank"
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    } else {
      // 本地链接
      return `<a href="${url}" class="local-link">${text}</a>`;
    }
  });
}
```

---

### checkLocalFile - 检查本地文件

检查本地文件路径是否有效。

#### 函数签名

```javascript
async function checkLocalFile(filePath)
```

#### 参数

| 参数         | 类型       | 必需 | 描述       |
|------------|----------|----|----------|
| `filePath` | `string` | ✅  | 要检查的文件路径 |

#### 返回值

| 字段            | 类型        | 描述     |
|---------------|-----------|--------|
| `exists`      | `boolean` | 文件是否存在 |
| `isFile`      | `boolean` | 是否为文件  |
| `isDirectory` | `boolean` | 是否为目录  |
| `accessible`  | `boolean` | 是否可访问  |

#### 使用示例

```javascript
import {checkLocalFile} from '@/utils/linkUtils';

// 检查单个文件
async function validateFile(filePath) {
    try {
        const result = await checkLocalFile(filePath);

        if (result.exists) {
            if (result.isFile) {
                console.log('文件存在且可访问');
                return true;
            } else if (result.isDirectory) {
                console.log('路径是一个目录');
                return false;
            }
        } else {
            console.log('文件不存在');
            return false;
        }
    } catch (error) {
        console.error('检查文件失败:', error);
        return false;
    }
}

// 批量检查文件
async function validateMultipleFiles(filePaths) {
    const results = await Promise.all(
        filePaths.map(async (path) => {
            const result = await checkLocalFile(path);
            return {
                path,
                valid: result.exists && result.isFile,
                ...result
            };
        })
    );

    return results;
}

// 文件链接验证器
class FileLinkValidator {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5000; // 5秒缓存
    }

    async validate(filePath) {
        // 检查缓存
        const cached = this.cache.get(filePath);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.result;
        }

        // 执行检查
        const result = await checkLocalFile(filePath);

        // 缓存结果
        this.cache.set(filePath, {
            result,
            timestamp: Date.now()
        });

        return result;
    }

    clearCache() {
        this.cache.clear();
    }
}

// 使用示例
const validator = new FileLinkValidator();

async function handleFileLink(filePath) {
    const result = await validator.validate(filePath);

    if (result.exists && result.isFile) {
        // 打开文件
        await openFile(filePath);
    } else if (result.exists && result.isDirectory) {
        // 打开目录
        await openDirectory(filePath);
    } else {
        // 显示错误
        showError(`文件不存在: ${filePath}`);
    }
}
```

---

### 链接工具组合使用

```javascript
import { isExternalLink, checkLocalFile } from '@/utils/linkUtils';
import { appApi } from '@/utils/tauriApi';

// 通用链接处理器
class LinkHandler {
  constructor() {
    this.fileValidator = new FileLinkValidator();
  }
  
  async handleLink(url, options = {}) {
    const { openInNewWindow = false, showConfirmation = true } = options;
    
    try {
      if (isExternalLink(url)) {
        return await this.handleExternalLink(url, { showConfirmation });
      } else {
        return await this.handleLocalLink(url, { openInNewWindow });
      }
    } catch (error) {
      console.error('处理链接失败:', error);
      throw error;
    }
  }
  
  async handleExternalLink(url, { showConfirmation = true } = {}) {
    if (showConfirmation) {
      const confirmed = await showConfirmDialog(
        '打开外部链接',
        `是否要在浏览器中打开: ${url}?`
      );
      
      if (!confirmed) {
        return false;
      }
    }
    
    await appApi.openUrl(url);
    return true;
  }
  
  async handleLocalLink(filePath, { openInNewWindow = false } = {}) {
    const result = await this.fileValidator.validate(filePath);
    
    if (!result.exists) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    if (result.isFile) {
      if (openInNewWindow) {
        await openFileInNewWindow(filePath);
      } else {
        await openFile(filePath);
      }
    } else if (result.isDirectory) {
      await openDirectory(filePath);
    }
    
    return true;
  }
}

// Markdown链接处理
function createMarkdownLinkHandler(linkHandler) {
  return function processMarkdownContent(content) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    return content.replace(linkRegex, (match, text, url) => {
      const isExternal = isExternalLink(url);
      const className = isExternal ? 'external-link' : 'local-link';
      const icon = isExternal ? '🔗' : '📄';
      
      return `<a href="${url}" class="${className}" data-url="${url}">
        ${text} ${icon}
      </a>`;
    });
  };
}

// 使用示例
const linkHandler = new LinkHandler();
const processMarkdown = createMarkdownLinkHandler(linkHandler);

// 处理点击事件
document.addEventListener('click', async (event) => {
  if (event.target.tagName === 'A' && event.target.dataset.url) {
    event.preventDefault();
    
    const url = event.target.dataset.url;
    const isExternal = event.target.classList.contains('external-link');
    
    try {
      await linkHandler.handleLink(url, {
        openInNewWindow: event.ctrlKey || event.metaKey,
        showConfirmation: isExternal
      });
    } catch (error) {
      showError(`无法打开链接: ${error.message}`);
    }
  }
});

// 链接预览功能
async function createLinkPreview(url) {
  if (isExternalLink(url)) {
    return {
      type: 'external',
      url,
      title: '外部链接',
      description: '将在浏览器中打开'
    };
  } else {
    const result = await checkLocalFile(url);
    
    if (result.exists) {
      const { fileName, extension } = splitPath(url);
      
      return {
        type: 'local',
        url,
        title: fileName,
        description: result.isFile ? `文件 (${extension})` : '目录',
        exists: true
      };
    } else {
      return {
        type: 'local',
        url,
        title: '文件不存在',
        description: '路径无效',
        exists: false
      };
    }
  }
}
```

---

## 性能优化建议

### 1. 缓存机制

```javascript
// 文件信息缓存
class FileInfoCache {
    constructor(maxSize = 100, ttl = 30000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    get(key) {
        const item = this.cache.get(key);

        if (!item) return null;

        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    set(key, data) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clear() {
        this.cache.clear();
    }
}

// 使用缓存的文件API
const fileInfoCache = new FileInfoCache();

async function getCachedFileInfo(filePath) {
    let info = fileInfoCache.get(filePath);

    if (!info) {
        info = await fileApi.getInfo(filePath);
        fileInfoCache.set(filePath, info);
    }

    return info;
}
```

### 2. 防抖和节流

```javascript
// 防抖保存
function createDebouncedSave(delay = 1000) {
  let timeoutId;
  
  return function debouncedSave(filePath, content) {
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(async () => {
      try {
        await fileApi.writeFile(filePath, content);
        console.log('文件已自动保存');
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, delay);
  };
}

// 节流文件监控
function createThrottledFileCheck(interval = 5000) {
  let lastCheck = 0;
  
  return async function throttledCheck(filePath) {
    const now = Date.now();
    
    if (now - lastCheck < interval) {
      return null;
    }
    
    lastCheck = now;
    return await fileApi.checkExternalChanges(filePath);
  };
}

// 使用示例
const debouncedSave = createDebouncedSave(2000);
const throttledCheck = createThrottledFileCheck(3000);

// 在编辑器中使用
function onContentChange(filePath, content) {
  debouncedSave(filePath, content);
}

setInterval(async () => {
  const change = await throttledCheck(currentFilePath);
  if (change) {
    handleFileChange(change);
  }
}, 1000);
```

### 3. 批量操作

```javascript
// 批量文件操作
async function batchFileOperation(operations, concurrency = 3) {
  const results = [];
  
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
  }
  
  return results;
}

// 使用示例
const operations = files.map(file => 
  fileApi.readFile(file.path)
);

const results = await batchFileOperation(operations, 5);
```

---

## 错误处理最佳实践

### 统一错误处理

```javascript
// 错误类型定义
class FileError extends Error {
  constructor(message, code, filePath) {
    super(message);
    this.name = 'FileError';
    this.code = code;
    this.filePath = filePath;
  }
}

// 错误处理包装器
function withErrorHandling(apiFunction) {
  return async function(...args) {
    try {
      return await apiFunction(...args);
    } catch (error) {
      console.error(`API调用失败:`, error);
      
      // 转换为统一错误格式
      if (error.includes && error.includes('FileNotFound')) {
        throw new FileError('文件不存在', 'FILE_NOT_FOUND', args[0]);
      } else if (error.includes && error.includes('PermissionDenied')) {
        throw new FileError('权限不足', 'PERMISSION_DENIED', args[0]);
      } else {
        throw new FileError('操作失败', 'UNKNOWN_ERROR', args[0]);
      }
    }
  };
}

// 包装API函数
const safeFileApi = {
  readFile: withErrorHandling(fileApi.readFile),
  writeFile: withErrorHandling(fileApi.writeFile),
  getInfo: withErrorHandling(fileApi.getInfo)
};
```

---

## 注意事项

1. **异步操作**: 所有文件操作都是异步的，需要正确处理Promise
2. **路径格式**: 注意不同操作系统的路径分隔符差异
3. **编码处理**: 文件编码检测可能不准确，建议提供手动选择选项
4. **权限检查**: 确保应用有足够权限访问目标文件和目录
5. **错误恢复**: 实现适当的错误恢复和重试机制
6. **内存管理**: 大文件操作时注意内存使用
7. **缓存策略**: 合理使用缓存提高性能，但要注意缓存失效
8. **用户体验**: 长时间操作应显示进度指示器

---

*本文档基于 miaogu-notepad v1.3.0 版本编写*
