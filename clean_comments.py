#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单行注释清理工具
智能清理JavaScript/JSX/CSS/SCSS文件中的单行注释
保留重要的注释，如JSDoc、版权信息、配置说明等
"""

import os
import re
import sys
import argparse
from pathlib import Path
from typing import List, Tuple, Set

class CommentCleaner:
    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.processed_files = 0
        self.removed_comments = 0
        
        # 支持的文件扩展名
        self.supported_extensions = {'.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.sass'}
        
        # 需要保留的注释模式（正则表达式）
        self.preserve_patterns = [
            r'^\s*//\s*@\w+',  # JSDoc标签 (@param, @returns等)
            r'^\s*//\s*eslint-',  # ESLint指令
            r'^\s*//\s*prettier-',  # Prettier指令
            r'^\s*//\s*TODO:',  # TODO注释
            r'^\s*//\s*FIXME:',  # FIXME注释
            r'^\s*//\s*NOTE:',  # NOTE注释
            r'^\s*//\s*HACK:',  # HACK注释
            r'^\s*//\s*XXX:',  # XXX注释
            r'^\s*//\s*Copyright',  # 版权信息
            r'^\s*//\s*License',  # 许可证信息
            r'^\s*//\s*Author',  # 作者信息
            r'^\s*//\s*https?://',  # URL链接
            r'^\s*//\s*\d+\.',  # 编号列表 (1. 2. 3.)
            r'^\s*//\s*-\s',  # 列表项 (- item)
            r'^\s*//\s*\*\s',  # 列表项 (* item)
            r'^\s*//\s*=+',  # 分隔线 (====)
            r'^\s*//\s*-+',  # 分隔线 (----)
            r'^\s*//\s*\*+',  # 分隔线 (****)
        ]
        
        # 需要删除的注释模式（更具体的匹配）
        self.remove_patterns = [
            r'^\s*//\s*$',  # 空注释行
            r'^\s*//\s+\w+.*$',  # 一般性描述注释
        ]
        
        # 排除的目录
        self.exclude_dirs = {
            'node_modules', '.git', 'dist', 'build', 'coverage', 
            '.next', '.nuxt', 'public', 'static', '__pycache__'
        }
        
        # 排除的文件
        self.exclude_files = {
            'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
            '.gitignore', '.eslintrc.js', '.prettierrc.js'
        }

    def should_preserve_comment(self, line: str) -> bool:
        """判断是否应该保留注释"""
        line_stripped = line.strip()
        
        # 检查保留模式
        for pattern in self.preserve_patterns:
            if re.match(pattern, line_stripped, re.IGNORECASE):
                return True
        
        # 检查是否是多行注释的一部分
        if '/*' in line or '*/' in line or line_stripped.startswith('*'):
            return True
            
        # 检查是否包含重要关键词
        important_keywords = [
            'important', 'critical', 'warning', 'danger', 'security',
            'performance', 'optimization', 'config', 'configuration',
            'api', 'endpoint', 'url', 'path', 'route', 'middleware'
        ]
        
        for keyword in important_keywords:
            if keyword.lower() in line.lower():
                return True
        
        return False

    def should_remove_comment(self, line: str) -> bool:
        """判断是否应该删除注释"""
        line_stripped = line.strip()
        
        # 如果应该保留，则不删除
        if self.should_preserve_comment(line):
            return False
        
        # 检查删除模式
        for pattern in self.remove_patterns:
            if re.match(pattern, line_stripped):
                return True
        
        # 检查是否是简单的描述性注释
        if re.match(r'^\s*//\s*[^@\-\*=].*$', line_stripped):
            # 进一步检查是否包含有用信息
            comment_content = re.sub(r'^\s*//', '', line_stripped).strip()
            
            # 如果注释内容太短或太简单，删除
            if len(comment_content) < 3:
                return True
            
            # 如果是常见的无用注释，删除
            useless_patterns = [
                r'^(导入|import).*$',
                r'^(导出|export).*$',
                r'^(定义|define).*$',
                r'^(创建|create).*$',
                r'^(初始化|init).*$',
                r'^(设置|set).*$',
                r'^(获取|get).*$',
                r'^(处理|handle).*$',
                r'^(渲染|render).*$',
                r'^(组件|component).*$',
                r'^(函数|function).*$',
                r'^(方法|method).*$',
                r'^(变量|variable).*$',
                r'^(状态|state).*$',
                r'^(属性|prop).*$',
                r'^(样式|style).*$',
                r'^(类|class).*$',
                r'^(接口|interface).*$',
                r'^(类型|type).*$',
            ]
            
            for pattern in useless_patterns:
                if re.match(pattern, comment_content, re.IGNORECASE):
                    return True
        
        return False

    def clean_file(self, file_path: Path) -> Tuple[int, List[str]]:
        """清理单个文件中的注释"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    lines = f.readlines()
            except UnicodeDecodeError:
                print(f"警告: 无法读取文件 {file_path} (编码问题)")
                return 0, []

        new_lines = []
        removed_comments = []
        removed_count = 0
        in_string = False
        string_char = None
        
        for i, line in enumerate(lines, 1):
            original_line = line
            should_remove = False
            
            # 简单的字符串检测（避免删除字符串中的 //）
            temp_line = line
            j = 0
            while j < len(temp_line):
                char = temp_line[j]
                if not in_string:
                    if char in ['"', "'", '`']:
                        in_string = True
                        string_char = char
                    elif temp_line[j:j+2] == '//':
                        # 找到注释，检查是否应该删除
                        if self.should_remove_comment(line):
                            should_remove = True
                            removed_comments.append(f"第{i}行: {line.strip()}")
                            removed_count += 1
                        break
                else:
                    if char == string_char and (j == 0 or temp_line[j-1] != '\\'):
                        in_string = False
                        string_char = None
                j += 1
            
            if not should_remove:
                new_lines.append(original_line)
        
        # 如果有修改且不是试运行，写入文件
        if removed_count > 0 and not self.dry_run:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.writelines(new_lines)
            except Exception as e:
                print(f"错误: 无法写入文件 {file_path}: {e}")
                return 0, []
        
        return removed_count, removed_comments

    def scan_directory(self, directory: Path) -> List[Path]:
        """扫描目录，找到所有需要处理的文件"""
        files_to_process = []
        
        for root, dirs, files in os.walk(directory):
            # 排除特定目录
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            
            for file in files:
                file_path = Path(root) / file
                
                # 检查文件扩展名
                if file_path.suffix.lower() in self.supported_extensions:
                    # 检查是否在排除列表中
                    if file not in self.exclude_files:
                        files_to_process.append(file_path)
        
        return files_to_process

    def clean_project(self, project_path: Path) -> None:
        """清理整个项目"""
        if not project_path.exists():
            print(f"错误: 项目路径不存在: {project_path}")
            return
        
        print(f"{'[试运行] ' if self.dry_run else ''}开始清理项目: {project_path}")
        print(f"支持的文件类型: {', '.join(self.supported_extensions)}")
        print()
        
        # 扫描文件
        files_to_process = self.scan_directory(project_path)
        print(f"找到 {len(files_to_process)} 个文件需要处理")
        print()
        
        # 处理每个文件
        total_removed = 0
        for file_path in files_to_process:
            removed_count, removed_comments = self.clean_file(file_path)
            
            if removed_count > 0:
                self.processed_files += 1
                total_removed += removed_count
                
                print(f"{'[试运行] ' if self.dry_run else ''}处理文件: {file_path.relative_to(project_path)}")
                print(f"  删除了 {removed_count} 行注释:")
                for comment in removed_comments[:5]:  # 只显示前5个
                    print(f"    - {comment}")
                if len(removed_comments) > 5:
                    print(f"    ... 还有 {len(removed_comments) - 5} 行")
                print()
        
        self.removed_comments = total_removed
        
        # 输出总结
        print("=" * 50)
        print(f"{'[试运行] ' if self.dry_run else ''}清理完成!")
        print(f"处理的文件数: {self.processed_files}")
        print(f"删除的注释行数: {self.removed_comments}")
        
        if self.dry_run:
            print("\n这是试运行模式，没有实际修改文件。")
            print("如果确认要执行清理，请使用 --execute 参数。")

def main():
    parser = argparse.ArgumentParser(description='清理JavaScript/JSX/CSS/SCSS文件中的单行注释')
    parser.add_argument('path', nargs='?', default='.', help='项目路径 (默认: 当前目录)')
    parser.add_argument('--execute', action='store_true', help='执行实际清理 (默认为试运行模式)')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')
    
    args = parser.parse_args()
    
    project_path = Path(args.path).resolve()
    dry_run = not args.execute
    
    # 创建清理器
    cleaner = CommentCleaner(dry_run=dry_run)
    
    # 执行清理
    try:
        cleaner.clean_project(project_path)
    except KeyboardInterrupt:
        print("\n操作被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()