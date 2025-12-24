/**
 * Phase 2 테스트: electron/preload.ts 네임스페이스별 API 노출 검증
 *
 * 테스트 항목:
 * 1. 8개 네임스페이스 존재 확인 (production, stock, bom, material, lotTrace, inspection, line, sequence)
 * 2. 각 네임스페이스 메서드 존재 확인
 * 3. IPC 채널 연결 확인 (ipcRenderer.invoke 호출)
 * 4. contextBridge.exposeInMainWorld 호출 확인
 *
 * 실행 방법:
 * npx vitest run TEST/phase2_preload_api.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// electron/preload.ts 파일 내용 읽기
let preloadTsContent: string

beforeAll(() => {
  const preloadTsPath = path.join(__dirname, '..', 'electron', 'preload.ts')
  preloadTsContent = fs.readFileSync(preloadTsPath, 'utf-8')
})

describe('Phase 2: Preload API 노출 검증', () => {

  // ============================================
  // 1. 기본 구조 검증
  // ============================================
  describe('기본 구조 검증', () => {
    it('contextBridge.exposeInMainWorld가 electronAPI를 노출해야 함', () => {
      expect(preloadTsContent).toContain("contextBridge.exposeInMainWorld('electronAPI'")
    })

    it('ipcRenderer import가 존재해야 함', () => {
      expect(preloadTsContent).toContain("import { ipcRenderer, contextBridge } from 'electron'")
    })
  })

  // ============================================
  // 2. 네임스페이스 존재 검증
  // ============================================
  describe('네임스페이스 존재 검증', () => {
    const namespaces = [
      'production',
      'stock',
      'bom',
      'material',
      'lotTrace',
      'inspection',
      'line',
      'sequence',
    ]

    it.each(namespaces)('"%s" 네임스페이스가 electronAPI에 존재해야 함', (namespace) => {
      // 네임스페이스: { 형태로 정의되어 있는지 확인
      const pattern = new RegExp(`${namespace}:\\s*\\{`)
      expect(preloadTsContent).toMatch(pattern)
    })

    it('총 8개의 비즈니스 네임스페이스가 존재해야 함', () => {
      let count = 0
      for (const ns of namespaces) {
        const pattern = new RegExp(`${ns}:\\s*\\{`)
        if (pattern.test(preloadTsContent)) {
          count++
        }
      }
      expect(count).toBe(8)
    })
  })

  // ============================================
  // 3. Production 네임스페이스 메서드 검증 (10개)
  // ============================================
  describe('Production 네임스페이스 메서드', () => {
    const productionMethods = [
      { method: 'createLot', channel: 'production:createLot' },
      { method: 'startProduction', channel: 'production:startProduction' },
      { method: 'completeProduction', channel: 'production:completeProduction' },
      { method: 'addMaterial', channel: 'production:addMaterial' },
      { method: 'removeMaterial', channel: 'production:removeMaterial' },
      { method: 'getLotById', channel: 'production:getLotById' },
      { method: 'getLotByNumber', channel: 'production:getLotByNumber' },
      { method: 'getLotsByProcess', channel: 'production:getLotsByProcess' },
      { method: 'getLotsByStatus', channel: 'production:getLotsByStatus' },
      { method: 'updateLotQuantity', channel: 'production:updateLotQuantity' },
    ]

    it.each(productionMethods)('production.$method가 $channel IPC 채널을 호출해야 함', ({ method, channel }) => {
      expect(preloadTsContent).toContain(`${method}:`)
      expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
    })

    it('production 네임스페이스에 10개 메서드가 있어야 함', () => {
      let count = 0
      for (const { channel } of productionMethods) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }
      expect(count).toBe(10)
    })
  })

  // ============================================
  // 4. Stock 네임스페이스 메서드 검증 (8개)
  // ============================================
  describe('Stock 네임스페이스 메서드', () => {
    const stockMethods = [
      { method: 'receiveStock', channel: 'stock:receiveStock' },
      { method: 'consumeStock', channel: 'stock:consumeStock' },
      { method: 'deductByBOM', channel: 'stock:deductByBOM' },
      { method: 'getStockByMaterial', channel: 'stock:getStockByMaterial' },
      { method: 'getStockSummary', channel: 'stock:getStockSummary' },
      { method: 'getLowStock', channel: 'stock:getLowStock' },
      { method: 'getAvailableQty', channel: 'stock:getAvailableQty' },
      { method: 'getTodayReceivings', channel: 'stock:getTodayReceivings' },
    ]

    it.each(stockMethods)('stock.$method가 $channel IPC 채널을 호출해야 함', ({ method, channel }) => {
      expect(preloadTsContent).toContain(`${method}:`)
      expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
    })

    it('stock 네임스페이스에 8개 메서드가 있어야 함', () => {
      let count = 0
      for (const { channel } of stockMethods) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }
      expect(count).toBe(8)
    })
  })

  // ============================================
  // 5. BOM 네임스페이스 메서드 검증 (4개)
  // ============================================
  describe('BOM 네임스페이스 메서드', () => {
    const bomMethods = [
      { method: 'createBOMItem', channel: 'bom:createBOMItem' },
      { method: 'updateBOMItem', channel: 'bom:updateBOMItem' },
      { method: 'deleteBOMItem', channel: 'bom:deleteBOMItem' },
      { method: 'getBOMByProduct', channel: 'bom:getBOMByProduct' },
    ]

    it.each(bomMethods)('bom.$method가 $channel IPC 채널을 호출해야 함', ({ method, channel }) => {
      expect(preloadTsContent).toContain(`${method}:`)
      expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
    })

    it('bom 네임스페이스에 4개 메서드가 있어야 함', () => {
      let count = 0
      for (const { channel } of bomMethods) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }
      expect(count).toBe(4)
    })
  })

  // ============================================
  // 6. Material 네임스페이스 메서드 검증 (5개)
  // ============================================
  describe('Material 네임스페이스 메서드', () => {
    const materialMethods = [
      { method: 'create', channel: 'material:create' },
      { method: 'getById', channel: 'material:getById' },
      { method: 'update', channel: 'material:update' },
      { method: 'delete', channel: 'material:delete' },
      { method: 'getAll', channel: 'material:getAll' },
    ]

    it.each(materialMethods)('material.$method가 $channel IPC 채널을 호출해야 함', ({ method, channel }) => {
      expect(preloadTsContent).toContain(`${method}:`)
      expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
    })

    it('material 네임스페이스에 5개 메서드가 있어야 함', () => {
      let count = 0
      for (const { channel } of materialMethods) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }
      expect(count).toBe(5)
    })
  })

  // ============================================
  // 7. LotTrace 네임스페이스 메서드 검증 (3개)
  // ============================================
  describe('LotTrace 네임스페이스 메서드', () => {
    const lotTraceMethods = [
      { method: 'traceForward', channel: 'lotTrace:traceForward' },
      { method: 'traceBackward', channel: 'lotTrace:traceBackward' },
      { method: 'buildTraceTree', channel: 'lotTrace:buildTraceTree' },
    ]

    it.each(lotTraceMethods)('lotTrace.$method가 $channel IPC 채널을 호출해야 함', ({ method, channel }) => {
      expect(preloadTsContent).toContain(`${method}:`)
      expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
    })

    it('lotTrace 네임스페이스에 3개 메서드가 있어야 함', () => {
      let count = 0
      for (const { channel } of lotTraceMethods) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }
      expect(count).toBe(3)
    })
  })

  // ============================================
  // 8. Inspection 네임스페이스 메서드 검증 (2개)
  // ============================================
  describe('Inspection 네임스페이스 메서드', () => {
    const inspectionMethods = [
      { method: 'create', channel: 'inspection:create' },
      { method: 'getByLot', channel: 'inspection:getByLot' },
    ]

    it.each(inspectionMethods)('inspection.$method가 $channel IPC 채널을 호출해야 함', ({ method, channel }) => {
      expect(preloadTsContent).toContain(`${method}:`)
      expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
    })

    it('inspection 네임스페이스에 2개 메서드가 있어야 함', () => {
      let count = 0
      for (const { channel } of inspectionMethods) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }
      expect(count).toBe(2)
    })
  })

  // ============================================
  // 9. Line 네임스페이스 메서드 검증 (2개)
  // ============================================
  describe('Line 네임스페이스 메서드', () => {
    const lineMethods = [
      { method: 'getAll', channel: 'line:getAll' },
      { method: 'getByProcess', channel: 'line:getByProcess' },
    ]

    it.each(lineMethods)('line.$method가 $channel IPC 채널을 호출해야 함', ({ method, channel }) => {
      expect(preloadTsContent).toContain(`${method}:`)
      expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
    })

    it('line 네임스페이스에 2개 메서드가 있어야 함', () => {
      let count = 0
      for (const { channel } of lineMethods) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }
      expect(count).toBe(2)
    })
  })

  // ============================================
  // 10. Sequence 네임스페이스 메서드 검증 (2개)
  // ============================================
  describe('Sequence 네임스페이스 메서드', () => {
    const sequenceMethods = [
      { method: 'getNext', channel: 'sequence:getNext' },
      { method: 'getNextBundle', channel: 'sequence:getNextBundle' },
    ]

    it.each(sequenceMethods)('sequence.$method가 $channel IPC 채널을 호출해야 함', ({ method, channel }) => {
      expect(preloadTsContent).toContain(`${method}:`)
      expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
    })

    it('sequence 네임스페이스에 2개 메서드가 있어야 함', () => {
      let count = 0
      for (const { channel } of sequenceMethods) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }
      expect(count).toBe(2)
    })
  })

  // ============================================
  // 11. 전체 API 메서드 수 검증
  // ============================================
  describe('전체 API 메서드 수 검증', () => {
    it('총 36개 비즈니스 API 메서드가 노출되어야 함', () => {
      const allChannels = [
        // Production (10)
        'production:createLot', 'production:startProduction', 'production:completeProduction',
        'production:addMaterial', 'production:removeMaterial', 'production:getLotById',
        'production:getLotByNumber', 'production:getLotsByProcess', 'production:getLotsByStatus',
        'production:updateLotQuantity',
        // Stock (8)
        'stock:receiveStock', 'stock:consumeStock', 'stock:deductByBOM',
        'stock:getStockByMaterial', 'stock:getStockSummary', 'stock:getLowStock',
        'stock:getAvailableQty', 'stock:getTodayReceivings',
        // BOM (4)
        'bom:createBOMItem', 'bom:updateBOMItem', 'bom:deleteBOMItem', 'bom:getBOMByProduct',
        // Material (5)
        'material:create', 'material:getById', 'material:update', 'material:delete', 'material:getAll',
        // LotTrace (3)
        'lotTrace:traceForward', 'lotTrace:traceBackward', 'lotTrace:buildTraceTree',
        // Inspection (2)
        'inspection:create', 'inspection:getByLot',
        // Line (2)
        'line:getAll', 'line:getByProcess',
        // Sequence (2)
        'sequence:getNext', 'sequence:getNextBundle',
      ]

      let count = 0
      for (const channel of allChannels) {
        if (preloadTsContent.includes(`ipcRenderer.invoke('${channel}'`)) {
          count++
        }
      }

      expect(count).toBe(36)
    })
  })

  // ============================================
  // 12. 기존 API 유지 검증
  // ============================================
  describe('기존 API 유지 검증', () => {
    const existingApis = [
      'getPrinters',
      'printPDF',
      'printToPDF',
      'printLabel',
      'saveFileDialog',
      'openFileDialog',
      'writeFile',
      'readFile',
    ]

    it.each(existingApis)('기존 "%s" API가 유지되어야 함', (api) => {
      expect(preloadTsContent).toContain(`${api}:`)
    })
  })

  // ============================================
  // 13. Phase 1 IPC 채널과 일치 검증
  // ============================================
  describe('Phase 1 IPC 채널 일치 검증', () => {
    it('preload.ts의 IPC 채널이 main.ts의 핸들러와 일치해야 함', () => {
      const mainTsPath = path.join(__dirname, '..', 'electron', 'main.ts')
      const mainTsContent = fs.readFileSync(mainTsPath, 'utf-8')

      // main.ts에서 정의된 채널 추출
      const mainChannels = mainTsContent.match(/ipcMain\.handle\('([^']+)'/g) || []
      const mainChannelNames = mainChannels.map(m => m.match(/ipcMain\.handle\('([^']+)'/)?.[1]).filter(Boolean)

      // 비즈니스 로직 채널만 필터링 (프린터/파일 제외)
      const businessChannels = mainChannelNames.filter(ch =>
        ch?.startsWith('production:') ||
        ch?.startsWith('stock:') ||
        ch?.startsWith('bom:') ||
        ch?.startsWith('material:') ||
        ch?.startsWith('lotTrace:') ||
        ch?.startsWith('inspection:') ||
        ch?.startsWith('line:') ||
        ch?.startsWith('sequence:')
      )

      // preload.ts에서 모든 비즈니스 채널이 invoke되는지 확인
      for (const channel of businessChannels) {
        expect(preloadTsContent).toContain(`ipcRenderer.invoke('${channel}'`)
      }
    })
  })
})
