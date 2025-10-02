/**
 * @fileoverview mgtree语言定义 - Monaco编辑器自定义语言配置
 * 为mgtree文件格式提供语法高亮支持，包括层级结构、代码引用块和跳转节点
 * @author hhyufan
 * @version 1.3.0
 */

/**
 * mgtree语言配置
 * 支持：
 * 1. 代码引用块（``中间的内容）高亮
 * 2. 不同层级的彩色高亮（根据缩进区分）
 * 3. 跳转节点语法（>language[number]）的蓝紫色高亮
 */
export const mgtreeLanguageConfig = {
    // 语言ID
    id: 'mgtree',

    // 语言扩展名
    extensions: ['.mgtree'],

    // 语言别名
    aliases: ['mgtree', 'MgTree'],

    // 语言配置
    configuration: {
        comments: {
            lineComment: '//',
            blockComment: ['/*', '*/']
        },
        brackets: [
            ['{', '}'],
            ['[', ']'],
            ['(', ')']
        ],
        autoClosingPairs: [
            {open: '{', close: '}'},
            {open: '[', close: ']'},
            {open: '(', close: ')'},
            {open: '`', close: '`'},
            {open: '"', close: '"'},
            {open: "'", close: "'"}
        ],
        surroundingPairs: [
            {open: '{', close: '}'},
            {open: '[', close: ']'},
            {open: '(', close: ')'},
            {open: '`', close: '`'},
            {open: '"', close: '"'},
            {open: "'", close: "'"}
        ]
    },

    // 语法规则
    monarchLanguage: {
        // 默认token
        defaultToken: 'text',

        // 忽略大小写
        ignoreCase: false,

        // token化规则
        tokenizer: {
            root: [
                // 代码引用块 - 高优先级匹配
                [/`[^`]*`/, 'code-block'],

                // 跳转节点语法 - >language[number] 格式
                [/>([a-zA-Z]+)\[(\d+)\]/, 'jump-node'],

                // 层级1 - 无缩进的行（根节点）
                [/^[^\s].*$/, 'level-1'],

                // 层级2 - 2个空格缩进
                [/^  [^\s].*$/, 'level-2'],

                // 层级3 - 4个空格缩进
                [/^    [^\s].*$/, 'level-3'],

                // 层级4 - 6个空格缩进
                [/^      [^\s].*$/, 'level-4'],

                // 层级5 - 8个空格缩进
                [/^        [^\s].*$/, 'level-5'],

                // 层级6+ - 10个或更多空格缩进
                [/^          .*$/, 'level-6'],

                // 注释
                [/\/\/.*$/, 'comment'],
                [/\/\*/, 'comment', '@comment'],

                // 数字
                [/\d+/, 'number'],

                // 字符串
                [/"([^"\\]|\\.)*$/, 'string.invalid'],
                [/"/, 'string', '@string'],
                [/'([^'\\]|\\.)*$/, 'string.invalid'],
                [/'/, 'string', '@string_single'],

                // 默认文本
                [/.*/, 'text']
            ],

            // 注释状态
            comment: [
                [/[^\/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[\/*]/, 'comment']
            ],

            // 双引号字符串状态
            string: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape'],
                [/"/, 'string', '@pop']
            ],

            // 单引号字符串状态
            string_single: [
                [/[^\\']+/, 'string'],
                [/\\./, 'string.escape'],
                [/'/, 'string', '@pop']
            ]
        }
    }
};

/**
 * mgtree主题配置
 * 定义各种token的颜色和样式
 */
export const mgtreeThemeConfig = {
    // 亮色主题
    light: {
        base: 'vs',
        inherit: true,
        rules: [
            // 代码引用块 - 深蓝色背景，白色文字
            {token: 'code-block', foreground: '1e40af', background: 'e0e7ff', fontStyle: 'bold'},

            // 跳转节点 - 蓝紫色
            {token: 'jump-node', foreground: '7c3aed', fontStyle: 'bold'},

            // 层级1 - 深红色（根节点）
            {token: 'level-1', foreground: 'dc2626', fontStyle: 'bold'},

            // 层级2 - 橙色
            {token: 'level-2', foreground: 'ea580c', fontStyle: 'bold'},

            // 层级3 - 黄色
            {token: 'level-3', foreground: 'd97706', fontStyle: 'bold'},

            // 层级4 - 绿色
            {token: 'level-4', foreground: '16a34a', fontStyle: 'bold'},

            // 层级5 - 青色
            {token: 'level-5', foreground: '0891b2', fontStyle: 'bold'},

            // 层级6+ - 紫色
            {token: 'level-6', foreground: '9333ea', fontStyle: 'bold'},

            // 注释
            {token: 'comment', foreground: '6b7280', fontStyle: 'italic'},

            // 字符串
            {token: 'string', foreground: '059669'},
            {token: 'string.escape', foreground: 'dc2626'},
            {token: 'string.invalid', foreground: 'dc2626'},

            // 数字
            {token: 'number', foreground: '7c2d12'},

            // 默认文本
            {token: 'text', foreground: '374151'}
        ],
        colors: {
            'editor.background': '#ffffff',
            'editor.foreground': '#374151'
        }
    },

    // 暗色主题
    dark: {
        base: 'vs-dark',
        inherit: true,
        rules: [
            // 代码引用块 - 深蓝色背景，亮蓝色文字
            {token: 'code-block', foreground: '60a5fa', background: '1e3a8a', fontStyle: 'bold'},

            // 跳转节点 - 亮紫色
            {token: 'jump-node', foreground: 'a855f7', fontStyle: 'bold'},

            // 层级1 - 亮红色（根节点）
            {token: 'level-1', foreground: 'f87171', fontStyle: 'bold'},

            // 层级2 - 亮橙色
            {token: 'level-2', foreground: 'fb923c', fontStyle: 'bold'},

            // 层级3 - 亮黄色
            {token: 'level-3', foreground: 'fbbf24', fontStyle: 'bold'},

            // 层级4 - 亮绿色
            {token: 'level-4', foreground: '4ade80', fontStyle: 'bold'},

            // 层级5 - 亮青色
            {token: 'level-5', foreground: '22d3ee', fontStyle: 'bold'},

            // 层级6+ - 亮紫色
            {token: 'level-6', foreground: 'c084fc', fontStyle: 'bold'},

            // 注释
            {token: 'comment', foreground: '9ca3af', fontStyle: 'italic'},

            // 字符串
            {token: 'string', foreground: '34d399'},
            {token: 'string.escape', foreground: 'f87171'},
            {token: 'string.invalid', foreground: 'f87171'},

            // 数字
            {token: 'number', foreground: 'fdba74'},

            // 默认文本
            {token: 'text', foreground: 'e5e7eb'}
        ],
        colors: {
            'editor.background': '#1f2937',
            'editor.foreground': '#e5e7eb'
        }
    }
};
