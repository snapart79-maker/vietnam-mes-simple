/**
 * Phase 3: 공정별 입력 검증 테스트
 *
 * 테스트 범위:
 * 1. 공정별 입력 타입 검증
 * 2. 이전 공정 제한 검증
 * 3. 바코드 타입 추론
 * 4. 검증 결과 처리
 * 5. Mock 서비스 검증 통합
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateInputs,
  validateBarcodes,
  createInputsFromBarcodes,
  isValidProcessCode,
  inferInputType,
  validateSingleInput,
  isInputTypeAllowed,
  getInputTypeName,
  getProcessInputDescription,
  getAllProcessInputRules,
  formatValidationErrors,
  summarizeValidationResult,
  PROCESS_INPUT_RULES,
  PROCESS_NAMES,
  PROCESS_NAMES_VI,
  ALLOWED_PREVIOUS_PROCESSES,
  type ProcessCode,
  type InputItem,
  type InputType,
  type ValidationResult,
} from '../src/lib/processValidation'
import {
  validateProcessInputs,
  getAllowedInputTypes,
  inferBarcodeInputType,
} from '../src/services/mock/productionService.mock'

describe('Phase 3: 공정별 입력 검증', () => {
  // ============================================
  // 1. 공정 코드 유효성 검증
  // ============================================
  describe('isValidProcessCode', () => {
    it('유효한 공정 코드 확인', () => {
      const validCodes = ['MO', 'CA', 'MC', 'MS', 'SB', 'HS', 'SP', 'PA', 'CI', 'VI']
      validCodes.forEach(code => {
        expect(isValidProcessCode(code)).toBe(true)
        expect(isValidProcessCode(code.toLowerCase())).toBe(true)
      })
    })

    it('유효하지 않은 공정 코드 거부', () => {
      expect(isValidProcessCode('XX')).toBe(false)
      expect(isValidProcessCode('AB')).toBe(false)
      expect(isValidProcessCode('')).toBe(false)
    })
  })

  // ============================================
  // 2. 공정별 입력 타입 허용 검증
  // ============================================
  describe('isInputTypeAllowed', () => {
    it('MO 공정: 자재만 허용', () => {
      expect(isInputTypeAllowed('MO', 'material')).toBe(true)
      expect(isInputTypeAllowed('MO', 'semi_product')).toBe(false)
      expect(isInputTypeAllowed('MO', 'production')).toBe(false)
    })

    it('CA 공정: 자재만 허용', () => {
      expect(isInputTypeAllowed('CA', 'material')).toBe(true)
      expect(isInputTypeAllowed('CA', 'semi_product')).toBe(false)
      expect(isInputTypeAllowed('CA', 'production')).toBe(false)
    })

    it('MC 공정: 반제품만 허용', () => {
      expect(isInputTypeAllowed('MC', 'material')).toBe(false)
      expect(isInputTypeAllowed('MC', 'semi_product')).toBe(true)
      expect(isInputTypeAllowed('MC', 'production')).toBe(false)
    })

    it('MS 공정: 반제품만 허용', () => {
      expect(isInputTypeAllowed('MS', 'material')).toBe(false)
      expect(isInputTypeAllowed('MS', 'semi_product')).toBe(true)
      expect(isInputTypeAllowed('MS', 'production')).toBe(false)
    })

    it('SB 공정: 자재 + 반제품 허용', () => {
      expect(isInputTypeAllowed('SB', 'material')).toBe(true)
      expect(isInputTypeAllowed('SB', 'semi_product')).toBe(true)
      expect(isInputTypeAllowed('SB', 'production')).toBe(false)
    })

    it('HS 공정: 반제품만 허용', () => {
      expect(isInputTypeAllowed('HS', 'material')).toBe(false)
      expect(isInputTypeAllowed('HS', 'semi_product')).toBe(true)
      expect(isInputTypeAllowed('HS', 'production')).toBe(false)
    })

    it('SP 공정: 반제품만 허용', () => {
      expect(isInputTypeAllowed('SP', 'material')).toBe(false)
      expect(isInputTypeAllowed('SP', 'semi_product')).toBe(true)
      expect(isInputTypeAllowed('SP', 'production')).toBe(false)
    })

    it('PA 공정: 반제품만 허용', () => {
      expect(isInputTypeAllowed('PA', 'material')).toBe(false)
      expect(isInputTypeAllowed('PA', 'semi_product')).toBe(true)
      expect(isInputTypeAllowed('PA', 'production')).toBe(false)
    })

    it('CI 공정: 생산 LOT만 허용', () => {
      expect(isInputTypeAllowed('CI', 'material')).toBe(false)
      expect(isInputTypeAllowed('CI', 'semi_product')).toBe(false)
      expect(isInputTypeAllowed('CI', 'production')).toBe(true)
    })

    it('VI 공정: 생산 LOT만 허용', () => {
      expect(isInputTypeAllowed('VI', 'material')).toBe(false)
      expect(isInputTypeAllowed('VI', 'semi_product')).toBe(false)
      expect(isInputTypeAllowed('VI', 'production')).toBe(true)
    })
  })

  // ============================================
  // 3. 바코드 타입 추론
  // ============================================
  describe('inferInputType', () => {
    it('자재 바코드 (본사 형식) → material', () => {
      expect(inferInputType('M-WIRE-001')).toBe('material')
      expect(inferInputType('MAT123456')).toBe('material')
      expect(inferInputType('INVALID-BARCODE')).toBe('material')
    })

    it('CA 공정 출력 → semi_product', () => {
      expect(inferInputType('CA-241220-0001')).toBe('semi_product')
      expect(inferInputType('CAP001Q100-C241220-0001')).toBe('semi_product')
    })

    it('MC 공정 출력 → semi_product', () => {
      expect(inferInputType('MC-241220-0001')).toBe('semi_product')
      expect(inferInputType('MCP002Q50-M241220-0002')).toBe('semi_product')
    })

    it('PA 공정 출력 → semi_product', () => {
      expect(inferInputType('PA-241220-0001')).toBe('semi_product')
      expect(inferInputType('PAP003Q200-A241220-0003')).toBe('semi_product')
    })

    it('CI 공정 출력 → production', () => {
      expect(inferInputType('CI-241220-0001')).toBe('production')
    })

    it('VI 공정 출력 → production', () => {
      expect(inferInputType('VI-241220-0001')).toBe('production')
    })
  })

  // ============================================
  // 4. 단일 입력 검증
  // ============================================
  describe('validateSingleInput', () => {
    it('CA 공정에 자재 입력 → 성공', () => {
      const input: InputItem = {
        barcode: 'M-WIRE-001',
        type: 'material',
      }
      const result = validateSingleInput('CA', input)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('CA 공정에 반제품 입력 → 실패', () => {
      const input: InputItem = {
        barcode: 'MC-241220-0001',
        type: 'semi_product',
        processCode: 'MC',
      }
      const result = validateSingleInput('CA', input)
      expect(result.isValid).toBe(false)
      expect(result.error?.code).toBe('INVALID_INPUT_TYPE')
    })

    it('MC 공정에 CA 출력 → 성공', () => {
      const input: InputItem = {
        barcode: 'CA-241220-0001',
        type: 'semi_product',
        processCode: 'CA',
      }
      const result = validateSingleInput('MC', input)
      expect(result.isValid).toBe(true)
    })

    it('MC 공정에 PA 출력 → 실패 (이전 공정 제한)', () => {
      const input: InputItem = {
        barcode: 'PA-241220-0001',
        type: 'semi_product',
        processCode: 'PA',
      }
      const result = validateSingleInput('MC', input)
      expect(result.isValid).toBe(false)
      expect(result.error?.code).toBe('INVALID_PREVIOUS_PROCESS')
    })

    it('CI 공정에 PA 출력 → 성공', () => {
      const input: InputItem = {
        barcode: 'PA-241220-0001',
        type: 'production',
        processCode: 'PA',
      }
      const result = validateSingleInput('CI', input)
      expect(result.isValid).toBe(true)
    })
  })

  // ============================================
  // 5. 다중 입력 검증
  // ============================================
  describe('validateInputs', () => {
    it('유효한 공정 코드 필요', () => {
      const result = validateInputs('XX', [
        { barcode: 'MAT-001', type: 'material' },
      ])
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('INVALID_PROCESS_CODE')
    })

    it('빈 입력 → 실패', () => {
      const result = validateInputs('CA', [])
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('EMPTY_INPUTS')
    })

    it('CA 공정에 자재 여러 개 → 성공', () => {
      const result = validateInputs('CA', [
        { barcode: 'WIRE-001', type: 'material' },
        { barcode: 'TERMINAL-001', type: 'material' },
        { barcode: 'SEAL-001', type: 'material' },
      ])
      expect(result.isValid).toBe(true)
      expect(result.validatedInputs).toHaveLength(3)
    })

    it('SB 공정에 자재 + 반제품 → 성공', () => {
      const result = validateInputs('SB', [
        { barcode: 'MAT-001', type: 'material' },
        { barcode: 'CA-241220-0001', type: 'semi_product', processCode: 'CA' },
      ])
      expect(result.isValid).toBe(true)
    })

    it('CA 공정에 자재 + 반제품 혼합 → 실패', () => {
      const result = validateInputs('CA', [
        { barcode: 'MAT-001', type: 'material' },
        { barcode: 'MC-241220-0001', type: 'semi_product', processCode: 'MC' },
      ])
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'INVALID_INPUT_TYPE')).toBe(true)
    })
  })

  // ============================================
  // 6. 바코드 기반 검증
  // ============================================
  describe('validateBarcodes', () => {
    it('CA 공정에 자재 바코드 → 성공', () => {
      const result = validateBarcodes('CA', ['M-WIRE-001', 'TERMINAL-123'])
      expect(result.isValid).toBe(true)
    })

    it('MC 공정에 CA 출력 바코드 → 성공', () => {
      const result = validateBarcodes('MC', ['CA-241220-0001'])
      expect(result.isValid).toBe(true)
    })

    it('CA 공정에 MC 출력 바코드 → 실패', () => {
      const result = validateBarcodes('CA', ['MC-241220-0001'])
      expect(result.isValid).toBe(false)
    })
  })

  // ============================================
  // 7. 입력 아이템 생성
  // ============================================
  describe('createInputsFromBarcodes', () => {
    it('바코드 배열에서 InputItem 배열 생성', () => {
      const barcodes = ['M-WIRE-001', 'CA-241220-0001', 'CI-241220-0001']
      const inputs = createInputsFromBarcodes(barcodes)

      expect(inputs).toHaveLength(3)
      expect(inputs[0].type).toBe('material')
      expect(inputs[1].type).toBe('semi_product')
      expect(inputs[2].type).toBe('production')
    })
  })

  // ============================================
  // 8. 유틸리티 함수
  // ============================================
  describe('유틸리티 함수', () => {
    it('getInputTypeName: 타입명 반환', () => {
      expect(getInputTypeName('material')).toBe('자재')
      expect(getInputTypeName('semi_product')).toBe('반제품')
      expect(getInputTypeName('production')).toBe('생산 LOT')
    })

    it('getProcessInputDescription: 공정 설명 반환', () => {
      const desc = getProcessInputDescription('CA')
      expect(desc).toContain('자동절압착')
      expect(desc).toContain('자재')
    })

    it('getAllProcessInputRules: 모든 규칙 반환', () => {
      const rules = getAllProcessInputRules()
      expect(rules).toHaveLength(10)
      expect(rules.find(r => r.processCode === 'CA')?.allowedInputs).toContain('material')
    })

    it('formatValidationErrors: 에러 포맷팅', () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [{ code: 'TEST', message: '테스트 에러' }],
        warnings: [],
        validatedInputs: [],
      }
      const formatted = formatValidationErrors(result)
      expect(formatted).toContain('TEST')
      expect(formatted).toContain('테스트 에러')
    })

    it('summarizeValidationResult: 결과 요약', () => {
      const successResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        validatedInputs: [],
      }
      expect(summarizeValidationResult(successResult).status).toBe('success')

      const errorResult: ValidationResult = {
        isValid: false,
        errors: [{ code: 'E1', message: 'Error' }],
        warnings: [],
        validatedInputs: [],
      }
      expect(summarizeValidationResult(errorResult).status).toBe('error')
      expect(summarizeValidationResult(errorResult).errorCount).toBe(1)

      const warningResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [{ code: 'W1', message: 'Warning' }],
        validatedInputs: [],
      }
      expect(summarizeValidationResult(warningResult).status).toBe('warning')
    })
  })

  // ============================================
  // 9. 상수 검증
  // ============================================
  describe('상수 검증', () => {
    it('PROCESS_INPUT_RULES: 10개 공정 포함', () => {
      expect(Object.keys(PROCESS_INPUT_RULES)).toHaveLength(10)
    })

    it('PROCESS_NAMES: 10개 한글명 포함', () => {
      expect(Object.keys(PROCESS_NAMES)).toHaveLength(10)
      expect(PROCESS_NAMES.CA).toBe('자동절압착')
    })

    it('PROCESS_NAMES_VI: 10개 베트남어명 포함', () => {
      expect(Object.keys(PROCESS_NAMES_VI)).toHaveLength(10)
      expect(PROCESS_NAMES_VI.CA).toBe('Cắt ép tự động')
    })

    it('ALLOWED_PREVIOUS_PROCESSES: 공정 순서 규칙', () => {
      expect(ALLOWED_PREVIOUS_PROCESSES.MC).toContain('CA')
      expect(ALLOWED_PREVIOUS_PROCESSES.PA).toContain('SP')
      expect(ALLOWED_PREVIOUS_PROCESSES.CI).toContain('PA')
      expect(ALLOWED_PREVIOUS_PROCESSES.VI).toContain('CI')
    })
  })

  // ============================================
  // 10. Mock 서비스 통합
  // ============================================
  describe('Mock 서비스 통합', () => {
    it('validateProcessInputs: Mock 함수 동작', () => {
      const result = validateProcessInputs('CA', ['MAT-001'])
      expect(result.isValid).toBe(true)
    })

    it('getAllowedInputTypes: 허용 타입 조회', () => {
      expect(getAllowedInputTypes('CA')).toContain('material')
      expect(getAllowedInputTypes('MC')).toContain('semi_product')
      expect(getAllowedInputTypes('CI')).toContain('production')
      expect(getAllowedInputTypes('XX')).toBeNull()
    })

    it('inferBarcodeInputType: 타입 추론', () => {
      expect(inferBarcodeInputType('MAT-001')).toBe('material')
      expect(inferBarcodeInputType('CA-241220-0001')).toBe('semi_product')
      expect(inferBarcodeInputType('CI-241220-0001')).toBe('production')
    })
  })

  // ============================================
  // 11. 복합 시나리오 테스트
  // ============================================
  describe('복합 시나리오', () => {
    it('전체 생산 공정 흐름 검증', () => {
      // 1. MO (자재출고) - 자재 입력
      const moResult = validateBarcodes('MO', ['MAT-WIRE-001', 'MAT-TERMINAL-001'])
      expect(moResult.isValid).toBe(true)

      // 2. CA (자동절압착) - 자재 입력
      const caResult = validateBarcodes('CA', ['MAT-WIRE-001'])
      expect(caResult.isValid).toBe(true)

      // 3. MC (수동압착) - CA 출력 입력
      const mcResult = validateBarcodes('MC', ['CA-241220-0001'])
      expect(mcResult.isValid).toBe(true)

      // 4. SB (서브조립) - 자재 + CA 출력 혼합
      const sbResult = validateInputs('SB', [
        { barcode: 'MAT-001', type: 'material' },
        { barcode: 'CA-241220-0002', type: 'semi_product', processCode: 'CA' },
      ])
      expect(sbResult.isValid).toBe(true)

      // 5. SP (제품조립제공부품) - 반제품 입력
      const spResult = validateInputs('SP', [
        { barcode: 'CA-241220-0003', type: 'semi_product', processCode: 'CA' },
        { barcode: 'MC-241220-0001', type: 'semi_product', processCode: 'MC' },
      ])
      expect(spResult.isValid).toBe(true)

      // 6. PA (제품조립) - SP 출력 입력
      const paResult = validateInputs('PA', [
        { barcode: 'SP-241220-0001', type: 'semi_product', processCode: 'SP' },
      ])
      expect(paResult.isValid).toBe(true)

      // 7. CI (회로검사) - PA 출력 입력
      const ciResult = validateInputs('CI', [
        { barcode: 'PA-241220-0001', type: 'production', processCode: 'PA' },
      ])
      expect(ciResult.isValid).toBe(true)

      // 8. VI (육안검사) - CI 출력 입력
      const viResult = validateInputs('VI', [
        { barcode: 'CI-241220-0001', type: 'production', processCode: 'CI' },
      ])
      expect(viResult.isValid).toBe(true)
    })

    it('잘못된 공정 순서 거부', () => {
      // MC 공정에서 PA 출력 사용 불가
      const mcResult = validateInputs('MC', [
        { barcode: 'PA-241220-0001', type: 'semi_product', processCode: 'PA' },
      ])
      expect(mcResult.isValid).toBe(false)

      // CA 공정에서 반제품 사용 불가
      const caResult = validateInputs('CA', [
        { barcode: 'MC-241220-0001', type: 'semi_product', processCode: 'MC' },
      ])
      expect(caResult.isValid).toBe(false)

      // CI 공정에서 자재 사용 불가
      const ciResult = validateInputs('CI', [
        { barcode: 'MAT-001', type: 'material' },
      ])
      expect(ciResult.isValid).toBe(false)
    })
  })
})
