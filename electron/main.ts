import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync, readFileSync } from 'node:fs'

// ============================================
// Service Imports for IPC Handlers
// ============================================
import * as productionService from '../src/services/productionService'
import * as stockService from '../src/services/stockService'
import * as bomService from '../src/services/bomService'
import * as materialService from '../src/services/materialService'
import * as lotTraceService from '../src/services/lotTraceService'
import * as inspectionService from '../src/services/inspectionService'
import * as lineService from '../src/services/lineService'
import * as sequenceService from '../src/services/sequenceService'
import * as bundleService from '../src/services/bundleService'
import * as productService from '../src/services/productService'

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

// 개발 모드 감지: dist/index.html이 없으면 개발 모드
const isDev = !app.isPackaged

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
  } else if (isDev) {
    // 개발 모드에서 VITE_DEV_SERVER_URL이 없으면 기본 URL 사용
    win.loadURL('http://localhost:5173')
  } else {
    // 프로덕션 모드
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

// ============================================
// IPC Handlers - Production API (10개)
// ============================================

/**
 * 생산 LOT 생성
 */
ipcMain.handle('production:createLot', async (_event, input: Parameters<typeof productionService.createLot>[0]) => {
  try {
    const result = await productionService.createLot(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:createLot 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 생산 시작
 */
ipcMain.handle('production:startProduction', async (_event, lotId: number) => {
  try {
    const result = await productionService.startProduction(lotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:startProduction 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 생산 완료
 */
ipcMain.handle('production:completeProduction', async (_event, lotId: number, quantity: number) => {
  try {
    const result = await productionService.completeProduction(lotId, quantity)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:completeProduction 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * LOT에 자재 추가
 */
ipcMain.handle('production:addMaterial', async (_event, lotId: number, materialId: number, quantity: number, lotNumber?: string) => {
  try {
    const result = await productionService.addMaterial(lotId, materialId, quantity, lotNumber)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:addMaterial 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * LOT에서 자재 제거
 */
ipcMain.handle('production:removeMaterial', async (_event, lotMaterialId: number) => {
  try {
    const result = await productionService.removeMaterial(lotMaterialId)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:removeMaterial 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * LOT ID로 조회
 */
ipcMain.handle('production:getLotById', async (_event, lotId: number) => {
  try {
    const result = await productionService.getLotById(lotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:getLotById 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * LOT 번호로 조회
 */
ipcMain.handle('production:getLotByNumber', async (_event, lotNumber: string) => {
  try {
    const result = await productionService.getLotByNumber(lotNumber)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:getLotByNumber 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정별 LOT 조회
 */
ipcMain.handle('production:getLotsByProcess', async (_event, processCode: string) => {
  try {
    const result = await productionService.getLotsByProcess(processCode)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:getLotsByProcess 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 상태별 LOT 조회
 */
ipcMain.handle('production:getLotsByStatus', async (_event, status: string) => {
  try {
    const result = await productionService.getLotsByStatus(status)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:getLotsByStatus 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * LOT 수량 업데이트
 */
ipcMain.handle('production:updateLotQuantity', async (_event, lotId: number, quantity: number) => {
  try {
    const result = await productionService.updateLotQuantity(lotId, quantity)
    return { success: true, data: result }
  } catch (error) {
    console.error('production:updateLotQuantity 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - Stock API (8개)
// ============================================

/**
 * 재고 입고
 */
ipcMain.handle('stock:receiveStock', async (_event, input: Parameters<typeof stockService.receiveStock>[0]) => {
  try {
    const result = await stockService.receiveStock(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('stock:receiveStock 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 재고 소비
 */
ipcMain.handle('stock:consumeStock', async (_event, stockId: number, quantity: number, lotId?: number) => {
  try {
    const result = await stockService.consumeStock(stockId, quantity, lotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('stock:consumeStock 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * BOM 기반 재고 차감
 */
ipcMain.handle('stock:deductByBOM', async (_event, productId: number, processCode: string, productionQty: number, inputMaterials?: Array<{materialId: number, quantity: number, lotNumber?: string}>, allowNegative?: boolean, productionLotId?: number) => {
  try {
    const result = await stockService.deductByBOM(productId, processCode, productionQty, inputMaterials, allowNegative, productionLotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('stock:deductByBOM 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 자재별 재고 조회
 */
ipcMain.handle('stock:getStockByMaterial', async (_event, materialId: number) => {
  try {
    const result = await stockService.getStockByMaterial(materialId)
    return { success: true, data: result }
  } catch (error) {
    console.error('stock:getStockByMaterial 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 전체 재고 요약
 */
ipcMain.handle('stock:getStockSummary', async () => {
  try {
    const result = await stockService.getStockSummary()
    return { success: true, data: result }
  } catch (error) {
    console.error('stock:getStockSummary 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 부족 재고 조회
 */
ipcMain.handle('stock:getLowStock', async () => {
  try {
    const result = await stockService.getLowStock()
    return { success: true, data: result }
  } catch (error) {
    console.error('stock:getLowStock 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 가용 수량 조회
 */
ipcMain.handle('stock:getAvailableQty', async (_event, materialId: number) => {
  try {
    const result = await stockService.getAvailableQty(materialId)
    return { success: true, data: result }
  } catch (error) {
    console.error('stock:getAvailableQty 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 오늘 입고 목록 조회
 */
ipcMain.handle('stock:getTodayReceivings', async () => {
  try {
    const result = await stockService.getTodayReceivings()
    return { success: true, data: result }
  } catch (error) {
    console.error('stock:getTodayReceivings 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 전체 재고 조회
 */
ipcMain.handle('stock:getAllStocks', async (_event, options?: { materialCode?: string; showZero?: boolean }) => {
  try {
    // 모든 자재의 재고를 조회
    const materials = await import('../src/lib/prisma').then(m => m.prisma.material.findMany({
      where: options?.materialCode ? { code: { contains: options.materialCode } } : undefined,
      include: {
        stocks: {
          orderBy: { receivedAt: 'asc' }
        }
      }
    }))

    const allStocks: Array<{
      id: number
      materialId: number
      materialCode: string
      materialName: string
      lotNumber: string
      quantity: number
      usedQty: number
      availableQty: number
      processCode?: string
      location: string | null
      receivedAt: Date
    }> = []

    for (const mat of materials) {
      for (const stock of mat.stocks) {
        const availableQty = stock.quantity - stock.usedQty
        // showZero가 false면 가용 수량 0인 것 제외
        if (!options?.showZero && availableQty <= 0) continue

        allStocks.push({
          id: stock.id,
          materialId: stock.materialId,
          materialCode: mat.code,
          materialName: mat.name,
          lotNumber: stock.lotNumber,
          quantity: stock.quantity,
          usedQty: stock.usedQty,
          availableQty,
          processCode: stock.location || undefined, // location을 processCode로 활용
          location: stock.location,
          receivedAt: stock.receivedAt,
        })
      }
    }

    return { success: true, data: allStocks }
  } catch (error) {
    console.error('stock:getAllStocks 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정별 재고 등록 (registerProcessStock)
 * 공정 코드를 location 필드에 저장
 */
ipcMain.handle('stock:registerProcessStock', async (_event, input: {
  processCode: string
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
}) => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    // 기존 LOT 확인
    const existing = await prisma.materialStock.findFirst({
      where: {
        materialId: input.materialId,
        lotNumber: input.lotNumber,
        location: input.processCode, // processCode를 location에 저장
      }
    })

    if (existing) {
      // 기존 LOT에 수량 추가
      const updated = await prisma.materialStock.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + input.quantity }
      })
      return {
        success: true,
        data: {
          id: updated.id,
          isNewEntry: false,
          stock: {
            id: updated.id,
            materialId: updated.materialId,
            lotNumber: updated.lotNumber,
            quantity: updated.quantity,
            usedQty: updated.usedQty,
            availableQty: updated.quantity - updated.usedQty,
            processCode: updated.location,
          }
        }
      }
    }

    // 새 LOT 생성
    const stock = await prisma.materialStock.create({
      data: {
        materialId: input.materialId,
        lotNumber: input.lotNumber,
        quantity: input.quantity,
        usedQty: 0,
        location: input.processCode, // processCode를 location에 저장
        receivedAt: new Date(),
      }
    })

    return {
      success: true,
      data: {
        id: stock.id,
        isNewEntry: true,
        stock: {
          id: stock.id,
          materialId: stock.materialId,
          lotNumber: stock.lotNumber,
          quantity: stock.quantity,
          usedQty: stock.usedQty,
          availableQty: stock.quantity - stock.usedQty,
          processCode: stock.location,
        }
      }
    }
  } catch (error) {
    console.error('stock:registerProcessStock 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정별 재고 조회
 */
ipcMain.handle('stock:getStocksByProcess', async (_event, processCode: string, options?: { materialCode?: string; showZero?: boolean }) => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    const stocks = await prisma.materialStock.findMany({
      where: {
        location: processCode,
        ...(options?.materialCode ? {
          material: { code: { contains: options.materialCode } }
        } : {})
      },
      include: {
        material: { select: { code: true, name: true } }
      },
      orderBy: { receivedAt: 'asc' }
    })

    const result = stocks
      .map(s => ({
        id: s.id,
        materialId: s.materialId,
        materialCode: s.material.code,
        materialName: s.material.name,
        lotNumber: s.lotNumber,
        quantity: s.quantity,
        usedQty: s.usedQty,
        availableQty: s.quantity - s.usedQty,
        processCode: s.location,
        location: s.location,
        receivedAt: s.receivedAt,
      }))
      .filter(s => options?.showZero || s.availableQty > 0)

    return { success: true, data: result }
  } catch (error) {
    console.error('stock:getStocksByProcess 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정+LOT 상태 확인
 */
ipcMain.handle('stock:checkProcessStockStatus', async (_event, processCode: string, lotNumber: string) => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    const stock = await prisma.materialStock.findFirst({
      where: {
        location: processCode,
        lotNumber,
      }
    })

    if (!stock) {
      return {
        success: true,
        data: {
          exists: false,
          lotNumber,
          processCode,
          quantity: 0,
          usedQty: 0,
          availableQty: 0,
          isExhausted: false,
          canRegister: true,
        }
      }
    }

    const availableQty = stock.quantity - stock.usedQty
    const isExhausted = availableQty <= 0

    return {
      success: true,
      data: {
        exists: true,
        lotNumber,
        processCode,
        quantity: stock.quantity,
        usedQty: stock.usedQty,
        availableQty,
        isExhausted,
        canRegister: !isExhausted,
      }
    }
  } catch (error) {
    console.error('stock:checkProcessStockStatus 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정별 재고 차감 (FIFO)
 */
ipcMain.handle('stock:consumeProcessStock', async (_event, processCode: string, materialId: number, quantity: number, productionLotId?: number, allowNegative?: boolean) => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    // 공정별 재고 조회 (FIFO)
    const stocks = await prisma.materialStock.findMany({
      where: {
        materialId,
        location: processCode,
      },
      orderBy: { receivedAt: 'asc' }
    })

    let remainingQty = quantity
    const usedLots: Array<{ lotNumber: string; usedQty: number }> = []
    let totalDeducted = 0

    for (const stock of stocks) {
      if (remainingQty <= 0) break

      const availableQty = stock.quantity - stock.usedQty
      if (availableQty <= 0) continue

      const useQty = Math.min(availableQty, remainingQty)

      await prisma.materialStock.update({
        where: { id: stock.id },
        data: { usedQty: stock.usedQty + useQty }
      })

      if (productionLotId) {
        await prisma.lotMaterial.create({
          data: {
            productionLotId,
            materialId,
            materialLotNo: stock.lotNumber,
            quantity: useQty,
          }
        })
      }

      usedLots.push({ lotNumber: stock.lotNumber, usedQty: useQty })
      totalDeducted += useQty
      remainingQty -= useQty
    }

    // 음수 허용 시 추가 차감
    if (remainingQty > 0 && allowNegative && stocks.length > 0) {
      const lastStock = stocks[stocks.length - 1]
      await prisma.materialStock.update({
        where: { id: lastStock.id },
        data: { usedQty: lastStock.usedQty + remainingQty }
      })

      const existingLot = usedLots.find(l => l.lotNumber === lastStock.lotNumber)
      if (existingLot) {
        existingLot.usedQty += remainingQty
      } else {
        usedLots.push({ lotNumber: lastStock.lotNumber, usedQty: remainingQty })
      }
      totalDeducted += remainingQty
      remainingQty = 0
    }

    return {
      success: true,
      data: {
        lots: usedLots,
        deductedQty: totalDeducted,
        remainingQty,
      }
    }
  } catch (error) {
    console.error('stock:consumeProcessStock 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정별 재고 요약
 */
ipcMain.handle('stock:getProcessStockSummary', async (_event, processCode: string) => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    const stocks = await prisma.materialStock.findMany({
      where: { location: processCode }
    })

    const materialIds = new Set(stocks.map(s => s.materialId))

    const summary = {
      totalLots: stocks.length,
      totalQuantity: stocks.reduce((sum, s) => sum + s.quantity, 0),
      totalUsed: stocks.reduce((sum, s) => sum + s.usedQty, 0),
      totalAvailable: stocks.reduce((sum, s) => sum + (s.quantity - s.usedQty), 0),
      materialCount: materialIds.size,
    }

    return { success: true, data: summary }
  } catch (error) {
    console.error('stock:getProcessStockSummary 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정별 가용 재고 수량
 */
ipcMain.handle('stock:getProcessAvailableQty', async (_event, processCode: string, materialId: number) => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    const result = await prisma.materialStock.aggregate({
      where: {
        materialId,
        location: processCode,
      },
      _sum: {
        quantity: true,
        usedQty: true,
      }
    })

    const total = result._sum.quantity || 0
    const used = result._sum.usedQty || 0

    return { success: true, data: total - used }
  } catch (error) {
    console.error('stock:getProcessAvailableQty 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정별 금일 스캔 내역
 */
ipcMain.handle('stock:getTodayProcessReceivings', async (_event, processCode?: string) => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const receivings = await prisma.materialStock.findMany({
      where: {
        receivedAt: { gte: today },
        ...(processCode ? { location: processCode } : {})
      },
      include: {
        material: { select: { code: true, name: true } }
      },
      orderBy: { receivedAt: 'desc' }
    })

    const result = receivings.map(r => ({
      id: r.id,
      processCode: r.location || '',
      materialCode: r.material.code,
      materialName: r.material.name,
      lotNumber: r.lotNumber,
      quantity: r.quantity,
      receivedAt: r.receivedAt,
    }))

    return { success: true, data: result }
  } catch (error) {
    console.error('stock:getTodayProcessReceivings 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 재고 아이템 삭제
 */
ipcMain.handle('stock:deleteStockItems', async (_event, ids: number[]) => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    const result = await prisma.materialStock.deleteMany({
      where: { id: { in: ids } }
    })

    return { success: true, data: result.count }
  } catch (error) {
    console.error('stock:deleteStockItems 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 전체 재고 데이터 초기화
 */
ipcMain.handle('stock:resetAllStockData', async () => {
  try {
    const { prisma } = await import('../src/lib/prisma')

    // LotMaterial 먼저 삭제 (외래키 제약)
    const lotMaterialsResult = await prisma.lotMaterial.deleteMany({})
    // MaterialStock 삭제
    const stocksResult = await prisma.materialStock.deleteMany({})

    return {
      success: true,
      data: {
        stocks: stocksResult.count,
        receivings: 0,
        lotMaterials: lotMaterialsResult.count,
      }
    }
  } catch (error) {
    console.error('stock:resetAllStockData 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - BOM API (4개)
// ============================================

/**
 * BOM 항목 생성
 */
ipcMain.handle('bom:createBOMItem', async (_event, input: Parameters<typeof bomService.createBOMItem>[0]) => {
  try {
    const result = await bomService.createBOMItem(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('bom:createBOMItem 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * BOM 항목 수정
 */
ipcMain.handle('bom:updateBOMItem', async (_event, bomId: number, input: Parameters<typeof bomService.updateBOMItem>[1]) => {
  try {
    const result = await bomService.updateBOMItem(bomId, input)
    return { success: true, data: result }
  } catch (error) {
    console.error('bom:updateBOMItem 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * BOM 항목 삭제
 */
ipcMain.handle('bom:deleteBOMItem', async (_event, bomId: number) => {
  try {
    const result = await bomService.deleteBOMItem(bomId)
    return { success: true, data: result }
  } catch (error) {
    console.error('bom:deleteBOMItem 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 제품별 BOM 조회
 */
ipcMain.handle('bom:getBOMByProduct', async (_event, productId: number) => {
  try {
    const result = await bomService.getBOMByProduct(productId)
    return { success: true, data: result }
  } catch (error) {
    console.error('bom:getBOMByProduct 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - Material API (5개)
// ============================================

/**
 * 자재 생성
 */
ipcMain.handle('material:create', async (_event, input: Parameters<typeof materialService.createMaterial>[0]) => {
  try {
    const result = await materialService.createMaterial(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('material:create 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 자재 조회 (ID)
 */
ipcMain.handle('material:getById', async (_event, materialId: number) => {
  try {
    const result = await materialService.getMaterialById(materialId)
    return { success: true, data: result }
  } catch (error) {
    console.error('material:getById 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 자재 수정
 */
ipcMain.handle('material:update', async (_event, materialId: number, input: Parameters<typeof materialService.updateMaterial>[1]) => {
  try {
    const result = await materialService.updateMaterial(materialId, input)
    return { success: true, data: result }
  } catch (error) {
    console.error('material:update 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 자재 삭제
 */
ipcMain.handle('material:delete', async (_event, materialId: number) => {
  try {
    const result = await materialService.deleteMaterial(materialId)
    return { success: true, data: result }
  } catch (error) {
    console.error('material:delete 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 전체 자재 조회
 */
ipcMain.handle('material:getAll', async () => {
  try {
    const result = await materialService.getAllMaterials()
    return { success: true, data: result }
  } catch (error) {
    console.error('material:getAll 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - LotTrace API (3개)
// ============================================

/**
 * 전방 추적 (LOT → 사용처)
 */
ipcMain.handle('lotTrace:traceForward', async (_event, lotId: number) => {
  try {
    const result = await lotTraceService.traceForward(lotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('lotTrace:traceForward 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 역방향 추적 (LOT → 원재료)
 */
ipcMain.handle('lotTrace:traceBackward', async (_event, lotId: number) => {
  try {
    const result = await lotTraceService.traceBackward(lotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('lotTrace:traceBackward 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 추적 트리 생성
 */
ipcMain.handle('lotTrace:buildTraceTree', async (_event, lotId: number, direction: 'forward' | 'backward') => {
  try {
    const result = await lotTraceService.buildTraceTree(lotId, direction)
    return { success: true, data: result }
  } catch (error) {
    console.error('lotTrace:buildTraceTree 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - Inspection API (2개)
// ============================================

/**
 * 검사 기록 생성
 */
ipcMain.handle('inspection:create', async (_event, input: Parameters<typeof inspectionService.createInspection>[0]) => {
  try {
    const result = await inspectionService.createInspection(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('inspection:create 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * LOT별 검사 기록 조회
 */
ipcMain.handle('inspection:getByLot', async (_event, lotId: number) => {
  try {
    const result = await inspectionService.getInspectionsByLot(lotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('inspection:getByLot 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - Line API (2개)
// ============================================

/**
 * 전체 라인 조회
 */
ipcMain.handle('line:getAll', async () => {
  try {
    const result = await lineService.getAllLines()
    return { success: true, data: result }
  } catch (error) {
    console.error('line:getAll 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 공정별 라인 조회
 */
ipcMain.handle('line:getByProcess', async (_event, processCode: string) => {
  try {
    const result = await lineService.getLinesByProcess(processCode)
    return { success: true, data: result }
  } catch (error) {
    console.error('line:getByProcess 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - Sequence API (2개)
// ============================================

/**
 * 다음 일련번호 조회
 */
ipcMain.handle('sequence:getNext', async (_event, prefix: string) => {
  try {
    const result = await sequenceService.getNextSequence(prefix)
    return { success: true, data: result }
  } catch (error) {
    console.error('sequence:getNext 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 다음 번들 일련번호 조회
 */
ipcMain.handle('sequence:getNextBundle', async (_event, prefix: string) => {
  try {
    const result = await sequenceService.getNextBundleSequence(prefix)
    return { success: true, data: result }
  } catch (error) {
    console.error('sequence:getNextBundle 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - Bundle API (12개)
// ============================================

/**
 * 번들 생성
 */
ipcMain.handle('bundle:create', async (_event, input: Parameters<typeof bundleService.createBundle>[0]) => {
  try {
    const result = await bundleService.createBundle(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:create 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들에 LOT 추가
 */
ipcMain.handle('bundle:addToBundle', async (_event, input: Parameters<typeof bundleService.addToBundle>[0]) => {
  try {
    const result = await bundleService.addToBundle(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:addToBundle 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들에서 LOT 제거
 */
ipcMain.handle('bundle:removeFromBundle', async (_event, bundleItemId: number) => {
  try {
    const result = await bundleService.removeFromBundle(bundleItemId)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:removeFromBundle 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들 완료
 */
ipcMain.handle('bundle:complete', async (_event, bundleLotId: number) => {
  try {
    const result = await bundleService.completeBundle(bundleLotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:complete 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들 해제
 */
ipcMain.handle('bundle:unbundle', async (_event, bundleLotId: number) => {
  try {
    await bundleService.unbundle(bundleLotId)
    return { success: true }
  } catch (error) {
    console.error('bundle:unbundle 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들 삭제
 */
ipcMain.handle('bundle:delete', async (_event, bundleLotId: number) => {
  try {
    await bundleService.deleteBundle(bundleLotId)
    return { success: true }
  } catch (error) {
    console.error('bundle:delete 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들 ID로 조회
 */
ipcMain.handle('bundle:getById', async (_event, bundleLotId: number) => {
  try {
    const result = await bundleService.getBundleById(bundleLotId)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:getById 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들 번호로 조회
 */
ipcMain.handle('bundle:getByNo', async (_event, bundleNo: string) => {
  try {
    const result = await bundleService.getBundleByNo(bundleNo)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:getByNo 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 진행 중인 번들 조회
 */
ipcMain.handle('bundle:getActive', async () => {
  try {
    const result = await bundleService.getActiveBundles()
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:getActive 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들에 추가 가능한 LOT 조회
 */
ipcMain.handle('bundle:getAvailableLots', async (_event, productId: number) => {
  try {
    const result = await bundleService.getAvailableLotsForBundle(productId)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:getAvailableLots 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * SET 번들 생성
 */
ipcMain.handle('bundle:createSet', async (_event, items: Parameters<typeof bundleService.createSetBundle>[0]) => {
  try {
    const result = await bundleService.createSetBundle(items)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:createSet 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 번들 전체 출하
 */
ipcMain.handle('bundle:shipEntire', async (_event, bundleId: number) => {
  try {
    const result = await bundleService.shipEntireBundle(bundleId)
    return { success: true, data: result }
  } catch (error) {
    console.error('bundle:shipEntire 오류:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// IPC Handlers - Product API (5개)
// ============================================

/**
 * 전체 제품 조회
 */
ipcMain.handle('product:getAll', async () => {
  try {
    const result = await productService.getAllProducts()
    return { success: true, data: result }
  } catch (error) {
    console.error('product:getAll 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 제품 ID로 조회
 */
ipcMain.handle('product:getById', async (_event, productId: number) => {
  try {
    const result = await productService.getProductById(productId)
    return { success: true, data: result }
  } catch (error) {
    console.error('product:getById 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 제품 생성
 */
ipcMain.handle('product:create', async (_event, input: Parameters<typeof productService.createProduct>[0]) => {
  try {
    const result = await productService.createProduct(input)
    return { success: true, data: result }
  } catch (error) {
    console.error('product:create 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 제품 수정
 */
ipcMain.handle('product:update', async (_event, productId: number, input: Parameters<typeof productService.updateProduct>[1]) => {
  try {
    const result = await productService.updateProduct(productId, input)
    return { success: true, data: result }
  } catch (error) {
    console.error('product:update 오류:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 제품 삭제
 */
ipcMain.handle('product:delete', async (_event, productId: number) => {
  try {
    const result = await productService.deleteProduct(productId)
    return { success: true, data: result }
  } catch (error) {
    console.error('product:delete 오류:', error)
    return { success: false, error: String(error) }
  }
})
