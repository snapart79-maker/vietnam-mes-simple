/**
 * Phase 1: 생산 데이터 영속화 테스트
 *
 * 목표: productionService.mock, inspectionService.mock의 localStorage 영속화 검증
 * - 데이터 생성 후 localStorage 저장 확인
 * - localStorage에서 데이터 로드 확인
 * - Date 필드 직렬화/역직렬화 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

// 동적 import로 mock 서비스 로드 (localStorage mock 이후)
describe('Phase 1: Production Service Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('STORAGE_KEYS 상수', () => {
    it('생산 LOT와 이월 데이터에 대한 키가 정의되어야 함', async () => {
      const module = await import('../src/services/mock/productionService.mock')

      // STORAGE_KEYS는 내부 상수이므로 localStorage 호출로 간접 확인
      await module.startNewProduction({
        processCode: 'CA',
        productCode: 'TEST001',
        productName: '테스트 제품',
        plannedQty: 100,
        productId: 1,
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vietnam_mes_production_lots',
        expect.any(String)
      )
    })
  })

  describe('LOT 생성 및 저장', () => {
    it('LOT 생성 시 localStorage에 저장되어야 함', async () => {
      const module = await import('../src/services/mock/productionService.mock')

      const lot = await module.startNewProduction({
        processCode: 'CA',
        productCode: 'P001',
        productName: '테스트 제품',
        plannedQty: 100,
        productId: 1,
      })

      expect(lot.id).toBe(1)
      expect(lot.processCode).toBe('CA')
      expect(lot.status).toBe('IN_PROGRESS')
      expect(localStorageMock.setItem).toHaveBeenCalled()

      // 저장된 데이터 확인
      const savedData = localStorageMock.getItem('vietnam_mes_production_lots')
      expect(savedData).not.toBeNull()

      const parsed = JSON.parse(savedData!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].processCode).toBe('CA')
    })

    it('LOT 완료 시 localStorage가 업데이트되어야 함', async () => {
      const module = await import('../src/services/mock/productionService.mock')

      const lot = await module.startNewProduction({
        processCode: 'CA',
        productCode: 'P001',
        productName: '테스트 제품',
        plannedQty: 100,
        productId: 1,
      })

      const completedLot = await module.completeProductionV2({
        lotId: lot.id,
        completedQty: 95,
        defectQty: 5,
      })

      expect(completedLot.status).toBe('COMPLETED')
      expect(completedLot.completedQty).toBe(95)

      const savedData = localStorageMock.getItem('vietnam_mes_production_lots')
      const parsed = JSON.parse(savedData!)
      expect(parsed[0].status).toBe('COMPLETED')
      expect(parsed[0].completedQty).toBe(95)
    })
  })

  describe('Date 직렬화/역직렬화', () => {
    it('Date 필드가 ISO 문자열로 저장되어야 함', async () => {
      const module = await import('../src/services/mock/productionService.mock')

      await module.startNewProduction({
        processCode: 'CA',
        productCode: 'P001',
        productName: '테스트 제품',
        plannedQty: 100,
        productId: 1,
      })

      const savedData = localStorageMock.getItem('vietnam_mes_production_lots')
      const parsed = JSON.parse(savedData!)

      // ISO 문자열 형식 확인
      expect(parsed[0].startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('모듈 리로드 시 Date 객체로 복원되어야 함', async () => {
      // 첫 번째 모듈 로드 및 데이터 생성
      const module1 = await import('../src/services/mock/productionService.mock')

      await module1.startNewProduction({
        processCode: 'CA',
        productCode: 'P001',
        productName: '테스트 제품',
        plannedQty: 100,
        productId: 1,
      })

      // 모듈 캐시 초기화 (리로드 시뮬레이션)
      vi.resetModules()

      // 두 번째 모듈 로드
      const module2 = await import('../src/services/mock/productionService.mock')
      const lots = await module2.getTodayLots('CA')

      expect(lots).toHaveLength(1)
      expect(lots[0].startedAt).toBeInstanceOf(Date)
    })
  })

  describe('이월(CarryOver) 데이터 영속화', () => {
    it('이월 생성 시 localStorage에 저장되어야 함', async () => {
      const module = await import('../src/services/mock/productionService.mock')

      const lot = await module.startNewProduction({
        processCode: 'CA',
        productCode: 'P001',
        productName: '테스트 제품',
        plannedQty: 100,
        productId: 1,
      })

      await module.completeProductionV2({
        lotId: lot.id,
        completedQty: 80,
        createCarryOver: true,
        carryOverQty: 20,
      })

      const carryOvers = await module.getCarryOvers({ processCode: 'CA' })
      expect(carryOvers).toHaveLength(1)
      expect(carryOvers[0].quantity).toBe(20)

      // localStorage 확인
      const savedData = localStorageMock.getItem('vietnam_mes_carry_overs')
      expect(savedData).not.toBeNull()
    })
  })

  describe('데이터 초기화', () => {
    it('resetProductionData 호출 시 localStorage도 초기화되어야 함', async () => {
      const module = await import('../src/services/mock/productionService.mock')

      await module.startNewProduction({
        processCode: 'CA',
        productCode: 'P001',
        productName: '테스트 제품',
        plannedQty: 100,
        productId: 1,
      })

      expect(localStorageMock.getItem('vietnam_mes_production_lots')).not.toBeNull()

      module.resetProductionData()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vietnam_mes_production_lots')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vietnam_mes_carry_overs')
    })
  })
})

describe('Phase 1: Inspection Service Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('검사 기록 생성 및 저장', () => {
    it('검사 기록 생성 시 localStorage에 저장되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      expect(result.id).toBe(1)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vietnam_mes_inspections',
        expect.any(String)
      )

      const savedData = localStorageMock.getItem('vietnam_mes_inspections')
      expect(savedData).not.toBeNull()

      const parsed = JSON.parse(savedData!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].type).toBe('CRIMP')
      expect(parsed[0].result).toBe('PASS')
    })

    it('불량 검사 기록이 올바르게 저장되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.createInspection({
        lotId: 1,
        type: 'VISUAL',
        result: 'FAIL',
        defectReason: '찍힘/스크래치',
      })

      const savedData = localStorageMock.getItem('vietnam_mes_inspections')
      const parsed = JSON.parse(savedData!)

      expect(parsed[0].result).toBe('FAIL')
      expect(parsed[0].defectReason).toBe('찍힘/스크래치')
    })
  })

  describe('검사 통계', () => {
    it('저장된 검사 기록으로 통계가 계산되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // 합격 3개, 불량 1개
      await module.createInspection({ lotId: 1, type: 'CRIMP', result: 'PASS' })
      await module.createInspection({ lotId: 2, type: 'CRIMP', result: 'PASS' })
      await module.createInspection({ lotId: 3, type: 'CIRCUIT', result: 'PASS' })
      await module.createInspection({ lotId: 4, type: 'VISUAL', result: 'FAIL', defectReason: '오염' })

      const stats = await module.getTodayInspectionSummary()

      expect(stats.total).toBe(4)
      expect(stats.pass).toBe(3)
      expect(stats.fail).toBe(1)
      expect(stats.passRate).toBe(75)
      expect(stats.byType.CRIMP.pass).toBe(2)
      expect(stats.byType.VISUAL.fail).toBe(1)
    })
  })

  describe('Date 직렬화/역직렬화', () => {
    it('검사 날짜가 ISO 문자열로 저장되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      const savedData = localStorageMock.getItem('vietnam_mes_inspections')
      const parsed = JSON.parse(savedData!)

      expect(parsed[0].inspectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('모듈 리로드 시 Date 객체로 복원되어야 함', async () => {
      const module1 = await import('../src/services/mock/inspectionService.mock')

      await module1.createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      vi.resetModules()

      const module2 = await import('../src/services/mock/inspectionService.mock')
      const inspections = await module2.getInspectionsByLot(1)

      expect(inspections).toHaveLength(1)
      expect(inspections[0].inspectedAt).toBeInstanceOf(Date)
    })
  })

  describe('Mock LOT 데이터 영속화', () => {
    it('addMockLot 호출 시 localStorage에 저장되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      module.addMockLot({
        id: 1,
        lotNumber: 'CAP001Q100-C241220-0001',
        processCode: 'CA',
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vietnam_mes_inspection_lots',
        expect.any(String)
      )

      const savedData = localStorageMock.getItem('vietnam_mes_inspection_lots')
      const parsed = JSON.parse(savedData!)

      expect(parsed).toHaveLength(1)
      expect(parsed[0].processCode).toBe('CA')
    })
  })

  describe('데이터 초기화', () => {
    it('resetInspectionData 호출 시 localStorage도 초기화되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      expect(localStorageMock.getItem('vietnam_mes_inspections')).not.toBeNull()

      module.resetInspectionData()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vietnam_mes_inspections')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vietnam_mes_inspection_lots')
    })
  })
})

describe('Phase 1: 통합 영속화 테스트', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  it('앱 재시작 시나리오: 데이터가 유지되어야 함', async () => {
    // 1단계: 데이터 생성 (첫 번째 세션)
    const prodModule1 = await import('../src/services/mock/productionService.mock')
    const inspModule1 = await import('../src/services/mock/inspectionService.mock')

    // LOT 생성
    const lot = await prodModule1.startNewProduction({
      processCode: 'CA',
      productCode: 'P001',
      productName: '테스트 제품',
      plannedQty: 100,
      productId: 1,
    })

    // 검사 기록 생성
    await inspModule1.createInspection({
      lotId: lot.id,
      type: 'CRIMP',
      result: 'PASS',
    })

    // 2단계: 모듈 리로드 (앱 재시작 시뮬레이션)
    vi.resetModules()

    // 3단계: 데이터 확인 (두 번째 세션)
    const prodModule2 = await import('../src/services/mock/productionService.mock')
    const inspModule2 = await import('../src/services/mock/inspectionService.mock')

    // LOT 데이터 확인
    const lots = await prodModule2.getTodayLots('CA')
    expect(lots).toHaveLength(1)
    expect(lots[0].processCode).toBe('CA')
    expect(lots[0].plannedQty).toBe(100)

    // 검사 데이터 확인
    const stats = await inspModule2.getTodayInspectionSummary()
    expect(stats.total).toBe(1)
    expect(stats.pass).toBe(1)
    expect(stats.byType.CRIMP.pass).toBe(1)
  })
})
