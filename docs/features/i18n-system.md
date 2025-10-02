# 国际化(i18n)系统实现

## 概述

喵咕记事本采用基于 `react-i18next` 的国际化解决方案，提供完整的中英文界面切换支持。系统具备自动语言检测、本地存储持久化、动态语言切换等特性，为用户提供原生化的多语言体验。

## 核心架构

### 1. 技术栈

| 组件          | 技术                               | 版本    | 功能         |
|-------------|----------------------------------|-------|------------|
| **核心库**     | react-i18next                    | ^13.x | React国际化框架 |
| **语言检测**    | i18next-browser-languagedetector | ^7.x  | 浏览器语言自动检测  |
| **自定义Hook** | useI18n                          | 1.3.0 | 封装翻译和语言管理  |
| **翻译文件**    | JSON                             | -     | 结构化翻译资源    |

### 2. 文件结构

```
src/i18n/
├── index.js                 # i18n配置入口
├── locales/
│   ├── zh-CN.json          # 中文翻译文件
│   └── en-US.json          # 英文翻译文件
└── hooks/
    └── useI18n.js          # 自定义i18n Hook
```

## 技术实现

### 1. i18n配置 (index.js)

#### 核心配置

```javascript
/**
 * 国际化配置 - 配置i18next多语言支持
 * 支持中文和英文两种语言，自动检测用户语言偏好
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const resources = {
  'zh-CN': {
    translation: zhCN
  },
  'en-US': {
    translation: enUS
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-CN',
    debug: process.env.NODE_ENV === 'development',

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'miaogu-notepad-language'
    },

    interpolation: {
      escapeValue: false
    },

    defaultNS: 'translation',
    ns: ['translation']
  });
```

#### 配置特性

| 配置项                           | 值                                  | 说明       |
|-------------------------------|------------------------------------|----------|
| **fallbackLng**               | 'zh-CN'                            | 默认回退语言   |
| **detection.order**           | localStorage → navigator → htmlTag | 语言检测优先级  |
| **detection.caches**          | localStorage                       | 语言偏好缓存方式 |
| **lookupLocalStorage**        | 'miaogu-notepad-language'          | 本地存储键名   |
| **interpolation.escapeValue** | false                              | 禁用HTML转义 |

### 2. 自定义Hook (useI18n.js)

#### Hook实现

```javascript
/**
 * 自定义i18n hook
 * 封装react-i18next，提供更便捷的国际化操作接口
 */
export const useI18n = () => {
        const {t, i18n} = useTranslation();

        const changeLanguage = useCallback(async (language) => {
            try {
                await i18n.changeLanguage(language);
                localStorage.setItem('miaogu-notepad-language', language);
            } catch (error) {
                console.error('Language change failed:', error);
            }
        }, [i18n]);

        const currentLanguage = i18n.language;

        const supportedLanguages = [
            {code: 'zh-CN', name: '简体中文', nativeName: '简体中文'},
            {code: 'en-US', name: 'English', nativeName: 'English'}
        ];

        const getCurrentLanguageInfo = useCallback(() => {
            return supportedLanguages.find(lang => lang.code === currentLanguage) || supportedLanguages[0];
        }, [currentLanguage]);

        return {
            t,                        // 翻译函数
            changeLanguage,           // 切换语言函数
            currentLanguage,          // 当前语言代码
            supportedLanguages,       // 支持的语言列表
            getCurrentLanguageInfo,   // 获取当前语言信息
            isReady: i18n.isInitialized  // i18n是否已初始化
        };
    };

/**
 * 获取翻译文本的简化hook
 */
export const useT = (key, options = {}) => {
    const {t} = useTranslation();
    return t(key, options);
};
```

#### Hook特性

| 功能        | 返回值                    | 类型       | 说明      |
|-----------|------------------------|----------|---------|
| **翻译函数**  | t                      | Function | 核心翻译方法  |
| **语言切换**  | changeLanguage         | Function | 异步语言切换  |
| **当前语言**  | currentLanguage        | String   | 当前语言代码  |
| **支持语言**  | supportedLanguages     | Array    | 语言列表配置  |
| **语言信息**  | getCurrentLanguageInfo | Function | 获取语言详情  |
| **初始化状态** | isReady                | Boolean  | 初始化完成标志 |

### 3. 翻译文件结构

#### 中文翻译 (zh-CN.json)

```json
{
  "app": {
    "title": "喵咕记事本",
    "theme": {
      "light": "切换到亮色模式",
      "dark": "切换到暗色模式"
    }
  },
  "header": {
    "file": "文件",
    "fileMenu": {
      "new": "新建文件",
      "open": "打开文件",
      "save": "保存文件",
      "saveAs": "另存为",
      "rename": "重命名",
      "close": "关闭"
    },
    "edit": {
      "undo": "撤销",
      "redo": "重做",
      "cut": "剪切",
      "copy": "复制",
      "paste": "粘贴"
    },
    "window": {
      "minimize": "最小化",
      "maximize": "最大化",
      "restore": "还原",
      "close": "关闭",
      "pin": "置顶窗口",
      "unpin": "取消置顶"
    }
  },
  "common": {
    "confirm": "确认",
    "cancel": "取消",
    "save": "保存",
    "delete": "删除",
    "edit": "编辑",
    "add": "添加",
    "search": "搜索",
    "loading": "加载中...",
    "untitled": "未命名",
    "modified": "已修改"
  },
  "settings": {
    "title": "设置",
    "general": {
      "title": "通用",
      "theme": {
        "title": "主题设置",
        "mode": "主题模式",
        "light": "亮色模式",
        "dark": "暗色模式"
      },
      "language": {
        "title": "语言设置",
        "label": "界面语言",
        "select": "选择语言"
      }
    },
    "editor": {
      "title": "编辑器",
      "font": {
        "title": "字体设置",
        "family": "字体家族",
        "lineHeight": "行高"
      }
    },
    "ai": {
      "title": "AI补全",
      "enable": "启用AI补全",
      "baseUrl": "基础URL",
      "apiKey": "API密钥",
      "model": "模型"
    }
  }
}
```

#### 英文翻译 (en-US.json)

```json
{
  "app": {
    "title": "Miaogu Notepad",
    "theme": {
      "light": "Switch to light mode",
      "dark": "Switch to dark mode"
    }
  },
  "header": {
    "file": "File",
    "fileMenu": {
      "new": "New File",
      "open": "Open File",
      "save": "Save File",
      "saveAs": "Save As",
      "rename": "Rename",
      "close": "Close"
    },
    "edit": {
      "undo": "Undo",
      "redo": "Redo",
      "cut": "Cut",
      "copy": "Copy",
      "paste": "Paste"
    },
    "window": {
      "minimize": "Minimize",
      "maximize": "Maximize",
      "restore": "Restore",
      "close": "Close"
    }
  },
  "common": {
    "confirm": "Confirm",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "search": "Search",
    "loading": "Loading...",
    "untitled": "Untitled",
    "modified": "Modified"
  },
  "settings": {
    "title": "Settings",
    "general": {
      "title": "General",
      "theme": {
        "title": "Theme Settings",
        "mode": "Theme Mode",
        "light": "Light Mode",
        "dark": "Dark Mode"
      },
      "language": {
        "title": "Language Settings",
        "label": "Interface Language",
        "select": "Select Language"
      }
    },
    "editor": {
      "title": "Editor",
      "font": {
        "title": "Font Settings",
        "family": "Font Family",
        "lineHeight": "Line Height"
      }
    },
    "ai": {
      "title": "AI Completion",
      "enable": "Enable AI Completion",
      "baseUrl": "Base URL",
      "apiKey": "API Key",
      "model": "Model"
    }
  }
}
```

## 组件集成

### 1. 设置面板语言切换

#### SettingsModal组件实现

```javascript
/**
 * 设置弹窗中的语言切换功能
 */
const SettingsModal = ({visible, onClose}) => {
        const {t, changeLanguage, currentLanguage, supportedLanguages} = useI18n();

        const renderGeneralSettings = () => (
            <div className="settings-section">
                <Title level={4}>{t('settings.general.title')}</Title>
                <Space direction="vertical" size="large" style={{width: '100%'}}>
                    {/* 语言设置卡片 */}
                    <Card size="small" title={t('settings.language.settings')}>
                        <Space direction="vertical" style={{width: '100%'}}>
                            <div className="setting-item">
                                <Text>{t('settings.language.select')}</Text>
                                <Select
                                    value={currentLanguage}
                                    onChange={changeLanguage}
                                    style={{width: 150}}
                                >
                                    {supportedLanguages.map(lang => (
                                        <Option key={lang.code} value={lang.code}>
                                            {lang.name}
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        </Space>
                    </Card>
                </Space>
            </div>
        );

        return (
            <Modal
                title={t('settings.title')}
                open={visible}
                onCancel={onClose}
                // ... 其他配置
            >
                {renderGeneralSettings()}
            </Modal>
        );
    };
```

### 2. 应用组件使用示例

#### AppHeader组件

```javascript
/**
 * 应用头部组件中的i18n使用
 */
const AppHeader = ({fileManager, hasOpenFiles}) => {
        const {t} = useI18n();

        return (
            <Header className="app-header">
                <Title level={4}>{t('app.title')}</Title>
                <Menu mode="horizontal">
                    <SubMenu key="file" title={t('header.file')}>
                        <Menu.Item key="new" onClick={fileManager.createNewFile}>
                            {t('header.fileMenu.new')}
                        </Menu.Item>
                        <Menu.Item key="open" onClick={fileManager.openFile}>
                            {t('header.fileMenu.open')}
                        </Menu.Item>
                        <Menu.Item key="save" onClick={fileManager.saveFile}>
                            {t('header.fileMenu.save')}
                        </Menu.Item>
                    </SubMenu>
                </Menu>
            </Header>
        );
    };
```

#### WelcomeScreen组件

```javascript
/**
 * 欢迎界面组件中的i18n使用
 */
const WelcomeScreen = ({onNewFile, onOpenFile}) => {
        const {t} = useI18n();

        return (
            <div className="welcome-screen">
                <Title level={2}>{t('welcome.title')}</Title>
                <Text type="secondary">{t('welcome.description')}</Text>
                <Space size="large">
                    <Button
                        type="primary"
                        icon={<FileAddOutlined/>}
                        onClick={onNewFile}
                    >
                        {t('welcome.newFile')}
                    </Button>
                    <Button
                        icon={<FolderOpenOutlined/>}
                        onClick={onOpenFile}
                    >
                        {t('welcome.openFile')}
                    </Button>
                </Space>
                <Text type="secondary">{t('welcome.tip')}</Text>
            </div>
        );
    };
```

## 语言检测机制

### 1. 检测优先级

| 优先级   | 检测方式         | 说明           |
|-------|--------------|--------------|
| **1** | localStorage | 用户手动设置的语言偏好  |
| **2** | navigator    | 浏览器/系统语言设置   |
| **3** | htmlTag      | HTML标签lang属性 |

### 2. 检测流程

```javascript
// 语言检测配置
detection: {
  order: ['localStorage', 'navigator', 'htmlTag'],
  caches: ['localStorage'],
  lookupLocalStorage: 'miaogu-notepad-language'
}
```

#### 检测逻辑

1. **localStorage检测**: 优先读取用户之前设置的语言偏好
2. **navigator检测**: 读取浏览器/系统语言设置
3. **htmlTag检测**: 读取HTML标签的lang属性
4. **fallback**: 如果都检测失败，使用默认语言 'zh-CN'

### 3. 语言持久化

```javascript
const changeLanguage = useCallback(async (language) => {
  try {
    await i18n.changeLanguage(language);
    // 持久化到localStorage
    localStorage.setItem('miaogu-notepad-language', language);
  } catch (error) {
    console.error('Language change failed:', error);
  }
}, [i18n]);
```

## 翻译键命名规范

### 1. 命名约定

| 层级      | 命名规则    | 示例                            |
|---------|---------|-------------------------------|
| **模块级** | 功能模块名   | app, header, editor, settings |
| **组件级** | 组件或功能名  | fileMenu, theme, language     |
| **属性级** | 具体属性或动作 | title, save, open, cancel     |

### 2. 层级结构

```json
{
  "模块名": {
    "组件名": {
      "属性名": "翻译文本",
      "子组件": {
        "属性名": "翻译文本"
      }
    }
  }
}
```

### 3. 特殊键约定

| 键名              | 用途    | 示例                          |
|-----------------|-------|-----------------------------|
| **title**       | 标题文本  | "设置", "Settings"            |
| **label**       | 标签文本  | "语言", "Language"            |
| **placeholder** | 占位符文本 | "请输入...", "Please enter..." |
| **tooltip**     | 提示文本  | "点击切换", "Click to toggle"   |
| **confirm**     | 确认操作  | "确认", "Confirm"             |
| **cancel**      | 取消操作  | "取消", "Cancel"              |

## 性能优化

### 1. 懒加载策略

```javascript
// 按需加载翻译资源
const loadLanguageAsync = async (language) => {
  try {
    const translations = await import(`./locales/${language}.json`);
    i18n.addResourceBundle(language, 'translation', translations.default);
  } catch (error) {
    console.error(`Failed to load language ${language}:`, error);
  }
};
```

### 2. 缓存机制

| 缓存类型     | 实现方式         | 说明         |
|----------|--------------|------------|
| **翻译缓存** | i18next内置    | 自动缓存已加载的翻译 |
| **语言偏好** | localStorage | 持久化用户语言选择  |
| **组件缓存** | React.memo   | 避免不必要的重渲染  |

### 3. 优化建议

```javascript
// 使用React.memo优化翻译组件
const TranslatedComponent = React.memo(({translationKey}) => {
    const {t} = useI18n();
    return <span>{t(translationKey)}</span>;
});

// 批量翻译优化
const useBatchTranslation = (keys) => {
    const {t} = useI18n();
    return useMemo(() => {
        return keys.reduce((acc, key) => {
            acc[key] = t(key);
            return acc;
        }, {});
    }, [t, keys]);
};
```

## 错误处理

### 1. 翻译缺失处理

```javascript
// i18n配置中的错误处理
i18n.init({
  // 翻译缺失时的回退策略
  fallbackLng: 'zh-CN',
  
  // 开发环境显示缺失的翻译键
  debug: process.env.NODE_ENV === 'development',
  
  // 缺失翻译时的处理
  missingKeyHandler: (lng, ns, key, fallbackValue) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Missing translation: ${lng}.${ns}.${key}`);
    }
  }
});
```

### 2. 语言切换错误处理

```javascript
const changeLanguage = useCallback(async (language) => {
  try {
    await i18n.changeLanguage(language);
    localStorage.setItem('miaogu-notepad-language', language);
  } catch (error) {
    console.error('Language change failed:', error);
    // 回退到默认语言
    await i18n.changeLanguage('zh-CN');
  }
}, [i18n]);
```

### 3. 初始化错误处理

```javascript
// 检查i18n初始化状态
const {isReady} = useI18n();

if (!isReady) {
    return <div>Loading translations...</div>;
}
```

## 扩展功能

### 1. 添加新语言

#### 步骤流程

1. **创建翻译文件**: 在 `locales/` 目录下创建新的语言文件
2. **更新资源配置**: 在 `index.js` 中添加新语言资源
3. **更新语言列表**: 在 `useI18n.js` 中添加语言选项
4. **测试验证**: 确保所有翻译键都有对应翻译

#### 示例：添加日语支持

```javascript
// 1. 创建 locales/ja-JP.json
{
    "app"
:
    {
        "title"
    :
        "ミャオグノートパッド"
    }
    // ... 其他翻译
}

// 2. 更新 index.js
import jaJP from './locales/ja-JP.json';

const resources = {
    'zh-CN': {translation: zhCN},
    'en-US': {translation: enUS},
    'ja-JP': {translation: jaJP}  // 新增
};

// 3. 更新 useI18n.js
const supportedLanguages = [
    {code: 'zh-CN', name: '简体中文', nativeName: '简体中文'},
    {code: 'en-US', name: 'English', nativeName: 'English'},
    {code: 'ja-JP', name: '日本語', nativeName: '日本語'}  // 新增
];
```

### 2. 动态翻译加载

```javascript
// 动态加载翻译资源
const loadTranslation = async (language) => {
  try {
    const module = await import(`./locales/${language}.json`);
    i18n.addResourceBundle(language, 'translation', module.default);
    return true;
  } catch (error) {
    console.error(`Failed to load ${language} translations:`, error);
    return false;
  }
};
```

### 3. 翻译插值支持

```javascript
// 支持变量插值的翻译
{
    "editor"
:
    {
        "lineColumn"
    :
        "行 {{line}}, 列 {{column}}",
            "fileSize"
    :
        "文件大小: {{size}} KB"
    }
}

// 使用插值
const {t} = useI18n();
const positionText = t('editor.lineColumn', {line: 10, column: 5});
// 输出: "行 10, 列 5"
```

## 最佳实践

### 1. 性能优化

- **组件级缓存**: 使用 `React.memo` 避免不必要的重渲染
- **翻译键预加载**: 在应用启动时预加载常用翻译
- **按需加载**: 大型应用可考虑按模块懒加载翻译

### 2. 用户体验

- **即时切换**: 语言切换后立即生效，无需刷新页面
- **状态保持**: 保持用户的语言偏好设置
- **回退机制**: 提供合理的翻译缺失回退策略

### 3. 开发建议

- **统一命名**: 遵循一致的翻译键命名规范
- **完整覆盖**: 确保所有用户可见文本都有翻译
- **测试验证**: 在不同语言环境下测试界面布局
- **文档维护**: 及时更新翻译文档和使用指南

## 总结

喵咕记事本的国际化系统具备以下特点：

- **🌍 完整性**: 覆盖所有用户界面文本的翻译支持
- **⚡ 高性能**: 基于成熟的 react-i18next 框架，性能优异
- **🔄 易用性**: 提供简洁的 Hook 接口，开发体验友好
- **🎯 可扩展**: 支持轻松添加新语言和翻译资源
- **💾 持久化**: 自动保存用户语言偏好，提升用户体验

该系统为应用的国际化提供了坚实的技术基础，支持未来的多语言扩展需求。
