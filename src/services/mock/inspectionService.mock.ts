/**
 * Inspection Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * Phase 5: 검사 워크플로우 강화
 */

import { parseBarcode } from '../barcodeService'

export type InspectionType = 'CRIMP' | 'CIRCUIT' | 'VISUAL'
export type InspectionResult = 'PASS' | 'FAIL'
export type ProcessCode = 'MO' | 'CA' | 'MC' | 'MS' | 'SB' | 'HS' | 'SP' | 'PA' | 'CI' | 'VI'

export interface InspectionStats {
  total: number
  pass: number
  fail: number
  passRate: number
  byType: Record<InspectionType, { pass: number; fail: number }>
}

export interface CreateInspectionInput {
  lotId: number
  type: InspectionType
  result: InspectionResult
  defectReason?: string
  defectQty?: number
  inspectorId?: number
}

// Mock 검사 기록
const mockInspections: Array<{
  id: number
  lotId: number
  type: InspectionType
  result: InspectionResult
  defectReason?: string
  inspectedAt: Date
}> = []

/**
 * 검사 기록 생성
 */
export async function createInspection(input: CreateInspectionInput): Promise<{ id: number }> {
  await new Promise((r) => setTimeout(r, 200))

  const newId = mockInspections.length + 1
  mockInspections.push({
    id: newId,
    lotId: input.lotId,
    type: input.type,
    result: input.result,
    defectReason: input.defectReason,
    inspectedAt: new Date(),
  })

  return { id: newId }
}

/**
 * 금일 검사 통계 조회
 * - 실제 mockInspections 배열 기반으로 통계 계산
 */
export async function getTodayInspectionSummary(): Promise<InspectionStats> {
  await new Promise((r) => setTimeout(r, 150))

  // mockInspections가 비어있으면 빈 통계 반환
  if (mockInspections.length === 0) {
    return {
      total: 0,
      pass: 0,
      fail: 0,
      passRate: 0,
      byType: {
        CRIMP: { pass: 0, fail: 0 },
        CIRCUIT: { pass: 0, fail: 0 },
        VISUAL: { pass: 0, fail: 0 },
      },
    }
  }

  // 실제 데이터 기반 통계 계산
  const byType: Record<InspectionType, { pass: number; fail: number }> = {
    CRIMP: { pass: 0, fail: 0 },
    CIRCUIT: { pass: 0, fail: 0 },
    VISUAL: { pass: 0, fail: 0 },
  }

  let pass = 0
  let fail = 0

  for (const inspection of mockInspections) {
    if (inspection.result === 'PASS') {
      pass++
      byType[inspection.type].pass++
    } else {
      fail++
      byType[inspection.type].fail++
    }
  }

  const total = pass + fail
  const passRate = total > 0 ? (pass / total) * 100 : 0

  return {
    total,
    pass,
    fail,
    passRate: Math.round(passRate * 10) / 10,
    byType,
  }
}

/**
 * LOT별 검사 이력 조회
 */
export async function getInspectionsByLot(lotId: number): Promise<Array<{
  id: number
  type: InspectionType
  result: InspectionResult
  defectReason?: string
  inspectedAt: Date
}>> {
  await new Promise((r) => setTimeout(r, 200))
  return mockInspections.filter((i) => i.lotId === lotId)
}

/**
 * 검사 데이터 초기화 (모든 검사 기록 삭제)
 */
export function resetInspectionData(): number {
  const count = mockInspections.length
  mockInspections.length = 0
  MOCK_LOTS.length = 0
  return count
}

// ============================================
// Phase 5: 검사 워크플로우 강화 (Mock)
// ============================================

/**
 * Mock LOT 데이터 저장소
 */
interface MockLot {
  id: number
  lotNumber: string
  processCode: string
}

const MOCK_LOTS: MockLot[] = []

/**
 * 검사 유형별 허용 공정 규칙
 */
export const INSPECTION_TARGET_PROCESS: Record<InspectionType, ProcessCode[]> = {
  CRIMP: ['CA', 'MC'],
  CIRCUIT: ['PA'],
  VISUAL: ['CI'],
}

/**
 * 검사 유형별 한글명
 */
export const INSPECTION_TYPE_NAMES: Record<InspectionType, string> = {
  CRIMP: '압착검사',
  CIRCUIT: '회로검사',
  VISUAL: '육안검사',
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
 * 검사 대상 검증 결과
 */
export interface InspectionTargetValidation {
  valid: boolean
  inspectionType: InspectionType
  lotNumber: string
  processCode: string | null
  allowedProcesses: ProcessCode[]
  error?: string
}

/**
 * 중복 검사 확인 결과
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean
  lotNumber: string
  inspectionType: InspectionType
  existingInspection?: {
    id: number
    result: InspectionResult
    inspectedAt: Date
  }
}

/**
 * Mock LOT 추가 (테스트용)
 */
export function addMockLot(lot: MockLot): void {
  MOCK_LOTS.push(lot)
}

/**
 * 검사 대상 공정 검증 (Mock)
 */
export async function validateInspectionTarget(
  inspectionType: InspectionType,
  lotNumber: string
): Promise<InspectionTargetValidation> {
  await new Promise((r) => setTimeout(r, 50))

  const allowedProcesses = INSPECTION_TARGET_PROCESS[inspectionType]

  // 바코드 파싱으로 공정 코드 추출
  const parsed = parseBarcode(lotNumber)
  let processCode: string | null = null

  if (parsed.isValid) {
    processCode = parsed.processCode.toUpperCase()
  } else {
    // Mock LOT에서 조회
    const lot = MOCK_LOTS.find((l) => l.lotNumber === lotNumber)
    if (lot) {
      processCode = lot.processCode
    }
  }

  if (!processCode) {
    return {
      valid: false,
      inspectionType,
      lotNumber,
      processCode: null,
      allowedProcesses,
      error: `LOT을 찾을 수 없거나 공정 코드를 확인할 수 없습니다: ${lotNumber}`,
    }
  }

  const isAllowed = allowedProcesses.includes(processCode as ProcessCode)

  if (!isAllowed) {
    const allowedNames = allowedProcesses.map((p) => PROCESS_NAMES[p]).join(', ')
    return {
      valid: false,
      inspectionType,
      lotNumber,
      processCode,
      allowedProcesses,
      error: `${INSPECTION_TYPE_NAMES[inspectionType]}는 ${allowedNames} 공정만 대상입니다. 현재 공정: ${PROCESS_NAMES[processCode as ProcessCode] || processCode}`,
    }
  }

  return {
    valid: true,
    inspectionType,
    lotNumber,
    processCode,
    allowedProcesses,
  }
}

/**
 * 중복 검사 확인 (Mock)
 */
export async function checkDuplicateInspection(
  lotNumber: string,
  inspectionType: InspectionType
): Promise<DuplicateCheckResult> {
  await new Promise((r) => setTimeout(r, 50))

  // Mock LOT 조회
  const lot = MOCK_LOTS.find((l) => l.lotNumber === lotNumber)
  if (!lot) {
    return {
      isDuplicate: false,
      lotNumber,
      inspectionType,
    }
  }

  // 기존 검사 조회
  const existingInspection = mockInspections.find(
    (i) => i.lotId === lot.id && i.type === inspectionType
  )

  if (existingInspection) {
    return {
      isDuplicate: true,
      lotNumber,
      inspectionType,
      existingInspection: {
        id: existingInspection.id,
        result: existingInspection.result,
        inspectedAt: existingInspection.inspectedAt,
      },
    }
  }

  return {
    isDuplicate: false,
    lotNumber,
    inspectionType,
  }
}

/**
 * 검사 가능 여부 통합 확인 (Mock)
 */
export async function canPerformInspection(
  inspectionType: InspectionType,
  lotNumber: string,
  allowDuplicate: boolean = false
): Promise<{
  canInspect: boolean
  targetValidation: InspectionTargetValidation
  duplicateCheck: DuplicateCheckResult
  errors: string[]
}> {
  const errors: string[] = []

  const targetValidation = await validateInspectionTarget(inspectionType, lotNumber)
  if (!targetValidation.valid && targetValidation.error) {
    errors.push(targetValidation.error)
  }

  const duplicateCheck = await checkDuplicateInspection(lotNumber, inspectionType)
  if (duplicateCheck.isDuplicate && !allowDuplicate) {
    const existingDate = duplicateCheck.existingInspection?.inspectedAt
      ? new Date(duplicateCheck.existingInspection.inspectedAt).toLocaleDateString('ko-KR')
      : '알 수 없음'
    const existingResult = duplicateCheck.existingInspection?.result || '알 수 없음'
    errors.push(
      `이미 ${INSPECTION_TYPE_NAMES[inspectionType]}가 수행되었습니다. ` +
        `(${existingDate}, 결과: ${existingResult === 'PASS' ? '합격' : '불합격'})`
    )
  }

  return {
    canInspect: errors.length === 0,
    targetValidation,
    duplicateCheck,
    errors,
  }
}

/**
 * 검사 유형에 허용되는 공정 목록 조회 (Mock)
 */
export function getAllowedProcessesForInspection(inspectionType: InspectionType): ProcessCode[] {
  return INSPECTION_TARGET_PROCESS[inspectionType]
}

/**
 * 공정에 적용 가능한 검사 유형 조회 (Mock)
 */
export function getApplicableInspectionTypes(processCode: string): InspectionType[] {
  const normalized = processCode.toUpperCase() as ProcessCode
  const types: InspectionType[] = []

  for (const [type, processes] of Object.entries(INSPECTION_TARGET_PROCESS)) {
    if (processes.includes(normalized)) {
      types.push(type as InspectionType)
    }
  }

  return types
}

/**
 * LOT의 검사 상태 조회 (Mock)
 */
export async function getLotInspectionStatus(
  lotNumber: string
): Promise<{
  lotNumber: string
  processCode: string | null
  applicableTypes: InspectionType[]
  completedInspections: Array<{
    type: InspectionType
    result: InspectionResult
    inspectedAt: Date
  }>
  pendingTypes: InspectionType[]
}> {
  await new Promise((r) => setTimeout(r, 50))

  const lot = MOCK_LOTS.find((l) => l.lotNumber === lotNumber)

  if (!lot) {
    return {
      lotNumber,
      processCode: null,
      applicableTypes: [],
      completedInspections: [],
      pendingTypes: [],
    }
  }

  const applicableTypes = getApplicableInspectionTypes(lot.processCode)

  const completedInspections = mockInspections
    .filter((i) => i.lotId === lot.id)
    .map((i) => ({
      type: i.type,
      result: i.result,
      inspectedAt: i.inspectedAt,
    }))

  const completedTypes = new Set(completedInspections.map((i) => i.type))
  const pendingTypes = applicableTypes.filter((t) => !completedTypes.has(t))

  return {
    lotNumber,
    processCode: lot.processCode,
    applicableTypes,
    completedInspections,
    pendingTypes,
  }
}
