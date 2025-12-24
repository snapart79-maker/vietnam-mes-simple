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

// ============================================
// 재고 위치 타입 (Phase 5: 3단계 재고 관리)
// ============================================
export type StockLocation = 'warehouse' | 'production' | 'process'

export interface StockItem {
  id: number
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  usedQty: number
  availableQty: number
  unit?: string  // 단위 (StockContext 호환)
  receivedAt: string  // ISO string for localStorage
  location: StockLocation  // Phase 5: 재고 위치 (warehouse=자재창고, production=생산창고, process=공정)
  processCode?: string  // location='process'일 때만 사용
}

// ============================================
// Phase A: 공정별 재고 관리 Types
// ============================================

export interface ProcessStockInput {
  processCode: string
  materialId: number
  materialCode: string
  materialName?: string
  lotNumber: string
  quantity: number
  receivedAt?: Date | string
}

export interface ProcessStockResult {
  success: boolean
  id: number
  stock?: {
    id: number
    materialId: number
    lotNumber: string
    quantity: number
    availableQty: number
    processCode: string
  }
  isNewEntry: boolean  // 새로 등록인지 기존에 추가인지
  error?: string
}

export interface ProcessStockStatus {
  exists: boolean
  lotNumber: string
  processCode: string
  quantity: number
  usedQty: number
  availableQty: number
  isExhausted: boolean  // 완전 소진 여부
  canRegister: boolean  // 추가 등록 가능 여부
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
 * - location='warehouse'로 자재 창고에 입고
 */
export async function receiveStock(input: ReceiveStockInput): Promise<ReceiveStockResult> {
  await new Promise((r) => setTimeout(r, 300))

  // 중복 LOT 체크 (같은 위치에서만)
  const existingInWarehouse = MOCK_STOCKS.find(
    s => s.lotNumber === input.lotNumber && s.location === 'warehouse'
  )
  if (existingInWarehouse) {
    return {
      success: false,
      id: 0,
      error: `LOT ${input.lotNumber}은(는) 이미 자재 창고에 등록되어 있습니다.`,
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
    location: 'warehouse',  // Phase 5: 자재 창고에 입고
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

// ============================================
// Phase A: 공정별 재고 관리 Functions
// ============================================

/**
 * 공정+LOT 중복 체크
 */
export function isLotExistsForProcess(processCode: string, lotNumber: string): boolean {
  return MOCK_STOCKS.some(s => s.processCode === processCode && s.lotNumber === lotNumber)
}

/**
 * 공정에 자재 등록 (스캔 시 자동 등록)
 * - 같은 공정+LOT가 있으면 수량 추가 (재스캔 시 남은 수량 등록)
 * - 없으면 새로 등록
 */
export async function registerProcessStock(input: ProcessStockInput): Promise<ProcessStockResult> {
  await new Promise((r) => setTimeout(r, 100))

  // 입력 검증
  if (!input.processCode || input.processCode.trim() === '') {
    return {
      success: false,
      id: 0,
      isNewEntry: false,
      error: '공정을 선택해주세요.',
    }
  }

  if (!input.lotNumber || input.lotNumber.trim() === '') {
    return {
      success: false,
      id: 0,
      isNewEntry: false,
      error: 'LOT 번호가 필요합니다.',
    }
  }

  if (input.quantity < 0) {
    return {
      success: false,
      id: 0,
      isNewEntry: false,
      error: '수량은 0 이상이어야 합니다.',
    }
  }

  const receivedAt = input.receivedAt
    ? (typeof input.receivedAt === 'string' ? input.receivedAt : input.receivedAt.toISOString())
    : new Date().toISOString()

  // 같은 공정+LOT 찾기
  const existingStock = MOCK_STOCKS.find(
    s => s.processCode === input.processCode && s.lotNumber === input.lotNumber
  )

  if (existingStock) {
    // 이미 소진된 LOT인지 확인
    if (existingStock.availableQty <= 0 && existingStock.usedQty > 0) {
      return {
        success: false,
        id: existingStock.id,
        isNewEntry: false,
        error: `LOT ${input.lotNumber}은(는) 이미 사용이 완료된 바코드입니다.`,
      }
    }

    // 기존 LOT에 수량 추가
    existingStock.quantity += input.quantity
    existingStock.availableQty += input.quantity
    saveStocks()

    return {
      success: true,
      id: existingStock.id,
      stock: {
        id: existingStock.id,
        materialId: existingStock.materialId,
        lotNumber: existingStock.lotNumber,
        quantity: existingStock.quantity,
        availableQty: existingStock.availableQty,
        processCode: input.processCode,
      },
      isNewEntry: false,
    }
  }

  // 새로 등록
  const newId = MOCK_STOCKS.length > 0 ? Math.max(...MOCK_STOCKS.map(s => s.id)) + 1 : 1

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
    location: 'process',  // Phase 5: 공정 재고
    processCode: input.processCode,
  }

  MOCK_STOCKS.push(stockItem)
  saveStocks()

  // 입고 기록도 생성
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
      availableQty: input.quantity,
      processCode: input.processCode,
    },
    isNewEntry: true,
  }
}

/**
 * 공정별 재고 조회
 */
export async function getStocksByProcess(
  processCode: string,
  options?: {
    materialCode?: string
    showZero?: boolean
  }
): Promise<StockItem[]> {
  await new Promise((r) => setTimeout(r, 100))

  let result = MOCK_STOCKS.filter(s => s.processCode === processCode)

  // 자재 코드 필터
  if (options?.materialCode) {
    result = result.filter((s) =>
      s.materialCode.toLowerCase().includes(options.materialCode!.toLowerCase()) ||
      s.materialName.toLowerCase().includes(options.materialCode!.toLowerCase())
    )
  }

  // 소진 재고 숨기기 (기본)
  if (!options?.showZero) {
    result = result.filter((s) => s.availableQty > 0)
  }

  // 최신순 정렬
  result.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return result
}

/**
 * 공정+LOT로 재고 조회
 */
export async function getProcessStockByLot(
  processCode: string,
  lotNumber: string
): Promise<StockItem | null> {
  await new Promise((r) => setTimeout(r, 50))

  const stock = MOCK_STOCKS.find(
    s => s.processCode === processCode && s.lotNumber === lotNumber
  )

  return stock || null
}

/**
 * 공정+LOT 상태 확인
 * - exists: 해당 공정에 LOT가 존재하는지
 * - isExhausted: 완전 소진되었는지
 * - canRegister: 추가 등록 가능한지 (새 LOT이거나, 남은 수량 있는 LOT)
 */
export async function checkProcessStockStatus(
  processCode: string,
  lotNumber: string
): Promise<ProcessStockStatus> {
  await new Promise((r) => setTimeout(r, 50))

  const stock = MOCK_STOCKS.find(
    s => s.processCode === processCode && s.lotNumber === lotNumber
  )

  if (!stock) {
    // LOT가 없음 - 새로 등록 가능
    return {
      exists: false,
      lotNumber,
      processCode,
      quantity: 0,
      usedQty: 0,
      availableQty: 0,
      isExhausted: false,
      canRegister: true,
    }
  }

  const isExhausted = stock.usedQty > 0 && stock.availableQty <= 0

  return {
    exists: true,
    lotNumber,
    processCode,
    quantity: stock.quantity,
    usedQty: stock.usedQty,
    availableQty: stock.availableQty,
    isExhausted,
    canRegister: !isExhausted, // 소진된 LOT는 추가 등록 불가
  }
}

/**
 * 공정별 FIFO 재고 차감
 */
export async function consumeProcessStock(
  processCode: string,
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

  // 해당 공정의 해당 자재 재고만 조회 (FIFO: 오래된 것 먼저)
  const stocks = MOCK_STOCKS
    .filter((s) => s.processCode === processCode && s.materialId === materialId)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))

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
 * 공정별 재고 요약 통계
 */
export async function getProcessStockSummary(processCode: string): Promise<{
  totalLots: number
  totalQuantity: number
  totalAvailable: number
  totalUsed: number
  materialCount: number
}> {
  await new Promise((r) => setTimeout(r, 100))

  const processStocks = MOCK_STOCKS.filter(s => s.processCode === processCode)
  const materialCodes = new Set(processStocks.map((s) => s.materialCode))

  return {
    totalLots: processStocks.length,
    totalQuantity: processStocks.reduce((sum, s) => sum + s.quantity, 0),
    totalAvailable: processStocks.reduce((sum, s) => sum + s.availableQty, 0),
    totalUsed: processStocks.reduce((sum, s) => sum + s.usedQty, 0),
    materialCount: materialCodes.size,
  }
}

/**
 * 공정별 가용 재고 수량 조회
 */
export async function getProcessAvailableQty(
  processCode: string,
  materialId: number
): Promise<number> {
  await new Promise((r) => setTimeout(r, 50))

  const stocks = MOCK_STOCKS.filter(
    (s) => s.processCode === processCode && s.materialId === materialId
  )
  return stocks.reduce((sum, s) => sum + s.availableQty, 0)
}

/**
 * 공정별 금일 스캔 내역 조회
 * processCode가 없으면 전체 조회
 */
export interface ProcessReceivingRecord {
  id: number
  processCode: string
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  availableQty: number
  usedQty: number
  receivedAt: string
}

export async function getTodayProcessReceivings(
  processCode?: string
): Promise<ProcessReceivingRecord[]> {
  await new Promise((r) => setTimeout(r, 100))

  const today = new Date().toISOString().split('T')[0]

  // 공정 코드가 있는 재고만 (공정 스캔으로 등록된 것)
  let processStocks = MOCK_STOCKS.filter(
    s => s.processCode && s.receivedAt.startsWith(today)
  )

  // 공정 필터링
  if (processCode) {
    processStocks = processStocks.filter(s => s.processCode === processCode)
  }

  // 최신순 정렬
  processStocks.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return processStocks.map(s => ({
    id: s.id,
    processCode: s.processCode!,
    materialCode: s.materialCode,
    materialName: s.materialName,
    lotNumber: s.lotNumber,
    quantity: s.quantity,
    availableQty: s.availableQty,
    usedQty: s.usedQty,
    receivedAt: s.receivedAt,
  }))
}

// ============================================
// Phase 5: 3단계 재고 관리 Functions
// 자재창고 → 생산창고 → 공정재고
// ============================================

/**
 * 불출 입력 타입
 */
export interface IssueToProductionInput {
  materialId: number
  materialCode: string
  materialName?: string
  lotNumber: string
  quantity: number
}

/**
 * 불출 결과 타입
 */
export interface IssueToProductionResult {
  success: boolean
  warehouseStock?: StockItem  // 차감된 자재창고 재고
  productionStock?: StockItem  // 생성된 생산창고 재고
  issuedQty: number
  error?: string
}

/**
 * 자재 불출 (자재창고 → 생산창고)
 * - 자재창고에서 availableQty 차감
 * - 생산창고에 새 레코드 생성 (또는 기존 LOT에 수량 추가)
 */
export async function issueToProduction(input: IssueToProductionInput): Promise<IssueToProductionResult> {
  await new Promise((r) => setTimeout(r, 100))

  // 자재창고에서 해당 LOT 찾기
  const warehouseStock = MOCK_STOCKS.find(
    s => s.lotNumber === input.lotNumber && s.location === 'warehouse'
  )

  // 자재창고에 없으면 바코드 스캔으로 직접 생산창고에 등록 (자재창고 재고 없이)
  if (!warehouseStock) {
    // 생산창고에 이미 있는지 확인
    const existingProduction = MOCK_STOCKS.find(
      s => s.lotNumber === input.lotNumber && s.location === 'production'
    )

    if (existingProduction) {
      // 이미 소진된 LOT인지 확인
      if (existingProduction.availableQty <= 0 && existingProduction.usedQty > 0) {
        return {
          success: false,
          issuedQty: 0,
          error: `LOT ${input.lotNumber}은(는) 이미 사용이 완료된 바코드입니다.`,
        }
      }

      // 기존 LOT에 수량 추가
      existingProduction.quantity += input.quantity
      existingProduction.availableQty += input.quantity
      saveStocks()

      return {
        success: true,
        productionStock: existingProduction,
        issuedQty: input.quantity,
      }
    }

    // 생산창고에 새로 등록
    const newId = MOCK_STOCKS.length > 0 ? Math.max(...MOCK_STOCKS.map(s => s.id)) + 1 : 1
    const newProductionStock: StockItem = {
      id: newId,
      materialId: input.materialId,
      materialCode: input.materialCode,
      materialName: input.materialName || input.materialCode,
      lotNumber: input.lotNumber,
      quantity: input.quantity,
      usedQty: 0,
      availableQty: input.quantity,
      receivedAt: new Date().toISOString(),
      location: 'production',
    }

    MOCK_STOCKS.push(newProductionStock)
    saveStocks()

    // 입고 기록 생성
    const receivingRecord: ReceivingRecord = {
      id: newId,
      lotNumber: input.lotNumber,
      quantity: input.quantity,
      receivedAt: new Date().toISOString(),
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
      productionStock: newProductionStock,
      issuedQty: input.quantity,
    }
  }

  // 자재창고 재고가 있는 경우
  const availableQty = warehouseStock.availableQty
  if (availableQty <= 0) {
    return {
      success: false,
      issuedQty: 0,
      error: `LOT ${input.lotNumber}의 자재창고 재고가 부족합니다. (가용: ${availableQty})`,
    }
  }

  // 불출할 수량 결정 (요청 수량 또는 가용 수량 중 작은 값)
  const issueQty = Math.min(input.quantity, availableQty)

  // 자재창고에서 차감
  warehouseStock.usedQty += issueQty
  warehouseStock.availableQty = warehouseStock.quantity - warehouseStock.usedQty

  // 생산창고에 있는지 확인
  const existingProduction = MOCK_STOCKS.find(
    s => s.lotNumber === input.lotNumber && s.location === 'production'
  )

  let productionStock: StockItem

  if (existingProduction) {
    // 기존 생산창고 LOT에 수량 추가
    existingProduction.quantity += issueQty
    existingProduction.availableQty += issueQty
    productionStock = existingProduction
  } else {
    // 생산창고에 새 레코드 생성
    const newId = MOCK_STOCKS.length > 0 ? Math.max(...MOCK_STOCKS.map(s => s.id)) + 1 : 1
    productionStock = {
      id: newId,
      materialId: warehouseStock.materialId,
      materialCode: warehouseStock.materialCode,
      materialName: warehouseStock.materialName,
      lotNumber: warehouseStock.lotNumber,
      quantity: issueQty,
      usedQty: 0,
      availableQty: issueQty,
      receivedAt: new Date().toISOString(),
      location: 'production',
    }
    MOCK_STOCKS.push(productionStock)
  }

  saveStocks()

  return {
    success: true,
    warehouseStock,
    productionStock,
    issuedQty: issueQty,
  }
}

/**
 * 공정 스캔 입력 타입
 */
export interface ScanToProcessInput {
  processCode: string
  materialId: number
  materialCode: string
  materialName?: string
  lotNumber: string
  quantity: number
}

/**
 * 공정 스캔 결과 타입
 */
export interface ScanToProcessResult {
  success: boolean
  productionStock?: StockItem  // 차감된 생산창고 재고
  processStock?: StockItem     // 생성된 공정 재고
  scannedQty: number
  error?: string
}

/**
 * 공정 자재 스캔 (생산창고 → 공정재고)
 * - 생산창고에서 availableQty 차감
 * - 해당 공정에 새 레코드 생성 (또는 기존 LOT에 수량 추가)
 */
export async function scanToProcess(input: ScanToProcessInput): Promise<ScanToProcessResult> {
  await new Promise((r) => setTimeout(r, 100))

  if (!input.processCode) {
    return {
      success: false,
      scannedQty: 0,
      error: '공정 코드가 필요합니다.',
    }
  }

  // 생산창고에서 해당 LOT 찾기
  const productionStock = MOCK_STOCKS.find(
    s => s.lotNumber === input.lotNumber && s.location === 'production'
  )

  if (!productionStock) {
    return {
      success: false,
      scannedQty: 0,
      error: `LOT ${input.lotNumber}이(가) 생산창고에 없습니다. 먼저 자재 불출을 해주세요.`,
    }
  }

  const availableQty = productionStock.availableQty
  if (availableQty <= 0) {
    return {
      success: false,
      scannedQty: 0,
      error: `LOT ${input.lotNumber}의 생산창고 재고가 부족합니다. (가용: ${availableQty})`,
    }
  }

  // 스캔할 수량 결정
  const scanQty = Math.min(input.quantity, availableQty)

  // 생산창고에서 차감
  productionStock.usedQty += scanQty
  productionStock.availableQty = productionStock.quantity - productionStock.usedQty

  // 해당 공정에 있는지 확인
  const existingProcess = MOCK_STOCKS.find(
    s => s.lotNumber === input.lotNumber && s.location === 'process' && s.processCode === input.processCode
  )

  let processStock: StockItem

  if (existingProcess) {
    // 이미 소진된 LOT인지 확인
    if (existingProcess.availableQty <= 0 && existingProcess.usedQty > 0) {
      // 생산창고 차감 롤백
      productionStock.usedQty -= scanQty
      productionStock.availableQty = productionStock.quantity - productionStock.usedQty
      saveStocks()

      return {
        success: false,
        scannedQty: 0,
        error: `LOT ${input.lotNumber}은(는) ${input.processCode} 공정에서 이미 사용이 완료된 바코드입니다.`,
      }
    }

    // 기존 공정 LOT에 수량 추가
    existingProcess.quantity += scanQty
    existingProcess.availableQty += scanQty
    processStock = existingProcess
  } else {
    // 공정에 새 레코드 생성
    const newId = MOCK_STOCKS.length > 0 ? Math.max(...MOCK_STOCKS.map(s => s.id)) + 1 : 1
    processStock = {
      id: newId,
      materialId: productionStock.materialId,
      materialCode: productionStock.materialCode,
      materialName: productionStock.materialName,
      lotNumber: productionStock.lotNumber,
      quantity: scanQty,
      usedQty: 0,
      availableQty: scanQty,
      receivedAt: new Date().toISOString(),
      location: 'process',
      processCode: input.processCode,
    }
    MOCK_STOCKS.push(processStock)
  }

  saveStocks()

  return {
    success: true,
    productionStock,
    processStock,
    scannedQty: scanQty,
  }
}

/**
 * 위치별 재고 조회
 */
export async function getStocksByLocation(
  location: StockLocation,
  options?: {
    processCode?: string  // location='process'일 때만 사용
    materialCode?: string
    showZero?: boolean
  }
): Promise<StockItem[]> {
  await new Promise((r) => setTimeout(r, 100))

  let result = MOCK_STOCKS.filter(s => s.location === location)

  // 공정 필터 (location='process'일 때)
  if (location === 'process' && options?.processCode) {
    result = result.filter(s => s.processCode === options.processCode)
  }

  // 자재 코드 필터
  if (options?.materialCode) {
    result = result.filter((s) =>
      s.materialCode.toLowerCase().includes(options.materialCode!.toLowerCase()) ||
      s.materialName.toLowerCase().includes(options.materialCode!.toLowerCase())
    )
  }

  // 소진 재고 숨기기 (기본)
  if (!options?.showZero) {
    result = result.filter((s) => s.availableQty > 0)
  }

  // 최신순 정렬
  result.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return result
}

/**
 * 위치별 재고 요약
 */
export async function getLocationStockSummary(location: StockLocation): Promise<{
  totalLots: number
  totalQuantity: number
  totalAvailable: number
  totalUsed: number
  materialCount: number
}> {
  await new Promise((r) => setTimeout(r, 100))

  const stocks = MOCK_STOCKS.filter(s => s.location === location)
  const materialCodes = new Set(stocks.map((s) => s.materialCode))

  return {
    totalLots: stocks.length,
    totalQuantity: stocks.reduce((sum, s) => sum + s.quantity, 0),
    totalAvailable: stocks.reduce((sum, s) => sum + s.availableQty, 0),
    totalUsed: stocks.reduce((sum, s) => sum + s.usedQty, 0),
    materialCount: materialCodes.size,
  }
}

/**
 * 금일 불출 내역 조회
 */
export interface IssuingRecord {
  id: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  availableQty: number
  issuedAt: string
}

export async function getTodayIssuings(): Promise<IssuingRecord[]> {
  await new Promise((r) => setTimeout(r, 100))

  const today = new Date().toISOString().split('T')[0]

  // 생산창고에 있는 금일 등록된 재고
  const productionStocks = MOCK_STOCKS.filter(
    s => s.location === 'production' && s.receivedAt.startsWith(today)
  )

  // 최신순 정렬
  productionStocks.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return productionStocks.map(s => ({
    id: s.id,
    materialCode: s.materialCode,
    materialName: s.materialName,
    lotNumber: s.lotNumber,
    quantity: s.quantity,
    availableQty: s.availableQty,
    issuedAt: s.receivedAt,
  }))
}

/**
 * 생산창고 가용 재고 확인 (LOT 번호로)
 */
export async function getProductionStockByLot(lotNumber: string): Promise<StockItem | null> {
  await new Promise((r) => setTimeout(r, 50))

  return MOCK_STOCKS.find(
    s => s.lotNumber === lotNumber && s.location === 'production'
  ) || null
}

/**
 * 기존 데이터 마이그레이션 (processCode → location)
 * 기존 processCode가 있는 데이터를 location='process'로 변환
 */
export function migrateToLocationBasedStock(): number {
  let migratedCount = 0

  for (const stock of MOCK_STOCKS) {
    // location이 없는 경우 (기존 데이터)
    if (!stock.location) {
      if (stock.processCode) {
        // processCode가 있으면 공정 재고
        stock.location = 'process'
      } else {
        // 없으면 자재 창고
        stock.location = 'warehouse'
      }
      migratedCount++
    }
  }

  if (migratedCount > 0) {
    saveStocks()
  }

  return migratedCount
}

/**
 * 불출 취소 결과 타입
 */
export interface CancelIssueResult {
  success: boolean
  cancelledQty: number
  error?: string
}

/**
 * 불출 취소 (생산창고 재고 삭제 또는 수량 감소)
 * - 이미 공정에서 사용된 경우 (usedQty > 0) 취소 불가
 * - 가용 수량만 취소 가능
 */
export async function cancelIssue(stockId: number): Promise<CancelIssueResult> {
  await new Promise((r) => setTimeout(r, 100))

  // 생산창고에서 해당 재고 찾기
  const stockIndex = MOCK_STOCKS.findIndex(
    s => s.id === stockId && s.location === 'production'
  )

  if (stockIndex === -1) {
    return {
      success: false,
      cancelledQty: 0,
      error: '생산창고에서 해당 불출 내역을 찾을 수 없습니다.',
    }
  }

  const stock = MOCK_STOCKS[stockIndex]

  // 이미 사용된 수량이 있으면 취소 불가
  if (stock.usedQty > 0) {
    return {
      success: false,
      cancelledQty: 0,
      error: `이미 ${stock.usedQty}개가 공정에서 사용되어 취소할 수 없습니다.`,
    }
  }

  const cancelledQty = stock.quantity

  // 생산창고에서 삭제
  MOCK_STOCKS.splice(stockIndex, 1)
  saveStocks()

  return {
    success: true,
    cancelledQty,
  }
}

/**
 * 생산창고 재고 상세 조회 (ID로)
 */
export async function getProductionStockById(stockId: number): Promise<StockItem | null> {
  await new Promise((r) => setTimeout(r, 50))

  return MOCK_STOCKS.find(
    s => s.id === stockId && s.location === 'production'
  ) || null
}

// 앱 시작 시 자동 마이그레이션
migrateToLocationBasedStock()

// Re-export types
export type { CalculatedRequirement }
