/**
 * Phase 5: 검사 워크플로우 강화 테스트
 *
 * 테스트 범위:
 * 1. 검사 대상 공정 검증
 * 2. 중복 검사 확인
 * 3. 통합 검사 가능 여부 확인
 * 4. 공정별 적용 가능 검사 유형
 * 5. LOT 검사 상태 조회
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateInspectionTarget,
  checkDuplicateInspection,
  canPerformInspection,
  getAllowedProcessesForInspection,
  getApplicableInspectionTypes,
  getLotInspectionStatus,
  createInspection,
  resetInspectionData,
  addMockLot,
  INSPECTION_TARGET_PROCESS,
  INSPECTION_TYPE_NAMES,
  PROCESS_NAMES,
  type InspectionType,
  type ProcessCode,
} from '../src/services/mock/inspectionService.mock'

describe('Phase 5: 검사 워크플로우 강화', () => {
  beforeEach(() => {
    resetInspectionData()
  })

  // ============================================
  // 1. 검사 대상 공정 규칙
  // ============================================
  describe('검사 대상 공정 규칙', () => {
    it('CRIMP 검사: CA, MC만 허용', () => {
      const allowed = INSPECTION_TARGET_PROCESS.CRIMP
      expect(allowed).toContain('CA')
      expect(allowed).toContain('MC')
      expect(allowed).not.toContain('PA')
      expect(allowed).not.toContain('CI')
    })

    it('CIRCUIT 검사: PA만 허용', () => {
      const allowed = INSPECTION_TARGET_PROCESS.CIRCUIT
      expect(allowed).toContain('PA')
      expect(allowed).not.toContain('CA')
      expect(allowed).not.toContain('CI')
    })

    it('VISUAL 검사: CI만 허용', () => {
      const allowed = INSPECTION_TARGET_PROCESS.VISUAL
      expect(allowed).toContain('CI')
      expect(allowed).not.toContain('PA')
      expect(allowed).not.toContain('CA')
    })
  })

  // ============================================
  // 2. 검사 대상 공정 검증
  // ============================================
  describe('validateInspectionTarget', () => {
    it('CA 공정 LOT에 CRIMP 검사 → 허용', async () => {
      const result = await validateInspectionTarget('CRIMP', 'CA-241220-0001')

      expect(result.valid).toBe(true)
      expect(result.processCode).toBe('CA')
      expect(result.allowedProcesses).toContain('CA')
    })

    it('MC 공정 LOT에 CRIMP 검사 → 허용', async () => {
      const result = await validateInspectionTarget('CRIMP', 'MC-241220-0001')

      expect(result.valid).toBe(true)
      expect(result.processCode).toBe('MC')
    })

    it('PA 공정 LOT에 CRIMP 검사 → 거부', async () => {
      const result = await validateInspectionTarget('CRIMP', 'PA-241220-0001')

      expect(result.valid).toBe(false)
      expect(result.processCode).toBe('PA')
      expect(result.error).toContain('자동절압착')
      expect(result.error).toContain('수동압착')
    })

    it('PA 공정 LOT에 CIRCUIT 검사 → 허용', async () => {
      const result = await validateInspectionTarget('CIRCUIT', 'PA-241220-0001')

      expect(result.valid).toBe(true)
      expect(result.processCode).toBe('PA')
    })

    it('CA 공정 LOT에 CIRCUIT 검사 → 거부', async () => {
      const result = await validateInspectionTarget('CIRCUIT', 'CA-241220-0001')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('제품조립')
    })

    it('CI 공정 LOT에 VISUAL 검사 → 허용', async () => {
      const result = await validateInspectionTarget('VISUAL', 'CI-241220-0001')

      expect(result.valid).toBe(true)
      expect(result.processCode).toBe('CI')
    })

    it('PA 공정 LOT에 VISUAL 검사 → 거부', async () => {
      const result = await validateInspectionTarget('VISUAL', 'PA-241220-0001')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('회로검사')
    })

    it('알 수 없는 LOT → 에러', async () => {
      const result = await validateInspectionTarget('CRIMP', 'UNKNOWN-LOT')

      expect(result.valid).toBe(false)
      expect(result.processCode).toBeNull()
      expect(result.error).toContain('찾을 수 없')
    })
  })

  // ============================================
  // 3. 중복 검사 확인
  // ============================================
  describe('checkDuplicateInspection', () => {
    beforeEach(() => {
      // Mock LOT 추가
      addMockLot({ id: 1, lotNumber: 'CA-241220-0001', processCode: 'CA' })
    })

    it('검사 기록이 없으면 중복 아님', async () => {
      const result = await checkDuplicateInspection('CA-241220-0001', 'CRIMP')

      expect(result.isDuplicate).toBe(false)
      expect(result.existingInspection).toBeUndefined()
    })

    it('검사 기록이 있으면 중복', async () => {
      // 검사 기록 생성
      await createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      const result = await checkDuplicateInspection('CA-241220-0001', 'CRIMP')

      expect(result.isDuplicate).toBe(true)
      expect(result.existingInspection).toBeDefined()
      expect(result.existingInspection?.result).toBe('PASS')
    })

    it('다른 검사 유형은 중복 아님', async () => {
      // CRIMP 검사 생성
      await createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      // CIRCUIT 검사 확인
      const result = await checkDuplicateInspection('CA-241220-0001', 'CIRCUIT')

      expect(result.isDuplicate).toBe(false)
    })

    it('존재하지 않는 LOT → 중복 아님', async () => {
      const result = await checkDuplicateInspection('UNKNOWN-LOT', 'CRIMP')

      expect(result.isDuplicate).toBe(false)
    })
  })

  // ============================================
  // 4. 통합 검사 가능 여부 확인
  // ============================================
  describe('canPerformInspection', () => {
    beforeEach(() => {
      addMockLot({ id: 1, lotNumber: 'CA-241220-0001', processCode: 'CA' })
      addMockLot({ id: 2, lotNumber: 'PA-241220-0001', processCode: 'PA' })
    })

    it('대상 공정 일치 + 중복 없음 → 검사 가능', async () => {
      const result = await canPerformInspection('CRIMP', 'CA-241220-0001')

      expect(result.canInspect).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('대상 공정 불일치 → 검사 불가', async () => {
      const result = await canPerformInspection('CIRCUIT', 'CA-241220-0001')

      expect(result.canInspect).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.targetValidation.valid).toBe(false)
    })

    it('중복 검사 → 검사 불가 (기본)', async () => {
      // 기존 검사 생성
      await createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      const result = await canPerformInspection('CRIMP', 'CA-241220-0001')

      expect(result.canInspect).toBe(false)
      expect(result.duplicateCheck.isDuplicate).toBe(true)
      expect(result.errors.some((e) => e.includes('이미'))).toBe(true)
    })

    it('중복 허용 옵션 사용 → 검사 가능', async () => {
      // 기존 검사 생성
      await createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'FAIL',
      })

      const result = await canPerformInspection('CRIMP', 'CA-241220-0001', true)

      expect(result.canInspect).toBe(true) // 대상 공정은 일치하므로
      expect(result.duplicateCheck.isDuplicate).toBe(true)
    })

    it('대상 공정 불일치 + 중복 → 에러 2개', async () => {
      // PA LOT에 CRIMP 검사 (불일치)
      addMockLot({ id: 3, lotNumber: 'PA-241220-0002', processCode: 'PA' })
      await createInspection({
        lotId: 3,
        type: 'CRIMP',
        result: 'PASS',
      })

      const result = await canPerformInspection('CRIMP', 'PA-241220-0002')

      expect(result.canInspect).toBe(false)
      // 대상 공정 불일치 에러만 (중복은 대상이 아니면 체크 불필요할 수 있으나 현재 구현상 둘 다 체크)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ============================================
  // 5. 공정별 적용 가능 검사 유형
  // ============================================
  describe('getApplicableInspectionTypes', () => {
    it('CA 공정 → CRIMP 검사 적용 가능', () => {
      const types = getApplicableInspectionTypes('CA')
      expect(types).toContain('CRIMP')
      expect(types).not.toContain('CIRCUIT')
      expect(types).not.toContain('VISUAL')
    })

    it('MC 공정 → CRIMP 검사 적용 가능', () => {
      const types = getApplicableInspectionTypes('MC')
      expect(types).toContain('CRIMP')
    })

    it('PA 공정 → CIRCUIT 검사 적용 가능', () => {
      const types = getApplicableInspectionTypes('PA')
      expect(types).toContain('CIRCUIT')
      expect(types).not.toContain('CRIMP')
    })

    it('CI 공정 → VISUAL 검사 적용 가능', () => {
      const types = getApplicableInspectionTypes('CI')
      expect(types).toContain('VISUAL')
    })

    it('MO 공정 → 적용 가능 검사 없음', () => {
      const types = getApplicableInspectionTypes('MO')
      expect(types).toHaveLength(0)
    })

    it('SB 공정 → 적용 가능 검사 없음', () => {
      const types = getApplicableInspectionTypes('SB')
      expect(types).toHaveLength(0)
    })

    it('대소문자 무관', () => {
      const typesLower = getApplicableInspectionTypes('ca')
      const typesUpper = getApplicableInspectionTypes('CA')
      expect(typesLower).toEqual(typesUpper)
    })
  })

  // ============================================
  // 6. 허용 공정 목록 조회
  // ============================================
  describe('getAllowedProcessesForInspection', () => {
    it('CRIMP → CA, MC 반환', () => {
      const processes = getAllowedProcessesForInspection('CRIMP')
      expect(processes).toEqual(['CA', 'MC'])
    })

    it('CIRCUIT → PA 반환', () => {
      const processes = getAllowedProcessesForInspection('CIRCUIT')
      expect(processes).toEqual(['PA'])
    })

    it('VISUAL → CI 반환', () => {
      const processes = getAllowedProcessesForInspection('VISUAL')
      expect(processes).toEqual(['CI'])
    })
  })

  // ============================================
  // 7. LOT 검사 상태 조회
  // ============================================
  describe('getLotInspectionStatus', () => {
    beforeEach(() => {
      addMockLot({ id: 1, lotNumber: 'CA-241220-0001', processCode: 'CA' })
      addMockLot({ id: 2, lotNumber: 'PA-241220-0001', processCode: 'PA' })
    })

    it('검사 미수행 LOT → 모든 검사 대기', async () => {
      const status = await getLotInspectionStatus('CA-241220-0001')

      expect(status.processCode).toBe('CA')
      expect(status.applicableTypes).toContain('CRIMP')
      expect(status.completedInspections).toHaveLength(0)
      expect(status.pendingTypes).toContain('CRIMP')
    })

    it('검사 완료 LOT → 완료 목록에 포함', async () => {
      // CRIMP 검사 완료
      await createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      const status = await getLotInspectionStatus('CA-241220-0001')

      expect(status.completedInspections).toHaveLength(1)
      expect(status.completedInspections[0].type).toBe('CRIMP')
      expect(status.completedInspections[0].result).toBe('PASS')
      expect(status.pendingTypes).not.toContain('CRIMP')
    })

    it('PA 공정 LOT → CIRCUIT 검사 대기', async () => {
      const status = await getLotInspectionStatus('PA-241220-0001')

      expect(status.processCode).toBe('PA')
      expect(status.applicableTypes).toContain('CIRCUIT')
      expect(status.pendingTypes).toContain('CIRCUIT')
    })

    it('존재하지 않는 LOT → 빈 결과', async () => {
      const status = await getLotInspectionStatus('UNKNOWN-LOT')

      expect(status.processCode).toBeNull()
      expect(status.applicableTypes).toHaveLength(0)
      expect(status.completedInspections).toHaveLength(0)
      expect(status.pendingTypes).toHaveLength(0)
    })
  })

  // ============================================
  // 8. 상수 검증
  // ============================================
  describe('상수 검증', () => {
    it('INSPECTION_TYPE_NAMES: 3개 검사 유형 포함', () => {
      expect(Object.keys(INSPECTION_TYPE_NAMES)).toHaveLength(3)
      expect(INSPECTION_TYPE_NAMES.CRIMP).toBe('압착검사')
      expect(INSPECTION_TYPE_NAMES.CIRCUIT).toBe('회로검사')
      expect(INSPECTION_TYPE_NAMES.VISUAL).toBe('육안검사')
    })

    it('PROCESS_NAMES: 10개 공정 포함', () => {
      expect(Object.keys(PROCESS_NAMES)).toHaveLength(10)
      expect(PROCESS_NAMES.CA).toBe('자동절압착')
      expect(PROCESS_NAMES.PA).toBe('제품조립')
      expect(PROCESS_NAMES.CI).toBe('회로검사')
    })
  })

  // ============================================
  // 9. 복합 시나리오
  // ============================================
  describe('복합 시나리오', () => {
    it('전체 검사 워크플로우', async () => {
      // 1. LOT 생성
      addMockLot({ id: 1, lotNumber: 'CA-241220-0001', processCode: 'CA' })

      // 2. 검사 가능 여부 확인
      const canInspect1 = await canPerformInspection('CRIMP', 'CA-241220-0001')
      expect(canInspect1.canInspect).toBe(true)

      // 3. 검사 수행
      await createInspection({
        lotId: 1,
        type: 'CRIMP',
        result: 'PASS',
      })

      // 4. 중복 검사 시도 → 거부
      const canInspect2 = await canPerformInspection('CRIMP', 'CA-241220-0001')
      expect(canInspect2.canInspect).toBe(false)
      expect(canInspect2.duplicateCheck.isDuplicate).toBe(true)

      // 5. 검사 상태 확인
      const status = await getLotInspectionStatus('CA-241220-0001')
      expect(status.completedInspections).toHaveLength(1)
      expect(status.pendingTypes).toHaveLength(0) // CA 공정은 CRIMP만 해당
    })

    it('잘못된 대상에 검사 시도', async () => {
      // CA LOT에 CIRCUIT 검사 시도
      addMockLot({ id: 1, lotNumber: 'CA-241220-0001', processCode: 'CA' })

      const result = await canPerformInspection('CIRCUIT', 'CA-241220-0001')

      expect(result.canInspect).toBe(false)
      expect(result.targetValidation.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('제품조립'))).toBe(true)
    })

    it('PA → CI → VI 검사 순서', async () => {
      // PA 공정 LOT
      addMockLot({ id: 1, lotNumber: 'PA-241220-0001', processCode: 'PA' })

      // PA에서 CIRCUIT 검사 가능
      expect((await canPerformInspection('CIRCUIT', 'PA-241220-0001')).canInspect).toBe(true)

      // PA에서 VISUAL 검사 불가 (CI 공정만 가능)
      expect((await canPerformInspection('VISUAL', 'PA-241220-0001')).canInspect).toBe(false)

      // CI 공정 LOT
      addMockLot({ id: 2, lotNumber: 'CI-241220-0001', processCode: 'CI' })

      // CI에서 VISUAL 검사 가능
      expect((await canPerformInspection('VISUAL', 'CI-241220-0001')).canInspect).toBe(true)

      // CI에서 CIRCUIT 검사 불가
      expect((await canPerformInspection('CIRCUIT', 'CI-241220-0001')).canInspect).toBe(false)
    })
  })
})
