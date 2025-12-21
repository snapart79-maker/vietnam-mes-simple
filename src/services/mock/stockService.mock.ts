/**
 * Stock Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * Phase 4: BOM 기반 자재 차감
 */

import { calculateRequiredMaterials, type CalculatedRequirement } from './bomService.mock'

// ============================================
// Types
// ============================================

export interface ReceiveStockInput {
  materialId: number
  materialCode: string
  lotNumber: string
  quantity: number
  receivedAt?: Date
}

export interface ReceivingRecord {
  id: number
  lotNumber: string
  quantity: number
  receivedAt: Date
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
  receivedAt: Date
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

// ============================================
// Mock Data Storage
// ============================================

// Mock 입고 기록 (초기 데이터 없음 - 공장초기화 상태)
const mockReceivings: ReceivingRecord[] = []

// Mock 재고 (LOT별)
const MOCK_STOCKS: StockItem[] = []

// Mock LOT 자재 사용 기록
const MOCK_LOT_MATERIALS: Array<{
  id: number
  productionLotId: number
  materialId: number
  materialLotNo: string
  quantity: number
}> = []

// ============================================
// Stock Receiving (Mock)
// ============================================

/**
 * 자재 입고 처리 (Mock)
 */
export async function receiveStock(input: ReceiveStockInput): Promise<ReceiveStockResult> {
  await new Promise((r) => setTimeout(r, 300))

  const newId = MOCK_STOCKS.length + 1
  const stockItem: StockItem = {
    id: newId,
    materialId: input.materialId,
    materialCode: input.materialCode,
    materialName: '자재명',
    lotNumber: input.lotNumber,
    quantity: input.quantity,
    usedQty: 0,
    availableQty: input.quantity,
    receivedAt: input.receivedAt || new Date(),
  }

  MOCK_STOCKS.push(stockItem)

  mockReceivings.push({
    id: newId,
    lotNumber: input.lotNumber,
    quantity: input.quantity,
    receivedAt: input.receivedAt || new Date(),
    material: { code: input.materialCode, name: '자재명', unit: 'EA' },
  })

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
  return mockReceivings
}

// ============================================
// Stock Queries (Mock)
// ============================================

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
  return stocks.reduce((sum, s) => sum + (s.quantity - s.usedQty), 0)
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
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
  )

  let remainingQty = quantity
  const usedLots: Array<{ lotNumber: string; usedQty: number }> = []
  let totalDeducted = 0

  // 가용 재고에서 차감
  for (const stock of stocks) {
    if (remainingQty <= 0) break

    const availableQty = stock.quantity - stock.usedQty
    if (availableQty <= 0) continue

    const useQty = Math.min(availableQty, remainingQty)
    stock.usedQty += useQty
    stock.availableQty = stock.quantity - stock.usedQty

    if (productionLotId) {
      MOCK_LOT_MATERIALS.push({
        id: MOCK_LOT_MATERIALS.length + 1,
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
      MOCK_LOT_MATERIALS.push({
        id: MOCK_LOT_MATERIALS.length + 1,
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
// Data Reset (Mock)
// ============================================

/**
 * 재고 데이터 초기화 (모든 입고 기록 삭제)
 */
export function resetStockData(): number {
  const count = mockReceivings.length + MOCK_STOCKS.length
  mockReceivings.length = 0
  MOCK_STOCKS.length = 0
  MOCK_LOT_MATERIALS.length = 0
  return count
}

/**
 * Mock 재고 데이터 추가 (테스트용)
 */
export function addMockStock(stock: StockItem): void {
  MOCK_STOCKS.push(stock)
}

// Re-export types
export type { CalculatedRequirement }
