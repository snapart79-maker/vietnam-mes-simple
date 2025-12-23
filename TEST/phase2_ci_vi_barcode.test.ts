/**
 * Phase 2: CI/VI 바코드 생성 테스트
 *
 * 목표: 회로검사(CI) / 육안검사(VI) 바코드 생성 및 ProductionLot 연동 검증
 * - BARCORD 형식 CI 바코드: CI-{markingLot}-{4자리시퀀스}
 * - BARCORD 형식 VI 바코드: VI-{markingLot}-{4자리시퀀스}
 * - 검사 합격 시 자동 바코드 발급
 * - ProductionLot 생성 및 영속화
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

// ============================================
// Part 1: barcodeService CI/VI 함수 테스트
// ============================================

describe('Phase 2: barcodeService CI/VI 함수', () => {
  describe('generateBarcordCIBarcode', () => {
    it('정상적인 CI 바코드를 생성해야 함', async () => {
      const { generateBarcordCIBarcode } = await import('../src/services/barcodeService')

      const barcode = generateBarcordCIBarcode('5MT', 1)
      expect(barcode).toBe('CI-5MT-0001')
    })

    it('시퀀스 번호가 4자리로 패딩되어야 함', async () => {
      const { generateBarcordCIBarcode } = await import('../src/services/barcodeService')

      expect(generateBarcordCIBarcode('ABC', 1)).toBe('CI-ABC-0001')
      expect(generateBarcordCIBarcode('ABC', 42)).toBe('CI-ABC-0042')
      expect(generateBarcordCIBarcode('ABC', 123)).toBe('CI-ABC-0123')
      expect(generateBarcordCIBarcode('ABC', 9999)).toBe('CI-ABC-9999')
    })

    it('마킹LOT이 대문자로 변환되어야 함', async () => {
      const { generateBarcordCIBarcode } = await import('../src/services/barcodeService')

      const barcode = generateBarcordCIBarcode('abc', 1)
      expect(barcode).toBe('CI-ABC-0001')
    })

    it('잘못된 마킹LOT에 대해 에러를 발생시켜야 함', async () => {
      const { generateBarcordCIBarcode } = await import('../src/services/barcodeService')

      expect(() => generateBarcordCIBarcode('AB', 1)).toThrow()  // 2자리
      expect(() => generateBarcordCIBarcode('ABCD', 1)).toThrow()  // 4자리
      expect(() => generateBarcordCIBarcode('', 1)).toThrow()  // 빈 문자열
    })

    it('잘못된 시퀀스에 대해 에러를 발생시켜야 함', async () => {
      const { generateBarcordCIBarcode } = await import('../src/services/barcodeService')

      expect(() => generateBarcordCIBarcode('ABC', 0)).toThrow()  // 0
      expect(() => generateBarcordCIBarcode('ABC', -1)).toThrow()  // 음수
      expect(() => generateBarcordCIBarcode('ABC', 10000)).toThrow()  // 10000
      expect(() => generateBarcordCIBarcode('ABC', 1.5)).toThrow()  // 소수
    })
  })

  describe('generateBarcordVIBarcode', () => {
    it('정상적인 VI 바코드를 생성해야 함', async () => {
      const { generateBarcordVIBarcode } = await import('../src/services/barcodeService')

      const barcode = generateBarcordVIBarcode('5MT', 1)
      expect(barcode).toBe('VI-5MT-0001')
    })

    it('시퀀스 번호가 4자리로 패딩되어야 함', async () => {
      const { generateBarcordVIBarcode } = await import('../src/services/barcodeService')

      expect(generateBarcordVIBarcode('XYZ', 1)).toBe('VI-XYZ-0001')
      expect(generateBarcordVIBarcode('XYZ', 99)).toBe('VI-XYZ-0099')
      expect(generateBarcordVIBarcode('XYZ', 500)).toBe('VI-XYZ-0500')
    })
  })

  describe('parseBarcordCIBarcode', () => {
    it('정상적인 CI 바코드를 파싱해야 함', async () => {
      const { parseBarcordCIBarcode } = await import('../src/services/barcodeService')

      const result = parseBarcordCIBarcode('CI-5MT-0001')
      expect(result).not.toBeNull()
      expect(result?.type).toBe('CI')
      expect(result?.markingLot).toBe('5MT')
      expect(result?.sequence).toBe('0001')
    })

    it('소문자 입력도 파싱해야 함', async () => {
      const { parseBarcordCIBarcode } = await import('../src/services/barcodeService')

      const result = parseBarcordCIBarcode('ci-abc-0042')
      expect(result).not.toBeNull()
      expect(result?.markingLot).toBe('ABC')
    })

    it('잘못된 CI 바코드에 대해 null을 반환해야 함', async () => {
      const { parseBarcordCIBarcode } = await import('../src/services/barcodeService')

      expect(parseBarcordCIBarcode('VI-5MT-0001')).toBeNull()  // VI 아님
      expect(parseBarcordCIBarcode('CI-AB-0001')).toBeNull()  // 2자리 마킹LOT
      expect(parseBarcordCIBarcode('CI-5MT-001')).toBeNull()  // 3자리 시퀀스
      expect(parseBarcordCIBarcode('')).toBeNull()
    })
  })

  describe('parseBarcordVIBarcode', () => {
    it('정상적인 VI 바코드를 파싱해야 함', async () => {
      const { parseBarcordVIBarcode } = await import('../src/services/barcodeService')

      const result = parseBarcordVIBarcode('VI-5MT-0001')
      expect(result).not.toBeNull()
      expect(result?.type).toBe('VI')
      expect(result?.markingLot).toBe('5MT')
      expect(result?.sequence).toBe('0001')
    })

    it('잘못된 VI 바코드에 대해 null을 반환해야 함', async () => {
      const { parseBarcordVIBarcode } = await import('../src/services/barcodeService')

      expect(parseBarcordVIBarcode('CI-5MT-0001')).toBeNull()  // CI 아님
    })
  })

  describe('isBarcordCIBarcode / isBarcordVIBarcode', () => {
    it('CI 바코드를 올바르게 감지해야 함', async () => {
      const { isBarcordCIBarcode, isBarcordVIBarcode } = await import('../src/services/barcodeService')

      expect(isBarcordCIBarcode('CI-5MT-0001')).toBe(true)
      expect(isBarcordCIBarcode('VI-5MT-0001')).toBe(false)
      expect(isBarcordCIBarcode('CA-241220-0001')).toBe(false)
    })

    it('VI 바코드를 올바르게 감지해야 함', async () => {
      const { isBarcordCIBarcode, isBarcordVIBarcode } = await import('../src/services/barcodeService')

      expect(isBarcordVIBarcode('VI-5MT-0001')).toBe(true)
      expect(isBarcordVIBarcode('CI-5MT-0001')).toBe(false)
    })
  })

  describe('isBarcordInspectionBarcode', () => {
    it('CI 또는 VI 바코드를 감지해야 함', async () => {
      const { isBarcordInspectionBarcode } = await import('../src/services/barcodeService')

      expect(isBarcordInspectionBarcode('CI-5MT-0001')).toBe(true)
      expect(isBarcordInspectionBarcode('VI-5MT-0001')).toBe(true)
      expect(isBarcordInspectionBarcode('CA-241220-0001')).toBe(false)
    })
  })
})

// ============================================
// Part 2: inspectionService CI/VI 워크플로우 테스트
// ============================================

describe('Phase 2: inspectionService CI/VI 워크플로우', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('recordCircuitInspectionWithBarcode', () => {
    it('회로검사 합격 시 CI 바코드가 생성되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
        productCode: 'P001',
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe('PASS')
      expect(result.ciBarcode).toBe('CI-5MT-0001')
      expect(result.productionLotId).toBe(1)
      expect(result.inspectionId).toBeGreaterThan(0)
    })

    it('연속 합격 시 시퀀스가 증가해야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result1 = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      const result2 = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-002',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      const result3 = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-003',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      expect(result1.ciBarcode).toBe('CI-5MT-0001')
      expect(result2.ciBarcode).toBe('CI-5MT-0002')
      expect(result3.ciBarcode).toBe('CI-5MT-0003')
    })

    it('다른 마킹LOT은 독립적인 시퀀스를 가져야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result1 = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: 'AAA',
        quantity: 100,
        result: 'PASS',
      })

      const result2 = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-002',
        markingLot: 'BBB',
        quantity: 100,
        result: 'PASS',
      })

      expect(result1.ciBarcode).toBe('CI-AAA-0001')
      expect(result2.ciBarcode).toBe('CI-BBB-0001')  // 독립적인 시퀀스
    })

    it('회로검사 불합격 시 CI 바코드가 생성되지 않아야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'FAIL',
        defectReason: '회로 단락',
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe('FAIL')
      expect(result.ciBarcode).toBeUndefined()
      expect(result.productionLotId).toBeUndefined()
      expect(result.inspectionId).toBeGreaterThan(0)
    })

    it('필수 입력값 누락 시 실패해야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordCircuitInspectionWithBarcode({
        paBarcode: '',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('필수 입력값')
    })

    it('잘못된 마킹LOT 형식에 대해 실패해야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: 'AB',  // 2자리
        quantity: 100,
        result: 'PASS',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('마킹LOT')
    })

    it('검사 기록이 localStorage에 저장되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vietnam_mes_inspections',
        expect.any(String)
      )

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vietnam_mes_ci_vi_lots',
        expect.any(String)
      )
    })
  })

  describe('recordVisualInspectionWithBarcode', () => {
    it('육안검사 합격 시 VI 바코드가 생성되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordVisualInspectionWithBarcode({
        ciBarcode: 'CI-5MT-0001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
        productCode: 'P001',
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe('PASS')
      expect(result.viBarcode).toBe('VI-5MT-0001')
      expect(result.productionLotId).toBe(1)
    })

    it('육안검사 불합격 시 VI 바코드가 생성되지 않아야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordVisualInspectionWithBarcode({
        ciBarcode: 'CI-5MT-0001',
        markingLot: '5MT',
        quantity: 100,
        result: 'FAIL',
        defectReason: '외관 불량',
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe('FAIL')
      expect(result.viBarcode).toBeUndefined()
    })

    it('연속 합격 시 시퀀스가 증가해야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result1 = await module.recordVisualInspectionWithBarcode({
        ciBarcode: 'CI-5MT-0001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      const result2 = await module.recordVisualInspectionWithBarcode({
        ciBarcode: 'CI-5MT-0002',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      expect(result1.viBarcode).toBe('VI-5MT-0001')
      expect(result2.viBarcode).toBe('VI-5MT-0002')
    })
  })

  describe('CI → VI 전체 워크플로우', () => {
    it('PA → CI 합격 → VI 합격 전체 흐름이 동작해야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // 1. PA 바코드로 회로검사 수행
      const ciResult = await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA00315452Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
        productCode: '00315452',
        productName: '테스트 제품',
      })

      expect(ciResult.success).toBe(true)
      expect(ciResult.ciBarcode).toBe('CI-5MT-0001')

      // 2. CI 바코드로 육안검사 수행
      const viResult = await module.recordVisualInspectionWithBarcode({
        ciBarcode: ciResult.ciBarcode!,
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
        productCode: '00315452',
        productName: '테스트 제품',
      })

      expect(viResult.success).toBe(true)
      expect(viResult.viBarcode).toBe('VI-5MT-0001')

      // 3. 생성된 LOT 확인
      const lots = module.getCIVILots()
      expect(lots).toHaveLength(2)

      const ciLot = lots.find((l) => l.processCode === 'CI')
      const viLot = lots.find((l) => l.processCode === 'VI')

      expect(ciLot?.lotNumber).toBe('CI-5MT-0001')
      expect(ciLot?.inputBarcode).toBe('PA00315452Q100-A251220-001')
      expect(ciLot?.quantity).toBe(100)

      expect(viLot?.lotNumber).toBe('VI-5MT-0001')
      expect(viLot?.inputBarcode).toBe('CI-5MT-0001')
    })
  })

  describe('영속화 테스트', () => {
    it('CI/VI 시퀀스가 localStorage에 저장되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vietnam_mes_ci_vi_sequences',
        expect.any(String)
      )

      const savedSeq = localStorageMock.getItem('vietnam_mes_ci_vi_sequences')
      expect(savedSeq).not.toBeNull()
      const parsed = JSON.parse(savedSeq!)
      expect(parsed['CI_5MT']).toBe(1)
    })

    it('CI/VI LOT이 localStorage에 저장되어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
        productCode: 'P001',
      })

      const savedLots = localStorageMock.getItem('vietnam_mes_ci_vi_lots')
      expect(savedLots).not.toBeNull()

      const parsed = JSON.parse(savedLots!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].lotNumber).toBe('CI-5MT-0001')
      expect(parsed[0].processCode).toBe('CI')
      expect(parsed[0].quantity).toBe(100)
    })

    it('모듈 리로드 후에도 시퀀스가 유지되어야 함', async () => {
      // 첫 번째 세션
      const module1 = await import('../src/services/mock/inspectionService.mock')

      await module1.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      // 모듈 리로드
      vi.resetModules()

      // 두 번째 세션
      const module2 = await import('../src/services/mock/inspectionService.mock')

      const result = await module2.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-002',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      // 시퀀스가 2가 되어야 함
      expect(result.ciBarcode).toBe('CI-5MT-0002')
    })

    it('모듈 리로드 후에도 LOT 데이터가 유지되어야 함', async () => {
      // 첫 번째 세션
      const module1 = await import('../src/services/mock/inspectionService.mock')

      await module1.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA12345678Q100-A251220-001',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      // 모듈 리로드
      vi.resetModules()

      // 두 번째 세션
      const module2 = await import('../src/services/mock/inspectionService.mock')

      const lots = module2.getCIVILots()
      expect(lots).toHaveLength(1)
      expect(lots[0].lotNumber).toBe('CI-5MT-0001')
    })
  })

  describe('getCIVILotsByMarkingLot', () => {
    it('마킹LOT으로 CI/VI LOT을 조회할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA1',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA2',
        markingLot: 'ABC',
        quantity: 50,
        result: 'PASS',
      })

      await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA3',
        markingLot: '5MT',
        quantity: 75,
        result: 'PASS',
      })

      const lots5MT = module.getCIVILotsByMarkingLot('5MT')
      expect(lots5MT).toHaveLength(2)
      expect(lots5MT.every((l) => l.markingLot === '5MT')).toBe(true)

      const lotsABC = module.getCIVILotsByMarkingLot('ABC')
      expect(lotsABC).toHaveLength(1)
    })
  })

  describe('resetCIVIData', () => {
    it('CI/VI 데이터를 초기화할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.recordCircuitInspectionWithBarcode({
        paBarcode: 'PA1',
        markingLot: '5MT',
        quantity: 100,
        result: 'PASS',
      })

      expect(module.getCIVILots()).toHaveLength(1)

      module.resetCIVIData()

      expect(module.getCIVILots()).toHaveLength(0)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vietnam_mes_ci_vi_lots')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vietnam_mes_ci_vi_sequences')
    })
  })
})
