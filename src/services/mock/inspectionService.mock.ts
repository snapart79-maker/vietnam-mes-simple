/**
 * Inspection Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * Phase 1: localStorage 영속화 지원
 * Phase 5: 검사 워크플로우 강화
 */

import { parseBarcode } from '../barcodeService'

// ============================================
// LocalStorage Keys & Persistence
// ============================================

const STORAGE_KEYS = {
  INSPECTIONS: 'vietnam_mes_inspections',
  INSPECTION_LOTS: 'vietnam_mes_inspection_lots',
}

// Date 필드를 가진 객체의 직렬화/역직렬화를 위한 타입
interface SerializedInspection {
  id: number
  lotId: number
  type: InspectionType
  result: InspectionResult
  defectReason?: string
  inspectedAt: string  // ISO string
}

// 데이터 로드 (with Date 변환)
function loadInspectionsFromStorage(): Array<{
  id: number
  lotId: number
  type: InspectionType
  result: InspectionResult
  defectReason?: string
  inspectedAt: Date
}> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.INSPECTIONS)
    if (stored) {
      const parsed: SerializedInspection[] = JSON.parse(stored)
      return parsed.map((insp) => ({
        ...insp,
        inspectedAt: new Date(insp.inspectedAt),
      }))
    }
  } catch (error) {
    console.error('Failed to load inspections from localStorage:', error)
  }
  return []
}

interface MockLot {
  id: number
  lotNumber: string
  processCode: string
}

function loadInspectionLotsFromStorage(): MockLot[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.INSPECTION_LOTS)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load inspection lots from localStorage:', error)
  }
  return []
}

// 데이터 저장
function saveInspections(): void {
  try {
    const serialized: SerializedInspection[] = mockInspections.map((insp) => ({
      ...insp,
      inspectedAt: insp.inspectedAt.toISOString(),
    }))
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(serialized))
  } catch (error) {
    console.error('Failed to save inspections to localStorage:', error)
  }
}

function saveInspectionLots(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INSPECTION_LOTS, JSON.stringify(MOCK_LOTS))
  } catch (error) {
    console.error('Failed to save inspection lots to localStorage:', error)
  }
}

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

// Mock 검사 기록 (localStorage에서 로드)
let mockInspections: Array<{
  id: number
  lotId: number
  type: InspectionType
  result: InspectionResult
  defectReason?: string
  inspectedAt: Date
}> = loadInspectionsFromStorage()

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

  saveInspections()
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
  // localStorage도 초기화
  localStorage.removeItem(STORAGE_KEYS.INSPECTIONS)
  localStorage.removeItem(STORAGE_KEYS.INSPECTION_LOTS)
  return count
}

// ============================================
// Phase 5: 검사 워크플로우 강화 (Mock)
// ============================================

// Mock LOT 데이터 저장소 (localStorage에서 로드)
// MockLot 인터페이스는 상단에 정의됨
let MOCK_LOTS: MockLot[] = loadInspectionLotsFromStorage()

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
  saveInspectionLots()
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

// ============================================
// Phase 2: CI/VI 바코드 생성 워크플로우
// ============================================

// CI/VI 시퀀스 카운터 (localStorage 영속화)
const CI_VI_SEQUENCE_KEY = 'vietnam_mes_ci_vi_sequences'

interface SequenceCounter {
  [key: string]: number  // key: {type}_{markingLot}, value: lastSequence
}

function loadSequences(): SequenceCounter {
  try {
    const stored = localStorage.getItem(CI_VI_SEQUENCE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load CI/VI sequences:', error)
  }
  return {}
}

function saveSequences(): void {
  try {
    localStorage.setItem(CI_VI_SEQUENCE_KEY, JSON.stringify(sequenceCounters))
  } catch (error) {
    console.error('Failed to save CI/VI sequences:', error)
  }
}

let sequenceCounters: SequenceCounter = loadSequences()

function getNextCIVISequence(type: 'CI' | 'VI', markingLot: string): number {
  const key = `${type}_${markingLot.toUpperCase()}`
  const current = sequenceCounters[key] || 0
  const next = current + 1
  sequenceCounters[key] = next
  saveSequences()
  return next
}

// ProductionLot 저장소 (CI/VI용)
const CI_VI_LOTS_KEY = 'vietnam_mes_ci_vi_lots'

interface CIVIProductionLot {
  id: number
  lotNumber: string       // CI 또는 VI 바코드
  processCode: 'CI' | 'VI'
  inputBarcode: string    // 투입 바코드 (PA 또는 CI)
  markingLot: string
  quantity: number
  productCode?: string
  productName?: string
  createdAt: string       // ISO string
  status: 'COMPLETED'
}

function loadCIVILots(): CIVIProductionLot[] {
  try {
    const stored = localStorage.getItem(CI_VI_LOTS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load CI/VI lots:', error)
  }
  return []
}

function saveCIVILots(): void {
  try {
    const serialized = civiLots.map((lot) => ({
      ...lot,
      createdAt: typeof lot.createdAt === 'string' ? lot.createdAt : new Date(lot.createdAt).toISOString(),
    }))
    localStorage.setItem(CI_VI_LOTS_KEY, JSON.stringify(serialized))
  } catch (error) {
    console.error('Failed to save CI/VI lots:', error)
  }
}

let civiLots: CIVIProductionLot[] = loadCIVILots()

/**
 * 회로검사 결과 기록 및 CI 바코드 생성
 *
 * 워크플로우:
 * 1. PA 바코드 입력 → 검증
 * 2. 회로검사 결과 기록 (PASS/FAIL)
 * 3. PASS인 경우 CI 바코드 생성 + ProductionLot 생성
 *
 * @param input 회로검사 입력
 * @returns 검사 결과 및 생성된 CI 바코드 (합격 시)
 */
export interface CircuitInspectionInput {
  paBarcode: string       // PA 공정 바코드 (투입)
  markingLot: string      // 마킹LOT (3자리)
  quantity: number        // 수량
  result: InspectionResult
  defectReason?: string   // 불량 사유 (FAIL인 경우)
  productCode?: string    // 완제품 품번
  productName?: string    // 제품명
  inspectorId?: number    // 검사자 ID
}

export interface CircuitInspectionResult {
  success: boolean
  inspectionId: number
  result: InspectionResult
  ciBarcode?: string          // 합격 시 생성된 CI 바코드
  productionLotId?: number    // 합격 시 생성된 ProductionLot ID
  message: string
}

export async function recordCircuitInspectionWithBarcode(
  input: CircuitInspectionInput
): Promise<CircuitInspectionResult> {
  await new Promise((r) => setTimeout(r, 100))

  // 1. 입력 검증
  if (!input.paBarcode || !input.markingLot || !input.quantity) {
    return {
      success: false,
      inspectionId: 0,
      result: input.result,
      message: '필수 입력값이 누락되었습니다 (PA바코드, 마킹LOT, 수량)',
    }
  }

  // 마킹LOT 검증 (3자리 영숫자)
  if (!/^[A-Z0-9]{3}$/i.test(input.markingLot)) {
    return {
      success: false,
      inspectionId: 0,
      result: input.result,
      message: '마킹LOT은 3자리 영숫자여야 합니다',
    }
  }

  // 2. Mock LOT 찾기 또는 생성
  let lot = MOCK_LOTS.find((l) => l.lotNumber === input.paBarcode)
  if (!lot) {
    // PA 바코드로 Mock LOT 생성
    const newLotId = MOCK_LOTS.length > 0 ? Math.max(...MOCK_LOTS.map((l) => l.id)) + 1 : 1
    lot = {
      id: newLotId,
      lotNumber: input.paBarcode,
      processCode: 'PA',
    }
    MOCK_LOTS.push(lot)
    saveInspectionLots()
  }

  // 3. 검사 기록 생성
  const inspectionId = mockInspections.length + 1
  mockInspections.push({
    id: inspectionId,
    lotId: lot.id,
    type: 'CIRCUIT',
    result: input.result,
    defectReason: input.defectReason,
    inspectedAt: new Date(),
  })
  saveInspections()

  // 4. 불합격인 경우 여기서 종료
  if (input.result === 'FAIL') {
    return {
      success: true,
      inspectionId,
      result: 'FAIL',
      message: '회로검사 불합격 기록됨',
    }
  }

  // 5. 합격 시 CI 바코드 생성
  const sequence = getNextCIVISequence('CI', input.markingLot)
  const ciBarcode = `CI-${input.markingLot.toUpperCase()}-${String(sequence).padStart(4, '0')}`

  // 6. CI ProductionLot 생성
  const lotId = civiLots.length > 0 ? Math.max(...civiLots.map((l) => l.id)) + 1 : 1
  const newLot: CIVIProductionLot = {
    id: lotId,
    lotNumber: ciBarcode,
    processCode: 'CI',
    inputBarcode: input.paBarcode,
    markingLot: input.markingLot.toUpperCase(),
    quantity: input.quantity,
    productCode: input.productCode,
    productName: input.productName,
    createdAt: new Date().toISOString(),
    status: 'COMPLETED',
  }
  civiLots.push(newLot)
  saveCIVILots()

  // CI 바코드도 MOCK_LOTS에 추가 (VI 검사에서 참조하기 위해)
  MOCK_LOTS.push({
    id: MOCK_LOTS.length > 0 ? Math.max(...MOCK_LOTS.map((l) => l.id)) + 1 : 1,
    lotNumber: ciBarcode,
    processCode: 'CI',
  })
  saveInspectionLots()

  return {
    success: true,
    inspectionId,
    result: 'PASS',
    ciBarcode,
    productionLotId: lotId,
    message: `회로검사 합격. CI 바코드 생성: ${ciBarcode}`,
  }
}

/**
 * 육안검사 결과 기록 및 VI 바코드 생성
 *
 * 워크플로우:
 * 1. CI 바코드 입력 → 검증
 * 2. 육안검사 결과 기록 (PASS/FAIL)
 * 3. PASS인 경우 VI 바코드 생성 + ProductionLot 생성
 *
 * @param input 육안검사 입력
 * @returns 검사 결과 및 생성된 VI 바코드 (합격 시)
 */
export interface VisualInspectionInput {
  ciBarcode: string       // CI 바코드 (투입)
  markingLot: string      // 마킹LOT (3자리)
  quantity: number        // 수량
  result: InspectionResult
  defectReason?: string   // 불량 사유 (FAIL인 경우)
  productCode?: string    // 완제품 품번
  productName?: string    // 제품명
  inspectorId?: number    // 검사자 ID
}

export interface VisualInspectionResult {
  success: boolean
  inspectionId: number
  result: InspectionResult
  viBarcode?: string          // 합격 시 생성된 VI 바코드
  productionLotId?: number    // 합격 시 생성된 ProductionLot ID
  message: string
}

export async function recordVisualInspectionWithBarcode(
  input: VisualInspectionInput
): Promise<VisualInspectionResult> {
  await new Promise((r) => setTimeout(r, 100))

  // 1. 입력 검증
  if (!input.ciBarcode || !input.markingLot || !input.quantity) {
    return {
      success: false,
      inspectionId: 0,
      result: input.result,
      message: '필수 입력값이 누락되었습니다 (CI바코드, 마킹LOT, 수량)',
    }
  }

  // 마킹LOT 검증 (3자리 영숫자)
  if (!/^[A-Z0-9]{3}$/i.test(input.markingLot)) {
    return {
      success: false,
      inspectionId: 0,
      result: input.result,
      message: '마킹LOT은 3자리 영숫자여야 합니다',
    }
  }

  // CI 바코드 형식 검증 (옵션 - 너무 엄격하면 운영에 불편)
  // if (!/^CI-[A-Z0-9]{3}-\d{4}$/i.test(input.ciBarcode)) {
  //   return { success: false, ... }
  // }

  // 2. Mock LOT 찾기 또는 생성
  let lot = MOCK_LOTS.find((l) => l.lotNumber === input.ciBarcode)
  if (!lot) {
    // CI 바코드로 Mock LOT 생성
    const newLotId = MOCK_LOTS.length > 0 ? Math.max(...MOCK_LOTS.map((l) => l.id)) + 1 : 1
    lot = {
      id: newLotId,
      lotNumber: input.ciBarcode,
      processCode: 'CI',
    }
    MOCK_LOTS.push(lot)
    saveInspectionLots()
  }

  // 3. 검사 기록 생성
  const inspectionId = mockInspections.length + 1
  mockInspections.push({
    id: inspectionId,
    lotId: lot.id,
    type: 'VISUAL',
    result: input.result,
    defectReason: input.defectReason,
    inspectedAt: new Date(),
  })
  saveInspections()

  // 4. 불합격인 경우 여기서 종료
  if (input.result === 'FAIL') {
    return {
      success: true,
      inspectionId,
      result: 'FAIL',
      message: '육안검사 불합격 기록됨',
    }
  }

  // 5. 합격 시 VI 바코드 생성
  const sequence = getNextCIVISequence('VI', input.markingLot)
  const viBarcode = `VI-${input.markingLot.toUpperCase()}-${String(sequence).padStart(4, '0')}`

  // 6. VI ProductionLot 생성
  const lotId = civiLots.length > 0 ? Math.max(...civiLots.map((l) => l.id)) + 1 : 1
  const newLot: CIVIProductionLot = {
    id: lotId,
    lotNumber: viBarcode,
    processCode: 'VI',
    inputBarcode: input.ciBarcode,
    markingLot: input.markingLot.toUpperCase(),
    quantity: input.quantity,
    productCode: input.productCode,
    productName: input.productName,
    createdAt: new Date().toISOString(),
    status: 'COMPLETED',
  }
  civiLots.push(newLot)
  saveCIVILots()

  return {
    success: true,
    inspectionId,
    result: 'PASS',
    viBarcode,
    productionLotId: lotId,
    message: `육안검사 합격. VI 바코드 생성: ${viBarcode}`,
  }
}

/**
 * CI/VI ProductionLot 조회
 */
export function getCIVILots(): CIVIProductionLot[] {
  return civiLots.map((lot) => ({
    ...lot,
    createdAt: lot.createdAt,  // 이미 string
  }))
}

/**
 * 마킹LOT으로 CI/VI 바코드 조회
 */
export function getCIVILotsByMarkingLot(markingLot: string): CIVIProductionLot[] {
  return civiLots.filter((lot) => lot.markingLot === markingLot.toUpperCase())
}

/**
 * CI/VI 데이터 초기화
 */
export function resetCIVIData(): void {
  civiLots = []
  sequenceCounters = {}
  localStorage.removeItem(CI_VI_LOTS_KEY)
  localStorage.removeItem(CI_VI_SEQUENCE_KEY)
}

// ============================================
// Phase 3: SP 공정 압착검사 확인
// ============================================

/**
 * 압착검사(CRIMP) 대상 공정 코드
 * CA, MC 공정의 출력물만 압착검사 대상
 */
export const CRIMP_TARGET_PROCESSES = ['CA', 'MC'] as const

/**
 * SP 공정에서 허용되는 이전 공정들
 */
export const SP_ALLOWED_PREVIOUS_PROCESSES = ['CA', 'MC', 'MS', 'SB', 'HS'] as const

/**
 * 압착검사 결과 인터페이스
 */
export interface CrimpInspectionStatus {
  barcode: string
  processCode: string | null
  requiresCrimpInspection: boolean  // CA/MC 공정인지 여부
  hasCrimpInspection: boolean       // 압착검사 기록이 있는지
  passed: boolean                   // 합격 여부
  inspections: Array<{
    id: number
    result: InspectionResult
    inspectedAt: Date
    defectReason?: string
  }>
  message: string
}

/**
 * SP 공정 입력 검증 결과 인터페이스
 */
export interface SPInputValidationResult {
  barcode: string
  isValid: boolean
  processCode: string | null
  requiresCrimpInspection: boolean
  crimpInspectionPassed: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 압착검사 통과 여부 확인
 *
 * CA/MC 공정의 바코드에 대해 압착검사(CRIMP) 통과 여부 확인
 *
 * @param barcode CA/MC 공정 바코드
 * @returns 압착검사 상태
 */
export async function checkCrimpInspectionPassed(
  barcode: string
): Promise<CrimpInspectionStatus> {
  await new Promise((r) => setTimeout(r, 50))

  // 바코드 파싱으로 공정 코드 추출
  const parsed = parseBarcode(barcode)
  let processCode: string | null = null

  if (parsed.isValid) {
    processCode = parsed.processCode.toUpperCase()
  } else {
    // Mock LOT에서 조회
    const lot = MOCK_LOTS.find((l) => l.lotNumber === barcode)
    if (lot) {
      processCode = lot.processCode
    }
  }

  // 공정 코드를 찾을 수 없는 경우
  if (!processCode) {
    return {
      barcode,
      processCode: null,
      requiresCrimpInspection: false,
      hasCrimpInspection: false,
      passed: true,  // 공정 코드 없으면 검사 불필요로 간주
      inspections: [],
      message: `바코드의 공정 코드를 확인할 수 없습니다: ${barcode}`,
    }
  }

  // CA/MC 공정이 아닌 경우 압착검사 불필요
  if (!CRIMP_TARGET_PROCESSES.includes(processCode as typeof CRIMP_TARGET_PROCESSES[number])) {
    return {
      barcode,
      processCode,
      requiresCrimpInspection: false,
      hasCrimpInspection: false,
      passed: true,  // 압착검사 대상 아님
      inspections: [],
      message: `${processCode} 공정은 압착검사 대상이 아닙니다.`,
    }
  }

  // LOT ID 찾기
  let lot = MOCK_LOTS.find((l) => l.lotNumber === barcode)
  if (!lot) {
    // Mock LOT 자동 생성 (테스트용)
    const newLotId = MOCK_LOTS.length > 0 ? Math.max(...MOCK_LOTS.map((l) => l.id)) + 1 : 1
    lot = {
      id: newLotId,
      lotNumber: barcode,
      processCode,
    }
    MOCK_LOTS.push(lot)
    saveInspectionLots()
  }

  // 해당 LOT의 압착검사(CRIMP) 기록 조회
  const crimpInspections = mockInspections.filter(
    (i) => i.lotId === lot!.id && i.type === 'CRIMP'
  )

  if (crimpInspections.length === 0) {
    return {
      barcode,
      processCode,
      requiresCrimpInspection: true,
      hasCrimpInspection: false,
      passed: false,
      inspections: [],
      message: `${processCode} 공정 바코드이지만 압착검사 기록이 없습니다.`,
    }
  }

  // 가장 최근 검사 결과 확인 (또는 합격 기록이 있는지)
  const passedInspection = crimpInspections.find((i) => i.result === 'PASS')
  const latestInspection = crimpInspections[crimpInspections.length - 1]

  const inspectionDetails = crimpInspections.map((i) => ({
    id: i.id,
    result: i.result,
    inspectedAt: i.inspectedAt,
    defectReason: i.defectReason,
  }))

  if (passedInspection) {
    return {
      barcode,
      processCode,
      requiresCrimpInspection: true,
      hasCrimpInspection: true,
      passed: true,
      inspections: inspectionDetails,
      message: `압착검사 합격 (검사 ID: ${passedInspection.id})`,
    }
  } else {
    return {
      barcode,
      processCode,
      requiresCrimpInspection: true,
      hasCrimpInspection: true,
      passed: false,
      inspections: inspectionDetails,
      message: `압착검사 불합격 (마지막 검사: ${latestInspection.defectReason || '사유 없음'})`,
    }
  }
}

/**
 * 압착검사 이력 조회
 *
 * @param barcode 바코드 (CA/MC 공정)
 * @returns 압착검사 이력 목록
 */
export async function getCrimpInspectionHistory(
  barcode: string
): Promise<Array<{
  id: number
  lotNumber: string
  processCode: string
  result: InspectionResult
  defectReason?: string
  inspectedAt: Date
}>> {
  await new Promise((r) => setTimeout(r, 50))

  const lot = MOCK_LOTS.find((l) => l.lotNumber === barcode)
  if (!lot) {
    return []
  }

  const crimpInspections = mockInspections.filter(
    (i) => i.lotId === lot.id && i.type === 'CRIMP'
  )

  return crimpInspections.map((i) => ({
    id: i.id,
    lotNumber: barcode,
    processCode: lot.processCode,
    result: i.result,
    defectReason: i.defectReason,
    inspectedAt: i.inspectedAt,
  }))
}

/**
 * 압착검사 기록 생성 (CRIMP)
 *
 * @param input 압착검사 입력
 * @returns 검사 결과
 */
export interface CrimpInspectionInput {
  barcode: string           // CA/MC 공정 바코드
  result: InspectionResult  // PASS/FAIL
  defectReason?: string     // 불량 사유 (FAIL인 경우)
  inspectorId?: number      // 검사자 ID
}

export async function recordCrimpInspection(
  input: CrimpInspectionInput
): Promise<{
  success: boolean
  inspectionId: number
  message: string
}> {
  await new Promise((r) => setTimeout(r, 100))

  // 바코드에서 공정 코드 추출
  const parsed = parseBarcode(input.barcode)
  let processCode: string | null = null

  if (parsed.isValid) {
    processCode = parsed.processCode.toUpperCase()
  }

  // CA/MC 공정만 압착검사 대상
  if (processCode && !CRIMP_TARGET_PROCESSES.includes(processCode as typeof CRIMP_TARGET_PROCESSES[number])) {
    return {
      success: false,
      inspectionId: 0,
      message: `${processCode} 공정은 압착검사 대상이 아닙니다. CA 또는 MC 공정만 가능합니다.`,
    }
  }

  // LOT 찾기 또는 생성
  let lot = MOCK_LOTS.find((l) => l.lotNumber === input.barcode)
  if (!lot) {
    const newLotId = MOCK_LOTS.length > 0 ? Math.max(...MOCK_LOTS.map((l) => l.id)) + 1 : 1
    lot = {
      id: newLotId,
      lotNumber: input.barcode,
      processCode: processCode || 'CA',
    }
    MOCK_LOTS.push(lot)
    saveInspectionLots()
  }

  // 검사 기록 생성
  const inspectionId = mockInspections.length + 1
  mockInspections.push({
    id: inspectionId,
    lotId: lot.id,
    type: 'CRIMP',
    result: input.result,
    defectReason: input.defectReason,
    inspectedAt: new Date(),
  })
  saveInspections()

  const resultMessage = input.result === 'PASS'
    ? `압착검사 합격 기록됨 (검사 ID: ${inspectionId})`
    : `압착검사 불합격 기록됨 (사유: ${input.defectReason || '없음'})`

  return {
    success: true,
    inspectionId,
    message: resultMessage,
  }
}

/**
 * SP 공정 입력 검증
 *
 * SP 공정에 투입되는 바코드 검증
 * - CA/MC 공정인 경우 압착검사 통과 필수
 * - MS, SB, HS 공정은 압착검사 불필요
 *
 * @param barcode 투입 바코드
 * @returns 검증 결과
 */
export async function validateSPProcessInput(
  barcode: string
): Promise<SPInputValidationResult> {
  await new Promise((r) => setTimeout(r, 50))

  const errors: string[] = []
  const warnings: string[] = []

  // 바코드 파싱으로 공정 코드 추출
  const parsed = parseBarcode(barcode)
  let processCode: string | null = null

  if (parsed.isValid) {
    processCode = parsed.processCode.toUpperCase()
  } else {
    // Mock LOT에서 조회
    const lot = MOCK_LOTS.find((l) => l.lotNumber === barcode)
    if (lot) {
      processCode = lot.processCode
    }
  }

  // 공정 코드를 찾을 수 없는 경우
  if (!processCode) {
    // 자재로 간주 (SP에서는 반제품만 허용)
    errors.push(`바코드의 공정 코드를 확인할 수 없습니다. SP 공정에는 반제품(CA, MC, MS, SB, HS)만 투입 가능합니다.`)
    return {
      barcode,
      isValid: false,
      processCode: null,
      requiresCrimpInspection: false,
      crimpInspectionPassed: false,
      errors,
      warnings,
    }
  }

  // SP 허용 공정 확인
  if (!SP_ALLOWED_PREVIOUS_PROCESSES.includes(processCode as typeof SP_ALLOWED_PREVIOUS_PROCESSES[number])) {
    errors.push(`${processCode} 공정의 출력물은 SP 공정에 투입할 수 없습니다. 허용: CA, MC, MS, SB, HS`)
    return {
      barcode,
      isValid: false,
      processCode,
      requiresCrimpInspection: false,
      crimpInspectionPassed: false,
      errors,
      warnings,
    }
  }

  // CA/MC 공정인 경우 압착검사 확인
  const requiresCrimpInspection = CRIMP_TARGET_PROCESSES.includes(processCode as typeof CRIMP_TARGET_PROCESSES[number])

  if (requiresCrimpInspection) {
    const crimpStatus = await checkCrimpInspectionPassed(barcode)

    if (!crimpStatus.hasCrimpInspection) {
      errors.push(`${processCode} 공정 바코드(${barcode})에 대한 압착검사 기록이 없습니다. 압착검사를 먼저 수행하세요.`)
      return {
        barcode,
        isValid: false,
        processCode,
        requiresCrimpInspection: true,
        crimpInspectionPassed: false,
        errors,
        warnings,
      }
    }

    if (!crimpStatus.passed) {
      errors.push(`${processCode} 공정 바코드(${barcode})가 압착검사에 불합격했습니다. SP 공정에 투입할 수 없습니다.`)
      return {
        barcode,
        isValid: false,
        processCode,
        requiresCrimpInspection: true,
        crimpInspectionPassed: false,
        errors,
        warnings,
      }
    }

    // 압착검사 합격
    return {
      barcode,
      isValid: true,
      processCode,
      requiresCrimpInspection: true,
      crimpInspectionPassed: true,
      errors: [],
      warnings: [],
    }
  }

  // MS, SB, HS 공정은 압착검사 불필요
  return {
    barcode,
    isValid: true,
    processCode,
    requiresCrimpInspection: false,
    crimpInspectionPassed: true,  // 검사 불필요하면 통과로 간주
    errors: [],
    warnings: [],
  }
}

/**
 * SP 공정 여러 입력 검증
 *
 * @param barcodes 투입 바코드 목록
 * @returns 검증 결과 목록 및 전체 통과 여부
 */
export async function validateSPProcessInputs(
  barcodes: string[]
): Promise<{
  isValid: boolean
  results: SPInputValidationResult[]
  summary: {
    total: number
    passed: number
    failed: number
    crimpRequired: number
    crimpPassed: number
  }
  errors: string[]
}> {
  const results: SPInputValidationResult[] = []
  const allErrors: string[] = []

  for (const barcode of barcodes) {
    const result = await validateSPProcessInput(barcode)
    results.push(result)
    allErrors.push(...result.errors)
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.isValid).length,
    failed: results.filter((r) => !r.isValid).length,
    crimpRequired: results.filter((r) => r.requiresCrimpInspection).length,
    crimpPassed: results.filter((r) => r.requiresCrimpInspection && r.crimpInspectionPassed).length,
  }

  return {
    isValid: summary.failed === 0,
    results,
    summary,
    errors: allErrors,
  }
}
