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
    def __init__(self, dry_run: bool = True, aggressive: bool = False):
        self.dry_run = dry_run
        self.aggressive = aggressive  # 激进模式：无视所有规则清除所有//注释
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
        
        # 激进模式：删除所有//注释
        if self.aggressive:
            return '//' in line_stripped
        
        # 如果应该保留，则不删除
        if self.should_preserve_comment(line):
            return False
        
        # 检查删除模式
        for pattern in self.remove_patterns:
            if re.match(pattern, line_stripped):
                return True
        
        # 检查是否是单行注释
        if re.match(r'^\s*//', line_stripped):
            # 提取注释内容
            comment_content = re.sub(r'^\s*//\s*', '', line_stripped).strip()
            
            # 如果注释内容为空或太短，删除
            if len(comment_content) < 2:
                return True
            
            # 如果是常见的无用注释模式，删除
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
                r'^(检查|check).*$',
                r'^(如果|if).*$',
                r'^(使用|use).*$',
                r'^(添加|add).*$',
                r'^(移除|remove).*$',
                r'^(更新|update).*$',
                r'^(清理|clean).*$',
                r'^(保存|save).*$',
                r'^(加载|load).*$',
                r'^(监听|listen).*$',
                r'^(回退|fallback).*$',
                r'^(优先|prefer).*$',
                r'^(避免|avoid).*$',
                r'^(确保|ensure).*$',
                r'^(防止|prevent).*$',
                r'^(限制|limit).*$',
                r'^(静默|silent).*$',
                r'^(尝试|try).*$',
                r'^(构建|build).*$',
                r'^(生成|generate).*$',
                r'^(转换|convert).*$',
                r'^(解析|parse).*$',
                r'^(格式化|format).*$',
                r'^(验证|validate).*$',
                r'^(计算|calculate).*$',
                r'^(查找|find).*$',
                r'^(搜索|search).*$',
                r'^(过滤|filter).*$',
                r'^(排序|sort).*$',
                r'^(映射|map).*$',
                r'^(遍历|iterate).*$',
                r'^(循环|loop).*$',
                r'^(条件|condition).*$',
                r'^(判断|judge).*$',
                r'^(比较|compare).*$',
                r'^(匹配|match).*$',
                r'^(替换|replace).*$',
                r'^(分割|split).*$',
                r'^(合并|merge).*$',
                r'^(连接|join).*$',
                r'^(拼接|concat).*$',
                r'^(复制|copy).*$',
                r'^(克隆|clone).*$',
                r'^(深拷贝|deep copy).*$',
                r'^(浅拷贝|shallow copy).*$',
                r'^(序列化|serialize).*$',
                r'^(反序列化|deserialize).*$',
                r'^(编码|encode).*$',
                r'^(解码|decode).*$',
                r'^(压缩|compress).*$',
                r'^(解压|decompress).*$',
                r'^(缓存|cache).*$',
                r'^(存储|store).*$',
                r'^(读取|read).*$',
                r'^(写入|write).*$',
                r'^(删除|delete).*$',
                r'^(重置|reset).*$',
                r'^(清空|clear).*$',
                r'^(刷新|refresh).*$',
                r'^(重新加载|reload).*$',
                r'^(重新渲染|re-render).*$',
                r'^(重新计算|recalculate).*$',
                r'^(重新构建|rebuild).*$',
                r'^(重新初始化|reinitialize).*$',
                r'^(重新设置|reset).*$',
                r'^(重新配置|reconfigure).*$',
                r'^(重新连接|reconnect).*$',
                r'^(重新启动|restart).*$',
                r'^(重新开始|restart).*$',
                r'^(重新执行|re-execute).*$',
                r'^(重新运行|re-run).*$',
                r'^(重新调用|re-call).*$',
                r'^(重新发送|resend).*$',
                r'^(重新请求|re-request).*$',
                r'^(重新获取|re-fetch).*$',
                r'^(重新查询|re-query).*$',
                r'^(重新搜索|re-search).*$',
                r'^(重新查找|re-find).*$',
                r'^(重新匹配|re-match).*$',
                r'^(重新验证|re-validate).*$',
                r'^(重新检查|re-check).*$',
                r'^(重新测试|re-test).*$',
                r'^(重新尝试|retry).*$',
                r'^(API请求|API request).*$',
                r'^(节流|throttle).*$',
                r'^(防抖|debounce).*$',
                r'^(延迟|delay).*$',
                r'^(定时器|timer).*$',
                r'^(计时器|counter).*$',
                r'^(时间戳|timestamp).*$',
                r'^(日期|date).*$',
                r'^(时间|time).*$',
                r'^(年|year).*$',
                r'^(月|month).*$',
                r'^(日|day).*$',
                r'^(小时|hour).*$',
                r'^(分钟|minute).*$',
                r'^(秒|second).*$',
                r'^(毫秒|millisecond).*$',
                r'^(微秒|microsecond).*$',
                r'^(纳秒|nanosecond).*$',
                r'^(即使|even).*$',
                r'^(无论|regardless).*$',
                r'^(不管|no matter).*$',
                r'^(当|when).*$',
                r'^(在|at|in).*$',
                r'^(从|from).*$',
                r'^(到|to).*$',
                r'^(向|towards).*$',
                r'^(对于|for).*$',
                r'^(关于|about).*$',
                r'^(基于|based on).*$',
                r'^(根据|according to).*$',
                r'^(依据|based on).*$',
                r'^(按照|according to).*$',
                r'^(遵循|follow).*$',
                r'^(符合|conform to).*$',
                r'^(满足|satisfy).*$',
                r'^(达到|reach).*$',
                r'^(实现|achieve).*$',
                r'^(完成|complete).*$',
                r'^(结束|end).*$',
                r'^(开始|start).*$',
                r'^(启动|launch).*$',
                r'^(停止|stop).*$',
                r'^(暂停|pause).*$',
                r'^(继续|continue).*$',
                r'^(恢复|resume).*$',
                r'^(中断|interrupt).*$',
                r'^(取消|cancel).*$',
                r'^(终止|terminate).*$',
                r'^(退出|exit).*$',
                r'^(返回|return).*$',
                r'^(跳转|jump).*$',
                r'^(跳过|skip).*$',
                r'^(忽略|ignore).*$',
                r'^(排除|exclude).*$',
                r'^(包含|include).*$',
                r'^(包括|including).*$',
                r'^(除了|except).*$',
                r'^(除非|unless).*$',
                r'^(只有|only).*$',
                r'^(仅|only).*$',
                r'^(仅仅|just).*$',
                r'^(只是|just).*$',
                r'^(只需|just need).*$',
                r'^(只要|as long as).*$',
                r'^(只能|can only).*$',
                r'^(只会|will only).*$',
                r'^(只在|only in).*$',
                r'^(只对|only for).*$',
                r'^(只用|only use).*$',
                r'^(只支持|only support).*$',
                r'^(只允许|only allow).*$',
                r'^(只接受|only accept).*$',
                r'^(只处理|only handle).*$',
                r'^(只显示|only show).*$',
                r'^(只返回|only return).*$',
                r'^(只传递|only pass).*$',
                r'^(直接|directly).*$',
                r'^(间接|indirectly).*$',
                r'^(立即|immediately).*$',
                r'^(马上|right away).*$',
                r'^(稍后|later).*$',
                r'^(之后|after).*$',
                r'^(之前|before).*$',
                r'^(同时|meanwhile).*$',
                r'^(然后|then).*$',
                r'^(接着|next).*$',
                r'^(最后|finally).*$',
                r'^(首先|first).*$',
                r'^(其次|second).*$',
                r'^(再次|again).*$',
                r'^(另外|additionally).*$',
                r'^(此外|besides).*$',
                r'^(而且|moreover).*$',
                r'^(并且|and).*$',
                r'^(或者|or).*$',
                r'^(要么|either).*$',
                r'^(既然|since).*$',
                r'^(因为|because).*$',
                r'^(由于|due to).*$',
                r'^(所以|so).*$',
                r'^(因此|therefore).*$',
                r'^(结果|result).*$',
                r'^(导致|cause).*$',
                r'^(引起|trigger).*$',
                r'^(产生|generate).*$',
                r'^(形成|form).*$',
                r'^(构成|constitute).*$',
                r'^(组成|compose).*$',
                r'^(包含|contain).*$',
                r'^(拥有|have).*$',
                r'^(具有|possess).*$',
                r'^(存在|exist).*$',
                r'^(出现|appear).*$',
                r'^(发生|happen).*$',
                r'^(发现|discover).*$',
                r'^(找到|found).*$',
                r'^(获得|obtain).*$',
                r'^(得到|get).*$',
                r'^(收到|receive).*$',
                r'^(接收|receive).*$',
                r'^(发送|send).*$',
                r'^(传送|transmit).*$',
                r'^(传递|pass).*$',
                r'^(传输|transfer).*$',
                r'^(输入|input).*$',
                r'^(输出|output).*$',
                r'^(导入|import).*$',
                r'^(导出|export).*$',
                r'^(引入|introduce).*$',
                r'^(引用|reference).*$',
                r'^(调用|call).*$',
                r'^(执行|execute).*$',
                r'^(运行|run).*$',
                r'^(启用|enable).*$',
                r'^(禁用|disable).*$',
                r'^(开启|turn on).*$',
                r'^(关闭|turn off).*$',
                r'^(打开|open).*$',
                r'^(关闭|close).*$',
                r'^(显示|show).*$',
                r'^(隐藏|hide).*$',
                r'^(可见|visible).*$',
                r'^(不可见|invisible).*$',
                r'^(可用|available).*$',
                r'^(不可用|unavailable).*$',
                r'^(有效|valid).*$',
                r'^(无效|invalid).*$',
                r'^(正确|correct).*$',
                r'^(错误|error).*$',
                r'^(成功|success).*$',
                r'^(失败|fail).*$',
                r'^(完成|complete).*$',
                r'^(未完成|incomplete).*$',
                r'^(已完成|completed).*$',
                r'^(未开始|not started).*$',
                r'^(进行中|in progress).*$',
                r'^(等待|waiting).*$',
                r'^(准备|ready).*$',
                r'^(就绪|ready).*$',
                r'^(空闲|idle).*$',
                r'^(忙碌|busy).*$',
                r'^(活跃|active).*$',
                r'^(非活跃|inactive).*$',
                r'^(在线|online).*$',
                r'^(离线|offline).*$',
                r'^(连接|connect).*$',
                r'^(断开|disconnect).*$',
                r'^(连接中|connecting).*$',
                r'^(已连接|connected).*$',
                r'^(未连接|disconnected).*$',
                r'^(重连|reconnect).*$',
                r'^(超时|timeout).*$',
                r'^(过期|expired).*$',
                r'^(刷新|refresh).*$',
                r'^(更新|update).*$',
                r'^(升级|upgrade).*$',
                r'^(降级|downgrade).*$',
                r'^(回滚|rollback).*$',
                r'^(撤销|undo).*$',
                r'^(重做|redo).*$',
                r'^(恢复|restore).*$',
                r'^(备份|backup).*$',
                r'^(还原|restore).*$',
                r'^(同步|sync).*$',
                r'^(异步|async).*$',
                r'^(并发|concurrent).*$',
                r'^(串行|serial).*$',
                r'^(并行|parallel).*$',
                r'^(顺序|sequential).*$',
                r'^(随机|random).*$',
                r'^(排序|sort).*$',
                r'^(分组|group).*$',
                r'^(分类|classify).*$',
                r'^(分割|split).*$',
                r'^(合并|merge).*$',
                r'^(联合|union).*$',
                r'^(交集|intersection).*$',
                r'^(差集|difference).*$',
                r'^(子集|subset).*$',
                r'^(超集|superset).*$',
                r'^(集合|set).*$',
                r'^(数组|array).*$',
                r'^(列表|list).*$',
                r'^(队列|queue).*$',
                r'^(栈|stack).*$',
                r'^(堆|heap).*$',
                r'^(树|tree).*$',
                r'^(图|graph).*$',
                r'^(节点|node).*$',
                r'^(边|edge).*$',
                r'^(路径|path).*$',
                r'^(深度|depth).*$',
                r'^(广度|breadth).*$',
                r'^(遍历|traverse).*$',
                r'^(搜索|search).*$',
                r'^(查找|find).*$',
                r'^(定位|locate).*$',
                r'^(索引|index).*$',
                r'^(键|key).*$',
                r'^(值|value).*$',
                r'^(对|pair).*$',
                r'^(映射|mapping).*$',
                r'^(字典|dictionary).*$',
                r'^(哈希|hash).*$',
                r'^(散列|hash).*$',
                r'^(表|table).*$',
                r'^(数据库|database).*$',
                r'^(表格|table).*$',
                r'^(行|row).*$',
                r'^(列|column).*$',
                r'^(字段|field).*$',
                r'^(记录|record).*$',
                r'^(条目|entry).*$',
                r'^(项目|item).*$',
                r'^(元素|element).*$',
                r'^(成员|member).*$',
                r'^(属性|property).*$',
                r'^(特性|feature).*$',
                r'^(功能|function).*$',
                r'^(能力|capability).*$',
                r'^(权限|permission).*$',
                r'^(角色|role).*$',
                r'^(用户|user).*$',
                r'^(管理员|admin).*$',
                r'^(访客|guest).*$',
                r'^(会员|member).*$',
                r'^(客户|customer).*$',
                r'^(供应商|supplier).*$',
                r'^(提供商|provider).*$',
                r'^(服务商|service provider).*$',
                r'^(开发者|developer).*$',
                r'^(程序员|programmer).*$',
                r'^(工程师|engineer).*$',
                r'^(架构师|architect).*$',
                r'^(设计师|designer).*$',
                r'^(测试员|tester).*$',
                r'^(分析师|analyst).*$',
                r'^(顾问|consultant).*$',
                r'^(专家|expert).*$',
                r'^(新手|beginner).*$',
                r'^(初学者|beginner).*$',
                r'^(高级|advanced).*$',
                r'^(中级|intermediate).*$',
                r'^(初级|junior).*$',
                r'^(资深|senior).*$',
                r'^(主管|supervisor).*$',
                r'^(经理|manager).*$',
                r'^(总监|director).*$',
                r'^(总裁|president).*$',
                r'^(CEO|CEO).*$',
                r'^(CTO|CTO).*$',
                r'^(CFO|CFO).*$',
                r'^(COO|COO).*$',
                r'^(CMO|CMO).*$',
                r'^(CIO|CIO).*$',
                r'^(CHRO|CHRO).*$',
                r'^(VP|VP).*$',
                r'^(SVP|SVP).*$',
                r'^(EVP|EVP).*$',
                r'^(AVP|AVP).*$',
                r'^(MD|MD).*$',
                r'^(GM|GM).*$',
                r'^(PM|PM).*$',
                r'^(PO|PO).*$',
                r'^(BA|BA).*$',
                r'^(QA|QA).*$',
                r'^(QE|QE).*$',
                r'^(DevOps|DevOps).*$',
                r'^(SRE|SRE).*$',
                r'^(DBA|DBA).*$',
                r'^(SA|SA).*$',
                r'^(SE|SE).*$',
                r'^(FE|FE).*$',
                r'^(BE|BE).*$',
                r'^(FS|FS).*$',
                r'^(UI|UI).*$',
                r'^(UX|UX).*$',
                r'^(UE|UE).*$',
                r'^(PD|PD).*$',
                r'^(RD|RD).*$',
                r'^(OP|OP).*$',
                r'^(OPS|OPS).*$',
                r'^(IT|IT).*$',
                r'^(IS|IS).*$',
                r'^(CS|CS).*$',
                r'^(AI|AI).*$',
                r'^(ML|ML).*$',
                r'^(DL|DL).*$',
                r'^(NLP|NLP).*$',
                r'^(CV|CV).*$',
                r'^(AR|AR).*$',
                r'^(VR|VR).*$',
                r'^(MR|MR).*$',
                r'^(XR|XR).*$',
                r'^(IoT|IoT).*$',
                r'^(IIoT|IIoT).*$',
                r'^(5G|5G).*$',
                r'^(6G|6G).*$',
                r'^(WiFi|WiFi).*$',
                r'^(Bluetooth|Bluetooth).*$',
                r'^(NFC|NFC).*$',
                r'^(RFID|RFID).*$',
                r'^(GPS|GPS).*$',
                r'^(GIS|GIS).*$',
                r'^(API|API).*$',
                r'^(SDK|SDK).*$',
                r'^(IDE|IDE).*$',
                r'^(CLI|CLI).*$',
                r'^(GUI|GUI).*$',
                r'^(TUI|TUI).*$',
                r'^(CUI|CUI).*$',
                r'^(UI|UI).*$',
                r'^(UX|UX).*$',
                r'^(DX|DX).*$',
                r'^(CX|CX).*$',
                r'^(EX|EX).*$',
                r'^(PX|PX).*$',
                r'^(BX|BX).*$',
                r'^(SX|SX).*$',
                r'^(TX|TX).*$',
                r'^(RX|RX).*$',
                r'^(FX|FX).*$',
                r'^(GX|GX).*$',
                r'^(HX|HX).*$',
                r'^(IX|IX).*$',
                r'^(JX|JX).*$',
                r'^(KX|KX).*$',
                r'^(LX|LX).*$',
                r'^(MX|MX).*$',
                r'^(NX|NX).*$',
                r'^(OX|OX).*$',
                r'^(PX|PX).*$',
                r'^(QX|QX).*$',
                r'^(RX|RX).*$',
                r'^(SX|SX).*$',
                r'^(TX|TX).*$',
                r'^(UX|UX).*$',
                r'^(VX|VX).*$',
                r'^(WX|WX).*$',
                r'^(XX|XX).*$',
                r'^(YX|YX).*$',
                r'^(ZX|ZX).*$'
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
            processed_line = line
            
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
                            if self.aggressive:
                                # 激进模式：删除整行或删除行内注释
                                code_part = temp_line[:j].rstrip()
                                if code_part:  # 如果有代码部分，保留代码删除注释
                                    processed_line = code_part + '\n'
                                    removed_comments.append(f"第{i}行内联注释: {temp_line[j:].strip()}")
                                else:  # 整行都是注释，删除整行
                                    should_remove = True
                                    removed_comments.append(f"第{i}行: {line.strip()}")
                            else:
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
                new_lines.append(processed_line)
        
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
    parser.add_argument('--aggressive', action='store_true', help='激进模式：删除所有//注释，包括内联注释')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')
    
    args = parser.parse_args()
    
    project_path = Path(args.path).resolve()
    dry_run = not args.execute
    
    # 创建清理器
    cleaner = CommentCleaner(dry_run=dry_run, aggressive=args.aggressive)
    
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