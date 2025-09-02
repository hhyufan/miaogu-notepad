import './TabBar.scss'
import { useCallback, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { EditOutlined, FileAddOutlined } from '@ant-design/icons'
import { Tabs } from 'antd'

const TabBar = ({ fileManager }) => {
    const { 
        currentFile, 
        openedFiles, 
        switchFile: switchToFile, 
        closeFile: closeFileByPath 
    } = fileManager
    
    const { theme, backgroundEnabled, backgroundImage } = useSelector(state => state.theme)
    const hasBackground = backgroundEnabled && backgroundImage

    const onChange = useCallback((activeKey) => {
        switchToFile(activeKey)
    }, [switchToFile])

    const onEdit = useCallback((targetKey, action) => {
        if (action === 'remove') {
            closeFileByPath(targetKey)
        }
    }, [closeFileByPath])

    // 生成唯一的文件标识符
    const getFileKey = useCallback((file) => {
        // 对于临时文件，使用临时标识符
        if (file.isTemporary) {
            return `temp-${file.name}`;
        }
        // 对于已保存文件，使用文件路径
        return file.path;
    }, []);

    const items = useMemo(() => openedFiles.map((file) => ({
        key: getFileKey(file),
        label: (
            <span>
                {file.name}
                {file.isTemporary ? (
                    <FileAddOutlined
                        style={{ marginLeft: '5px', fontSize: '12px', color: '#1890ff' }}
                    />
                ) : file.isModified ? (
                    <EditOutlined
                        style={{ marginLeft: '5px', fontSize: '12px', color: '#faad14' }}
                    />
                ) : null}
            </span>
        ),
        closable: true
    })), [openedFiles, getFileKey])

    // 设置标签栏高度CSS变量
    useEffect(() => {
        if (openedFiles.length === 0) {
            document.documentElement.style.setProperty('--tab-bar-height', '0px')
        } else {
            document.documentElement.style.setProperty('--tab-bar-height', '40px')
        }

        // 组件卸载时清理
        return () => {
            document.documentElement.style.setProperty('--tab-bar-height', '0px')
        }
    }, [openedFiles.length])

    // 如果没有打开的文件，不渲染标签栏
    if (openedFiles.length === 0) {
        return null
    }

    return (
        <div 
            className={`tab-bar ${hasBackground ? 'with-background' : ''}`}
            data-theme={theme}
        >
            <Tabs
                type="editable-card"
                onChange={onChange}
                activeKey={currentFile ? getFileKey(currentFile) : ''}
                onEdit={onEdit}
                items={items}
                hideAdd
            />
        </div>
    )
};

export default TabBar;