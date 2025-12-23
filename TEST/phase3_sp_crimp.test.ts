/**
 * Phase 3: SP 공정 압착검사 확인 테스트
 *
 * 목표: CA/MC 투입 시 압착검사(CQ) 통과 여부 검증
 * - checkCrimpInspectionPassed: CA/MC 바코드의 압착검사 통과 여부 확인
 * - getCrimpInspectionHistory: 압착검사 이력 조회
 * - recordCrimpInspection: 압착검사 기록
 * - validateSPProcessInput: SP 공정 투입 검증 (단일)
 * - validateSPProcessInputs: SP 공정 여러 입력 검증
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

describe('Phase 3: SP 공정 압착검사 확인', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('checkCrimpInspectionPassed - 압착검사 통과 여부 확인', () => {
    it('CA 바코드 - 압착검사 미실시 시 통과 false 반환', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.checkCrimpInspectionPassed('CAP001Q100-C241223-0001')

      expect(result.barcode).toBe('CAP001Q100-C241223-0001')
      expect(result.processCode).toBe('CA')
      expect(result.requiresCrimpInspection).toBe(true)
      expect(result.hasCrimpInspection).toBe(false)
      expect(result.passed).toBe(false)
      expect(result.message).toContain('압착검사')
    })

    it('CA 바코드 - 압착검사 합격 시 통과 true 반환', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // 압착검사 합격 기록
      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      const result = await module.checkCrimpInspectionPassed('CAP001Q100-C241223-0001')

      expect(result.requiresCrimpInspection).toBe(true)
      expect(result.hasCrimpInspection).toBe(true)
      expect(result.passed).toBe(true)
      expect(result.inspections.length).toBeGreaterThan(0)
    })

    it('CA 바코드 - 압착검사 불합격 시 통과 false 반환', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // 압착검사 불합격 기록
      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0002',
        result: 'FAIL',
        defectReason: '압착 불량',
      })

      const result = await module.checkCrimpInspectionPassed('CAP001Q100-C241223-0002')

      expect(result.requiresCrimpInspection).toBe(true)
      expect(result.hasCrimpInspection).toBe(true)
      expect(result.passed).toBe(false)
      expect(result.message).toContain('불합격')
    })

    it('MC 바코드 - 압착검사 필요 (requiresCrimpInspection = true)', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.checkCrimpInspectionPassed('MCP001Q50-M241223-0001')

      expect(result.processCode).toBe('MC')
      expect(result.requiresCrimpInspection).toBe(true)
      expect(result.hasCrimpInspection).toBe(false)
      expect(result.passed).toBe(false)
    })

    it('MS 바코드 - 압착검사 불필요 (requiresCrimpInspection = false)', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.checkCrimpInspectionPassed('MSP001Q100-S241223-0001')

      expect(result.processCode).toBe('MS')
      expect(result.requiresCrimpInspection).toBe(false)
      expect(result.passed).toBe(true)  // 압착검사 불필요하므로 통과
    })

    it('SB 바코드 - 압착검사 불필요', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.checkCrimpInspectionPassed('SBP001Q100-B241223-0001')

      expect(result.processCode).toBe('SB')
      expect(result.requiresCrimpInspection).toBe(false)
      expect(result.passed).toBe(true)
    })

    it('HS 바코드 - 압착검사 불필요', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.checkCrimpInspectionPassed('HSP001Q100-H241223-0001')

      expect(result.processCode).toBe('HS')
      expect(result.requiresCrimpInspection).toBe(false)
      expect(result.passed).toBe(true)
    })

    it('유효하지 않은 바코드 - 공정 코드 없음 처리', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.checkCrimpInspectionPassed('INVALID-BARCODE')

      expect(result.processCode).toBeNull()
      expect(result.requiresCrimpInspection).toBe(false)
      // 공정 코드 없으면 검사 불필요로 간주하여 passed=true
      expect(result.passed).toBe(true)
      expect(result.message).toContain('확인')
    })
  })

  describe('getCrimpInspectionHistory - 압착검사 이력 조회', () => {
    it('압착검사 이력이 없을 때 빈 배열 반환', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const history = await module.getCrimpInspectionHistory('CAP001Q100-C241223-0001')

      expect(history).toEqual([])
    })

    it('압착검사 이력 조회 - 단일 기록', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      const history = await module.getCrimpInspectionHistory('CAP001Q100-C241223-0001')

      expect(history).toHaveLength(1)
      expect(history[0].result).toBe('PASS')
      expect(history[0].lotNumber).toBe('CAP001Q100-C241223-0001')
      expect(history[0].processCode).toBe('CA')
    })

    it('압착검사 이력 조회 - 다중 기록 (재검사)', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // 첫 번째 검사 - 불합격
      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'FAIL',
        defectReason: '압착 불량',
      })

      // 재검사 - 합격
      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      const history = await module.getCrimpInspectionHistory('CAP001Q100-C241223-0001')

      expect(history).toHaveLength(2)
      expect(history[0].result).toBe('FAIL')
      expect(history[1].result).toBe('PASS')
    })
  })

  describe('recordCrimpInspection - 압착검사 기록', () => {
    it('CA 바코드 압착검사 합격 기록', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      expect(result.success).toBe(true)
      expect(result.inspectionId).toBeGreaterThan(0)
      expect(result.message).toContain('합격')
    })

    it('MC 바코드 압착검사 불합격 기록 - 불량 사유 포함', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordCrimpInspection({
        barcode: 'MCP001Q50-M241223-0001',
        result: 'FAIL',
        defectReason: '단자 변형',
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('불합격')
      expect(result.message).toContain('단자 변형')
    })

    it('압착검사 대상 아닌 바코드 - 에러 반환', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.recordCrimpInspection({
        barcode: 'MSP001Q100-S241223-0001',  // MS는 압착검사 대상 아님
        result: 'PASS',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('대상')
    })

    it('유효하지 않은 바코드 - LOT 자동 생성 후 기록', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // 유효하지 않은 바코드도 CA/MC가 아니면 에러
      // 그러나 processCode가 null이고 CRIMP_TARGET에 없으면 성공
      const result = await module.recordCrimpInspection({
        barcode: 'INVALID',
        result: 'PASS',
      })

      // processCode가 null이면 기본적으로 CA로 처리되므로 성공
      expect(result.success).toBe(true)
    })

    it('압착검사 기록 후 localStorage에 저장', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vietnam_mes_inspections',
        expect.any(String)
      )

      const savedData = localStorageMock.getItem('vietnam_mes_inspections')
      expect(savedData).not.toBeNull()
      const parsed = JSON.parse(savedData!)
      expect(parsed.some((i: any) => i.type === 'CRIMP')).toBe(true)
    })
  })

  describe('validateSPProcessInput - SP 공정 투입 검증 (단일)', () => {
    it('CA 바코드 - 압착검사 합격 시 유효', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // 압착검사 합격 기록
      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      const result = await module.validateSPProcessInput('CAP001Q100-C241223-0001')

      expect(result.isValid).toBe(true)
      expect(result.processCode).toBe('CA')
      expect(result.requiresCrimpInspection).toBe(true)
      expect(result.crimpInspectionPassed).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('CA 바코드 - 압착검사 미실시 시 무효', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.validateSPProcessInput('CAP001Q100-C241223-0001')

      expect(result.isValid).toBe(false)
      expect(result.requiresCrimpInspection).toBe(true)
      expect(result.crimpInspectionPassed).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('압착검사')
    })

    it('MC 바코드 - 압착검사 불합격 시 무효', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      await module.recordCrimpInspection({
        barcode: 'MCP001Q50-M241223-0001',
        result: 'FAIL',
        defectReason: '압착 불량',
      })

      const result = await module.validateSPProcessInput('MCP001Q50-M241223-0001')

      expect(result.isValid).toBe(false)
      expect(result.crimpInspectionPassed).toBe(false)
      expect(result.errors[0]).toContain('불합격')
    })

    it('MS 바코드 - 압착검사 불필요, 바로 유효', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.validateSPProcessInput('MSP001Q100-S241223-0001')

      expect(result.isValid).toBe(true)
      expect(result.processCode).toBe('MS')
      expect(result.requiresCrimpInspection).toBe(false)
      expect(result.errors).toHaveLength(0)
    })

    it('SB 바코드 - SP 투입 가능', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.validateSPProcessInput('SBP001Q100-B241223-0001')

      expect(result.isValid).toBe(true)
      expect(result.processCode).toBe('SB')
    })

    it('HS 바코드 - SP 투입 가능', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.validateSPProcessInput('HSP001Q100-H241223-0001')

      expect(result.isValid).toBe(true)
      expect(result.processCode).toBe('HS')
    })

    it('PA 바코드 - SP 투입 불가 (허용되지 않은 공정)', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.validateSPProcessInput('PAP001Q100-A241223-0001')

      expect(result.isValid).toBe(false)
      expect(result.processCode).toBe('PA')
      expect(result.errors[0]).toContain('허용')
    })

    it('CI 바코드 - SP 투입 불가', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.validateSPProcessInput('CIP001Q100-I241223-0001')

      expect(result.isValid).toBe(false)
      expect(result.processCode).toBe('CI')
    })

    it('유효하지 않은 바코드 - 에러 처리', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const result = await module.validateSPProcessInput('INVALID-BARCODE')

      expect(result.isValid).toBe(false)
      expect(result.processCode).toBeNull()
      expect(result.errors[0]).toContain('확인')
    })
  })

  describe('validateSPProcessInputs - SP 공정 여러 입력 검증', () => {
    it('모든 바코드 유효 - 전체 통과', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // CA 압착검사 합격
      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      const results = await module.validateSPProcessInputs([
        'CAP001Q100-C241223-0001',  // CA - 압착검사 합격
        'MSP001Q100-S241223-0001',  // MS - 압착검사 불필요
        'SBP001Q100-B241223-0001',  // SB - 압착검사 불필요
      ])

      expect(results.isValid).toBe(true)
      expect(results.summary.passed).toBe(3)
      expect(results.summary.failed).toBe(0)
      expect(results.results).toHaveLength(3)
    })

    it('일부 바코드 무효 - 부분 통과', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const results = await module.validateSPProcessInputs([
        'CAP001Q100-C241223-0001',  // CA - 압착검사 미실시 (무효)
        'MSP001Q100-S241223-0001',  // MS - 압착검사 불필요 (유효)
      ])

      expect(results.isValid).toBe(false)
      expect(results.summary.passed).toBe(1)
      expect(results.summary.failed).toBe(1)
    })

    it('모든 바코드 무효 - 전체 실패', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const results = await module.validateSPProcessInputs([
        'CAP001Q100-C241223-0001',  // CA - 압착검사 미실시
        'MCP001Q50-M241223-0001',   // MC - 압착검사 미실시
      ])

      expect(results.isValid).toBe(false)
      expect(results.summary.passed).toBe(0)
      expect(results.summary.failed).toBe(2)
    })

    it('빈 배열 - 기본값 반환', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const results = await module.validateSPProcessInputs([])

      expect(results.isValid).toBe(true)
      expect(results.summary.passed).toBe(0)
      expect(results.summary.failed).toBe(0)
      expect(results.results).toHaveLength(0)
    })

    it('허용되지 않은 공정 포함 - 해당 바코드 무효', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // MS는 유효, PA는 무효
      const results = await module.validateSPProcessInputs([
        'MSP001Q100-S241223-0001',  // MS - 유효
        'PAP001Q100-A241223-0001',  // PA - SP 투입 불가
      ])

      expect(results.isValid).toBe(false)
      expect(results.summary.passed).toBe(1)
      expect(results.summary.failed).toBe(1)

      const paResult = results.results.find(r => r.barcode === 'PAP001Q100-A241223-0001')
      expect(paResult?.isValid).toBe(false)
      expect(paResult?.errors[0]).toContain('허용')
    })

    it('summary 필드 확인 - crimpRequired, crimpPassed', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // CA 합격, MC 미실시, MS 불필요
      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      const results = await module.validateSPProcessInputs([
        'CAP001Q100-C241223-0001',  // CA - 압착검사 필요, 합격
        'MCP001Q50-M241223-0001',   // MC - 압착검사 필요, 미실시
        'MSP001Q100-S241223-0001',  // MS - 압착검사 불필요
      ])

      expect(results.summary.total).toBe(3)
      expect(results.summary.crimpRequired).toBe(2)  // CA, MC
      expect(results.summary.crimpPassed).toBe(1)    // CA만 합격
    })
  })

  describe('통합 시나리오 - SP 공정 투입 워크플로우', () => {
    it('시나리오 1: CA 생산 → 압착검사 합격 → SP 투입 성공', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const barcode = 'CAP001Q100-C241223-0001'

      // 1단계: CA에서 생산 (바코드 발행)
      // 2단계: 압착검사 실시 - 합격
      await module.recordCrimpInspection({ barcode, result: 'PASS' })

      // 3단계: 압착검사 통과 확인
      const crimpStatus = await module.checkCrimpInspectionPassed(barcode)
      expect(crimpStatus.passed).toBe(true)

      // 4단계: SP 공정 투입 검증
      const spValidation = await module.validateSPProcessInput(barcode)
      expect(spValidation.isValid).toBe(true)
    })

    it('시나리오 2: MC 생산 → 압착검사 불합격 → 재검사 합격 → SP 투입 성공', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      const barcode = 'MCP001Q50-M241223-0001'

      // 1단계: MC에서 생산
      // 2단계: 첫 번째 압착검사 - 불합격
      await module.recordCrimpInspection({
        barcode,
        result: 'FAIL',
        defectReason: '압착 높이 불량',
      })

      // 3단계: SP 투입 검증 - 실패
      let validation = await module.validateSPProcessInput(barcode)
      expect(validation.isValid).toBe(false)
      expect(validation.errors[0]).toContain('불합격')

      // 4단계: 재작업 후 재검사 - 합격
      await module.recordCrimpInspection({ barcode, result: 'PASS' })

      // 5단계: 압착검사 이력 확인
      const history = await module.getCrimpInspectionHistory(barcode)
      expect(history).toHaveLength(2)
      expect(history[0].result).toBe('FAIL')
      expect(history[1].result).toBe('PASS')

      // 6단계: SP 투입 검증 - 성공 (마지막 검사가 합격)
      validation = await module.validateSPProcessInput(barcode)
      expect(validation.isValid).toBe(true)
    })

    it('시나리오 3: MS/SB 생산 → 압착검사 없이 SP 투입 성공', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // MS와 SB는 압착검사 대상이 아님
      const barcodes = [
        'MSP001Q100-S241223-0001',
        'SBP001Q100-B241223-0001',
      ]

      for (const barcode of barcodes) {
        const crimpStatus = await module.checkCrimpInspectionPassed(barcode)
        expect(crimpStatus.requiresCrimpInspection).toBe(false)
        expect(crimpStatus.passed).toBe(true)  // 압착검사 불필요이므로 자동 통과

        const validation = await module.validateSPProcessInput(barcode)
        expect(validation.isValid).toBe(true)
      }
    })

    it('시나리오 4: 여러 자재 혼합 투입 검증', async () => {
      const module = await import('../src/services/mock/inspectionService.mock')

      // CA - 압착검사 합격
      await module.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      // MC - 압착검사 미실시
      // MS - 압착검사 불필요

      const results = await module.validateSPProcessInputs([
        'CAP001Q100-C241223-0001',  // 유효
        'MCP001Q50-M241223-0001',   // 무효 (압착검사 미실시)
        'MSP001Q100-S241223-0001',  // 유효
      ])

      expect(results.isValid).toBe(false)
      expect(results.summary.passed).toBe(2)
      expect(results.summary.failed).toBe(1)

      // 무효 바코드 식별
      const invalidBarcodes = results.results.filter(r => !r.isValid)
      expect(invalidBarcodes).toHaveLength(1)
      expect(invalidBarcodes[0].barcode).toBe('MCP001Q50-M241223-0001')
    })
  })

  describe('영속성 테스트 - 모듈 리로드 후 데이터 유지', () => {
    it('압착검사 기록이 모듈 리로드 후에도 유지됨', async () => {
      // 첫 번째 세션: 압착검사 기록
      const module1 = await import('../src/services/mock/inspectionService.mock')

      await module1.recordCrimpInspection({
        barcode: 'CAP001Q100-C241223-0001',
        result: 'PASS',
      })

      // 모듈 리로드 (앱 재시작 시뮬레이션)
      vi.resetModules()

      // 두 번째 세션: 데이터 확인
      const module2 = await import('../src/services/mock/inspectionService.mock')

      const history = await module2.getCrimpInspectionHistory('CAP001Q100-C241223-0001')
      expect(history).toHaveLength(1)
      expect(history[0].result).toBe('PASS')

      const status = await module2.checkCrimpInspectionPassed('CAP001Q100-C241223-0001')
      expect(status.passed).toBe(true)
    })
  })
})
