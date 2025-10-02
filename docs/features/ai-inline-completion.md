# AI 内联补全方案实现文档

## 概述

AI 内联补全是喵咕记事本的核心智能功能之一，基于 Monaco Editor 的 `InlineCompletionsProvider` API 实现，通过调用外部 AI
服务提供上下文感知的代码补全建议。该功能支持多种编程语言，具备智能过滤、重试机制和性能优化等特性。

## 核心架构

### 1. 技术栈组成

- **前端框架**: React + Monaco Editor
- **AI 集成**: OpenAI Compatible API
- **状态管理**: Redux + Tauri Store
- **网络请求**: Fetch API + AbortController
- **配置管理**: Tauri Settings API

### 2. 主要组件

#### CodeEditor 组件

- **文件路径**: `src/components/CodeEditor.jsx`
- **核心功能**: 集成 Monaco Editor，注册内联补全提供器
- **关键方法**: `registerInlineCompletionsProvider`

#### SettingsModal 组件

- **文件路径**: `src/components/SettingsModal.jsx`
- **核心功能**: AI 补全配置界面
- **配置项**: API 端点、密钥、模型、启用状态

## 技术实现

### 1. 内联补全提供器注册

```javascript
// 注册内联补全提供器
monaco.languages.registerInlineCompletionsProvider(langId, {
    provideInlineCompletions: async (model, position, context, token) => {
        // 检查AI设置是否完整
        if (!aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
            return {items: []};
        }

        // 获取上下文信息
        const before = model.getValueInRange(new monaco.Range(1, 1, position.lineNumber, position.column));
        const after = model.getValueInRange(new monaco.Range(position.lineNumber, position.column, model.getLineCount(), model.getLineMaxColumn(model.getLineCount())));

        // 调用AI服务获取补全建议
        const completion = await getAICompletion(before, after, language);

        return {
            items: [{
                insertText: completion,
                range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                }
            }]
        };
    },

    freeInlineCompletions: () => {
        // 清理资源
    }
});
```

### 2. AI API 调用实现

#### 请求构建

```javascript
const body = {
  model: aiSettings.model,
  messages: [
    {
      role: 'system',
      content: `You are an advanced AI code completion engine using Fill-in-the-Middle (FIM) technology. Your primary goal is to provide contextually accurate, non-repetitive completions that seamlessly bridge prefix and suffix content.`
    },
    {
      role: 'user',
      content: `CONTEXT ANALYSIS:
- Language: ${language}
- Line Type: ${contextAnalysis.lineType}
- Current Line: "${currentLine}"
- Cursor Position: Column ${position.column}

FIM CONTEXT:
PREFIX (before cursor):
\`\`\`
${prefix}
\`\`\`

SUFFIX (after cursor):
\`\`\`
${suffix}
\`\`\`

CRITICAL FILTERING RULES (MUST FOLLOW):
🚫 NEVER repeat any word that exists in the current line
🚫 NEVER add comment symbols (//,/*,*/) in comment lines
🚫 NEVER duplicate content that exists in suffix
🚫 NEVER suggest excessively long content
🚫 NEVER repeat the last word from prefix

✅ COMPLETION STRATEGY:
1. If line type is 'comment': Continue with plain text, no symbols
2. If line type is 'string': Complete string content naturally
3. If line type is 'code': Complete syntax/logic appropriately
4. If suffix exists: Ensure completion bridges prefix→suffix smoothly
5. If line seems complete: Suggest minimal or no completion`
    }
  ],
  temperature: 0.05,
  max_tokens: 1000,
  stream: false
};
```

#### 网络请求处理

```javascript
const controller = new AbortController();
const unsub = token.onCancellationRequested?.(() => controller.abort());

const res = await fetch(`${aiSettings.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
  method: 'POST',
  mode: 'cors',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aiSettings.apiKey}`,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  },
  body: JSON.stringify(body),
  signal: controller.signal
});

unsub?.dispose?.();
```

### 3. 上下文分析系统

#### 代码上下文识别

```javascript
const contextAnalysis = {
  lineType: isCommentLine ? 'comment' : (inString ? 'string' : 'code'),
  hasPrefix: beforeCursor.trim().length > 0,
  hasSuffix: afterCursorText.trim().length > 0,
  isLineComplete: currentLine.trim().endsWith(';') || currentLine.trim().endsWith('}') || currentLine.trim().endsWith('{'),
  wordCount: currentLine.split(/[\s\W]+/).filter(w => w.length > 1).length
};
```

#### 智能过滤机制

```javascript
// 检测注释行
const isCommentLine = trimmedLine.startsWith('//') ||
    trimmedLine.startsWith('/*') ||
    trimmedLine.startsWith('*') ||
    trimmedLine.startsWith('#') ||
    trimmedLine.startsWith('<!--');

// 检测字符串内容
const inString = (beforeCursor.split('"').length - 1) % 2 === 1 ||
    (beforeCursor.split("'").length - 1) % 2 === 1 ||
    (beforeCursor.split('`').length - 1) % 2 === 1;
```

## 配置管理

### 1. AI 设置配置

#### SettingsModal 中的 AI 配置界面

```javascript
const renderAISettings = () => (
  <div className="settings-section">
    <Title level={4}>{t('settings.ai.title')}</Title>
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size="small" title={t('settings.ai.basicSettings')}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 启用开关 */}
          <div className="setting-item">
            <Text>{t('settings.ai.enable')}</Text>
            <Switch
              checked={localSettings.aiEnabled}
              onChange={(checked) => updateLocalSetting('aiEnabled', checked)}
            />
          </div>
          
          {/* API 端点配置 */}
          <div className="setting-item">
            <Text>{t('settings.ai.baseUrl')}</Text>
            <Input
              value={localSettings.aiBaseUrl}
              onChange={(e) => updateLocalSetting('aiBaseUrl', e.target.value)}
              placeholder={t('settings.ai.baseUrlPlaceholder')}
              disabled={!localSettings.aiEnabled}
            />
          </div>
          
          {/* API 密钥配置 */}
          <div className="setting-item">
            <Text>{t('settings.ai.apiKey')}</Text>
            <Input.Password
              value={localSettings.aiApiKey}
              onChange={(e) => updateLocalSetting('aiApiKey', e.target.value)}
              placeholder={t('settings.ai.apiKeyPlaceholder')}
              disabled={!localSettings.aiEnabled}
            />
          </div>
          
          {/* 模型配置 */}
          <div className="setting-item">
            <Text>{t('settings.ai.model')}</Text>
            <Input
              value={localSettings.aiModel}
              onChange={(e) => updateLocalSetting('aiModel', e.target.value)}
              placeholder={t('settings.ai.modelPlaceholder')}
              disabled={!localSettings.aiEnabled}
            />
          </div>
        </Space>
      </Card>
    </Space>
  </div>
);
```

### 2. 设置持久化

#### 配置保存机制

```javascript
// 保存AI设置到Tauri Store
await settingsApi.set('ai.enabled', !!localSettings.aiEnabled);
await settingsApi.set('ai.baseUrl', localSettings.aiBaseUrl || '');
await settingsApi.set('ai.apiKey', localSettings.aiApiKey || '');
await settingsApi.set('ai.model', localSettings.aiModel || '');

// 触发设置更新事件
window.dispatchEvent(new Event('ai-settings-changed'));
```

#### 配置加载机制

```javascript
useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const [enabled, baseUrl, apiKey, model] = await Promise.all([
        settingsApi.get('ai.enabled'),
        settingsApi.get('ai.baseUrl'),
        settingsApi.get('ai.apiKey'),
        settingsApi.get('ai.model'),
      ]);
      if (!mounted) return;
      setLocalSettings(prev => ({
        ...prev,
        aiEnabled: Boolean(enabled ?? prev.aiEnabled),
        aiBaseUrl: String(baseUrl ?? prev.aiBaseUrl ?? ''),
        aiApiKey: String(apiKey ?? prev.aiApiKey ?? ''),
        aiModel: String(model ?? prev.aiModel ?? ''),
      }));
    } catch (e) {
      console.error('加载AI设置失败:', e);
    }
  })();
  return () => { mounted = false; };
}, []);
```

## 性能优化

### 1. 请求频率控制

#### API 请求限制

```javascript
const MAX_REQUESTS_PER_MINUTE = 30;
const REQUEST_RESET_INTERVAL = 60000; // 1分钟

// 请求计数器
const apiRequestCountRef = useRef(0);
const lastRequestTimeRef = useRef(0);
const firstRequestTimeRef = useRef(0);
const apiRequestResetTimerRef = useRef(null);

// 检查请求频率
if (apiRequestCountRef.current >= MAX_REQUESTS_PER_MINUTE) {
  isCompletionActiveRef.current = false;
  return { items: [] };
}

// 更新请求计数
apiRequestCountRef.current++;
lastRequestTimeRef.current = now;
```

#### 自动重置机制

```javascript
// 设置重置定时器
if (apiRequestResetTimerRef.current) {
  clearTimeout(apiRequestResetTimerRef.current);
}

const timeElapsed = now - firstRequestTimeRef.current;
const timeRemaining = Math.max(0, REQUEST_RESET_INTERVAL - timeElapsed);

apiRequestResetTimerRef.current = setTimeout(() => {
  apiRequestCountRef.current = 0;
  firstRequestTimeRef.current = 0;
}, timeRemaining);
```

### 2. 智能重试机制

#### 重试逻辑实现

```javascript
const scheduleRetryWithReason = (rejectionReason, filterName) => {
  setTimeout(async () => {
    try {
      const retryResult = await retryCompletionWithReason(model, position, context, token, rejectionReason, filterName);
      if (retryResult && retryResult.items && retryResult.items.length > 0) {
        const suggestion = retryResult.items[0].insertText;
        const currentPosition = editorRef.current.getPosition();
        
        // 缓存重试建议
        retrySuggestionRef.current = {
          text: suggestion,
          position: {
            lineNumber: currentPosition.lineNumber,
            column: currentPosition.column
          },
          timestamp: Date.now()
        };
        
        // 触发新的补全建议
        editorRef.current.trigger('retry', 'editor.action.inlineSuggest.trigger', {});
      }
    } catch (error) {
      console.error('重试补全失败:', error);
    }
  }, 2000);
};
```

#### 重试请求优化

```javascript
const retryCompletionWithReason = async (model, position, context, token, rejectionReason, filterName) => {
  const existingWords = currentLine.toLowerCase().match(/\b\w+\b/g) || [];
  const avoidWords = existingWords.join('、');

  const retryBody = {
    model: aiSettings.model,
    messages: [
      {
        role: 'system',
        content: `You are an advanced AI code completion engine. The previous completion was rejected by ${filterName} because: ${rejectionReason}. You MUST provide a completely different completion that avoids ALL existing words and content.`
      },
      {
        role: 'user',
        content: `**CRITICAL RETRY REQUEST**

Previous rejection: ${rejectionReason}
Filter: ${filterName}

**STRICT REQUIREMENTS**:
1. NEVER use these existing words: ${avoidWords}
2. NEVER repeat any content from current line: "${currentLine}"
3. Provide a COMPLETELY DIFFERENT approach
4. Focus on UNIQUE and CREATIVE completion`
      }
    ],
    temperature: 0.3, // 提高创造性
    max_tokens: 500,
    stream: false
  };
  
  // 执行重试请求...
};
```

### 3. 缓存和状态管理

#### 建议缓存机制

```javascript
const retrySuggestionRef = useRef(null);

// 检查缓存的重试建议
if (retrySuggestionRef.current) {
  const retrySuggestion = retrySuggestionRef.current;
  const currentPos = position;

  if (retrySuggestion.position.lineNumber === currentPos.lineNumber &&
    retrySuggestion.position.column === currentPos.column &&
    Date.now() - retrySuggestion.timestamp < 30000) {
    
    // 使用缓存的建议
    retrySuggestionRef.current = null;
    return {
      items: [{
        insertText: retrySuggestion.text,
        range: {
          startLineNumber: currentPos.lineNumber,
          startColumn: currentPos.column,
          endLineNumber: currentPos.lineNumber,
          endColumn: currentPos.column
        }
      }]
    };
  }
}
```

#### 状态同步机制

```javascript
// 监听设置变更事件
useEffect(() => {
  const handleSettingsChange = () => {
    // 重新加载AI设置
    loadAISettings();
  };
  
  window.addEventListener('ai-settings-changed', handleSettingsChange);
  
  return () => {
    window.removeEventListener('ai-settings-changed', handleSettingsChange);
  };
}, []);
```

## 错误处理

### 1. 网络错误处理

#### 请求超时和取消

```javascript
const controller = new AbortController();
const unsub = token.onCancellationRequested?.(() => controller.abort());

try {
  const res = await fetch(apiUrl, {
    // ... 请求配置
    signal: controller.signal
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const data = await res.json();
  // 处理响应数据...
  
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('请求被取消');
    return { items: [] };
  }
  
  console.error('AI补全请求失败:', error);
  return { items: [] };
} finally {
  unsub?.dispose?.();
}
```

### 2. 配置验证

#### AI 设置验证

```javascript
// 检查AI配置完整性
if (!aiSettings.enabled || !aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
  console.warn('AI补全配置不完整');
  return { items: [] };
}

// 验证URL格式
try {
  new URL(aiSettings.baseUrl);
} catch (error) {
  console.error('AI服务URL格式无效:', aiSettings.baseUrl);
  return { items: [] };
}
```

### 3. 响应数据验证

#### 补全结果过滤

```javascript
const data = await res.json();
const text = data?.choices?.[0]?.message?.content ?? '';

let insert = (text || '')
  .replace(/^```[\s\S]*?\n|```$/g, '') // 移除代码块标记
  .replace(/\r/g, '') // 移除回车符
  .trim();

// 验证补全内容
if (!insert || insert.length < 1) {
  return { items: [] };
}

// 检查重复内容
const trimmedInsert = insert.trim();
const trimmedBeforeCursor = beforeCursor.trim();

if (!trimmedInsert || trimmedInsert.length < 1) {
  return { items: [] };
}
```

## 扩展功能

### 1. 多语言支持

#### 语言检测和适配

```javascript
const language = model.getLanguageId();

// 根据语言调整补全策略
const getLanguageSpecificPrompt = (lang) => {
  const prompts = {
    'javascript': 'Focus on ES6+ syntax and modern JavaScript patterns',
    'typescript': 'Include type annotations and TypeScript-specific features',
    'python': 'Follow PEP 8 style guidelines and Pythonic patterns',
    'java': 'Use proper Java conventions and design patterns',
    'cpp': 'Focus on modern C++ features and best practices'
  };
  
  return prompts[lang] || 'Provide contextually appropriate code completion';
};
```

### 2. 自定义补全模板

#### 模板系统集成

```javascript
// 检查是否有自定义模板匹配
const checkCustomTemplates = (prefix, language) => {
  const templates = getLanguageTemplates(language);
  
  for (const template of templates) {
    if (prefix.endsWith(template.trigger)) {
      return {
        insertText: template.content,
        isTemplate: true
      };
    }
  }
  
  return null;
};

// 在补全提供器中使用
const templateMatch = checkCustomTemplates(beforeCursor, language);
if (templateMatch) {
  return {
    items: [{
      insertText: templateMatch.insertText,
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column - templateMatch.trigger.length,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      }
    }]
  };
}
```

### 3. 智能上下文感知

#### 项目文件分析

```javascript
// 分析项目结构和依赖
const analyzeProjectContext = async (currentFile) => {
  const projectFiles = await fileApi.getProjectFiles();
  const imports = extractImports(currentFile);
  const dependencies = await getDependencies();
  
  return {
    availableModules: imports,
    projectStructure: projectFiles,
    dependencies: dependencies
  };
};

// 在补全请求中包含项目上下文
const projectContext = await analyzeProjectContext(model.getValue());
const contextPrompt = `
Project Context:
- Available imports: ${projectContext.availableModules.join(', ')}
- Project files: ${projectContext.projectStructure.slice(0, 10).join(', ')}
- Dependencies: ${projectContext.dependencies.slice(0, 5).join(', ')}
`;
```

## 最佳实践

### 1. 性能优化建议

- **请求节流**: 限制API调用频率，避免过度请求
- **智能缓存**: 缓存最近的补全结果，减少重复请求
- **上下文优化**: 限制发送给AI的上下文长度，提高响应速度
- **异步处理**: 使用异步请求，避免阻塞编辑器操作

### 2. 用户体验优化

- **渐进式加载**: 优先显示简单补全，复杂补全异步加载
- **智能过滤**: 过滤低质量或重复的补全建议
- **视觉反馈**: 提供清晰的加载状态和错误提示
- **快捷操作**: 支持快捷键快速接受或拒绝补全

### 3. 开发建议

- **错误监控**: 完善的错误日志和监控机制
- **配置验证**: 严格验证用户配置的有效性
- **API兼容性**: 支持多种AI服务提供商的API格式
- **测试覆盖**: 编写全面的单元测试和集成测试

## 总结

AI 内联补全方案是一个复杂而强大的智能编程辅助系统，通过以下特点实现了高质量的代码补全体验：

1. **技术完整性**: 基于Monaco Editor的标准API，与编辑器深度集成
2. **智能化程度**: 上下文感知、智能过滤、重试机制等多重智能特性
3. **性能优化**: 请求限制、缓存机制、异步处理等性能优化策略
4. **用户友好**: 灵活的配置选项、清晰的错误处理、良好的用户反馈
5. **扩展性强**: 支持多语言、自定义模板、项目上下文分析等扩展功能

该方案不仅提供了基础的AI补全功能，还通过智能化的过滤和优化机制，确保了补全建议的质量和相关性，为用户提供了流畅、智能的编程体验。

---

*本文档基于 miaogu-notepad v1.1.0+ 版本编写，详细介绍了AI内联补全的完整实现方案*
