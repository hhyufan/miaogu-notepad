import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, writeFile, readdir, stat } from 'fs/promises'
import { watch } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let mainWindow
let store
let fileWatcher = null

// 动态导入electron-store
async function initStore() {
  const Store = (await import('electron-store')).default
  store = new Store({
    name: 'editor-state',
    defaults: {
      currentFile: null,
      treeData: [],
      expandedSections: [],
      isModified: false
    }
  })
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    // 暂时移除图标引用以避免构建错误
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // 初始化electron-store
  await initStore()
  
  // Set app user model id for windows
  electronApp.setAppUserModelId('top.miaogu.md.editor')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers for file operations
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'MgTree Files', extensions: ['mgtree'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result
  })

  ipcMain.handle('save-file-dialog', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'MgTree Files', extensions: ['mgtree'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result
  })

  ipcMain.handle('save-png-dialog', async (event, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [
        { name: 'PNG Images', extensions: ['png'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result
  })

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const content = await readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`)
    }
  })

  ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
      await writeFile(filePath, content, 'utf-8')
      return true
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`)
    }
  })

  ipcMain.handle('write-binary-file', async (event, filePath, buffer) => {
    try {
      await writeFile(filePath, Buffer.from(buffer))
      return true
    } catch (error) {
      throw new Error(`Failed to write binary file: ${error.message}`)
    }
  })

  ipcMain.handle('read-directory', async (event, dirPath) => {
    try {
      const entries = await readdir(dirPath)
      const contents = []

      for (const entry of entries) {
        try {
          const fullPath = join(dirPath, entry)
          const stats = await stat(fullPath)
          contents.push({
            name: entry,
            path: fullPath,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            size: stats.size,
            modified: stats.mtime
          })
        } catch (entryError) {
          // 跳过无法访问的文件/目录
          console.warn(`Cannot access ${entry}:`, entryError.message)
        }
      }

      return contents
    } catch (error) {
      throw new Error(`Failed to read directory: ${error.message}`)
    }
  })

  // 窗口控制 IPC 处理程序
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) {
      mainWindow.minimize()
    }
  })

  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.handle('window-close', () => {
    if (mainWindow) {
      mainWindow.close()
    }
  })

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false
  })

  // electron-store IPC 处理程序
  ipcMain.handle('store-get', (event, key) => {
    return store.get(key)
  })

  ipcMain.handle('store-set', (event, key, value) => {
    store.set(key, value)
    return true
  })

  ipcMain.handle('store-delete', (event, key) => {
    store.delete(key)
    return true
  })

  ipcMain.handle('store-clear', () => {
    store.clear()
    return true
  })

  ipcMain.handle('store-get-all', () => {
    return store.store
  })

  // 文件监听 IPC 处理程序
  ipcMain.handle('watch-file', (event, filePath) => {
    try {
      // 如果已经有监听器，先关闭它
      if (fileWatcher) {
        fileWatcher.close()
        fileWatcher = null
      }

      // 创建新的文件监听器
      fileWatcher = watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
          console.log(`文件已更改: ${filePath}`)
          // 通知渲染进程文件已更改
          mainWindow.webContents.send('file-changed', filePath)
        }
      })

      console.log(`开始监听文件: ${filePath}`)
      return true
    } catch (error) {
      console.error('文件监听失败:', error)
      return false
    }
  })

  ipcMain.handle('stop-watch-file', () => {
    try {
      if (fileWatcher) {
        fileWatcher.close()
        fileWatcher = null
        console.log('停止文件监听')
      }
      return true
    } catch (error) {
      console.error('停止文件监听失败:', error)
      return false
    }
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
