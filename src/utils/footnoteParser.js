/**
 * @fileoverview 自定义脚注解析器 - 解析Markdown中的脚注语法
 * 支持 [^1] 引用语法和 [^1]: 定义语法
 * @author hhyufan
 * @version 1.3.0
 */

/**
 * 解析Markdown文本中的脚注
 * @param {string} content - Markdown内容
 * @returns {Object} 解析结果包含处理后的内容和脚注定义
 */
export function parseFootnotes(content) {
  const footnoteDefinitions = new Map();
  const footnoteReferences = [];

  // 匹配脚注定义：[^1]: 这是脚注内容（支持多行）
  const definitionRegex = /^\[(\^[^\]]+)\]:\s*(.+(?:\n(?:    .+|\t.+))*)$/gm;
  let match;

  // 提取脚注定义
  while ((match = definitionRegex.exec(content)) !== null) {
    const [fullMatch, id, definition] = match;
    // 去除ID中的尾随空格，确保与引用匹配
    const cleanId = id.trim();
    footnoteDefinitions.set(cleanId, {
      id: cleanId,
      content: definition.trim(),
      originalMatch: fullMatch
    });
  }

  // 移除原始的脚注定义
  let processedContent = content.replace(definitionRegex, '');

  // 匹配脚注引用：[^1]
  const referenceRegex = /\[(\^[^\]]+)\]/g;
  let refMatch;
  let refIndex = 0;

  // 替换脚注引用为带链接的上标
  processedContent = processedContent.replace(referenceRegex, (fullMatch, id) => {
    refIndex++;
    // 清理ID，去除多余空格和特殊字符
    const cleanId = id.substring(1).trim().replace(/\s+/g, '');
    const refId = `fnref-${cleanId}`;
    const targetId = `fn-${cleanId}`;

    footnoteReferences.push({
      id: id,
      refId: refId,
      targetId: targetId,
      index: refIndex
    });

    // 使用简单的HTML结构，不使用复杂的嵌套
    return `<a href="#${targetId}" id="${refId}" class="footnote-ref">[${cleanId}]</a>`;
  });

  // 生成脚注列表HTML
  if (footnoteDefinitions.size > 0) {
    const footnotesArray = [];

    const usedFootnotes = new Set();

    footnoteReferences.forEach((ref, index) => {
      // 清理引用ID，确保与定义匹配
      const cleanRefId = ref.id.trim();

      if (!usedFootnotes.has(cleanRefId) && footnoteDefinitions.has(cleanRefId)) {
        const definition = footnoteDefinitions.get(cleanRefId);
        // 保留原始Markdown内容，不进行过度清理
        const markdownContent = definition.content
          .replace(/\n/g, ' ')
          .replace(/\r/g, '')
          .replace(/\t/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // 确保targetId正确生成
        const cleanId = cleanRefId.substring(1).trim().replace(/\s+/g, '');
        const targetId = `fn-${cleanId}`;
        const refId = `fnref-${cleanId}`;

        // 使用Markdown格式的脚注内容，让ReactMarkdown正确渲染
        footnotesArray.push(`<span id="${targetId}">${markdownContent} [↩](#${refId})</span>`);
        usedFootnotes.add(cleanRefId);
      }
    });

    // 使用HTML格式，但确保ReactMarkdown能正确处理
    const footnotesHtml = `

<div class="footnotes">
<hr />
<ol>
${footnotesArray.map((item, index) => `<li>${item}</li>`).join('\n')}
</ol>
</div>
`;

    processedContent = processedContent.trim() + footnotesHtml;
  }

  return {
    content: processedContent,
    footnoteDefinitions: Array.from(footnoteDefinitions.values()),
    footnoteReferences: footnoteReferences
  };
}

/**
 * 为脚注添加跳转功能
 * @param {HTMLElement} container - 容器元素
 */
export function addFootnoteJumpHandlers(container) {
  if (!container) return;

  // 查找所有脚注链接（包括引用和回引）
  const allFootnoteLinks = container.querySelectorAll('a[href^="#fn"]');

  // 查找所有脚注项目
  const footnoteItems = container.querySelectorAll('.footnotes li');

  allFootnoteLinks.forEach((link, index) => {
    // 移除现有的处理器
    link.removeAttribute('data-footnote-handler');

    link.addEventListener('click', (e) => {
      e.preventDefault();

      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      const targetId = href.substring(1);

      // 查找目标元素
      const targetElement = container.querySelector('#' + targetId);

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    });

    // 标记已添加处理器
    link.setAttribute('data-footnote-handler', 'true');
  });
}
