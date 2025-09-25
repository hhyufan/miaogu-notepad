/**
 * @fileoverview 自定义脚注解析器 - 解析Markdown中的脚注语法
 * 支持 [^1] 引用语法和 [^1]: 定义语法
 * @author hhyufan
 * @version 1.0.0
 */

/**
 * 解析Markdown文本中的脚注
 * @param {string} content - Markdown内容
 * @returns {Object} 解析结果包含处理后的内容和脚注定义
 */
export function parseFootnotes(content) {
  console.log('=== 开始解析脚注 ===');
  
  const footnoteDefinitions = new Map();
  const footnoteReferences = [];
  
  // 匹配脚注定义：[^1]: 这是脚注内容（支持多行）
  const definitionRegex = /^\[(\^[^\]]+)\]:\s*(.+(?:\n(?:    .+|\t.+))*)$/gm;
  let match;
  
  // 提取脚注定义
  while ((match = definitionRegex.exec(content)) !== null) {
    const [fullMatch, id, definition] = match;
    console.log(`找到脚注定义 ${id}:`, definition.trim());
    // 去除ID中的尾随空格，确保与引用匹配
    const cleanId = id.trim();
    footnoteDefinitions.set(cleanId, {
      id: cleanId,
      content: definition.trim(),
      originalMatch: fullMatch
    });
  }
  
  console.log('找到脚注定义:', footnoteDefinitions.size, '个');
  console.log('脚注定义列表:', Array.from(footnoteDefinitions.keys()));
  
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
  
  console.log('找到脚注引用:', footnoteReferences.length, '个');
  
  // 生成脚注列表HTML
  if (footnoteDefinitions.size > 0) {
    const footnotesArray = [];
    
    const usedFootnotes = new Set();
    
    console.log('开始处理脚注引用，总数:', footnoteReferences.length);
    console.log('脚注定义总数:', footnoteDefinitions.size);
    
    footnoteReferences.forEach((ref, index) => {
      // 清理引用ID，确保与定义匹配
      const cleanRefId = ref.id.trim();
      console.log(`处理脚注引用 ${index + 1}:`, cleanRefId, '是否已使用:', usedFootnotes.has(cleanRefId), '是否有定义:', footnoteDefinitions.has(cleanRefId));
      
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
        
        console.log(`添加脚注到数组: ${cleanId}, targetId: ${targetId}, refId: ${refId}`);
        
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
    console.log('生成脚注HTML，长度:', footnotesHtml.length);
    console.log('脚注HTML内容:', footnotesHtml);
    console.log('脚注数组:', footnotesArray);
  }
  
  console.log('=== 脚注解析完成 ===');
  
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

  console.log('=== 添加脚注跳转处理器 ===');
  
  // 查找所有脚注链接（包括引用和回引）
  const allFootnoteLinks = container.querySelectorAll('a[href^="#fn"]');
  console.log('找到脚注链接总数:', allFootnoteLinks.length);
  
  // 查找所有脚注项目
  const footnoteItems = container.querySelectorAll('.footnotes li');
  console.log('找到脚注项目总数:', footnoteItems.length);
  
  // 输出所有脚注项目的ID
  footnoteItems.forEach((item, index) => {
    console.log(`脚注项目 ${index + 1}:`, {
      id: item.id,
      tagName: item.tagName,
      innerHTML: item.innerHTML.substring(0, 100) + '...'
    });
  });
  
  allFootnoteLinks.forEach((link, index) => {
    console.log(`处理脚注链接 ${index + 1}:`, {
      href: link.getAttribute('href'),
      id: link.id,
      className: link.className,
      text: link.textContent
    });
    
    // 移除现有的处理器
    link.removeAttribute('data-footnote-handler');
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      
      const targetId = href.substring(1);
      console.log('=== 脚注跳转 ===');
      console.log('点击链接:', link.textContent);
      console.log('目标ID:', targetId);
      
      // 查找目标元素
      const targetElement = container.querySelector('#' + targetId);
      
      if (targetElement) {
        targetElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        console.log('跳转成功到:', targetElement.tagName, targetElement.id);
      } else {
        console.log('未找到目标元素:', targetId);
        
        // 调试信息
        const allElementsWithId = container.querySelectorAll('[id]');
        console.log('容器中所有带ID的元素:');
        allElementsWithId.forEach((el, idx) => {
          console.log(`  ${idx + 1}. ID: "${el.id}", 标签: ${el.tagName}`);
        });
        
        // 检查脚注HTML结构
        const footnotesDiv = container.querySelector('.footnotes');
        if (footnotesDiv) {
          console.log('脚注div存在，内容:', footnotesDiv.innerHTML.substring(0, 500));
        }
      }
    });
    
    // 标记已添加处理器
    link.setAttribute('data-footnote-handler', 'true');
  });
  
  console.log('脚注跳转处理器添加完成');
}