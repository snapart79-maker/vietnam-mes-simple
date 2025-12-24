/**
 * Phase 4 테스트: Context 하이브리드 모드 검증
 *
 * 테스트 항목:
 * 1. ProductionContext.tsx hasBusinessAPI() 호출 검증
 * 2. MaterialContext.tsx 하이브리드 모드 검증
 * 3. BOMContext.tsx 하이브리드 모드 검증
 * 4. electronBridge 헬퍼 함수 import 검증
 * 5. 하이브리드 모드 코드 패턴 검증
 *
 * 실행 방법:
 * npx vitest run TEST/phase4_context_integration.test.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// 파일 내용 읽기
let productionContextContent: string
let materialContextContent: string
let bomContextContent: string

beforeAll(() => {
  const productionContextPath = path.join(__dirname, '..', 'src', 'app', 'context', 'ProductionContext.tsx')
  productionContextContent = fs.readFileSync(productionContextPath, 'utf-8')

  const materialContextPath = path.join(__dirname, '..', 'src', 'app', 'context', 'MaterialContext.tsx')
  materialContextContent = fs.readFileSync(materialContextPath, 'utf-8')

  const bomContextPath = path.join(__dirname, '..', 'src', 'app', 'context', 'BOMContext.tsx')
  bomContextContent = fs.readFileSync(bomContextPath, 'utf-8')
})

describe('Phase 4: Context 하이브리드 모드 검증', () => {

  // ============================================
  // 1. electronBridge 헬퍼 함수 import 검증
  // ============================================
  describe('electronBridge 헬퍼 함수 import', () => {
    it('hasBusinessAPI 함수가 import 되어야 함', () => {
      expect(productionContextContent).toContain('import { hasBusinessAPI, getAPI }')
    })

    it('electronBridge 경로가 올바르게 지정되어야 함', () => {
      expect(productionContextContent).toContain("from '../../lib/electronBridge'")
    })
  })

  // ============================================
  // 2. Mock 서비스 import 변경 검증
  // ============================================
  describe('Mock 서비스 import 변경', () => {
    it('Mock 서비스가 mockProductionService로 rename되어야 함', () => {
      expect(productionContextContent).toContain('import * as mockProductionService from')
    })

    it('Mock 서비스 경로가 올바르게 지정되어야 함', () => {
      expect(productionContextContent).toContain("'../../services/mock/productionService.mock'")
    })

    it('LotWithRelations 타입이 Mock에서 import되어야 함', () => {
      expect(productionContextContent).toContain("import type { LotWithRelations, LotStatus }")
    })
  })

  // ============================================
  // 3. 하이브리드 모드 코드 패턴 검증
  // ============================================
  describe('하이브리드 모드 코드 패턴', () => {
    it('createLot 함수에서 hasBusinessAPI() 체크가 있어야 함', () => {
      expect(productionContextContent).toContain('if (hasBusinessAPI())')
    })

    it('Electron 환경 주석이 있어야 함', () => {
      expect(productionContextContent).toContain('// Electron 환경: IPC를 통해 실제 DB 서비스 호출')
    })

    it('브라우저 환경 주석이 있어야 함', () => {
      expect(productionContextContent).toContain('// 브라우저 환경: Mock 서비스 사용')
    })

    it('getAPI() 호출이 있어야 함', () => {
      expect(productionContextContent).toContain('const api = getAPI()')
    })
  })

  // ============================================
  // 4. Production API IPC 호출 검증
  // ============================================
  describe('Production API IPC 호출', () => {
    const productionMethods = [
      'api!.production.createLot',
      'api!.production.startProduction',
      'api!.production.completeProduction',
      'api!.production.addMaterial',
      'api!.production.removeMaterial',
      'api!.production.getLotById',
      'api!.production.getLotByNumber',
      'api!.production.getLotsByProcess',
      'api!.production.getLotsByStatus',
      'api!.production.updateLotQuantity',
    ]

    it.each(productionMethods)('%s 호출이 있어야 함', (method) => {
      expect(productionContextContent).toContain(method)
    })
  })

  // ============================================
  // 5. Mock 서비스 폴백 호출 검증
  // ============================================
  describe('Mock 서비스 폴백 호출', () => {
    const mockCalls = [
      'mockProductionService.createLot',
      'mockProductionService.startProduction',
      'mockProductionService.completeProduction',
      'mockProductionService.addMaterial',
      'mockProductionService.removeMaterial',
      'mockProductionService.getLotById',
      'mockProductionService.getLotByNumber',
      'mockProductionService.getTodayLots',
      'mockProductionService.getLotsByProcess',
      'mockProductionService.getLotsByStatus',
      'mockProductionService.updateLotQuantity',
    ]

    it.each(mockCalls)('%s 폴백 호출이 있어야 함', (call) => {
      expect(productionContextContent).toContain(call)
    })
  })

  // ============================================
  // 6. 에러 처리 검증
  // ============================================
  describe('에러 처리', () => {
    it('result.success 체크가 있어야 함', () => {
      expect(productionContextContent).toContain('if (!result.success')
    })

    it('result.error 사용이 있어야 함', () => {
      expect(productionContextContent).toContain('result.error')
    })

    it('throw new Error 패턴이 있어야 함', () => {
      expect(productionContextContent).toContain("throw new Error(result.error ||")
    })
  })

  // ============================================
  // 7. 타입 캐스팅 검증
  // ============================================
  describe('타입 캐스팅', () => {
    it('LotWithRelations 타입 캐스팅이 있어야 함', () => {
      expect(productionContextContent).toContain('as unknown as LotWithRelations')
    })

    it('배열 타입 캐스팅이 있어야 함', () => {
      expect(productionContextContent).toContain('as unknown as LotWithRelations[]')
    })
  })

  // ============================================
  // 8. 함수별 하이브리드 패턴 검증
  // ============================================
  describe('함수별 하이브리드 패턴', () => {
    const hybridFunctions = [
      'createLot',
      'startProduction',
      'completeProduction',
      'addMaterial',
      'removeMaterial',
      'getLotByNumber',
      'refreshTodayLots',
      'getLotsByProcess',
      'getLotsByStatus',
      'updateLotQuantity',
    ]

    it.each(hybridFunctions)('%s 함수가 하이브리드 모드로 구현되어야 함', (funcName) => {
      // 함수 정의와 hasBusinessAPI 체크가 가까이 있는지 확인
      const funcPattern = new RegExp(`const ${funcName} = useCallback\\(async`)
      expect(productionContextContent).toMatch(funcPattern)
    })

    it('모든 하이브리드 함수에 "(하이브리드)" 주석이 있어야 함', () => {
      const hybridCount = (productionContextContent.match(/\(하이브리드\)/g) || []).length
      // createLot, startProduction, completeProduction, addMaterial, removeMaterial,
      // getLotByNumber, refreshTodayLots, getLotsByProcess, getLotsByStatus, updateLotQuantity = 10개
      expect(hybridCount).toBeGreaterThanOrEqual(10)
    })
  })

  // ============================================
  // 9. Phase 1-3과 일치 검증
  // ============================================
  describe('Phase 1-3과 일치 검증', () => {
    it('electronBridge의 ProductionAPI 타입과 Context 호출이 일치해야 함', () => {
      const electronBridgePath = path.join(__dirname, '..', 'src', 'lib', 'electronBridge.ts')
      const electronBridgeContent = fs.readFileSync(electronBridgePath, 'utf-8')

      // electronBridge에 ProductionAPI 인터페이스가 있는지 확인
      expect(electronBridgeContent).toContain('export interface ProductionAPI')

      // Context에서 호출하는 메서드가 ProductionAPI에 정의되어 있는지 확인
      const methods = ['createLot', 'startProduction', 'completeProduction', 'addMaterial',
        'removeMaterial', 'getLotById', 'getLotByNumber', 'getLotsByProcess',
        'getLotsByStatus', 'updateLotQuantity']

      for (const method of methods) {
        expect(electronBridgeContent).toContain(`${method}:`)
      }
    })

    it('preload.ts의 production 네임스페이스와 Context 호출이 일치해야 함', () => {
      const preloadPath = path.join(__dirname, '..', 'electron', 'preload.ts')
      const preloadContent = fs.readFileSync(preloadPath, 'utf-8')

      // preload에 production 네임스페이스가 있는지 확인
      expect(preloadContent).toContain('production: {')

      // Context에서 호출하는 메서드가 preload에 정의되어 있는지 확인
      const methods = ['createLot', 'startProduction', 'completeProduction', 'addMaterial',
        'removeMaterial', 'getLotById', 'getLotByNumber', 'getLotsByProcess',
        'getLotsByStatus', 'updateLotQuantity']

      for (const method of methods) {
        expect(preloadContent).toContain(`${method}:`)
      }
    })
  })

  // ============================================
  // 10. 이전 productionService import 제거 검증
  // ============================================
  describe('이전 import 제거 검증', () => {
    it('이전 "import * as productionService" 패턴이 없어야 함', () => {
      // mockProductionService는 있지만 productionService는 없어야 함
      const oldPattern = /import \* as productionService from/
      expect(productionContextContent).not.toMatch(oldPattern)
    })

    it('productionService.createLot 호출이 없어야 함', () => {
      // mockProductionService.createLot은 있지만 productionService.createLot은 없어야 함
      expect(productionContextContent).not.toContain('productionService.createLot')
    })
  })

  // ============================================
  // 11. 컨텍스트 설명 주석 검증
  // ============================================
  describe('컨텍스트 설명 주석', () => {
    it('하이브리드 모드 설명 주석이 있어야 함', () => {
      expect(productionContextContent).toContain('하이브리드 모드')
    })

    it('Electron IPC 설명이 있어야 함', () => {
      expect(productionContextContent).toContain('IPC를 통해 실제 DB 서비스')
    })

    it('Browser 폴백 설명이 있어야 함', () => {
      expect(productionContextContent).toContain('Mock 서비스 사용 (localStorage)')
    })
  })
})

// ============================================
// MaterialContext 하이브리드 모드 검증
// ============================================
describe('Phase 4: MaterialContext 하이브리드 모드 검증', () => {

  // ============================================
  // 1. electronBridge 헬퍼 함수 import 검증
  // ============================================
  describe('electronBridge 헬퍼 함수 import', () => {
    it('hasBusinessAPI 함수가 import 되어야 함', () => {
      expect(materialContextContent).toContain('import { hasBusinessAPI, getAPI }')
    })

    it('electronBridge 경로가 올바르게 지정되어야 함', () => {
      expect(materialContextContent).toContain("from '../../lib/electronBridge'")
    })
  })

  // ============================================
  // 2. 하이브리드 모드 코드 패턴 검증
  // ============================================
  describe('하이브리드 모드 코드 패턴', () => {
    it('addMaterial 함수에서 hasBusinessAPI() 체크가 있어야 함', () => {
      expect(materialContextContent).toContain('if (hasBusinessAPI())')
    })

    it('Electron 환경 주석이 있어야 함', () => {
      expect(materialContextContent).toContain('// Electron 환경: IPC를 통해 실제 DB 서비스 호출')
    })

    it('브라우저 환경 주석이 있어야 함', () => {
      expect(materialContextContent).toContain('// 브라우저 환경: Mock 서비스 사용 (localStorage)')
    })

    it('getAPI() 호출이 있어야 함', () => {
      expect(materialContextContent).toContain('const api = getAPI()')
    })
  })

  // ============================================
  // 3. Material API IPC 호출 검증
  // ============================================
  describe('Material API IPC 호출', () => {
    const materialMethods = [
      'api!.material.create',
      'api!.material.update',
      'api!.material.delete',
      'api!.material.getAll',
    ]

    it.each(materialMethods)('%s 호출이 있어야 함', (method) => {
      expect(materialContextContent).toContain(method)
    })
  })

  // ============================================
  // 4. 함수별 하이브리드 패턴 검증
  // ============================================
  describe('함수별 하이브리드 패턴', () => {
    const hybridFunctions = [
      'addMaterial',
      'addMaterials',
      'updateMaterial',
      'deleteMaterial',
      'resetMaterials',
      'refreshMaterials',
    ]

    it.each(hybridFunctions)('%s 함수가 async로 정의되어야 함', (funcName) => {
      const funcPattern = new RegExp(`const ${funcName} = async`)
      expect(materialContextContent).toMatch(funcPattern)
    })

    it('모든 하이브리드 함수에 "(하이브리드)" 주석이 있어야 함', () => {
      const hybridCount = (materialContextContent.match(/\(하이브리드\)/g) || []).length
      // addMaterial, addMaterials, updateMaterial, deleteMaterial, resetMaterials, refreshMaterials = 6개+
      expect(hybridCount).toBeGreaterThanOrEqual(6)
    })
  })

  // ============================================
  // 5. 에러 처리 검증
  // ============================================
  describe('에러 처리', () => {
    it('result.success 체크가 있어야 함', () => {
      expect(materialContextContent).toContain('if (!result.success)')
    })

    it('throw new Error 패턴이 있어야 함', () => {
      expect(materialContextContent).toContain("throw new Error(result.error ||")
    })
  })

  // ============================================
  // 6. Context Type 반환 타입 검증
  // ============================================
  describe('Context Type 반환 타입', () => {
    it('addMaterial이 Promise<void>를 반환해야 함', () => {
      expect(materialContextContent).toContain('addMaterial: (material: Omit<Material')
      expect(materialContextContent).toContain('=> Promise<void>')
    })

    it('updateMaterial이 Promise<void>를 반환해야 함', () => {
      expect(materialContextContent).toContain('updateMaterial: (material: Material) => Promise<void>')
    })

    it('deleteMaterial이 Promise<void>를 반환해야 함', () => {
      expect(materialContextContent).toContain('deleteMaterial: (id: number) => Promise<void>')
    })

    it('refreshMaterials가 Promise<void>를 반환해야 함', () => {
      expect(materialContextContent).toContain('refreshMaterials: () => Promise<void>')
    })
  })
})

// ============================================
// BOMContext 하이브리드 모드 검증
// ============================================
describe('Phase 4: BOMContext 하이브리드 모드 검증', () => {

  // ============================================
  // 1. electronBridge 헬퍼 함수 import 검증
  // ============================================
  describe('electronBridge 헬퍼 함수 import', () => {
    it('hasBusinessAPI 함수가 import 되어야 함', () => {
      expect(bomContextContent).toContain('import { hasBusinessAPI, getAPI }')
    })

    it('electronBridge 경로가 올바르게 지정되어야 함', () => {
      expect(bomContextContent).toContain("from '../../lib/electronBridge'")
    })
  })

  // ============================================
  // 2. 하이브리드 모드 코드 패턴 검증
  // ============================================
  describe('하이브리드 모드 코드 패턴', () => {
    it('addBOMItem 함수에서 hasBusinessAPI() 체크가 있어야 함', () => {
      expect(bomContextContent).toContain('if (hasBusinessAPI())')
    })

    it('Electron 환경 주석이 있어야 함', () => {
      expect(bomContextContent).toContain('// Electron 환경: IPC를 통해 실제 DB 서비스 호출')
    })

    it('브라우저 환경 주석이 있어야 함', () => {
      expect(bomContextContent).toContain('// 브라우저 환경: Mock 서비스 사용 (localStorage)')
    })

    it('getAPI() 호출이 있어야 함', () => {
      expect(bomContextContent).toContain('const api = getAPI()')
    })
  })

  // ============================================
  // 3. BOM API IPC 호출 검증
  // ============================================
  describe('BOM API IPC 호출', () => {
    const bomMethods = [
      'api!.bom.createBOMItem',
      'api!.bom.updateBOMItem',
      'api!.bom.deleteBOMItem',
    ]

    it.each(bomMethods)('%s 호출이 있어야 함', (method) => {
      expect(bomContextContent).toContain(method)
    })
  })

  // ============================================
  // 4. 함수별 하이브리드 패턴 검증
  // ============================================
  describe('함수별 하이브리드 패턴', () => {
    const hybridFunctions = [
      'addBOMItem',
      'addBOMItems',
      'updateBOMItem',
      'deleteBOMItem',
      'deleteBOMByProduct',
      'resetBOM',
      'refreshBOM',
    ]

    it.each(hybridFunctions)('%s 함수가 async로 정의되어야 함', (funcName) => {
      const funcPattern = new RegExp(`const ${funcName} = async`)
      expect(bomContextContent).toMatch(funcPattern)
    })

    it('모든 하이브리드 함수에 "(하이브리드)" 주석이 있어야 함', () => {
      const hybridCount = (bomContextContent.match(/\(하이브리드\)/g) || []).length
      // addBOMItem, addBOMItems, updateBOMItem, deleteBOMItem, deleteBOMByProduct, resetBOM, refreshBOM = 7개+
      expect(hybridCount).toBeGreaterThanOrEqual(7)
    })
  })

  // ============================================
  // 5. 에러 처리 검증
  // ============================================
  describe('에러 처리', () => {
    it('result.success 체크가 있어야 함', () => {
      expect(bomContextContent).toContain('if (!result.success)')
    })

    it('throw new Error 패턴이 있어야 함', () => {
      expect(bomContextContent).toContain("throw new Error(result.error ||")
    })
  })

  // ============================================
  // 6. Context Type 반환 타입 검증
  // ============================================
  describe('Context Type 반환 타입', () => {
    it('addBOMItem이 Promise<void>를 반환해야 함', () => {
      expect(bomContextContent).toContain('=> Promise<void>; // (하이브리드)')
    })

    it('updateBOMItem이 Promise<void>를 반환해야 함', () => {
      expect(bomContextContent).toContain('updateBOMItem: (item: BOMItem) => Promise<void>')
    })

    it('deleteBOMItem이 Promise<void>를 반환해야 함', () => {
      expect(bomContextContent).toContain('deleteBOMItem: (id: number) => Promise<void>')
    })

    it('refreshBOM이 Promise<void>를 반환해야 함', () => {
      expect(bomContextContent).toContain('refreshBOM: () => Promise<void>')
    })
  })

  // ============================================
  // 7. 로컬 상태 조회 함수 유지 검증
  // ============================================
  describe('로컬 상태 조회 함수 유지', () => {
    it('getBOMByProduct가 동기 함수로 유지되어야 함', () => {
      expect(bomContextContent).toContain('getBOMByProduct: (productCode: string) => BOMItem[]')
    })

    it('getBOMByLevel이 동기 함수로 유지되어야 함', () => {
      expect(bomContextContent).toContain('getBOMByLevel: (productCode: string, level: number) => BOMItem[]')
    })
  })
})

// ============================================
// Phase 1-3 연동 검증
// ============================================
describe('Phase 4: Phase 1-3 연동 검증', () => {

  // ============================================
  // 1. 모든 Context의 electronBridge import 검증
  // ============================================
  describe('모든 Context의 electronBridge import', () => {
    it('ProductionContext가 electronBridge를 import해야 함', () => {
      expect(productionContextContent).toContain("from '../../lib/electronBridge'")
    })

    it('MaterialContext가 electronBridge를 import해야 함', () => {
      expect(materialContextContent).toContain("from '../../lib/electronBridge'")
    })

    it('BOMContext가 electronBridge를 import해야 함', () => {
      expect(bomContextContent).toContain("from '../../lib/electronBridge'")
    })
  })

  // ============================================
  // 2. preload.ts와 Context 호출 일치 검증
  // ============================================
  describe('preload.ts와 Context 호출 일치', () => {
    it('Material IPC 채널이 preload.ts에 정의되어 있어야 함', () => {
      const preloadPath = path.join(__dirname, '..', 'electron', 'preload.ts')
      const preloadContent = fs.readFileSync(preloadPath, 'utf-8')

      expect(preloadContent).toContain('material: {')
      expect(preloadContent).toContain("ipcRenderer.invoke('material:create'")
      expect(preloadContent).toContain("ipcRenderer.invoke('material:update'")
      expect(preloadContent).toContain("ipcRenderer.invoke('material:delete'")
      expect(preloadContent).toContain("ipcRenderer.invoke('material:getAll'")
    })

    it('BOM IPC 채널이 preload.ts에 정의되어 있어야 함', () => {
      const preloadPath = path.join(__dirname, '..', 'electron', 'preload.ts')
      const preloadContent = fs.readFileSync(preloadPath, 'utf-8')

      expect(preloadContent).toContain('bom: {')
      expect(preloadContent).toContain("ipcRenderer.invoke('bom:createBOMItem'")
      expect(preloadContent).toContain("ipcRenderer.invoke('bom:updateBOMItem'")
      expect(preloadContent).toContain("ipcRenderer.invoke('bom:deleteBOMItem'")
    })
  })

  // ============================================
  // 3. electronBridge 타입과 Context 일치 검증
  // ============================================
  describe('electronBridge 타입과 Context 일치', () => {
    it('MaterialAPI 인터페이스가 electronBridge에 정의되어 있어야 함', () => {
      const electronBridgePath = path.join(__dirname, '..', 'src', 'lib', 'electronBridge.ts')
      const electronBridgeContent = fs.readFileSync(electronBridgePath, 'utf-8')

      expect(electronBridgeContent).toContain('export interface MaterialAPI')
      expect(electronBridgeContent).toContain('create:')
      expect(electronBridgeContent).toContain('update:')
      expect(electronBridgeContent).toContain('delete:')
      expect(electronBridgeContent).toContain('getAll:')
    })

    it('BOMAPI 인터페이스가 electronBridge에 정의되어 있어야 함', () => {
      const electronBridgePath = path.join(__dirname, '..', 'src', 'lib', 'electronBridge.ts')
      const electronBridgeContent = fs.readFileSync(electronBridgePath, 'utf-8')

      expect(electronBridgeContent).toContain('export interface BOMAPI')
      expect(electronBridgeContent).toContain('createBOMItem:')
      expect(electronBridgeContent).toContain('updateBOMItem:')
      expect(electronBridgeContent).toContain('deleteBOMItem:')
    })
  })
})
