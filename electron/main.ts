import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync, readFileSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─ dist
// │ └── index.html
// │
// ├─┬─ dist-electron
// │ ├── main.js
// │ └── preload.js
//
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

// ============================================
// IPC Handlers - Printer
// ============================================

/**
 * 시스템 프린터 목록 조회
 */
ipcMain.handle('get-printers', async () => {
  if (!win) return []

  try {
    const printers = await win.webContents.getPrintersAsync()
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      description: printer.description,
      status: printer.status,
      isDefault: printer.isDefault,
    }))
  } catch (error) {
    console.error('프린터 목록 조회 오류:', error)
    return []
  }
})

/**
 * PDF 인쇄
 */
ipcMain.handle('print-pdf', async (_event, options: {
  printerName?: string
  silent?: boolean
  copies?: number
}) => {
  if (!win) return { success: false, error: 'Window not found' }

  try {
    const printOptions = {
      silent: options.silent ?? true,
      deviceName: options.printerName,
      copies: options.copies ?? 1,
    }

    const success = await win.webContents.print(printOptions)
    return { success }
  } catch (error) {
    console.error('PDF 인쇄 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * PDF 파일로 저장
 */
ipcMain.handle('print-to-pdf', async () => {
  if (!win) return { success: false, error: 'Window not found' }

  try {
    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: 'output.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })

    if (!filePath) {
      return { success: false, error: 'Cancelled' }
    }

    const data = await win.webContents.printToPDF({})
    writeFileSync(filePath, data)

    return { success: true, filePath }
  } catch (error) {
    console.error('PDF 저장 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 라벨 인쇄 (Zebra ZPL)
 * Note: 실제 ZPL 프린터 연동은 추가 설정 필요
 */
ipcMain.handle('print-label', async (_event, options: {
  printerName: string
  zplData?: string
  pdfBase64?: string
}) => {
  if (!win) return { success: false, error: 'Window not found' }

  try {
    // ZPL 데이터가 있는 경우 (라벨 프린터용)
    if (options.zplData) {
      // ZPL 프린터로 직접 전송 (구현 예정)
      // 현재는 일반 프린터로 인쇄
      console.log('ZPL 라벨 인쇄 요청:', options.printerName)
      return { success: true, message: 'ZPL 인쇄 대기중 (구현 예정)' }
    }

    // PDF Base64가 있는 경우
    if (options.pdfBase64) {
      const printOptions = {
        silent: true,
        deviceName: options.printerName,
        copies: 1,
      }

      await win.webContents.print(printOptions)
      return { success: true }
    }

    return { success: false, error: 'No print data provided' }
  } catch (error) {
    console.error('라벨 인쇄 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - File System
// ============================================

/**
 * 파일 저장 다이얼로그
 */
ipcMain.handle('save-file-dialog', async (_event, options: {
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}) => {
  if (!win) return null

  const result = await dialog.showSaveDialog(win, {
    defaultPath: options.defaultPath,
    filters: options.filters,
  })

  return result.filePath || null
})

/**
 * 파일 열기 다이얼로그
 */
ipcMain.handle('open-file-dialog', async (_event, options: {
  filters?: { name: string; extensions: string[] }[]
  multiple?: boolean
}) => {
  if (!win) return []

  const result = await dialog.showOpenDialog(win, {
    filters: options.filters,
    properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
  })

  return result.filePaths
})

/**
 * 파일 쓰기
 */
ipcMain.handle('write-file', async (_event, options: {
  filePath: string
  data: string | Buffer
}) => {
  try {
    writeFileSync(options.filePath, options.data)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

/**
 * 파일 읽기
 */
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const data = readFileSync(filePath)
    return { success: true, data: data.toString('base64') }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
