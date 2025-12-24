/**
 * Phase 3 테스트: src/lib/electronBridge.ts 타입 정의 및 헬퍼 함수 검증
 *
 * 테스트 항목:
 * 1. ApiResult<T> 타입 존재 확인
 * 2. 비즈니스 API 입력 타입 존재 확인
 * 3. 네임스페이스 타입 존재 확인
 * 4. Window.electronAPI 타입 확장 확인
 * 5. hasBusinessAPI() 헬퍼 함수 검증
 * 6. callAPI<T>() 헬퍼 함수 검증
 * 7. 기타 헬퍼 함수 검증
 *
 * 실행 방법:
 * npx vitest run TEST/phase3_electron_bridge.test.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// electronBridge 모듈 import
import {
  // Common Types
  ApiResult,
  CallAPIOptions,
  // Input Types
  CreateLotInput,
  ReceiveStockInput,
  InputMaterial,
  CreateBOMItemInput,
  UpdateBOMItemInput,
  CreateMaterialInput,
  UpdateMaterialInput,
  CreateInspectionInput,
  // Namespace Types
  ProductionAPI,
  StockAPI,
  BOMAPI,
  MaterialAPI,
  LotTraceAPI,
  InspectionAPI,
  LineAPI,
  SequenceAPI,
  // Helper Functions
  isElectron,
  hasBusinessAPI,
  hasNamespace,
  callAPI,
  getAPI,
  withBusinessAPI,
  // Existing Types
  PrinterInfo,
  PrintOptions,
  PrintResult,
} from '../src/lib/electronBridge'

// 파일 내용 읽기
let bridgeTsContent: string

beforeAll(() => {
  const bridgeTsPath = path.join(__dirname, '..', 'src', 'lib', 'electronBridge.ts')
  bridgeTsContent = fs.readFileSync(bridgeTsPath, 'utf-8')
})

describe('Phase 3: electronBridge 타입 및 헬퍼 함수 검증', () => {

  // ============================================
  // 1. ApiResult<T> 타입 검증
  // ============================================
  describe('ApiResult<T> 타입', () => {
    it('ApiResult 타입이 export 되어야 함', () => {
      // 타입이 import 되었으면 존재
      const result: ApiResult<string> = { success: true, data: 'test' }
      expect(result.success).toBe(true)
      expect(result.data).toBe('test')
    })

    it('ApiResult 에러 케이스', () => {
      const result: ApiResult<string> = { success: false, error: 'Error message' }
      expect(result.success).toBe(false)
      expect(result.error).toBe('Error message')
    })

    it('파일에 ApiResult 인터페이스가 정의되어 있어야 함', () => {
      expect(bridgeTsContent).toContain('export interface ApiResult<T>')
      expect(bridgeTsContent).toContain('success: boolean')
      expect(bridgeTsContent).toContain('data?: T')
      expect(bridgeTsContent).toContain('error?: string')
    })
  })

  // ============================================
  // 2. 비즈니스 API 입력 타입 검증
  // ============================================
  describe('비즈니스 API 입력 타입', () => {
    it('CreateLotInput 타입이 export 되어야 함', () => {
      const input: CreateLotInput = {
        processCode: 'CA',
        productId: 1,
        targetQuantity: 100,
      }
      expect(input.processCode).toBe('CA')
    })

    it('ReceiveStockInput 타입이 export 되어야 함', () => {
      const input: ReceiveStockInput = {
        materialId: 1,
        quantity: 50,
      }
      expect(input.materialId).toBe(1)
    })

    it('InputMaterial 타입이 export 되어야 함', () => {
      const input: InputMaterial = {
        materialId: 1,
        quantity: 10,
      }
      expect(input.materialId).toBe(1)
    })

    it('CreateBOMItemInput 타입이 export 되어야 함', () => {
      const input: CreateBOMItemInput = {
        productId: 1,
        materialId: 2,
        quantity: 5,
      }
      expect(input.productId).toBe(1)
    })

    it('UpdateBOMItemInput 타입이 export 되어야 함', () => {
      const input: UpdateBOMItemInput = {
        quantity: 10,
      }
      expect(input.quantity).toBe(10)
    })

    it('CreateMaterialInput 타입이 export 되어야 함', () => {
      const input: CreateMaterialInput = {
        code: 'M001',
        name: 'Material 1',
        unit: 'EA',
      }
      expect(input.code).toBe('M001')
    })

    it('UpdateMaterialInput 타입이 export 되어야 함', () => {
      const input: UpdateMaterialInput = {
        name: 'Updated Name',
      }
      expect(input.name).toBe('Updated Name')
    })

    it('CreateInspectionInput 타입이 export 되어야 함', () => {
      const input: CreateInspectionInput = {
        lotId: 1,
        result: 'PASS',
      }
      expect(input.result).toBe('PASS')
    })
  })

  // ============================================
  // 3. 네임스페이스 타입 검증
  // ============================================
  describe('네임스페이스 타입', () => {
    const namespaceTypes = [
      'ProductionAPI',
      'StockAPI',
      'BOMAPI',
      'MaterialAPI',
      'LotTraceAPI',
      'InspectionAPI',
      'LineAPI',
      'SequenceAPI',
    ]

    it.each(namespaceTypes)('%s 타입이 파일에 정의되어 있어야 함', (typeName) => {
      expect(bridgeTsContent).toContain(`export interface ${typeName}`)
    })

    it('ProductionAPI에 10개 메서드가 정의되어 있어야 함', () => {
      const productionMethods = [
        'createLot', 'startProduction', 'completeProduction', 'addMaterial',
        'removeMaterial', 'getLotById', 'getLotByNumber', 'getLotsByProcess',
        'getLotsByStatus', 'updateLotQuantity'
      ]
      for (const method of productionMethods) {
        expect(bridgeTsContent).toContain(`${method}:`)
      }
    })

    it('StockAPI에 8개 메서드가 정의되어 있어야 함', () => {
      const stockMethods = [
        'receiveStock', 'consumeStock', 'deductByBOM', 'getStockByMaterial',
        'getStockSummary', 'getLowStock', 'getAvailableQty', 'getTodayReceivings'
      ]
      for (const method of stockMethods) {
        expect(bridgeTsContent).toContain(`${method}:`)
      }
    })
  })

  // ============================================
  // 4. Window.electronAPI 타입 확장 검증
  // ============================================
  describe('Window.electronAPI 타입 확장', () => {
    it('declare global Window 인터페이스가 정의되어 있어야 함', () => {
      expect(bridgeTsContent).toContain('declare global')
      expect(bridgeTsContent).toContain('interface Window')
      expect(bridgeTsContent).toContain('electronAPI?:')
    })

    it('electronAPI에 비즈니스 네임스페이스가 포함되어 있어야 함', () => {
      const namespaces = [
        'production: ProductionAPI',
        'stock: StockAPI',
        'bom: BOMAPI',
        'material: MaterialAPI',
        'lotTrace: LotTraceAPI',
        'inspection: InspectionAPI',
        'line: LineAPI',
        'sequence: SequenceAPI',
      ]
      for (const ns of namespaces) {
        expect(bridgeTsContent).toContain(ns)
      }
    })

    it('기존 프린터/파일 API가 유지되어야 함', () => {
      expect(bridgeTsContent).toContain('getPrinters:')
      expect(bridgeTsContent).toContain('printPDF:')
      expect(bridgeTsContent).toContain('saveFileDialog:')
      expect(bridgeTsContent).toContain('readFile:')
    })
  })

  // ============================================
  // 5. hasBusinessAPI() 헬퍼 함수 검증
  // ============================================
  describe('hasBusinessAPI() 함수', () => {
    beforeEach(() => {
      // window.electronAPI 초기화
      (globalThis as unknown as { window: { electronAPI?: unknown } }).window = { electronAPI: undefined }
    })

    afterEach(() => {
      // 정리
      delete (globalThis as unknown as { window?: unknown }).window
    })

    it('hasBusinessAPI 함수가 export 되어야 함', () => {
      expect(typeof hasBusinessAPI).toBe('function')
    })

    it('electronAPI가 없으면 false 반환', () => {
      expect(hasBusinessAPI()).toBe(false)
    })

    it('파일에 hasBusinessAPI 함수가 정의되어 있어야 함', () => {
      expect(bridgeTsContent).toContain('export function hasBusinessAPI()')
      expect(bridgeTsContent).toContain('window.electronAPI.production !== undefined')
      expect(bridgeTsContent).toContain('window.electronAPI.stock !== undefined')
    })
  })

  // ============================================
  // 6. callAPI<T>() 헬퍼 함수 검증
  // ============================================
  describe('callAPI<T>() 함수', () => {
    beforeEach(() => {
      (globalThis as unknown as { window: { electronAPI?: unknown } }).window = { electronAPI: undefined }
    })

    afterEach(() => {
      delete (globalThis as unknown as { window?: unknown }).window
    })

    it('callAPI 함수가 export 되어야 함', () => {
      expect(typeof callAPI).toBe('function')
    })

    it('Electron 환경이 아니고 폴백이 없으면 에러 반환', async () => {
      const result = await callAPI(() => Promise.resolve({ success: true, data: 'test' }))
      expect(result.success).toBe(false)
      expect(result.error).toBe('Electron API not available')
    })

    it('Electron 환경이 아니고 폴백이 있으면 폴백 실행', async () => {
      const fallbackData = { id: 1, name: 'fallback' }
      const result = await callAPI(
        () => Promise.resolve({ success: true, data: 'test' }),
        { fallback: () => Promise.resolve(fallbackData) }
      )
      expect(result.success).toBe(true)
      expect(result.data).toEqual(fallbackData)
    })

    it('폴백 실행 중 에러 발생 시 에러 반환', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await callAPI(
        () => Promise.resolve({ success: true, data: 'test' }),
        { fallback: () => Promise.reject(new Error('Fallback error')), logErrors: true }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Fallback error')

      consoleError.mockRestore()
    })

    it('파일에 callAPI 함수가 정의되어 있어야 함', () => {
      expect(bridgeTsContent).toContain('export async function callAPI<T>')
      expect(bridgeTsContent).toContain('apiCall: () => Promise<ApiResult<T>>')
      expect(bridgeTsContent).toContain('options: CallAPIOptions')
    })
  })

  // ============================================
  // 7. 기타 헬퍼 함수 검증
  // ============================================
  describe('기타 헬퍼 함수', () => {
    beforeEach(() => {
      (globalThis as unknown as { window: { electronAPI?: unknown } }).window = { electronAPI: undefined }
    })

    afterEach(() => {
      delete (globalThis as unknown as { window?: unknown }).window
    })

    it('isElectron 함수가 export 되어야 함', () => {
      expect(typeof isElectron).toBe('function')
    })

    it('hasNamespace 함수가 export 되어야 함', () => {
      expect(typeof hasNamespace).toBe('function')
    })

    it('getAPI 함수가 export 되어야 함', () => {
      expect(typeof getAPI).toBe('function')
    })

    it('withBusinessAPI 함수가 export 되어야 함', () => {
      expect(typeof withBusinessAPI).toBe('function')
    })

    it('getAPI()가 electronAPI 없으면 null 반환', () => {
      expect(getAPI()).toBe(null)
    })

    it('파일에 hasNamespace 함수가 정의되어 있어야 함', () => {
      expect(bridgeTsContent).toContain('export function hasNamespace')
    })

    it('파일에 getAPI 함수가 정의되어 있어야 함', () => {
      expect(bridgeTsContent).toContain('export function getAPI()')
    })

    it('파일에 withBusinessAPI 함수가 정의되어 있어야 함', () => {
      expect(bridgeTsContent).toContain('export async function withBusinessAPI<T>')
    })
  })

  // ============================================
  // 8. 기존 타입 유지 검증
  // ============================================
  describe('기존 타입 유지', () => {
    it('PrinterInfo 타입이 유지되어야 함', () => {
      const printer: PrinterInfo = {
        name: 'Printer1',
        displayName: 'Printer 1',
        description: 'Test Printer',
        status: 0,
        isDefault: true,
      }
      expect(printer.name).toBe('Printer1')
    })

    it('PrintOptions 타입이 유지되어야 함', () => {
      const options: PrintOptions = {
        printerName: 'Printer1',
        copies: 2,
      }
      expect(options.copies).toBe(2)
    })

    it('PrintResult 타입이 유지되어야 함', () => {
      const result: PrintResult = {
        success: true,
      }
      expect(result.success).toBe(true)
    })
  })

  // ============================================
  // 9. 타입 안전성 검증
  // ============================================
  describe('타입 안전성', () => {
    it('ApiResult<T>가 제네릭 타입으로 동작해야 함', () => {
      // 문자열 타입
      const stringResult: ApiResult<string> = { success: true, data: 'hello' }
      expect(stringResult.data).toBe('hello')

      // 숫자 타입
      const numberResult: ApiResult<number> = { success: true, data: 42 }
      expect(numberResult.data).toBe(42)

      // 객체 타입
      interface CustomType { id: number; name: string }
      const objectResult: ApiResult<CustomType> = {
        success: true,
        data: { id: 1, name: 'test' }
      }
      expect(objectResult.data?.id).toBe(1)

      // 배열 타입
      const arrayResult: ApiResult<string[]> = { success: true, data: ['a', 'b'] }
      expect(arrayResult.data?.length).toBe(2)
    })
  })

  // ============================================
  // 10. Phase 1, 2 IPC 채널 일치 검증
  // ============================================
  describe('Phase 1, 2와 일치 검증', () => {
    it('electronBridge의 네임스페이스가 preload.ts와 일치해야 함', () => {
      const preloadTsPath = path.join(__dirname, '..', 'electron', 'preload.ts')
      const preloadTsContent = fs.readFileSync(preloadTsPath, 'utf-8')

      // preload.ts에 정의된 네임스페이스가 electronBridge에도 정의됨
      const namespaces = ['production', 'stock', 'bom', 'material', 'lotTrace', 'inspection', 'line', 'sequence']

      for (const ns of namespaces) {
        expect(bridgeTsContent).toContain(`${ns}:`)
        expect(preloadTsContent).toContain(`${ns}:`)
      }
    })
  })
})
