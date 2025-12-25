/**
 * Production Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * Phase 1: localStorage 영속화 지원
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
import {
  parseBarcode,
  generateTempLotNumber,
  generateCompletionLotNumber,
  isTempLotNumber,
} from '../barcodeService'
import { getNextSequence } from './sequenceService.mock'

// ============================================
// LocalStorage Keys & Persistence
// ============================================

const STORAGE_KEYS = {
  LOTS: 'vietnam_mes_production_lots',
  CARRY_OVERS: 'vietnam_mes_carry_overs',
}

// Date 필드를 가진 객체의 직렬화/역직렬화를 위한 타입
interface SerializedLot {
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
  startedAt: string  // ISO string
  completedAt: string | null  // ISO string
  crimpCode?: string  // CA 공정 절압착 품번
  lotMaterials: Array<{
    id: number
    materialLotNo: string
    quantity: number
    materialCode?: string
    materialName?: string
    material: {
      id: number
      code: string
      name: string
    }
  }>
}

interface SerializedCarryOver {
  id: number
  processCode: string
  productId: number
  lineCode: string
  sourceDate: string  // ISO string
  sourceLotNo: string
  quantity: number
  usedQty: number
  targetLotNo: string | null
  isUsed: boolean
}

// 데이터 로드 (with Date 변환)
function loadLotsFromStorage(): LotWithRelations[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LOTS)
    if (stored) {
      const parsed: SerializedLot[] = JSON.parse(stored)
      return parsed.map((lot) => ({
        ...lot,
        startedAt: new Date(lot.startedAt),
        completedAt: lot.completedAt ? new Date(lot.completedAt) : null,
      }))
    }
  } catch (error) {
    console.error('Failed to load production lots from localStorage:', error)
  }
  return []
}

function loadCarryOversFromStorage(): MockCarryOver[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CARRY_OVERS)
    if (stored) {
      const parsed: SerializedCarryOver[] = JSON.parse(stored)
      return parsed.map((co) => ({
        ...co,
        sourceDate: new Date(co.sourceDate),
      }))
    }
  } catch (error) {
    console.error('Failed to load carry overs from localStorage:', error)
  }
  return []
}

// 데이터 저장
function saveLots(): void {
  try {
    const serialized: SerializedLot[] = MOCK_LOTS.map((lot) => ({
      ...lot,
      startedAt: lot.startedAt.toISOString(),
      completedAt: lot.completedAt ? lot.completedAt.toISOString() : null,
    }))
    localStorage.setItem(STORAGE_KEYS.LOTS, JSON.stringify(serialized))
  } catch (error) {
    console.error('Failed to save production lots to localStorage:', error)
  }
}

function saveCarryOvers(): void {
  try {
    const serialized: SerializedCarryOver[] = MOCK_CARRY_OVERS.map((co) => ({
      ...co,
      sourceDate: co.sourceDate.toISOString(),
    }))
    localStorage.setItem(STORAGE_KEYS.CARRY_OVERS, JSON.stringify(serialized))
  } catch (error) {
    console.error('Failed to save carry overs to localStorage:', error)
  }
}

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
  // CA 공정 절압착 품번
  crimpCode?: string
  lotMaterials: Array<{
    id: number
    materialLotNo: string
    quantity: number
    // 자재 정보 (전표 출력용)
    materialCode?: string
    materialName?: string
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

// Mock LOT 데이터 (localStorage에서 로드)
let MOCK_LOTS: LotWithRelations[] = loadLotsFromStorage()

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
 * LOT 목록 조회 (날짜 범위 지원)
 * @param processCode 공정 코드 (선택)
 * @param days 조회 기간 (일 수, 기본값: 30일)
 */
export async function getTodayLots(processCode?: string, days: number = 30): Promise<LotWithRelations[]> {
  await new Promise((r) => setTimeout(r, 200))

  // 날짜 범위 계산
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  let filtered = MOCK_LOTS.filter((lot) => {
    const lotDate = new Date(lot.startedAt)
    return lotDate >= startDate && lotDate <= endDate
  })

  if (processCode) {
    filtered = filtered.filter((l) => l.processCode === processCode.toUpperCase())
  }

  // 최신순 정렬
  return filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

/**
 * 날짜 범위로 LOT 목록 조회
 */
export async function getLotsByDateRange(
  processCode: string,
  startDate: Date,
  endDate: Date
): Promise<LotWithRelations[]> {
  await new Promise((r) => setTimeout(r, 100))

  return MOCK_LOTS.filter((lot) => {
    const lotDate = new Date(lot.startedAt)
    const matchDate = lotDate >= startDate && lotDate <= endDate
    const matchProcess = processCode ? lot.processCode === processCode.toUpperCase() : true
    return matchDate && matchProcess
  }).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
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
  crimpCode?: string  // CA 공정 절압착 품번
  // 자재 상세 정보 (바코드, 코드, 이름 포함)
  inputMaterialDetails?: Array<{
    barcode: string
    materialCode?: string
    materialName?: string
    quantity?: number
  }>
}): Promise<LotWithRelations> {
  await new Promise((r) => setTimeout(r, 300))

  const newId = MOCK_LOTS.length + 1
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const seqStr = String(newId).padStart(4, '0')

  // 입력 바코드를 lotMaterials로 변환
  const lotMaterials: LotWithRelations['lotMaterials'] = []

  // 자재 상세 정보가 있는 경우 우선 사용
  if (input.inputMaterialDetails && input.inputMaterialDetails.length > 0) {
    let materialId = 1
    for (const detail of input.inputMaterialDetails) {
      lotMaterials.push({
        id: materialId++,
        materialLotNo: detail.barcode,
        quantity: detail.quantity || 1,
        materialCode: detail.materialCode,
        materialName: detail.materialName,
        material: {
          id: materialId,
          code: detail.materialCode || detail.barcode,
          name: detail.materialName || '자재',
        },
      })
    }
  } else if (input.inputBarcodes && input.inputBarcodes.length > 0) {
    // 기존 바코드 기반 처리 (하위 호환성)
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

  // 작업 등록 시에는 임시 LOT 번호 생성 (완료 시 최종 LOT 번호 부여)
  const tempLotNumber = generateTempLotNumber(input.processCode)

  const newLot: LotWithRelations = {
    id: newId,
    lotNumber: tempLotNumber,
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
    crimpCode: input.crimpCode,  // CA 공정 절압착 품번 저장
    lotMaterials,
  }

  MOCK_LOTS.push(newLot)
  saveLots()
  return newLot
}

/**
 * 생산 작업 완료 (Mock)
 *
 * 완료 시점에 최종 LOT 번호를 생성합니다.
 * 형식: {공정코드}{반제품품번}Q{완료수량}-{YYMMDD}-{일련번호}
 * 예: CA00315452-001Q100-241224-001
 */
export async function completeProduction(input: {
  lotId: number
  completedQty: number
  defectQty?: number
  semiProductCode?: string  // 반제품 품번 (CA 공정의 경우 절압착품번)
}): Promise<LotWithRelations> {
  await new Promise((r) => setTimeout(r, 300))

  const lot = MOCK_LOTS.find((l) => l.id === input.lotId)
  if (!lot) throw new Error('LOT not found')

  // 임시 LOT 번호인 경우에만 최종 LOT 번호 생성
  if (isTempLotNumber(lot.lotNumber)) {
    // 반제품 품번: 입력값 > crimpCode > productCode > 'UNKNOWN'
    const semiProductCode = input.semiProductCode || lot.crimpCode || lot.product?.code || 'UNKNOWN'

    // 완료 시점에 일련번호 생성 (공정코드 기반)
    const seqResult = await getNextSequence(`COMPLETION_${lot.processCode}`, new Date(), 3)

    // 최종 LOT 번호 생성
    const finalLotNumber = generateCompletionLotNumber(
      lot.processCode,
      semiProductCode,
      input.completedQty,
      seqResult.sequence
    )

    lot.lotNumber = finalLotNumber
  }

  lot.status = 'COMPLETED'
  lot.completedQty = input.completedQty
  lot.defectQty = input.defectQty || 0
  lot.completedAt = new Date()

  saveLots()
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

  saveLots()
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

  saveLots()
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

  saveLots()
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
      saveLots()
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
  // localStorage도 초기화
  localStorage.removeItem(STORAGE_KEYS.LOTS)
  localStorage.removeItem(STORAGE_KEYS.CARRY_OVERS)
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

let MOCK_CARRY_OVERS: MockCarryOver[] = loadCarryOversFromStorage()

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
  saveLots()
  if (input.carryOverId) {
    saveCarryOvers()
  }
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

  saveLots()
  if (input.createCarryOver && input.carryOverQty && input.carryOverQty > 0) {
    saveCarryOvers()
  }
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

  saveLots()
  if (lot.carryOverIn > 0) {
    saveCarryOvers()
  }
}

/**
 * LOT 삭제 (Mock) - 모든 상태 삭제 가능
 * @param lotId LOT ID
 * @param options.hardDelete true면 완전 삭제, false면 CANCELLED 상태로 변경
 */
export async function deleteLot(
  lotId: number,
  options: { hardDelete?: boolean } = { hardDelete: true }
): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))

  const lotIndex = MOCK_LOTS.findIndex((l) => l.id === lotId)
  if (lotIndex === -1) {
    throw new Error(`LOT을 찾을 수 없습니다: ${lotId}`)
  }

  const lot = MOCK_LOTS[lotIndex]

  // 이월 사용 롤백 (진행 중인 LOT인 경우)
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

  saveLots()
  if (lot.carryOverIn > 0) {
    saveCarryOvers()
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

  saveLots()
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

  saveLots()
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
