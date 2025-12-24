/**
 * Phase 1 테스트: electron/main.ts IPC 핸들러 35개 검증
 *
 * 테스트 항목:
 * 1. IPC 채널 이름 정의 검증
 * 2. 서비스 함수 존재 여부 검증
 * 3. IPC 핸들러 코드 구조 검증
 *
 * 실행 방법:
 * npx vitest run TEST/phase1_ipc_handlers.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// 서비스 imports - 함수 존재 여부 검증용
import * as productionService from '../src/services/productionService'
import * as stockService from '../src/services/stockService'
import * as bomService from '../src/services/bomService'
import * as materialService from '../src/services/materialService'
import * as lotTraceService from '../src/services/lotTraceService'
import * as inspectionService from '../src/services/inspectionService'
import * as lineService from '../src/services/lineService'
import * as sequenceService from '../src/services/sequenceService'

// electron/main.ts 파일 내용 읽기
let mainTsContent: string

beforeAll(() => {
  const mainTsPath = path.join(__dirname, '..', 'electron', 'main.ts')
  mainTsContent = fs.readFileSync(mainTsPath, 'utf-8')
})

describe('Phase 1: IPC 핸들러 검증', () => {

  // ============================================
  // 1. Production API IPC 채널 검증 (10개)
  // ============================================
  describe('Production API IPC 핸들러', () => {
    const productionChannels = [
      'production:createLot',
      'production:startProduction',
      'production:completeProduction',
      'production:addMaterial',
      'production:removeMaterial',
      'production:getLotById',
      'production:getLotByNumber',
      'production:getLotsByProcess',
      'production:getLotsByStatus',
      'production:updateLotQuantity',
    ]

    it.each(productionChannels)('IPC 채널 "%s" 이 등록되어 있어야 함', (channel) => {
      expect(mainTsContent).toContain(`ipcMain.handle('${channel}'`)
    })

    it('productionService에 필요한 함수가 모두 존재해야 함', () => {
      expect(typeof productionService.createLot).toBe('function')
      expect(typeof productionService.startProduction).toBe('function')
      expect(typeof productionService.completeProduction).toBe('function')
      expect(typeof productionService.addMaterial).toBe('function')
      expect(typeof productionService.removeMaterial).toBe('function')
      expect(typeof productionService.getLotById).toBe('function')
      expect(typeof productionService.getLotByNumber).toBe('function')
      expect(typeof productionService.getLotsByProcess).toBe('function')
      expect(typeof productionService.getLotsByStatus).toBe('function')
      expect(typeof productionService.updateLotQuantity).toBe('function')
    })
  })

  // ============================================
  // 2. Stock API IPC 채널 검증 (8개)
  // ============================================
  describe('Stock API IPC 핸들러', () => {
    const stockChannels = [
      'stock:receiveStock',
      'stock:consumeStock',
      'stock:deductByBOM',
      'stock:getStockByMaterial',
      'stock:getStockSummary',
      'stock:getLowStock',
      'stock:getAvailableQty',
      'stock:getTodayReceivings',
    ]

    it.each(stockChannels)('IPC 채널 "%s" 이 등록되어 있어야 함', (channel) => {
      expect(mainTsContent).toContain(`ipcMain.handle('${channel}'`)
    })

    it('stockService에 필요한 함수가 모두 존재해야 함', () => {
      expect(typeof stockService.receiveStock).toBe('function')
      expect(typeof stockService.consumeStock).toBe('function')
      expect(typeof stockService.deductByBOM).toBe('function')
      expect(typeof stockService.getStockByMaterial).toBe('function')
      expect(typeof stockService.getStockSummary).toBe('function')
      expect(typeof stockService.getLowStock).toBe('function')
      expect(typeof stockService.getAvailableQty).toBe('function')
      expect(typeof stockService.getTodayReceivings).toBe('function')
    })
  })

  // ============================================
  // 3. BOM API IPC 채널 검증 (4개)
  // ============================================
  describe('BOM API IPC 핸들러', () => {
    const bomChannels = [
      'bom:createBOMItem',
      'bom:updateBOMItem',
      'bom:deleteBOMItem',
      'bom:getBOMByProduct',
    ]

    it.each(bomChannels)('IPC 채널 "%s" 이 등록되어 있어야 함', (channel) => {
      expect(mainTsContent).toContain(`ipcMain.handle('${channel}'`)
    })

    it('bomService에 필요한 함수가 모두 존재해야 함', () => {
      expect(typeof bomService.createBOMItem).toBe('function')
      expect(typeof bomService.updateBOMItem).toBe('function')
      expect(typeof bomService.deleteBOMItem).toBe('function')
      expect(typeof bomService.getBOMByProduct).toBe('function')
    })
  })

  // ============================================
  // 4. Material API IPC 채널 검증 (5개)
  // ============================================
  describe('Material API IPC 핸들러', () => {
    const materialChannels = [
      'material:create',
      'material:getById',
      'material:update',
      'material:delete',
      'material:getAll',
    ]

    it.each(materialChannels)('IPC 채널 "%s" 이 등록되어 있어야 함', (channel) => {
      expect(mainTsContent).toContain(`ipcMain.handle('${channel}'`)
    })

    it('materialService에 필요한 함수가 모두 존재해야 함', () => {
      expect(typeof materialService.createMaterial).toBe('function')
      expect(typeof materialService.getMaterialById).toBe('function')
      expect(typeof materialService.updateMaterial).toBe('function')
      expect(typeof materialService.deleteMaterial).toBe('function')
      expect(typeof materialService.getAllMaterials).toBe('function')
    })
  })

  // ============================================
  // 5. LotTrace API IPC 채널 검증 (3개)
  // ============================================
  describe('LotTrace API IPC 핸들러', () => {
    const lotTraceChannels = [
      'lotTrace:traceForward',
      'lotTrace:traceBackward',
      'lotTrace:buildTraceTree',
    ]

    it.each(lotTraceChannels)('IPC 채널 "%s" 이 등록되어 있어야 함', (channel) => {
      expect(mainTsContent).toContain(`ipcMain.handle('${channel}'`)
    })

    it('lotTraceService에 필요한 함수가 모두 존재해야 함', () => {
      expect(typeof lotTraceService.traceForward).toBe('function')
      expect(typeof lotTraceService.traceBackward).toBe('function')
      expect(typeof lotTraceService.buildTraceTree).toBe('function')
    })
  })

  // ============================================
  // 6. Inspection API IPC 채널 검증 (2개)
  // ============================================
  describe('Inspection API IPC 핸들러', () => {
    const inspectionChannels = [
      'inspection:create',
      'inspection:getByLot',
    ]

    it.each(inspectionChannels)('IPC 채널 "%s" 이 등록되어 있어야 함', (channel) => {
      expect(mainTsContent).toContain(`ipcMain.handle('${channel}'`)
    })

    it('inspectionService에 필요한 함수가 모두 존재해야 함', () => {
      expect(typeof inspectionService.createInspection).toBe('function')
      expect(typeof inspectionService.getInspectionsByLot).toBe('function')
    })
  })

  // ============================================
  // 7. Line API IPC 채널 검증 (2개)
  // ============================================
  describe('Line API IPC 핸들러', () => {
    const lineChannels = [
      'line:getAll',
      'line:getByProcess',
    ]

    it.each(lineChannels)('IPC 채널 "%s" 이 등록되어 있어야 함', (channel) => {
      expect(mainTsContent).toContain(`ipcMain.handle('${channel}'`)
    })

    it('lineService에 필요한 함수가 모두 존재해야 함', () => {
      expect(typeof lineService.getAllLines).toBe('function')
      expect(typeof lineService.getLinesByProcess).toBe('function')
    })
  })

  // ============================================
  // 8. Sequence API IPC 채널 검증 (2개)
  // ============================================
  describe('Sequence API IPC 핸들러', () => {
    const sequenceChannels = [
      'sequence:getNext',
      'sequence:getNextBundle',
    ]

    it.each(sequenceChannels)('IPC 채널 "%s" 이 등록되어 있어야 함', (channel) => {
      expect(mainTsContent).toContain(`ipcMain.handle('${channel}'`)
    })

    it('sequenceService에 필요한 함수가 모두 존재해야 함', () => {
      expect(typeof sequenceService.getNextSequence).toBe('function')
      expect(typeof sequenceService.getNextBundleSequence).toBe('function')
    })
  })

  // ============================================
  // 9. 전체 IPC 핸들러 수 검증
  // ============================================
  describe('전체 IPC 핸들러 수 검증', () => {
    it('총 35개 이상의 비즈니스 로직 IPC 핸들러가 등록되어 있어야 함', () => {
      // 기존 프린터/파일 핸들러 제외하고 비즈니스 로직 핸들러만 카운트
      const businessHandlers = [
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

      let registeredCount = 0
      for (const handler of businessHandlers) {
        if (mainTsContent.includes(`ipcMain.handle('${handler}'`)) {
          registeredCount++
        }
      }

      expect(registeredCount).toBe(36) // 실제로 36개 (8+8+4+5+3+2+2+2 + 기타)
      expect(registeredCount).toBeGreaterThanOrEqual(35)
    })
  })

  // ============================================
  // 10. 표준 패턴 검증 (try-catch, 반환 형식)
  // ============================================
  describe('IPC 핸들러 표준 패턴 검증', () => {
    it('모든 비즈니스 핸들러가 try-catch 패턴을 사용해야 함', () => {
      // 비즈니스 로직 핸들러 섹션에서 try-catch 패턴 확인
      const businessSection = mainTsContent.split('// IPC Handlers - Production API')[1]

      // try { ... } catch { ... } 패턴이 충분히 있는지 확인
      const tryCount = (businessSection.match(/try\s*\{/g) || []).length
      const catchCount = (businessSection.match(/catch\s*\(/g) || []).length

      expect(tryCount).toBeGreaterThanOrEqual(35)
      expect(catchCount).toBeGreaterThanOrEqual(35)
    })

    it('성공 시 { success: true, data: result } 형식을 반환해야 함', () => {
      const successPatternCount = (mainTsContent.match(/return\s*\{\s*success:\s*true,\s*data:\s*result\s*\}/g) || []).length
      expect(successPatternCount).toBeGreaterThanOrEqual(35)
    })

    it('실패 시 { success: false, error: String(error) } 형식을 반환해야 함', () => {
      const errorPatternCount = (mainTsContent.match(/return\s*\{\s*success:\s*false,\s*error:\s*String\(error\)\s*\}/g) || []).length
      expect(errorPatternCount).toBeGreaterThanOrEqual(35)
    })
  })

  // ============================================
  // 11. 서비스 Import 검증
  // ============================================
  describe('서비스 Import 검증', () => {
    it('모든 필요한 서비스가 import 되어 있어야 함', () => {
      expect(mainTsContent).toContain("import * as productionService from '../src/services/productionService'")
      expect(mainTsContent).toContain("import * as stockService from '../src/services/stockService'")
      expect(mainTsContent).toContain("import * as bomService from '../src/services/bomService'")
      expect(mainTsContent).toContain("import * as materialService from '../src/services/materialService'")
      expect(mainTsContent).toContain("import * as lotTraceService from '../src/services/lotTraceService'")
      expect(mainTsContent).toContain("import * as inspectionService from '../src/services/inspectionService'")
      expect(mainTsContent).toContain("import * as lineService from '../src/services/lineService'")
      expect(mainTsContent).toContain("import * as sequenceService from '../src/services/sequenceService'")
    })
  })
})
