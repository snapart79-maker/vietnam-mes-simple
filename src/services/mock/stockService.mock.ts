/**
 * Stock Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * Phase 4: BOM 기반 자재 차감
 * - localStorage 영속화 지원
 */

import { calculateRequiredMaterials, type CalculatedRequirement } from './bomService.mock'

// ============================================
// Types
// ============================================

export interface ReceiveStockInput {
  materialId: number
  materialCode: string
  materialName?: string
  lotNumber: string
  quantity: number
  receivedAt?: Date | string
}

export interface ReceivingRecord {
  id: number
  lotNumber: string
  quantity: number
  receivedAt: string  // ISO string for localStorage
  material: {
    code: string
    name: string
    unit: string
  }
}

export interface ReceiveStockResult {
  success: boolean
  id: number
  stock?: {
    id: number
    materialId: number
    lotNumber: string
    quantity: number
  }
  error?: string
}

export interface StockItem {
  id: number
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  usedQty: number
  availableQty: number
  receivedAt: string  // ISO string for localStorage
}

export interface MaterialInput {
  materialId: number
  lotNumber?: string
  quantity?: number
}

export interface DeductionItem {
  materialId: number
  materialCode: string
  materialName: string
  requiredQty: number
  deductedQty: number
  remainingQty: number
  lots: Array<{ lotNumber: string; usedQty: number }>
  success: boolean
  allowedNegative: boolean
  error?: string
}

export interface DeductionResult {
  success: boolean
  productId: number
  processCode: string
  productionQty: number
  allowNegative: boolean
  items: DeductionItem[]
  totalRequired: number
  totalDeducted: number
  errors: string[]
}

export interface LotMaterialRecord {
  id: number
  productionLotId: number
  materialId: number
  materialLotNo: string
  quantity: number
}

// ============================================
// LocalStorage Keys & Persistence
// ============================================

const STORAGE_KEYS = {
  RECEIVINGS: 'vietnam_mes_receivings',
  STOCKS: 'vietnam_mes_stocks',
  LOT_MATERIALS: 'vietnam_mes_lot_materials',
}

// 데이터 로드
function loadFromStorage<T>(key: string, defaultValue: T[]): T[] {
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error(`Failed to load ${key} from localStorage:`, error)
  }
  return defaultValue
}

// 데이터 저장
function saveToStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error)
  }
}

// ============================================
// Mock Data Storage (with localStorage)
// ============================================

// Mock 입고 기록
let mockReceivings: ReceivingRecord[] = loadFromStorage(STORAGE_KEYS.RECEIVINGS, [])

// Mock 재고 (LOT별)
let MOCK_STOCKS: StockItem[] = loadFromStorage(STORAGE_KEYS.STOCKS, [])

// Mock LOT 자재 사용 기록
let MOCK_LOT_MATERIALS: LotMaterialRecord[] = loadFromStorage(STORAGE_KEYS.LOT_MATERIALS, [])

// 저장 헬퍼 함수들
function saveReceivings(): void {
  saveToStorage(STORAGE_KEYS.RECEIVINGS, mockReceivings)
}

function saveStocks(): void {
  saveToStorage(STORAGE_KEYS.STOCKS, MOCK_STOCKS)
}

function saveLotMaterials(): void {
  saveToStorage(STORAGE_KEYS.LOT_MATERIALS, MOCK_LOT_MATERIALS)
}

// ============================================
// Stock Receiving (Mock)
// ============================================

/**
 * LOT 번호 중복 체크
 */
export function isLotExists(lotNumber: string): boolean {
  return MOCK_STOCKS.some(s => s.lotNumber === lotNumber)
}

/**
 * 자재 입고 처리 (Mock)
 */
export async function receiveStock(input: ReceiveStockInput): Promise<ReceiveStockResult> {
  await new Promise((r) => setTimeout(r, 300))

  // 중복 LOT 체크
  if (isLotExists(input.lotNumber)) {
    return {
      success: false,
      id: 0,
      error: `LOT ${input.lotNumber}은(는) 이미 등록되어 있습니다.`,
    }
  }

  const newId = MOCK_STOCKS.length > 0 ? Math.max(...MOCK_STOCKS.map(s => s.id)) + 1 : 1
  const receivedAt = input.receivedAt
    ? (typeof input.receivedAt === 'string' ? input.receivedAt : input.receivedAt.toISOString())
    : new Date().toISOString()

  const stockItem: StockItem = {
    id: newId,
    materialId: input.materialId,
    materialCode: input.materialCode,
    materialName: input.materialName || input.materialCode,
    lotNumber: input.lotNumber,
    quantity: input.quantity,
    usedQty: 0,
    availableQty: input.quantity,
    receivedAt,
  }

  MOCK_STOCKS.push(stockItem)
  saveStocks()

  const receivingRecord: ReceivingRecord = {
    id: newId,
    lotNumber: input.lotNumber,
    quantity: input.quantity,
    receivedAt,
    material: {
      code: input.materialCode,
      name: input.materialName || input.materialCode,
      unit: 'EA',
    },
  }

  mockReceivings.push(receivingRecord)
  saveReceivings()

  return {
    success: true,
    id: newId,
    stock: {
      id: newId,
      materialId: input.materialId,
      lotNumber: input.lotNumber,
      quantity: input.quantity,
    },
  }
}

/**
 * 금일 입고 내역 조회 (Mock)
 */
export async function getTodayReceivings(): Promise<ReceivingRecord[]> {
  await new Promise((r) => setTimeout(r, 200))

  const today = new Date().toISOString().split('T')[0]
  return mockReceivings.filter((r) => r.receivedAt.startsWith(today))
}

/**
 * 전체 입고 이력 조회 (Mock)
 */
export async function getAllReceivings(options?: {
  startDate?: string
  endDate?: string
  materialCode?: string
  limit?: number
}): Promise<ReceivingRecord[]> {
  await new Promise((r) => setTimeout(r, 200))

  let result = [...mockReceivings]

  // 날짜 필터
  if (options?.startDate) {
    result = result.filter((r) => r.receivedAt >= options.startDate!)
  }
  if (options?.endDate) {
    result = result.filter((r) => r.receivedAt <= options.endDate! + 'T23:59:59')
  }

  // 자재 코드 필터
  if (options?.materialCode) {
    result = result.filter((r) =>
      r.material.code.toLowerCase().includes(options.materialCode!.toLowerCase())
    )
  }

  // 최신순 정렬
  result.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  // 개수 제한
  if (options?.limit) {
    result = result.slice(0, options.limit)
  }

  return result
}

// ============================================
// Stock Queries (Mock)
// ============================================

/**
 * 전체 LOT별 재고 조회 (Mock)
 */
export async function getAllStocks(options?: {
  materialCode?: string
  showZero?: boolean
}): Promise<StockItem[]> {
  await new Promise((r) => setTimeout(r, 100))

  let result = [...MOCK_STOCKS]

  // 자재 코드 필터
  if (options?.materialCode) {
    result = result.filter((s) =>
      s.materialCode.toLowerCase().includes(options.materialCode!.toLowerCase()) ||
      s.materialName.toLowerCase().includes(options.materialCode!.toLowerCase())
    )
  }

  // 소진 재고 숨기기
  if (!options?.showZero) {
    result = result.filter((s) => s.availableQty > 0)
  }

  // 최신순 정렬
  result.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return result
}

/**
 * 자재별 재고 조회 (Mock)
 */
export async function getStockByMaterial(materialId: number): Promise<StockItem[]> {
  await new Promise((r) => setTimeout(r, 100))
  return MOCK_STOCKS.filter((s) => s.materialId === materialId)
}

/**
 * 자재별 가용 재고 수량 조회 (Mock)
 */
export async function getAvailableQty(materialId: number): Promise<number> {
  await new Promise((r) => setTimeout(r, 50))

  const stocks = MOCK_STOCKS.filter((s) => s.materialId === materialId)
  return stocks.reduce((sum, s) => sum + s.availableQty, 0)
}

/**
 * 자재 코드로 가용 재고 수량 조회 (Mock)
 */
export async function getAvailableQtyByCode(materialCode: string): Promise<number> {
  await new Promise((r) => setTimeout(r, 50))

  const stocks = MOCK_STOCKS.filter((s) => s.materialCode === materialCode)
  return stocks.reduce((sum, s) => sum + s.availableQty, 0)
}

/**
 * 재고 요약 통계 조회 (Mock)
 */
export async function getStockSummary(): Promise<{
  totalLots: number
  totalQuantity: number
  totalAvailable: number
  totalUsed: number
  materialCount: number
}> {
  await new Promise((r) => setTimeout(r, 100))

  const materialCodes = new Set(MOCK_STOCKS.map((s) => s.materialCode))

  return {
    totalLots: MOCK_STOCKS.length,
    totalQuantity: MOCK_STOCKS.reduce((sum, s) => sum + s.quantity, 0),
    totalAvailable: MOCK_STOCKS.reduce((sum, s) => sum + s.availableQty, 0),
    totalUsed: MOCK_STOCKS.reduce((sum, s) => sum + s.usedQty, 0),
    materialCount: materialCodes.size,
  }
}

// ============================================
// Phase 4: BOM 기반 자재 차감 (Mock)
// ============================================

/**
 * 음수 재고 허용 FIFO 차감 (Mock)
 */
export async function consumeStockFIFOWithNegative(
  materialId: number,
  quantity: number,
  productionLotId?: number,
  allowNegative: boolean = true
): Promise<{
  lots: Array<{ lotNumber: string; usedQty: number }>
  deductedQty: number
  remainingQty: number
}> {
  await new Promise((r) => setTimeout(r, 100))

  const stocks = MOCK_STOCKS.filter((s) => s.materialId === materialId).sort(
    (a, b) => a.receivedAt.localeCompare(b.receivedAt)
  )

  let remainingQty = quantity
  const usedLots: Array<{ lotNumber: string; usedQty: number }> = []
  let totalDeducted = 0

  // 가용 재고에서 차감
  for (const stock of stocks) {
    if (remainingQty <= 0) break

    const availableQty = stock.availableQty
    if (availableQty <= 0) continue

    const useQty = Math.min(availableQty, remainingQty)
    stock.usedQty += useQty
    stock.availableQty = stock.quantity - stock.usedQty

    if (productionLotId) {
      const lotMaterialId = MOCK_LOT_MATERIALS.length > 0
        ? Math.max(...MOCK_LOT_MATERIALS.map(m => m.id)) + 1
        : 1

      MOCK_LOT_MATERIALS.push({
        id: lotMaterialId,
        productionLotId,
        materialId,
        materialLotNo: stock.lotNumber,
        quantity: useQty,
      })
    }

    usedLots.push({ lotNumber: stock.lotNumber, usedQty: useQty })
    totalDeducted += useQty
    remainingQty -= useQty
  }

  // 음수 허용 시 마지막 LOT에서 추가 차감
  if (remainingQty > 0 && allowNegative && stocks.length > 0) {
    const targetStock = stocks[stocks.length - 1]
    targetStock.usedQty += remainingQty
    targetStock.availableQty = targetStock.quantity - targetStock.usedQty

    if (productionLotId) {
      const lotMaterialId = MOCK_LOT_MATERIALS.length > 0
        ? Math.max(...MOCK_LOT_MATERIALS.map(m => m.id)) + 1
        : 1

      MOCK_LOT_MATERIALS.push({
        id: lotMaterialId,
        productionLotId,
        materialId,
        materialLotNo: targetStock.lotNumber,
        quantity: remainingQty,
      })
    }

    const existingLot = usedLots.find((l) => l.lotNumber === targetStock.lotNumber)
    if (existingLot) {
      existingLot.usedQty += remainingQty
    } else {
      usedLots.push({ lotNumber: targetStock.lotNumber, usedQty: remainingQty })
    }

    totalDeducted += remainingQty
    remainingQty = 0
  }

  // 변경 사항 저장
  saveStocks()
  saveLotMaterials()

  return {
    lots: usedLots,
    deductedQty: totalDeducted,
    remainingQty,
  }
}

/**
 * BOM 기반 자재 차감 (Mock)
 */
export async function deductByBOM(
  productId: number,
  processCode: string,
  productionQty: number,
  inputMaterials: MaterialInput[] = [],
  allowNegative: boolean = true,
  productionLotId?: number
): Promise<DeductionResult> {
  await new Promise((r) => setTimeout(r, 200))

  const requirements = await calculateRequiredMaterials(productId, processCode, productionQty)

  const result: DeductionResult = {
    success: true,
    productId,
    processCode,
    productionQty,
    allowNegative,
    items: [],
    totalRequired: 0,
    totalDeducted: 0,
    errors: [],
  }

  if (requirements.length === 0) {
    return result
  }

  // 스캔된 자재를 materialId로 그룹화
  const inputMap = new Map<number, MaterialInput[]>()
  for (const input of inputMaterials) {
    const existing = inputMap.get(input.materialId) || []
    existing.push(input)
    inputMap.set(input.materialId, existing)
  }

  for (const req of requirements) {
    result.totalRequired += req.requiredQty

    const item: DeductionItem = {
      materialId: req.materialId,
      materialCode: req.materialCode,
      materialName: req.materialName,
      requiredQty: req.requiredQty,
      deductedQty: 0,
      remainingQty: req.requiredQty,
      lots: [],
      success: false,
      allowedNegative: false,
    }

    try {
      const fifoResult = await consumeStockFIFOWithNegative(
        req.materialId,
        req.requiredQty,
        productionLotId,
        allowNegative
      )

      item.lots = fifoResult.lots
      item.deductedQty = fifoResult.deductedQty
      item.remainingQty = fifoResult.remainingQty
      item.success = fifoResult.remainingQty === 0

      const totalAvailable = await getAvailableQty(req.materialId)
      if (totalAvailable < 0) {
        item.allowedNegative = true
      }

      result.totalDeducted += item.deductedQty
    } catch (error) {
      item.error = error instanceof Error ? error.message : '차감 실패'
      item.success = false
    }

    if (!item.success && !allowNegative) {
      result.success = false
      result.errors.push(`${req.materialCode}: ${item.error || '차감 실패'}`)
    }

    result.items.push(item)
  }

  return result
}

/**
 * BOM 기반 차감 롤백 (Mock)
 */
export async function rollbackBOMDeduction(productionLotId: number): Promise<number> {
  await new Promise((r) => setTimeout(r, 100))

  const lotMaterials = MOCK_LOT_MATERIALS.filter((lm) => lm.productionLotId === productionLotId)
  let restoredCount = 0

  for (const lotMaterial of lotMaterials) {
    const stock = MOCK_STOCKS.find(
      (s) => s.materialId === lotMaterial.materialId && s.lotNumber === lotMaterial.materialLotNo
    )

    if (stock) {
      stock.usedQty = Math.max(0, stock.usedQty - lotMaterial.quantity)
      stock.availableQty = stock.quantity - stock.usedQty
      restoredCount++
    }

    const index = MOCK_LOT_MATERIALS.indexOf(lotMaterial)
    if (index !== -1) {
      MOCK_LOT_MATERIALS.splice(index, 1)
    }
  }

  // 변경 사항 저장
  saveStocks()
  saveLotMaterials()

  return restoredCount
}

/**
 * 자재별 가용 재고 확인 (BOM 기준) (Mock)
 */
export async function checkBOMAvailability(
  productId: number,
  processCode: string,
  productionQty: number
): Promise<{
  available: boolean
  items: Array<{
    materialId: number
    materialCode: string
    materialName: string
    requiredQty: number
    availableQty: number
    shortage: number
  }>
}> {
  await new Promise((r) => setTimeout(r, 100))

  const requirements = await calculateRequiredMaterials(productId, processCode, productionQty)

  const items = await Promise.all(
    requirements.map(async (req) => {
      const availableQty = await getAvailableQty(req.materialId)
      return {
        materialId: req.materialId,
        materialCode: req.materialCode,
        materialName: req.materialName,
        requiredQty: req.requiredQty,
        availableQty,
        shortage: Math.max(0, req.requiredQty - availableQty),
      }
    })
  )

  const available = items.every((item) => item.shortage === 0)

  return { available, items }
}

// ============================================
// Data Delete (Mock)
// ============================================

/**
 * 선택한 LOT 재고 삭제
 */
export function deleteStockItems(ids: number[]): number {
  const idsSet = new Set(ids)
  const beforeCount = MOCK_STOCKS.length
  MOCK_STOCKS = MOCK_STOCKS.filter(s => !idsSet.has(s.id))
  const deletedCount = beforeCount - MOCK_STOCKS.length

  if (deletedCount > 0) {
    saveStocks()
  }

  return deletedCount
}

/**
 * 선택한 입고 이력 삭제
 */
export function deleteReceivingRecords(ids: number[]): number {
  const idsSet = new Set(ids)
  const beforeCount = mockReceivings.length
  mockReceivings = mockReceivings.filter(r => !idsSet.has(r.id))
  const deletedCount = beforeCount - mockReceivings.length

  if (deletedCount > 0) {
    saveReceivings()
  }

  return deletedCount
}

/**
 * 전체 재고 및 입고 이력 초기화
 */
export function resetAllStockData(): { stocks: number; receivings: number; lotMaterials: number } {
  const result = {
    stocks: MOCK_STOCKS.length,
    receivings: mockReceivings.length,
    lotMaterials: MOCK_LOT_MATERIALS.length,
  }

  MOCK_STOCKS = []
  mockReceivings = []
  MOCK_LOT_MATERIALS = []

  saveStocks()
  saveReceivings()
  saveLotMaterials()

  return result
}

// ============================================
// Data Reset (Mock) - Legacy
// ============================================

/**
 * 재고 데이터 초기화 (모든 입고 기록 삭제)
 */
export function resetStockData(): number {
  const count = mockReceivings.length + MOCK_STOCKS.length
  mockReceivings = []
  MOCK_STOCKS = []
  MOCK_LOT_MATERIALS = []

  saveReceivings()
  saveStocks()
  saveLotMaterials()

  return count
}

/**
 * Mock 재고 데이터 추가 (테스트용)
 */
export function addMockStock(stock: StockItem): void {
  MOCK_STOCKS.push(stock)
  saveStocks()
}

/**
 * 일괄 입고 처리 (Excel Import용)
 */
export async function bulkReceiveStock(items: ReceiveStockInput[]): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const result = { success: 0, failed: 0, errors: [] as string[] }

  for (const item of items) {
    try {
      await receiveStock(item)
      result.success++
    } catch (error) {
      result.failed++
      result.errors.push(`${item.materialCode}: ${error instanceof Error ? error.message : '입고 실패'}`)
    }
  }

  return result
}

// Re-export types
export type { CalculatedRequirement }
