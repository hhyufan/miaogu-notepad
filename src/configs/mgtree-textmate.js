/**
 * @fileoverview mgtree语言的TextMate语法定义
 * 用于Shiki集成，提供与Monaco Monarch相同的语法高亮功能
 * @author hhyufan
 * @version 1.3.1
 */

/**
 * 颜色配置 - 参考 Prism One Dark/Light 主题风格
 * 格式: [dark, light]
 */
const COLORS = {
    // 编辑器基础颜色
    editorBackground: ['#282c34', '#fafafa'],
    editorForeground: ['#abb2bf', '#383a42'],

    // 行内代码颜色 - 参考 Prism 的字符串和操作符颜色
    inlineCodeBacktick: ['#d19a66', '#986801'],    // 反引号 - 使用操作符颜色
    inlineCodeContent: ['#98c379', '#50a14f'],     // 代码内容 - 使用字符串颜色

    // 跳转节点颜色 - 参考 Prism 的关键字颜色
    jumpNode: ['#c678dd', '#a626a4'],              // 跳转节点 - 使用关键字颜色

    // 层级颜色 - 使用Prism风格，避开字符串(#98c379/#50a14f)、操作符(#56b6c2/#0184bc)、关键字(#c678dd/#a626a4)颜色
    level1: ['#e06c75', '#e45649'],                // 数字/常量颜色 - property, tag, boolean, number, constant
    level2: ['#e5c07b', '#c18401'],                // 函数颜色 - function, class-name
    level3: ['#61afef', '#4078f2'],                // 蓝色系 - 明显的蓝色调
    level4: ['#d19a66', '#986801'],                // 橙色系 - 明显的橙色调
    level5: ['#be5046', '#ca1243'],                // 深红色系 - 明显的红色调
    level6: ['#56b6c2', '#0184bc'],                // 青色系 - 明显的青色调

    // 其他元素颜色
    comment: ['#5c6370', '#a0a1a7'],               // 注释 - 直接使用 Prism 注释颜色
    string: ['#98c379', '#50a14f'],                // 字符串 - 直接使用 Prism 字符串颜色
    escape: ['#e06c75', '#e45649'],                // 转义字符 - 使用数字/常量颜色
    numeric: ['#d19a66', '#986801']                // 数字 - 基于函数颜色调整
};

/**
 * 获取颜色的辅助函数
 */
const getColor = (colorKey, isDark = false) => {
    const colors = COLORS[colorKey];
    return colors ? colors[isDark ? 0 : 1] : '#000000';
};

/**
 * mgtree语言的TextMate语法配置
 * 支持：
 * 1. 代码引用块（``中间的内容）高亮
 * 2. 不同层级的彩色高亮（根据缩进区分）
 * 3. 跳转节点语法（>language[number]）的蓝紫色高亮
 */
export const mgtreeTextMateGrammar = {
    id: 'mgtree',
    name: 'mgtree',
    scopeName: 'source.mgtree',
    aliases: ['mg-tree'],
    fileTypes: ['mgtree'],
    patterns: [
        // 跳转节点 - 最高优先级
        {
            name: 'keyword.control.jump.bracket.mgtree',
            match: '>([a-zA-Z]+)\\[(\\d+)\\]',
            captures: {
                0: {name: 'keyword.control.jump.bracket.mgtree'},
                1: {name: 'entity.name.type.mgtree'},
                2: {name: 'constant.numeric.mgtree'}
            }
        },
        {
            name: 'keyword.control.jump.increment.mgtree',
            match: '>([a-zA-Z]+)\\+\\+',
            captures: {
                0: {name: 'keyword.control.jump.increment.mgtree'},
                1: {name: 'entity.name.type.mgtree'}
            }
        },
        {
            name: 'keyword.control.jump.assignment.mgtree',
            match: '([a-zA-Z]+)\\+=(\\d+)',
            captures: {
                0: {name: 'keyword.control.jump.assignment.mgtree'},
                1: {name: 'entity.name.type.mgtree'},
                2: {name: 'constant.numeric.mgtree'}
            }
        },
        {
            name: 'keyword.control.jump.simple.mgtree',
            match: '>([a-zA-Z]+)(?![\\[\\+])',
            captures: {
                0: {name: 'keyword.control.jump.simple.mgtree'},
                1: {name: 'entity.name.type.mgtree'}
            }
        },
        // 行内代码 - 第二优先级，全局匹配
        {
            name: 'markup.inline.raw.mgtree',
            begin: '`',
            end: '`',
            beginCaptures: {
                0: {name: 'punctuation.definition.raw.begin.mgtree'}
            },
            endCaptures: {
                0: {name: 'punctuation.definition.raw.end.mgtree'}
            },
            contentName: 'markup.inline.raw.content.mgtree'
        },
        // 层级1 - 使用begin/end模式，允许内部匹配
        {
            name: 'markup.heading.1.mgtree',
            begin: '^([^\\s])',
            end: '$',
            beginCaptures: {
                0: {name: 'markup.heading.1.mgtree'}
            },
            patterns: [
                {include: '$self'}
            ]
        },
        // 层级6 - 使用begin/end模式（最深层级，10个空格）
        {
            name: 'markup.heading.6.mgtree',
            begin: '^          (?!  )',
            end: '$',
            beginCaptures: {
                0: {name: 'markup.heading.6.mgtree'}
            },
            patterns: [
                {include: '$self'}
            ]
        },
        // 层级5 - 使用begin/end模式（8个空格）
        {
            name: 'markup.heading.5.mgtree',
            begin: '^        (?!  )',
            end: '$',
            beginCaptures: {
                0: {name: 'markup.heading.5.mgtree'}
            },
            patterns: [
                {include: '$self'}
            ]
        },
        // 层级4 - 使用begin/end模式（6个空格）
        {
            name: 'markup.heading.4.mgtree',
            begin: '^      (?!  )',
            end: '$',
            beginCaptures: {
                0: {name: 'markup.heading.4.mgtree'}
            },
            patterns: [
                {include: '$self'}
            ]
        },
        // 层级3 - 使用begin/end模式（4个空格）
        {
            name: 'markup.heading.3.mgtree',
            begin: '^    (?!  )',
            end: '$',
            beginCaptures: {
                0: {name: 'markup.heading.3.mgtree'}
            },
            patterns: [
                {include: '$self'}
            ]
        },
        // 层级2 - 使用begin/end模式（2个空格）
        {
            name: 'markup.heading.2.mgtree',
            begin: '^  (?!  )',
            end: '$',
            beginCaptures: {
                0: {name: 'markup.heading.2.mgtree'}
            },
            patterns: [
                {include: '$self'}
            ]
        },
        // 行注释
        {
            name: 'comment.line.double-slash.mgtree',
            match: '//.*$'
        },
        // 块注释
        {
            name: 'comment.block.mgtree',
            begin: '/\\*',
            end: '\\*/',
            patterns: [
                {
                    name: 'comment.block.mgtree',
                    match: '.*'
                }
            ]
        },
        // 数字
        {
            name: 'constant.numeric.mgtree',
            match: '\\b\\d+\\b'
        },
        // 双引号字符串
        {
            name: 'string.quoted.double.mgtree',
            begin: '"',
            end: '"',
            patterns: [
                {
                    name: 'constant.character.escape.mgtree',
                    match: '\\\\.'
                }
            ]
        },
        // 单引号字符串
        {
            name: 'string.quoted.single.mgtree',
            begin: "'",
            end: "'",
            patterns: [
                {
                    name: 'constant.character.escape.mgtree',
                    match: '\\\\.'
                }
            ]
        }
    ]
};

/**
 * mgtree语言的Shiki主题配置
 * 与Monaco Monarch主题保持一致的颜色方案
 */
export const mgtreeShikiTheme = {
    light: {
        name: 'mgtree-light',
        type: 'light',
        colors: {
            'editor.background': getColor('editorBackground', false),
            'editor.foreground': getColor('editorForeground', false)
        },
        tokenColors: [
            {
                name: 'markup.inline.raw.mgtree',
                scope: [
                    'markup.heading.1.mgtree markup.inline.raw.mgtree',
                    'markup.heading.2.mgtree markup.inline.raw.mgtree',
                    'markup.heading.3.mgtree markup.inline.raw.mgtree',
                    'markup.heading.4.mgtree markup.inline.raw.mgtree',
                    'markup.heading.5.mgtree markup.inline.raw.mgtree',
                    'markup.heading.6.mgtree markup.inline.raw.mgtree',
                    'markup.inline.raw.mgtree',
                    'punctuation.definition.raw.begin.mgtree',
                    'punctuation.definition.raw.end.mgtree'
                ],
                settings: {
                    foreground: getColor('inlineCodeBacktick', false)
                }
            },
            {
                name: 'markup.inline.raw.content.mgtree',
                scope: [
                    'markup.heading.1.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.2.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.3.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.4.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.5.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.6.mgtree markup.inline.raw.content.mgtree',
                    'markup.inline.raw.content.mgtree'
                ],
                settings: {
                    foreground: getColor('inlineCodeContent', false)
                }
            },
            {
                name: 'keyword.control.jump.mgtree',
                scope: [
                    'markup.heading.1.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.2.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.3.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.4.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.5.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.6.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.1.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.2.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.3.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.4.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.5.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.6.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.1.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.2.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.3.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.4.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.5.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.6.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.1.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.2.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.3.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.4.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.5.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.6.mgtree keyword.control.jump.simple.mgtree',
                    'keyword.control.jump.bracket.mgtree',
                    'keyword.control.jump.increment.mgtree',
                    'keyword.control.jump.assignment.mgtree',
                    'keyword.control.jump.simple.mgtree'
                ],
                settings: {
                    foreground: getColor('jumpNode', false)
                }
            },
            // 层级1
            {
                scope: 'markup.heading.1.mgtree',
                settings: {
                    foreground: getColor('level1', false),
                    fontStyle: 'bold'
                }
            },
            // 层级2
            {
                scope: 'markup.heading.2.mgtree',
                settings: {
                    foreground: getColor('level2', false),
                    fontStyle: 'bold'
                }
            },
            // 层级3
            {
                scope: 'markup.heading.3.mgtree',
                settings: {
                    foreground: getColor('level3', false),
                    fontStyle: 'bold'
                }
            },
            // 层级4
            {
                scope: 'markup.heading.4.mgtree',
                settings: {
                    foreground: getColor('level4', false),
                    fontStyle: 'bold'
                }
            },
            // 层级5
            {
                scope: 'markup.heading.5.mgtree',
                settings: {
                    foreground: getColor('level5', false),
                    fontStyle: 'bold'
                }
            },
            // 层级6
            {
                scope: 'markup.heading.6.mgtree',
                settings: {
                    foreground: getColor('level6', false),
                    fontStyle: 'bold'
                }
            },
            // 注释
            {
                scope: 'comment.line.double-slash.mgtree, comment.block.mgtree',
                settings: {
                    foreground: getColor('comment', false),
                    fontStyle: 'italic'
                }
            },
            // 字符串
            {
                scope: 'string.quoted.double.mgtree, string.quoted.single.mgtree',
                settings: {
                    foreground: getColor('string', false)
                }
            },
            // 字符串转义
            {
                scope: 'constant.character.escape.mgtree',
                settings: {
                    foreground: getColor('escape', false)
                }
            },
            // 数字
            {
                scope: 'constant.numeric.mgtree',
                settings: {
                    foreground: getColor('numeric', false)
                }
            }
        ]
    },
    dark: {
        name: 'mgtree-dark',
        type: 'dark',
        colors: {
            'editor.background': getColor('editorBackground', true),
            'editor.foreground': getColor('editorForeground', true)
        },
        tokenColors: [
            {
                name: 'markup.inline.raw.mgtree',
                scope: [
                    'markup.heading.1.mgtree markup.inline.raw.mgtree',
                    'markup.heading.2.mgtree markup.inline.raw.mgtree',
                    'markup.heading.3.mgtree markup.inline.raw.mgtree',
                    'markup.heading.4.mgtree markup.inline.raw.mgtree',
                    'markup.heading.5.mgtree markup.inline.raw.mgtree',
                    'markup.heading.6.mgtree markup.inline.raw.mgtree',
                    'markup.inline.raw.mgtree',
                    'punctuation.definition.raw.begin.mgtree',
                    'punctuation.definition.raw.end.mgtree'
                ],
                settings: {
                    foreground: getColor('inlineCodeBacktick', true)
                }
            },
            {
                name: 'markup.inline.raw.content.mgtree',
                scope: [
                    'markup.heading.1.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.2.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.3.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.4.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.5.mgtree markup.inline.raw.content.mgtree',
                    'markup.heading.6.mgtree markup.inline.raw.content.mgtree',
                    'markup.inline.raw.content.mgtree'
                ],
                settings: {
                    foreground: getColor('inlineCodeContent', true)
                }
            },
            {
                name: 'keyword.control.jump.mgtree',
                scope: [
                    'markup.heading.1.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.2.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.3.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.4.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.5.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.6.mgtree keyword.control.jump.bracket.mgtree',
                    'markup.heading.1.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.2.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.3.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.4.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.5.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.6.mgtree keyword.control.jump.increment.mgtree',
                    'markup.heading.1.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.2.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.3.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.4.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.5.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.6.mgtree keyword.control.jump.assignment.mgtree',
                    'markup.heading.1.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.2.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.3.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.4.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.5.mgtree keyword.control.jump.simple.mgtree',
                    'markup.heading.6.mgtree keyword.control.jump.simple.mgtree',
                    'keyword.control.jump.bracket.mgtree',
                    'keyword.control.jump.increment.mgtree',
                    'keyword.control.jump.assignment.mgtree',
                    'keyword.control.jump.simple.mgtree'
                ],
                settings: {
                    foreground: getColor('jumpNode', true)
                }
            },
            // 层级1
            {
                scope: 'markup.heading.1.mgtree',
                settings: {
                    foreground: getColor('level1', true),
                    fontStyle: 'bold'
                }
            },
            // 层级2
            {
                scope: 'markup.heading.2.mgtree',
                settings: {
                    foreground: getColor('level2', true),
                    fontStyle: 'bold'
                }
            },
            // 层级3
            {
                scope: 'markup.heading.3.mgtree',
                settings: {
                    foreground: getColor('level3', true),
                    fontStyle: 'bold'
                }
            },
            // 层级4
            {
                scope: 'markup.heading.4.mgtree',
                settings: {
                    foreground: getColor('level4', true),
                    fontStyle: 'bold'
                }
            },
            // 层级5
            {
                scope: 'markup.heading.5.mgtree',
                settings: {
                    foreground: getColor('level5', true),
                    fontStyle: 'bold'
                }
            },
            // 层级6
            {
                scope: 'markup.heading.6.mgtree',
                settings: {
                    foreground: getColor('level6', true),
                    fontStyle: 'bold'
                }
            },
            // 注释
            {
                scope: 'comment.line.double-slash.mgtree, comment.block.mgtree',
                settings: {
                    foreground: getColor('comment', true),
                    fontStyle: 'italic'
                }
            },
            // 字符串
            {
                scope: 'string.quoted.double.mgtree, string.quoted.single.mgtree',
                settings: {
                    foreground: getColor('string', true)
                }
            },
            // 字符串转义
            {
                scope: 'constant.character.escape.mgtree',
                settings: {
                    foreground: getColor('escape', true)
                }
            },
            // 数字
            {
                scope: 'constant.numeric.mgtree',
                settings: {
                    foreground: getColor('numeric', true)
                }
            }
        ]
    }
};
