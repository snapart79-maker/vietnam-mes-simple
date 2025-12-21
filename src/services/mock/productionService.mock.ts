/**
 * Production Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 */

import {
  validateBarcodes,
  createInputsFromBarcodes,
  isValidProcessCode,
  PROCESS_INPUT_RULES,
  PROCESS_NAMES,
  type ProcessCode,
  type InputItem,
  type ValidationResult,
  type InputType,
} from '../../lib/processValidation'
import { parseBarcode } from '../barcodeService'

export type LotStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CONSUMED' | 'CANCELLED'

export interface LotWithRelations {
  id: number
  lotNumber: string
  processCode: string
  lineCode: string | null
  status: LotStatus
  product: {
    id: number
    code: string
    name: string
  } | null
  worker: {
    id: number
    name: string
  } | null
  plannedQty: number
  completedQty: number
  defectQty: number
  carryOverIn: number
  carryOverOut: number
  startedAt: Date
  completedAt: Date | null
  lotMaterials: Array<{
    id: number
    materialLotNo: string
    quantity: number
    material: {
      id: number
      code: string
      name: string
    }
  }>
}

/**
 * 2단계 생산 워크플로우 - 시작 입력
 */
export interface StartProductionInput {
  processCode: string
  productId?: number
  productCode?: string
  productName?: string
  lineCode?: string
  plannedQty: number
  workerId?: number
  barcodeVersion?: 1 | 2
  carryOverId?: number
  carryOverQty?: number
}

/**
 * 2단계 생산 워크플로우 - 완료 입력
 */
export interface CompleteProductionInput {
  lotId: number
  completedQty: number
  defectQty?: number
  createCarryOver?: boolean
  carryOverQty?: number
}

// Mock LOT 데이터 (초기 데이터 없음 - 공장초기화 상태)
const MOCK_LOTS: LotWithRelations[] = []

/**
 * LOT 번호로 조회
 */
export async function getLotByNumber(lotNumber: string): Promise<LotWithRelations | null> {
  await new Promise((r) => setTimeout(r, 200))
  return MOCK_LOTS.find((l) => l.lotNumber === lotNumber) || null
}

/**
 * LOT ID로 조회
 */
export async function getLotById(lotId: number): Promise<LotWithRelations | null> {
  await new Promise((r) => setTimeout(r, 200))
  return MOCK_LOTS.find((l) => l.id === lotId) || null
}

/**
 * 공정별 LOT 조회
 */
export async function getLotsByProcess(
  processCode: string,
  _options?: { status?: LotStatus; startDate?: Date; endDate?: Date; limit?: number }
): Promise<LotWithRelations[]> {
  await new Promise((r) => setTimeout(r, 200))
  return MOCK_LOTS.filter((l) => l.processCode === processCode.toUpperCase())
}

/**
 * 오늘의 LOT 목록 조회
 */
export async function getTodayLots(processCode?: string): Promise<LotWithRelations[]> {
  await new Promise((r) => setTimeout(r, 200))
  if (processCode) {
    return MOCK_LOTS.filter((l) => l.processCode === processCode.toUpperCase())
  }
  return MOCK_LOTS
}

/**
 * 일별 생산 현황 (Mock)
 * - MOCK_LOTS 기반으로 실제 데이터 반환 (초기화 시 빈 배열)
 */
export async function getDailyProductionSummary(_date: Date): Promise<Array<{
  processCode: string
  status: LotStatus
  count: number
  completedQty: number
  defectQty: number
}>> {
  await new Promise((r) => setTimeout(r, 200))

  // MOCK_LOTS가 비어있으면 빈 배열 반환
  if (MOCK_LOTS.length === 0) {
    return []
  }

  // 실제 MOCK_LOTS 기반으로 집계
  const summary: Record<string, { status: LotStatus; count: number; completedQty: number; defectQty: number }> = {}

  for (const lot of MOCK_LOTS) {
    const key = `${lot.processCode}-${lot.status}`
    if (!summary[key]) {
      summary[key] = { status: lot.status, count: 0, completedQty: 0, defectQty: 0 }
    }
    summary[key].count++
    summary[key].completedQty += lot.completedQty
    summary[key].defectQty += lot.defectQty
  }

  return Object.entries(summary).map(([key, data]) => ({
    processCode: key.split('-')[0],
    status: data.status,
    count: data.count,
    completedQty: data.completedQty,
    defectQty: data.defectQty,
  }))
}

/**
 * LOT 생성 (Mock)
 */
export async function createLot(input: {
  processCode: string
  productId?: number
  productCode?: string
  lineCode?: string
  plannedQty?: number
  workerId?: number
  inputBarcodes?: string[]
}): Promise<LotWithRelations> {
  await new Promise((r) => setTimeout(r, 300))

  const newId = MOCK_LOTS.length + 1
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const seqStr = String(newId).padStart(4, '0')

  // 입력 바코드를 lotMaterials로 변환
  const lotMaterials: LotWithRelations['lotMaterials'] = []
  if (input.inputBarcodes && input.inputBarcodes.length > 0) {
    let materialId = 1
    for (const barcode of input.inputBarcodes) {
      const parsed = parseBarcode(barcode)
      lotMaterials.push({
        id: materialId++,
        materialLotNo: barcode,
        quantity: parsed.isValid ? parsed.quantity || 1 : 1,
        material: {
          id: materialId,
          code: parsed.isValid ? parsed.productCode || barcode : barcode,
          name: parsed.isValid ? `${parsed.processCode} 반제품` : '자재',
        },
      })
    }
  }

  const newLot: LotWithRelations = {
    id: newId,
    lotNumber: `${input.processCode}${input.productCode || 'TEMP'}Q${input.plannedQty || 0}-${input.processCode[0]}${dateStr}-${seqStr}`,
    processCode: input.processCode.toUpperCase(),
    lineCode: input.lineCode || null,
    status: 'IN_PROGRESS',
    product: input.productId ? { id: input.productId, code: input.productCode || 'TEMP', name: '임시 제품' } : null,
    worker: input.workerId ? { id: input.workerId, name: '작업자' } : null,
    plannedQty: input.plannedQty || 0,
    completedQty: 0,
    defectQty: 0,
    carryOverIn: 0,
    carryOverOut: 0,
    startedAt: new Date(),
    completedAt: null,
    lotMaterials,
  }

  MOCK_LOTS.push(newLot)
  return newLot
}

/**
 * 생산 작업 완료 (Mock)
 */
export async function completeProduction(input: {
  lotId: number
  completedQty: number
  defectQty?: number
}): Promise<LotWithRelations> {
  await new Promise((r) => setTimeout(r, 300))

  const lot = MOCK_LOTS.find((l) => l.id === input.lotId)
  if (!lot) throw new Error('LOT not found')

  lot.status = 'COMPLETED'
  lot.completedQty = input.completedQty
  lot.defectQty = input.defectQty || 0
  lot.completedAt = new Date()

  return lot
}

/**
 * LOT 수량 업데이트 (Mock)
 */
export async function updateLotQuantity(
  lotId: number,
  updates: { plannedQty?: number; completedQty?: number; defectQty?: number }
): Promise<LotWithRelations> {
  await new Promise((r) => setTimeout(r, 200))

  const lot = MOCK_LOTS.find((l) => l.id === lotId)
  if (!lot) throw new Error('LOT not found')

  if (updates.plannedQty !== undefined) lot.plannedQty = updates.plannedQty
  if (updates.completedQty !== undefined) lot.completedQty = updates.completedQty
  if (updates.defectQty !== undefined) lot.defectQty = updates.defectQty

  return lot
}

/**
 * 생산 작업 시작 (Mock)
 */
export async function startProduction(
  lotId: number,
  lineCode: string,
  workerId?: number
): Promise<LotWithRelations> {
  await new Promise((r) => setTimeout(r, 200))

  const lot = MOCK_LOTS.find((l) => l.id === lotId)
  if (!lot) throw new Error('LOT not found')

  lot.lineCode = lineCode
  lot.status = 'IN_PROGRESS'
  lot.startedAt = new Date()
  if (workerId) {
    lot.worker = { id: workerId, name: `작업자${workerId}` }
  }

  return lot
}

/**
 * 자재 투입 (Mock)
 */
export async function addMaterial(input: {
  lotId: number
  materialBarcode: string
  materialId: number
  quantity: number
}): Promise<{ lotMaterialId: number; lot: LotWithRelations }> {
  await new Promise((r) => setTimeout(r, 200))

  const lot = MOCK_LOTS.find((l) => l.id === input.lotId)
  if (!lot) throw new Error('LOT not found')

  const newMaterialId = (lot.lotMaterials.length > 0
    ? Math.max(...lot.lotMaterials.map((m) => m.id))
    : 0) + 1

  lot.lotMaterials.push({
    id: newMaterialId,
    materialLotNo: input.materialBarcode,
    quantity: input.quantity,
    material: { id: input.materialId, code: 'MAT-XXX', name: '자재' },
  })

  return { lotMaterialId: newMaterialId, lot }
}

/**
 * 자재 투입 취소 (Mock)
 */
export async function removeMaterial(lotMaterialId: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 150))

  for (const lot of MOCK_LOTS) {
    const index = lot.lotMaterials.findIndex((m) => m.id === lotMaterialId)
    if (index !== -1) {
      lot.lotMaterials.splice(index, 1)
      return
    }
  }
}

/**
 * 상태별 LOT 조회 (Mock)
 */
export async function getLotsByStatus(
  status: LotStatus,
  options?: { processCode?: string; limit?: number }
): Promise<LotWithRelations[]> {
  await new Promise((r) => setTimeout(r, 200))

  let filtered = MOCK_LOTS.filter((l) => l.status === status)

  if (options?.processCode) {
    filtered = filtered.filter((l) => l.processCode === options.processCode!.toUpperCase())
  }

  if (options?.limit) {
    filtered = filtered.slice(0, options.limit)
  }

  return filtered
}

/**
 * 생산 데이터 초기화 (모든 LOT 삭제)
 */
export function resetProductionData(): number {
  const count = MOCK_LOTS.length
  MOCK_LOTS.length = 0
  MOCK_CARRY_OVERS.length = 0
  return count
}

// ============================================
// Mock CarryOver Storage
// ============================================

interface MockCarryOver {
  id: number
  processCode: string
  productId: number
  lineCode: string
  sourceDate: Date
  sourceLotNo: string
  quantity: number
  usedQty: number
  targetLotNo: string | null
  isUsed: boolean
}

const MOCK_CARRY_OVERS: MockCarryOver[] = []

// ============================================
// 2단계 생산 워크플로우 (Mock)
// ============================================

/**
 * 2단계 워크플로우 - 생산 시작 (Mock)
 */
export async function startNewProduction(input: StartProductionInput): Promise<LotWithRelations> {
  await new Promise((r) => setTimeout(r, 300))

  const newId = MOCK_LOTS.length + 1
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const seqStr = String(newId).padStart(4, '0')

  const processCode = input.processCode.toUpperCase()
  const productCode = input.productCode || 'TEMP'
  const shortCode = processCode[0]

  // V2 바코드 형식
  const lotNumber = `${processCode}${productCode}Q${input.plannedQty}-${shortCode}${dateStr}-${seqStr}`

  // 이월 사용 시 CarryOver 업데이트
  if (input.carryOverId && input.carryOverQty && input.carryOverQty > 0) {
    const carryOver = MOCK_CARRY_OVERS.find((c) => c.id === input.carryOverId)
    if (carryOver) {
      carryOver.usedQty += input.carryOverQty
      carryOver.targetLotNo = lotNumber
      carryOver.isUsed = true
    }
  }

  const newLot: LotWithRelations = {
    id: newId,
    lotNumber,
    processCode,
    lineCode: input.lineCode || null,
    status: 'IN_PROGRESS',
    product: input.productId
      ? { id: input.productId, code: productCode, name: input.productName || '제품' }
      : null,
    worker: input.workerId
      ? { id: input.workerId, name: `작업자${input.workerId}` }
      : null,
    plannedQty: input.plannedQty,
    completedQty: 0,
    defectQty: 0,
    carryOverIn: input.carryOverQty || 0,
    carryOverOut: 0,
    startedAt: new Date(),
    completedAt: null,
    lotMaterials: [],
  }

  MOCK_LOTS.push(newLot)
  return newLot
}

/**
 * 2단계 워크플로우 - 생산 완료 (Mock)
 */
export async function completeProductionV2(input: CompleteProductionInput): Promise<LotWithRelations> {
  await new Promise((r) => setTimeout(r, 300))

  const lot = MOCK_LOTS.find((l) => l.id === input.lotId)
  if (!lot) {
    throw new Error(`LOT을 찾을 수 없습니다: ${input.lotId}`)
  }

  if (lot.status !== 'IN_PROGRESS') {
    throw new Error(`진행 중인 LOT만 완료할 수 있습니다. 현재 상태: ${lot.status}`)
  }

  // 이월 생성
  if (input.createCarryOver && input.carryOverQty && input.carryOverQty > 0 && lot.product) {
    const newCarryOverId = MOCK_CARRY_OVERS.length + 1
    MOCK_CARRY_OVERS.push({
      id: newCarryOverId,
      processCode: lot.processCode,
      productId: lot.product.id,
      lineCode: lot.lineCode || '',
      sourceDate: new Date(),
      sourceLotNo: lot.lotNumber,
      quantity: input.carryOverQty,
      usedQty: 0,
      targetLotNo: null,
      isUsed: false,
    })
  }

  // LOT 완료 처리
  lot.status = 'COMPLETED'
  lot.completedQty = input.completedQty
  lot.defectQty = input.defectQty || 0
  lot.carryOverOut = input.carryOverQty || 0
  lot.completedAt = new Date()

  return lot
}

/**
 * 진행 중인 LOT 삭제 (Mock)
 */
export async function deleteInProgressProduction(
  lotId: number,
  options: { hardDelete?: boolean } = {}
): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))

  const lotIndex = MOCK_LOTS.findIndex((l) => l.id === lotId)
  if (lotIndex === -1) {
    throw new Error(`LOT을 찾을 수 없습니다: ${lotId}`)
  }

  const lot = MOCK_LOTS[lotIndex]
  if (lot.status !== 'IN_PROGRESS') {
    throw new Error(`진행 중인 LOT만 삭제할 수 있습니다. 현재 상태: ${lot.status}`)
  }

  // 이월 사용 롤백
  if (lot.carryOverIn > 0) {
    const carryOver = MOCK_CARRY_OVERS.find((c) => c.targetLotNo === lot.lotNumber)
    if (carryOver) {
      carryOver.usedQty -= lot.carryOverIn
      carryOver.targetLotNo = null
      carryOver.isUsed = false
    }
  }

  if (options.hardDelete) {
    MOCK_LOTS.splice(lotIndex, 1)
  } else {
    lot.status = 'CANCELLED'
  }
}

/**
 * 진행 중인 LOT 목록 조회 (Mock)
 */
export async function getInProgressLots(options?: {
  processCode?: string
  lineCode?: string
  workerId?: number
  limit?: number
}): Promise<LotWithRelations[]> {
  await new Promise((r) => setTimeout(r, 200))

  let filtered = MOCK_LOTS.filter((l) => l.status === 'IN_PROGRESS')

  if (options?.processCode) {
    filtered = filtered.filter((l) => l.processCode === options.processCode!.toUpperCase())
  }

  if (options?.lineCode) {
    filtered = filtered.filter((l) => l.lineCode === options.lineCode)
  }

  if (options?.workerId) {
    filtered = filtered.filter((l) => l.worker?.id === options.workerId)
  }

  if (options?.limit) {
    filtered = filtered.slice(0, options.limit)
  }

  return filtered
}

/**
 * LOT 상태 확인 유틸리티
 */
export function isLotInProgress(lot: LotWithRelations): boolean {
  return lot.status === 'IN_PROGRESS'
}

export function isLotCompleted(lot: LotWithRelations): boolean {
  return lot.status === 'COMPLETED'
}

/**
 * CarryOver 목록 조회 (Mock)
 */
export async function getCarryOvers(options?: {
  processCode?: string
  productId?: number
  isUsed?: boolean
}): Promise<MockCarryOver[]> {
  await new Promise((r) => setTimeout(r, 100))

  let filtered = [...MOCK_CARRY_OVERS]

  if (options?.processCode) {
    filtered = filtered.filter((c) => c.processCode === options.processCode!.toUpperCase())
  }

  if (options?.productId) {
    filtered = filtered.filter((c) => c.productId === options.productId)
  }

  if (options?.isUsed !== undefined) {
    filtered = filtered.filter((c) => c.isUsed === options.isUsed)
  }

  return filtered
}

// ============================================
// 공정별 입력 검증 (Phase 3 - Mock)
// ============================================

/**
 * 입력 자재 검증 옵션
 */
export interface ValidateInputOptions {
  skipValidation?: boolean
  allowWarnings?: boolean
}

/**
 * 자재 투입 검증 결과와 함께 반환
 */
export interface AddMaterialWithValidationResult {
  lotMaterialId: number
  lot: LotWithRelations
  validationResult: ValidationResult
}

// Re-export validation functions
export {
  validateBarcodes,
  createInputsFromBarcodes,
  isValidProcessCode,
  PROCESS_INPUT_RULES,
  PROCESS_NAMES,
}
export type { ProcessCode, InputItem, ValidationResult, InputType }

/**
 * 공정에서 입력 바코드 검증 (Mock)
 */
export function validateProcessInputs(
  processCode: string,
  barcodes: string[]
): ValidationResult {
  return validateBarcodes(processCode, barcodes)
}

/**
 * 자재 투입 전 검증 (Mock)
 */
export async function validateMaterialInput(
  lotId: number,
  materialBarcode: string
): Promise<ValidationResult> {
  await new Promise((r) => setTimeout(r, 100))

  const lot = MOCK_LOTS.find((l) => l.id === lotId)

  if (!lot) {
    return {
      isValid: false,
      errors: [{
        code: 'LOT_NOT_FOUND',
        message: `LOT을 찾을 수 없습니다: ${lotId}`,
      }],
      warnings: [],
      validatedInputs: [],
    }
  }

  return validateBarcodes(lot.processCode, [materialBarcode])
}

/**
 * 자재 투입 등록 (검증 포함) (Mock)
 */
export async function addMaterialWithValidation(
  input: {
    lotId: number
    materialBarcode: string
    materialId: number
    quantity: number
  },
  options: ValidateInputOptions = {}
): Promise<AddMaterialWithValidationResult> {
  await new Promise((r) => setTimeout(r, 200))

  const { skipValidation = false } = options
  const { lotId, materialBarcode, materialId, quantity } = input

  const lot = MOCK_LOTS.find((l) => l.id === lotId)
  if (!lot) {
    throw new Error(`LOT을 찾을 수 없습니다: ${lotId}`)
  }

  // 검증 실행
  const validationResult = validateBarcodes(lot.processCode, [materialBarcode])

  // 검증 실패 시 에러
  if (!skipValidation && !validationResult.isValid) {
    const errorMessage = validationResult.errors.map(e => e.message).join('; ')
    throw new Error(`입력 검증 실패: ${errorMessage}`)
  }

  // 자재 투입 기록 생성
  const newMaterialId = (lot.lotMaterials.length > 0
    ? Math.max(...lot.lotMaterials.map((m) => m.id))
    : 0) + 1

  lot.lotMaterials.push({
    id: newMaterialId,
    materialLotNo: materialBarcode,
    quantity,
    material: { id: materialId, code: `MAT-${materialId}`, name: '자재' },
  })

  return {
    lotMaterialId: newMaterialId,
    lot,
    validationResult,
  }
}

/**
 * 여러 자재 일괄 투입 (검증 포함) (Mock)
 */
export async function addMaterialsBatch(
  lotId: number,
  materials: Array<{
    materialBarcode: string
    materialId: number
    quantity: number
  }>,
  options: ValidateInputOptions = {}
): Promise<{
  results: Array<{ lotMaterialId: number; barcode: string }>
  lot: LotWithRelations
  validationResult: ValidationResult
}> {
  await new Promise((r) => setTimeout(r, 300))

  const { skipValidation = false } = options

  const lot = MOCK_LOTS.find((l) => l.id === lotId)
  if (!lot) {
    throw new Error(`LOT을 찾을 수 없습니다: ${lotId}`)
  }

  // 전체 바코드 검증
  const barcodes = materials.map(m => m.materialBarcode)
  const validationResult = validateBarcodes(lot.processCode, barcodes)

  // 검증 실패 시 에러
  if (!skipValidation && !validationResult.isValid) {
    const errorMessage = validationResult.errors.map(e => e.message).join('; ')
    throw new Error(`입력 검증 실패: ${errorMessage}`)
  }

  // 자재 일괄 투입
  const results: Array<{ lotMaterialId: number; barcode: string }> = []

  for (const material of materials) {
    const newMaterialId = (lot.lotMaterials.length > 0
      ? Math.max(...lot.lotMaterials.map((m) => m.id))
      : 0) + 1

    lot.lotMaterials.push({
      id: newMaterialId,
      materialLotNo: material.materialBarcode,
      quantity: material.quantity,
      material: { id: material.materialId, code: `MAT-${material.materialId}`, name: '자재' },
    })

    results.push({
      lotMaterialId: newMaterialId,
      barcode: material.materialBarcode,
    })
  }

  return {
    results,
    lot,
    validationResult,
  }
}

/**
 * 공정별 허용 입력 타입 조회 (Mock)
 */
export function getAllowedInputTypes(processCode: string): InputType[] | null {
  const normalized = processCode.toUpperCase()
  if (!isValidProcessCode(normalized)) {
    return null
  }
  return PROCESS_INPUT_RULES[normalized as ProcessCode]
}

/**
 * 입력 바코드 타입 추론 (Mock)
 */
export function inferBarcodeInputType(barcode: string): InputType {
  const parsed = parseBarcode(barcode)

  if (!parsed.isValid) {
    return 'material'
  }

  const processCode = parsed.processCode.toUpperCase()

  if (processCode === 'CI' || processCode === 'VI') {
    return 'production'
  }

  if (isValidProcessCode(processCode)) {
    return 'semi_product'
  }

  return 'material'
}
