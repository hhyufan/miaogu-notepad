# 主题系统实现文档

## 概述

本文档详细介绍了喵咕记事本应用的主题系统实现，包括主题切换机制、CSS变量管理、背景图片配置、Monaco编辑器主题集成等核心功能。

## 核心架构

### 技术栈
- **状态管理**: Redux Toolkit + React Hooks
- **样式系统**: SCSS + CSS Variables
- **持久化**: Tauri Settings API
- **编辑器主题**: Monaco Editor + Shiki
- **UI组件**: Ant Design

### 组件架构
```
主题系统
├── themeSlice.js          # Redux状态管理
├── useTheme.js            # React Hook封装
├── App.scss               # 全局CSS变量定义
├── SettingsModal.jsx      # 主题设置UI
├── App.jsx                # 主题切换逻辑
└── 各组件.scss            # 组件级主题样式
```

## 技术实现

### 1. 状态管理 (themeSlice.js)

#### Redux Slice定义
```javascript
const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    theme: 'light',                    // 主题模式: 'light' | 'dark'
    fontSize: 14,                      // 字体大小
    fontFamily: 'Consolas, Monaco, monospace', // 字体族
    lineHeight: 1.5,                   // 行高
    backgroundImage: '',               // 背景图片路径
    backgroundEnabled: false,          // 背景图片启用状态
    backgroundTransparency: {          // 背景透明度配置
      dark: 80,                        // 暗色主题透明度
      light: 80                        // 亮色主题透明度
    }
  },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setFontFamily: (state, action) => {
      state.fontFamily = action.payload;
    },
    setLineHeight: (state, action) => {
      state.lineHeight = action.payload;
    },
    setBackgroundImage: (state, action) => {
      state.backgroundImage = action.payload;
    },
    setBackgroundEnabled: (state, action) => {
      state.backgroundEnabled = action.payload;
    },
    setBackgroundTransparency: (state, action) => {
      const { mode, value } = action.payload;
      state.backgroundTransparency[mode] = value;
    },
    resetTheme: (state) => {
      // 重置所有主题设置到默认值
      return initialState;
    }
  }
});
```

### 2. React Hook封装 (useTheme.js)

#### 主题状态管理
```javascript
export const useTheme = () => {
  const theme = useSelector(state => state.theme.theme);
  const isDarkMode = theme === 'dark';
  
  // 同步DOM属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    
    // 兼容性类名设置
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-theme');
    }
  }, [theme, isDarkMode]);

  return {
    isDarkMode,
    theme,
    // ... 其他主题相关状态和方法
  };
};
```

### 3. CSS变量系统 (App.scss)

#### 亮色主题变量定义
```scss
:root {
  /* 基础色彩 */
  --primary-color: #1677ff;
  --primary-color-rgb: 22, 119, 255;
  --primary-hover: #4096ff;
  
  /* 背景色系 */
  --background-color: #f7f7f7;
  --background-primary: #ffffff;
  --background-secondary: #f5f5f5;
  --background-tertiary: #fafafa;
  
  /* 文本色系 */
  --text-color: #333333;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  
  /* 边框和状态色 */
  --border-color: #e8e8e8;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  
  /* 编辑器背景 */
  --editor-background-light: rgba(255, 255, 255, 0.5);
  --editor-background-dark: rgba(0, 0, 0, 0.5);
  --editor-background: var(--editor-background-light);
  --editor-background-image: none;
  
  /* 滚动条样式 */
  --scrollbar-track-color: rgba(0, 0, 0, 0.08);
  --scrollbar-thumb-color: rgba(0, 0, 0, 0.25);
  --scrollbar-thumb-hover-color: rgba(0, 0, 0, 0.4);
}
```

#### 暗色主题变量覆盖
```scss
[data-theme='dark'] {
  /* 基础色彩调整 */
  --primary-color: #177ddc;
  --primary-color-rgb: 23, 125, 220;
  --primary-hover: #1668dc;
  
  /* 背景色系 */
  --background-color: #292c33;
  --background-primary: #1f1f1f;
  --background-secondary: #262626;
  --background-tertiary: #303030;
  
  /* 文本色系 */
  --text-color: #f0f0f0;
  --text-primary: #f0f0f0;
  --text-secondary: #a0a0a0;
  --text-tertiary: #888888;
  
  /* 边框和状态色 */
  --border-color: #303030;
  --success-color: #49aa19;
  --warning-color: #d89614;
  --error-color: #a61d24;
  
  /* 编辑器背景 */
  --editor-background: var(--editor-background-dark);
  
  /* 滚动条样式 */
  --scrollbar-track-color: rgba(255, 255, 255, 0.1);
  --scrollbar-thumb-color: rgba(255, 255, 255, 0.3);
  --scrollbar-thumb-hover-color: rgba(255, 255, 255, 0.5);
}
```

### 4. 主题切换逻辑 (App.jsx)

#### 主题切换函数
```javascript
const toggleTheme = useCallback(async () => {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}, [currentTheme, setTheme]);

// 主题变化时同步DOM和背景设置
useEffect(() => {
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  // 更新背景透明度变量
  const updateBackgroundForTheme = () => {
    const state = store.getState();
    const { backgroundEnabled, backgroundTransparency, backgroundImage } = state.theme;
    
    if (backgroundEnabled && backgroundImage) {
      const darkTransparency = backgroundTransparency.dark / 100;
      const lightTransparency = backgroundTransparency.light / 100;
      
      const lightOpacity = `rgba(255, 255, 255, ${lightTransparency})`;
      const darkOpacity = `rgba(0, 0, 0, ${darkTransparency})`;
      
      document.documentElement.style.setProperty('--editor-background-light', lightOpacity);
      document.documentElement.style.setProperty('--editor-background-dark', darkOpacity);
    }
  };
  
  updateBackgroundForTheme();
}, [currentTheme]);
```

### 5. 设置界面 (SettingsModal.jsx)

#### 主题选择器
```javascript
const renderGeneralSettings = () => (
  <Card size="small" title={t('settings.general.theme.title')}>
    <div className="setting-item">
      <Text>{t('settings.general.theme.mode')}</Text>
      <Select
        value={theme}
        onChange={(value) => setTheme(value)}
        style={{ width: 120 }}
      >
        <Option value="light">{t('settings.general.theme.light')}</Option>
        <Option value="dark">{t('settings.general.theme.dark')}</Option>
      </Select>
    </div>
  </Card>
);
```

#### 背景图片配置
```javascript
const updateLocalSetting = useCallback(async (key, value) => {
  setLocalSettings(prev => ({ ...prev, [key]: value }));
  
  if (key === 'backgroundTransparency' || key === 'backgroundEnabled' || key === 'backgroundImage') {
    const updatedSettings = { ...localSettings, [key]: value };
    
    if (updatedSettings.backgroundEnabled && updatedSettings.backgroundImage) {
      // 处理背景图片URL
      let imageUrl;
      if (updatedSettings.backgroundImage.startsWith('data:')) {
        // Base64数据直接使用
        imageUrl = `url("${updatedSettings.backgroundImage}")`;
      } else {
        // 文件路径使用Tauri转换
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const convertedUrl = convertFileSrc(updatedSettings.backgroundImage);
        imageUrl = `url("${convertedUrl}")`;
      }
      
      // 设置CSS变量
      document.documentElement.style.setProperty('--editor-background-image', imageUrl);
      
      // 更新透明度
      const darkTransparency = updatedSettings.backgroundTransparency.dark / 100;
      const lightTransparency = updatedSettings.backgroundTransparency.light / 100;
      
      document.documentElement.style.setProperty('--editor-background-light', 
        `rgba(255, 255, 255, ${lightTransparency})`);
      document.documentElement.style.setProperty('--editor-background-dark', 
        `rgba(0, 0, 0, ${darkTransparency})`);
      
      // 根据当前主题设置背景
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const opacity = currentTheme === 'dark' ? darkTransparency : lightTransparency;
      const color = currentTheme === 'dark' ? '0, 0, 0' : '255, 255, 255';
      document.documentElement.style.setProperty('--editor-background', 
        `rgba(${color}, ${opacity})`);
    } else {
      // 禁用背景时重置
      document.documentElement.style.setProperty('--editor-background-image', 'none');
      document.documentElement.style.setProperty('--editor-background-light', 'rgba(255, 255, 255, 0.5)');
      document.documentElement.style.setProperty('--editor-background-dark', 'rgba(0, 0, 0, 0.5)');
    }
  }
}, [localSettings]);
```

#### 透明度滑块
```javascript
<div className="setting-item">
  <Text>{t('settings.appearance.background.transparency.dark')}</Text>
  <Slider
    min={0}
    max={100}
    step={5}
    value={localSettings.backgroundTransparency.dark}
    onChange={(value) => updateLocalSetting('backgroundTransparency', {
      ...localSettings.backgroundTransparency,
      dark: value
    })}
    style={{ width: 200 }}
    tooltip={{ formatter: (value) => `${value}%` }}
  />
</div>
```

## 编辑器主题集成

### 1. Monaco Editor主题

#### 主题切换逻辑
```javascript
// CodeEditor.jsx
useEffect(() => {
  if (monaco && editor) {
    if (language === 'mgtree') {
      // mgtree文件使用自定义主题
      monaco.editor.setTheme(isDarkMode ? 'mgtree-dark' : 'mgtree-light');
    } else {
      // 其他文件使用Monaco内置主题
      monaco.editor.setTheme(isDarkMode ? 'vs-dark' : 'vs');
    }
  }
}, [isDarkMode, language, monaco, editor]);
```

#### 自定义mgtree主题配置
```javascript
// mgtree-language.js
export const mgtreeThemeConfig = {
  light: {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'level-0', foreground: 'e74c3c' },      // 红色
      { token: 'level-1', foreground: 'e67e22' },      // 橙色
      { token: 'level-2', foreground: 'f39c12' },      // 黄色
      { token: 'level-3', foreground: '27ae60' },      // 绿色
      { token: 'level-4', foreground: '16a085' },      // 青色
      { token: 'level-5', foreground: '3498db' },      // 蓝色
      { token: 'level-deep', foreground: '9b59b6' },   // 紫色
      { token: 'jump-node', foreground: '8e44ad', fontStyle: 'bold' },
      { token: 'inline-code', foreground: 'd35400', background: 'fdf2e9' },
      { token: 'comment', foreground: '95a5a6', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#2c3e50'
    }
  },
  dark: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'level-0', foreground: 'ff6b6b' },
      { token: 'level-1', foreground: 'ffa726' },
      { token: 'level-2', foreground: 'ffcc02' },
      { token: 'level-3', foreground: '66bb6a' },
      { token: 'level-4', foreground: '26c6da' },
      { token: 'level-5', foreground: '42a5f5' },
      { token: 'level-deep', foreground: 'ab47bc' },
      { token: 'jump-node', foreground: 'ba68c8', fontStyle: 'bold' },
      { token: 'inline-code', foreground: 'ff8a65', background: '3e2723' },
      { token: 'comment', foreground: '78909c', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4'
    }
  }
};
```

### 2. Shiki代码高亮主题

#### Markdown渲染中的主题切换
```javascript
// MarkdownViewer.jsx
const highlighter = await createHighlighter({
  themes: ['one-light', 'one-dark-pro'],
  langs: ['javascript', 'typescript', 'python', 'java', 'cpp', 'html', 'css', 'json', 'markdown']
});

// 根据主题选择Shiki主题
const shikiTheme = isDarkMode ? 'one-dark-pro' : 'one-light';
```

### 3. Prism.js主题

#### CSS主题文件
- `public/prism-one-light.css` - 亮色主题样式
- `public/prism-one-dark.css` - 暗色主题样式

#### 动态主题加载
```javascript
// 根据主题动态加载对应的Prism CSS文件
const prismTheme = isDarkMode ? 'prism-one-dark.css' : 'prism-one-light.css';
```

## 配置管理

### 1. 持久化存储

#### Tauri Settings API集成
```javascript
// 保存主题设置
await settingsApi.set('theme', theme);
await settingsApi.set('fontSize', fontSize);
await settingsApi.set('fontFamily', fontFamily);
await settingsApi.set('lineHeight', lineHeight);
await settingsApi.set('backgroundImage', backgroundImage);
await settingsApi.set('backgroundEnabled', backgroundEnabled);
await settingsApi.set('backgroundTransparency', backgroundTransparency);

// 读取主题设置
const savedTheme = await settingsApi.get('theme', 'light');
const savedFontSize = await settingsApi.get('fontSize', 14);
// ... 其他设置项
```

#### 设置验证和错误处理
```javascript
const saveSettings = useCallback(async () => {
  try {
    // 保存设置
    await Promise.all([
      settingsApi.set('fontSize', localSettings.fontSize),
      settingsApi.set('fontFamily', localSettings.fontFamily),
      // ... 其他设置
    ]);
    
    // 验证保存结果
    const verifyBackgroundImage = await settingsApi.get('backgroundImage', '');
    const verifyBackgroundEnabled = await settingsApi.get('backgroundEnabled', false);
    
    message.success(t('settings.saveSuccess'));
  } catch (error) {
    console.error('设置保存失败:', error);
    message.error(`${t('settings.saveError')}: ${error.message}`);
  }
}, [localSettings, t]);
```

### 2. 国际化支持

#### 主题相关翻译键
```javascript
// i18n翻译键
'settings.general.theme.title': '主题设置',
'settings.general.theme.mode': '主题模式',
'settings.general.theme.light': '亮色主题',
'settings.general.theme.dark': '暗色主题',
'settings.appearance.background.title': '背景设置',
'settings.appearance.background.enable': '启用背景图片',
'settings.appearance.background.transparency.dark': '暗色主题透明度',
'settings.appearance.background.transparency.light': '亮色主题透明度'
```

## 性能优化

### 1. CSS变量优化

#### 减少重绘和重排
- 使用CSS变量实现主题切换，避免大量DOM操作
- 利用CSS `transition` 属性实现平滑过渡效果
- 通过 `data-theme` 属性控制全局主题状态

#### 样式隔离
```scss
// 组件级样式使用CSS变量
.component {
  background-color: var(--background-primary);
  color: var(--text-primary);
  border-color: var(--border-color);
  
  &:hover {
    background-color: var(--hover-background);
  }
}
```

### 2. 状态管理优化

#### Redux状态结构优化
- 扁平化状态结构，减少嵌套层级
- 使用 `createSlice` 简化reducer编写
- 通过 `useSelector` 精确订阅需要的状态片段

#### 异步操作优化
```javascript
// 批量设置更新，减少重渲染
const updateMultipleSettings = useCallback(async (updates) => {
  const actions = Object.entries(updates).map(([key, value]) => {
    switch (key) {
      case 'theme': return setTheme(value);
      case 'fontSize': return setFontSize(value);
      // ... 其他设置
    }
  });
  
  dispatch(batchActions(actions));
}, [dispatch]);
```

### 3. 背景图片优化

#### 图片处理优化
- 支持Base64和文件路径两种格式
- 使用Tauri的 `convertFileSrc` 安全处理本地文件路径
- 实现图片格式验证，支持常见图片格式

#### 内存管理
```javascript
// 清理背景图片资源
const clearBackground = useCallback(() => {
  document.documentElement.style.setProperty('--editor-background-image', 'none');
  // 清理可能的内存引用
  if (backgroundImageRef.current) {
    backgroundImageRef.current = null;
  }
}, []);
```

## 用户体验

### 1. 视觉过渡

#### 平滑主题切换
```scss
// 全局过渡效果
* {
  transition: background-color var(--transition-duration),
              color var(--transition-duration),
              border-color var(--transition-duration);
}

// 特定组件过渡
.app-layout {
  transition: all var(--transition-duration);
}
```

#### 背景图片过渡
```scss
.app-layout {
  &.has-background {
    &::before {
      transition: background-color var(--transition-duration);
    }
  }
}
```

### 2. 响应式设计

#### 主题适配
- 确保在不同屏幕尺寸下主题效果一致
- 针对移动端优化触摸交互体验
- 支持系统主题自动切换（可扩展）

### 3. 无障碍支持

#### 对比度优化
- 确保文本和背景有足够的对比度
- 提供高对比度主题选项（可扩展）
- 支持屏幕阅读器的主题状态播报

## 扩展功能

### 1. 自定义主题

#### 主题编辑器（规划中）
```javascript
// 自定义主题配置结构
const customTheme = {
  name: 'Custom Theme',
  colors: {
    primary: '#custom-color',
    background: '#custom-bg',
    text: '#custom-text'
  },
  editor: {
    background: '#editor-bg',
    foreground: '#editor-fg'
  }
};
```

### 2. 主题导入导出

#### 配置文件格式
```json
{
  "theme": {
    "name": "My Custom Theme",
    "version": "1.0.0",
    "colors": {
      "primary": "#1677ff",
      "background": "#ffffff"
    },
    "editor": {
      "fontSize": 14,
      "fontFamily": "Consolas"
    }
  }
}
```

### 3. 系统主题同步

#### 系统主题检测
```javascript
// 监听系统主题变化
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', (e) => {
  if (autoSyncSystemTheme) {
    setTheme(e.matches ? 'dark' : 'light');
  }
});
```

## 最佳实践

### 1. 开发建议

#### CSS变量命名规范
- 使用语义化命名：`--text-primary` 而不是 `--color-1`
- 保持一致的命名层级：`--background-primary/secondary/tertiary`
- 区分功能类型：`--editor-*`, `--ui-*`, `--status-*`

#### 组件主题适配
```scss
// 推荐的组件主题适配方式
.my-component {
  // 使用CSS变量而不是硬编码颜色
  background-color: var(--background-primary);
  color: var(--text-primary);
  
  // 状态变化使用主题色
  &:hover {
    background-color: var(--hover-background);
  }
  
  &.active {
    color: var(--primary-color);
  }
}
```

### 2. 性能建议

#### 避免频繁DOM操作
- 批量更新CSS变量
- 使用 `requestAnimationFrame` 优化动画
- 避免在主题切换时触发大量重排

#### 内存管理
- 及时清理事件监听器
- 避免背景图片内存泄漏
- 合理使用React的依赖数组

### 3. 测试建议

#### 主题切换测试
- 验证所有组件在两种主题下的显示效果
- 测试背景图片在不同透明度下的效果
- 确保设置的持久化和恢复功能正常

#### 兼容性测试
- 测试不同浏览器的CSS变量支持
- 验证Tauri环境下的文件路径处理
- 测试国际化文本在不同主题下的可读性

## 总结

喵咕记事本的主题系统通过以下特点实现了完整、高效的主题管理：

### 技术完整性
- **状态管理**: Redux + React Hooks提供可预测的状态管理
- **样式系统**: CSS变量 + SCSS实现灵活的主题切换
- **持久化**: Tauri Settings API确保设置的可靠存储
- **编辑器集成**: Monaco + Shiki + Prism多层次主题支持

### 功能丰富性
- **双主题支持**: 亮色/暗色主题完整适配
- **背景定制**: 支持背景图片和透明度调节
- **编辑器主题**: 针对不同文件类型的专门主题
- **国际化**: 完整的多语言主题设置界面

### 性能优化
- **CSS变量**: 避免大量DOM操作，实现高效主题切换
- **状态优化**: 精确的状态订阅和批量更新
- **资源管理**: 合理的图片处理和内存管理

### 用户体验
- **平滑过渡**: 自然的主题切换动画效果
- **即时预览**: 设置更改的实时反馈
- **持久化**: 用户偏好的可靠保存和恢复

### 可扩展性
- **模块化设计**: 清晰的组件和状态分离
- **配置化**: 易于添加新主题和自定义选项
- **标准化**: 遵循现代前端开发最佳实践

该主题系统为应用提供了专业级的主题管理能力，在保证功能完整性的同时，注重性能优化和用户体验，为后续的功能扩展奠定了坚实的基础。