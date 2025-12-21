/**
 * Process Validation
 *
 * 공정별 입력 검증 서비스
 * - 각 공정에서 허용되는 입력 타입 검증
 * - Python Barcord 호환
 *
 * Phase 3: 공정별 입력 검증 구현
 */

import { PROCESS_SHORT_CODES, parseBarcode, getProcessOrder } from '../services/barcodeService'

// ============================================
// Types
// ============================================

/**
 * 입력 타입 정의
 * - material: 자재 (원자재, 부자재)
 * - semi_product: 반제품 (이전 공정 출력물)
 * - production: 생산 LOT (검사 공정용)
 */
export type InputType = 'material' | 'semi_product' | 'production'

/**
 * 공정 코드 타입
 */
export type ProcessCode = 'MO' | 'CA' | 'MC' | 'MS' | 'SB' | 'HS' | 'SP' | 'PA' | 'CI' | 'VI'

/**
 * 입력 아이템 인터페이스
 */
export interface InputItem {
  barcode: string
  type: InputType
  processCode?: string
  materialId?: number
  productId?: number
  quantity?: number
}

/**
 * 검증 결과 인터페이스
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  validatedInputs: ValidatedInput[]
}

/**
 * 검증 에러 인터페이스
 */
export interface ValidationError {
  code: string
  message: string
  barcode?: string
  inputType?: InputType
  expectedTypes?: InputType[]
}

/**
 * 검증 경고 인터페이스
 */
export interface ValidationWarning {
  code: string
  message: string
  barcode?: string
}

/**
 * 검증된 입력 인터페이스
 */
export interface ValidatedInput {
  barcode: string
  type: InputType
  processCode?: string
  isValid: boolean
}

// ============================================
// Constants
// ============================================

/**
 * 공정별 필수 입력 타입 규칙
 *
 * Python Barcord 기준:
 * - MO: 자재만 (자재 출고)
 * - CA: 자재만 (터미널, 와이어, 실)
 * - MC: 반제품 (CA 출력 + 터미널 + Sub)
 * - MS: 반제품 (CA 출력)
 * - SB: 자재 + 반제품
 * - HS: 반제품 (열수축 튜브 적용)
 * - SP: 반제품 (PA 투입 자재 묶음 - 키팅)
 * - PA: 반제품 (SP 바코드)
 * - CI: 생산 LOT (회로검사 대상)
 * - VI: 생산 LOT (육안검사 대상)
 */
export const PROCESS_INPUT_RULES: Record<ProcessCode, InputType[]> = {
  MO: ['material'],
  CA: ['material'],
  MC: ['semi_product'],
  MS: ['semi_product'],
  SB: ['material', 'semi_product'],
  HS: ['semi_product'],
  SP: ['semi_product'],
  PA: ['semi_product'],
  CI: ['production'],
  VI: ['production'],
}

/**
 * 공정별 허용되는 이전 공정 코드
 *
 * 반제품 입력 시 어떤 공정에서 온 것인지 검증
 */
export const ALLOWED_PREVIOUS_PROCESSES: Record<ProcessCode, ProcessCode[]> = {
  MO: [],  // 자재만 입력
  CA: [],  // 자재만 입력
  MC: ['CA', 'SB'],  // CA 출력 또는 SB (Sub) 출력
  MS: ['CA'],  // CA 출력
  SB: ['CA', 'MC'],  // CA 또는 MC 출력
  HS: ['CA', 'MC', 'MS', 'SB'],  // 다양한 반제품
  SP: ['CA', 'MC', 'MS', 'SB', 'HS'],  // PA 전 공정들
  PA: ['SP'],  // SP 바코드만
  CI: ['PA'],  // PA 완료된 것만
  VI: ['CI'],  // CI 완료된 것만
}

/**
 * 공정별 한글명
 */
export const PROCESS_NAMES: Record<ProcessCode, string> = {
  MO: '자재출고',
  CA: '자동절압착',
  MC: '수동압착',
  MS: '미드스플라이스',
  SB: '서브조립',
  HS: '열수축',
  SP: '제품조립제공부품',
  PA: '제품조립',
  CI: '회로검사',
  VI: '육안검사',
}

/**
 * 공정별 베트남어명
 */
export const PROCESS_NAMES_VI: Record<ProcessCode, string> = {
  MO: 'Xuất vật tư',
  CA: 'Cắt ép tự động',
  MC: 'Ép thủ công',
  MS: 'Tước giữa',
  SB: 'Sub',
  HS: 'Co nhiệt',
  SP: 'Linh kiện lắp ráp',
  PA: 'Lắp ráp sản phẩm',
  CI: 'Kiểm tra mạch',
  VI: 'Kiểm tra ngoại quan',
}

// ============================================
// Validation Functions
// ============================================

/**
 * 유효한 공정 코드인지 확인
 */
export function isValidProcessCode(code: string): code is ProcessCode {
  return Object.keys(PROCESS_INPUT_RULES).includes(code.toUpperCase())
}

/**
 * 공정에서 특정 입력 타입이 허용되는지 확인
 */
export function isInputTypeAllowed(processCode: ProcessCode, inputType: InputType): boolean {
  const allowedTypes = PROCESS_INPUT_RULES[processCode]
  return allowedTypes.includes(inputType)
}

/**
 * 바코드에서 입력 타입 추론
 *
 * @param barcode 바코드 문자열
 * @returns 추론된 입력 타입
 */
export function inferInputType(barcode: string): InputType {
  const parsed = parseBarcode(barcode)

  if (!parsed.isValid) {
    // 파싱 실패 시 자재로 간주 (본사 바코드 등)
    return 'material'
  }

  const processCode = parsed.processCode.toUpperCase()

  // CI, VI 공정 출력은 production
  if (processCode === 'CI' || processCode === 'VI') {
    return 'production'
  }

  // 생산 공정 출력은 semi_product
  if (isValidProcessCode(processCode)) {
    return 'semi_product'
  }

  // 기본값: 자재
  return 'material'
}

/**
 * 단일 입력 아이템 검증
 *
 * @param processCode 현재 공정 코드
 * @param input 입력 아이템
 * @returns 검증 결과
 */
export function validateSingleInput(
  processCode: ProcessCode,
  input: InputItem
): { isValid: boolean; error?: ValidationError; warning?: ValidationWarning } {
  const allowedTypes = PROCESS_INPUT_RULES[processCode]

  // 입력 타입 검증
  if (!allowedTypes.includes(input.type)) {
    return {
      isValid: false,
      error: {
        code: 'INVALID_INPUT_TYPE',
        message: `${PROCESS_NAMES[processCode]} 공정에서는 ${getInputTypeName(input.type)}을(를) 사용할 수 없습니다. 허용: ${allowedTypes.map(getInputTypeName).join(', ')}`,
        barcode: input.barcode,
        inputType: input.type,
        expectedTypes: allowedTypes,
      },
    }
  }

  // 반제품 입력 시 이전 공정 검증
  if (input.type === 'semi_product' && input.processCode) {
    const allowedPrevious = ALLOWED_PREVIOUS_PROCESSES[processCode]
    const inputProcessCode = input.processCode.toUpperCase() as ProcessCode

    if (allowedPrevious.length > 0 && !allowedPrevious.includes(inputProcessCode)) {
      return {
        isValid: false,
        error: {
          code: 'INVALID_PREVIOUS_PROCESS',
          message: `${PROCESS_NAMES[processCode]} 공정에서는 ${PROCESS_NAMES[inputProcessCode] || inputProcessCode} 공정의 출력물을 사용할 수 없습니다. 허용: ${allowedPrevious.map(p => PROCESS_NAMES[p]).join(', ')}`,
          barcode: input.barcode,
        },
      }
    }
  }

  // 공정 순서 경고 (역방향 사용)
  if (input.processCode) {
    const currentOrder = getProcessOrder(processCode)
    const inputOrder = getProcessOrder(input.processCode)

    if (inputOrder >= currentOrder && processCode !== 'CI' && processCode !== 'VI') {
      return {
        isValid: true,
        warning: {
          code: 'REVERSE_PROCESS_ORDER',
          message: `경고: ${input.processCode} 공정(순서 ${inputOrder})의 출력물을 ${processCode} 공정(순서 ${currentOrder})에서 사용합니다.`,
          barcode: input.barcode,
        },
      }
    }
  }

  return { isValid: true }
}

/**
 * 여러 입력 아이템 검증
 *
 * @param processCode 현재 공정 코드
 * @param inputs 입력 아이템 배열
 * @returns 검증 결과
 */
export function validateInputs(
  processCode: string,
  inputs: InputItem[]
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    validatedInputs: [],
  }

  // 공정 코드 유효성 검사
  const normalizedProcessCode = processCode.toUpperCase()
  if (!isValidProcessCode(normalizedProcessCode)) {
    result.isValid = false
    result.errors.push({
      code: 'INVALID_PROCESS_CODE',
      message: `알 수 없는 공정 코드입니다: ${processCode}`,
    })
    return result
  }

  const validProcessCode = normalizedProcessCode as ProcessCode

  // 빈 입력 검증
  if (inputs.length === 0) {
    result.isValid = false
    result.errors.push({
      code: 'EMPTY_INPUTS',
      message: `${PROCESS_NAMES[validProcessCode]} 공정에 입력 자재/반제품이 필요합니다.`,
    })
    return result
  }

  // 각 입력 검증
  for (const input of inputs) {
    const validationResult = validateSingleInput(validProcessCode, input)

    const validatedInput: ValidatedInput = {
      barcode: input.barcode,
      type: input.type,
      processCode: input.processCode,
      isValid: validationResult.isValid,
    }

    result.validatedInputs.push(validatedInput)

    if (!validationResult.isValid && validationResult.error) {
      result.isValid = false
      result.errors.push(validationResult.error)
    }

    if (validationResult.warning) {
      result.warnings.push(validationResult.warning)
    }
  }

  // 필수 입력 타입 체크
  const requiredTypes = PROCESS_INPUT_RULES[validProcessCode]
  const providedTypes = new Set(inputs.map(i => i.type))

  // SB 공정: material과 semi_product 모두 필요할 수 있음
  if (validProcessCode === 'SB') {
    // SB는 둘 다 허용하지만, 최소 하나는 있어야 함
    if (providedTypes.size === 0) {
      result.isValid = false
      result.errors.push({
        code: 'MISSING_REQUIRED_INPUT',
        message: `${PROCESS_NAMES[validProcessCode]} 공정에는 자재 또는 반제품이 필요합니다.`,
      })
    }
  }

  return result
}

/**
 * 바코드 목록으로부터 입력 아이템 생성
 *
 * @param barcodes 바코드 문자열 배열
 * @returns 입력 아이템 배열
 */
export function createInputsFromBarcodes(barcodes: string[]): InputItem[] {
  return barcodes.map(barcode => {
    const parsed = parseBarcode(barcode)
    const type = inferInputType(barcode)

    return {
      barcode,
      type,
      processCode: parsed.isValid ? parsed.processCode : undefined,
    }
  })
}

/**
 * 공정에서 바코드 목록 검증 (간편 함수)
 *
 * @param processCode 현재 공정 코드
 * @param barcodes 바코드 문자열 배열
 * @returns 검증 결과
 */
export function validateBarcodes(
  processCode: string,
  barcodes: string[]
): ValidationResult {
  const inputs = createInputsFromBarcodes(barcodes)
  return validateInputs(processCode, inputs)
}

// ============================================
// Utility Functions
// ============================================

/**
 * 입력 타입 한글명 반환
 */
export function getInputTypeName(type: InputType): string {
  const names: Record<InputType, string> = {
    material: '자재',
    semi_product: '반제품',
    production: '생산 LOT',
  }
  return names[type]
}

/**
 * 공정별 필수 입력 타입 설명 반환
 */
export function getProcessInputDescription(processCode: ProcessCode): string {
  const rules = PROCESS_INPUT_RULES[processCode]
  const typeNames = rules.map(getInputTypeName).join(', ')

  return `${PROCESS_NAMES[processCode]}: ${typeNames} 입력 필요`
}

/**
 * 모든 공정의 입력 규칙 반환
 */
export function getAllProcessInputRules(): Array<{
  processCode: ProcessCode
  name: string
  nameVi: string
  allowedInputs: InputType[]
  allowedPreviousProcesses: ProcessCode[]
}> {
  return Object.keys(PROCESS_INPUT_RULES).map(code => {
    const processCode = code as ProcessCode
    return {
      processCode,
      name: PROCESS_NAMES[processCode],
      nameVi: PROCESS_NAMES_VI[processCode],
      allowedInputs: PROCESS_INPUT_RULES[processCode],
      allowedPreviousProcesses: ALLOWED_PREVIOUS_PROCESSES[processCode],
    }
  })
}

/**
 * 검증 에러 메시지 포맷팅
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.isValid) {
    return '검증 성공'
  }

  const errorMessages = result.errors.map(e => `[${e.code}] ${e.message}`)
  return errorMessages.join('\n')
}

/**
 * 검증 결과 요약
 */
export function summarizeValidationResult(result: ValidationResult): {
  status: 'success' | 'error' | 'warning'
  message: string
  errorCount: number
  warningCount: number
} {
  if (!result.isValid) {
    return {
      status: 'error',
      message: `검증 실패: ${result.errors.length}개 오류`,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    }
  }

  if (result.warnings.length > 0) {
    return {
      status: 'warning',
      message: `검증 성공 (${result.warnings.length}개 경고)`,
      errorCount: 0,
      warningCount: result.warnings.length,
    }
  }

  return {
    status: 'success',
    message: '검증 성공',
    errorCount: 0,
    warningCount: 0,
  }
}
