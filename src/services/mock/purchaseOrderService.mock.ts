/**
 * Purchase Order Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * localStorage 영속화 지원
 */

import {
  generatePOBarcode,
  parsePOBarcode,
  isPOBarcode,
  getDateString,
} from '../barcodeService'

// ============================================
// Types
// ============================================

export type PurchaseOrderStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type PurchaseOrderItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface CreatePurchaseOrderInput {
  orderDate: Date
  description?: string
  createdById?: number
  // 완제품별 계획 수량 (완제품코드 → 계획수량)
  finishedProductQty?: Record<string, number>
}

export interface AddPurchaseOrderItemInput {
  purchaseOrderId: number
  productId: number
  productCode: string
  productName?: string
  processCode: string
  plannedQty: number
  crimpCode?: string
  lineCode?: string
  lineName?: string
}

export interface PurchaseOrderWithItems {
  id: number
  orderNo: string
  orderDate: Date
  status: PurchaseOrderStatus
  description: string | null
  createdBy: {
    id: number
    name: string
  } | null
  createdAt: Date
  updatedAt: Date
  items: PurchaseOrderItemWithProduct[]
  // 완제품별 계획 수량 (완제품코드 → 계획수량)
  finishedProductQty?: Record<string, number>
}

export interface PurchaseOrderItemWithProduct {
  id: number
  purchaseOrderId: number
  barcode: string
  processCode: string
  plannedQty: number
  completedQty: number
  defectQty: number
  status: PurchaseOrderItemStatus
  crimpCode: string | null
  lineCode: string | null
  lineName: string | null
  startedAt: Date | null
  completedAt: Date | null
  productId: number         // 완제품 ID
  productCode: string       // 완제품 품번 (직접 접근용)
  productName: string       // 완제품 품명 (직접 접근용)
  createdAt: Date           // 생성일시
  updatedAt: Date           // 수정일시
  product: {
    id: number
    code: string
    name: string
  }
  worker: {
    id: number
    name: string
  } | null
}

export interface ProcessProgressSummary {
  processCode: string
  processName: string
  totalPlanned: number
  totalCompleted: number
  totalDefect: number
  progressPercent: number   // Context의 ProcessProgress와 일치
  itemCount: number         // Context의 ProcessProgress와 일치
  completedItems: number    // Context의 ProcessProgress와 일치
}

// ============================================
// LocalStorage Keys & Persistence
// ============================================

const STORAGE_KEYS = {
  PURCHASE_ORDERS: 'vietnam_mes_purchase_orders',
  PO_SEQUENCE: 'vietnam_mes_po_sequence',
}

interface SerializedPurchaseOrder {
  id: number
  orderNo: string
  orderDate: string
  status: PurchaseOrderStatus
  description: string | null
  createdBy: { id: number; name: string } | null
  createdAt: string
  updatedAt: string
  items: SerializedPurchaseOrderItem[]
  // 완제품별 계획 수량 (완제품코드 → 계획수량)
  finishedProductQty?: Record<string, number>
}

interface SerializedPurchaseOrderItem {
  id: number
  purchaseOrderId: number
  barcode: string
  processCode: string
  plannedQty: number
  completedQty: number
  defectQty: number
  status: PurchaseOrderItemStatus
  crimpCode: string | null
  lineCode: string | null
  lineName: string | null
  startedAt: string | null
  completedAt: string | null
  productCode: string       // 추가: 완제품 품번
  productName: string       // 추가: 완제품 품명
  product: { id: number; code: string; name: string }
  worker: { id: number; name: string } | null
}

function loadFromStorage(): PurchaseOrderWithItems[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PURCHASE_ORDERS)
    if (stored) {
      const parsed: SerializedPurchaseOrder[] = JSON.parse(stored)
      return parsed.map((po) => ({
        ...po,
        orderDate: new Date(po.orderDate),
        createdAt: new Date(po.createdAt),
        updatedAt: new Date(po.updatedAt),
        finishedProductQty: po.finishedProductQty || {},
        items: po.items.map((item) => ({
          ...item,
          startedAt: item.startedAt ? new Date(item.startedAt) : null,
          completedAt: item.completedAt ? new Date(item.completedAt) : null,
          // 이전 데이터 호환성: 필드가 없으면 product에서 가져오거나 기본값 설정
          productId: (item as any).productId || item.product?.id || 0,
          productCode: item.productCode || item.product?.code || '',
          productName: item.productName || item.product?.name || '',
          createdAt: (item as any).createdAt ? new Date((item as any).createdAt) : new Date(po.createdAt),
          updatedAt: (item as any).updatedAt ? new Date((item as any).updatedAt) : new Date(po.updatedAt),
        })),
      }))
    }
  } catch (error) {
    console.error('Failed to load purchase orders from localStorage:', error)
  }
  return []
}

function saveToStorage(): void {
  try {
    const serialized: SerializedPurchaseOrder[] = MOCK_PURCHASE_ORDERS.map((po) => ({
      ...po,
      orderDate: po.orderDate.toISOString(),
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      finishedProductQty: po.finishedProductQty || {},
      items: po.items.map((item) => ({
        ...item,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      })),
    }))
    localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(serialized))
  } catch (error) {
    console.error('Failed to save purchase orders to localStorage:', error)
  }
}

// 시퀀스 관리
function getNextSequence(dateKey: string): number {
  const sequences: Record<string, number> = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PO_SEQUENCE) || '{}'
  )
  const current = sequences[dateKey] || 0
  const next = current + 1
  sequences[dateKey] = next
  localStorage.setItem(STORAGE_KEYS.PO_SEQUENCE, JSON.stringify(sequences))
  return next
}

// Mock 데이터 저장소
let MOCK_PURCHASE_ORDERS: PurchaseOrderWithItems[] = loadFromStorage()
let nextPurchaseOrderId = MOCK_PURCHASE_ORDERS.length > 0
  ? Math.max(...MOCK_PURCHASE_ORDERS.map((p) => p.id)) + 1
  : 1
let nextItemId = 1
MOCK_PURCHASE_ORDERS.forEach((po) => {
  po.items.forEach((item) => {
    if (item.id >= nextItemId) nextItemId = item.id + 1
  })
})

// ============================================
// Purchase Order CRUD
// ============================================

/**
 * 발주서 생성
 */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<PurchaseOrderWithItems> {
  await delay(200)

  const { orderDate, description, createdById, finishedProductQty } = input

  // 날짜 유효성 검사
  const validation = validateOrderDate(orderDate)
  if (!validation.isValid) {
    throw new Error(validation.message)
  }

  const dateKey = formatDateKey(orderDate)
  const sequence = getNextSequence(dateKey)
  const orderNo = `PO-${dateKey}-${String(sequence).padStart(3, '0')}`

  const now = new Date()
  const purchaseOrder: PurchaseOrderWithItems = {
    id: nextPurchaseOrderId++,
    orderNo,
    orderDate,
    status: 'CREATED',
    description: description || null,
    createdBy: createdById ? { id: createdById, name: '관리자' } : null,
    createdAt: now,
    updatedAt: now,
    items: [],
    finishedProductQty: finishedProductQty || {},
  }

  MOCK_PURCHASE_ORDERS.push(purchaseOrder)
  saveToStorage()
  return purchaseOrder
}

/**
 * 발주서 아이템 추가
 */
export async function addPurchaseOrderItem(
  input: AddPurchaseOrderItemInput
): Promise<PurchaseOrderItemWithProduct> {
  await delay(150)

  const {
    purchaseOrderId,
    productId,
    productCode,
    productName,
    processCode,
    plannedQty,
    crimpCode,
    lineCode,
    lineName,
  } = input

  const purchaseOrder = MOCK_PURCHASE_ORDERS.find((p) => p.id === purchaseOrderId)
  if (!purchaseOrder) {
    throw new Error(`발주서를 찾을 수 없습니다: ${purchaseOrderId}`)
  }

  const dateKey = formatDateKey(purchaseOrder.orderDate)
  const sequence = getNextSequence(`ITEM_${dateKey}`)

  // 품번: CA 공정의 경우 절압착 품번 사용
  const barcodeProductCode = crimpCode || productCode

  const barcode = generatePOBarcode(
    barcodeProductCode,
    plannedQty,
    purchaseOrder.orderDate,
    sequence
  )

  const resolvedProductName = productName || `제품-${productCode}`
  const now = new Date()

  const item: PurchaseOrderItemWithProduct = {
    id: nextItemId++,
    purchaseOrderId,
    barcode,
    processCode: processCode.toUpperCase(),
    plannedQty,
    completedQty: 0,
    defectQty: 0,
    status: 'PENDING',
    crimpCode: crimpCode || null,
    lineCode: lineCode || null,
    lineName: lineName || null,
    startedAt: null,
    completedAt: null,
    productId,                      // 완제품 ID
    productCode,                    // 완제품 품번 (직접 접근용)
    productName: resolvedProductName, // 완제품 품명 (직접 접근용)
    createdAt: now,                 // 생성일시
    updatedAt: now,                 // 수정일시
    product: {
      id: productId,
      code: productCode,
      name: resolvedProductName,
    },
    worker: null,
  }

  purchaseOrder.items.push(item)
  purchaseOrder.updatedAt = new Date()
  saveToStorage()
  return item
}

/**
 * 발주서 ID로 조회
 */
export async function getPurchaseOrderById(
  id: number
): Promise<PurchaseOrderWithItems | null> {
  await delay(100)
  return MOCK_PURCHASE_ORDERS.find((p) => p.id === id) || null
}

/**
 * 발주서 번호로 조회
 */
export async function getPurchaseOrderByNo(
  orderNo: string
): Promise<PurchaseOrderWithItems | null> {
  await delay(100)
  return MOCK_PURCHASE_ORDERS.find((p) => p.orderNo === orderNo) || null
}

/**
 * 오늘 날짜 발주서 목록 조회
 */
export async function getTodayPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  await delay(150)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return MOCK_PURCHASE_ORDERS.filter((p) => {
    const orderDate = new Date(p.orderDate)
    return orderDate >= today && orderDate < tomorrow
  }).sort((a, b) => a.orderNo.localeCompare(b.orderNo))
}

/**
 * 날짜 범위로 발주서 조회
 */
export async function getPurchaseOrdersByDateRange(
  startDate: Date,
  endDate: Date
): Promise<PurchaseOrderWithItems[]> {
  await delay(150)

  return MOCK_PURCHASE_ORDERS.filter((p) => {
    const orderDate = new Date(p.orderDate)
    return orderDate >= startDate && orderDate <= endDate
  }).sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime())
}

/**
 * 상태별 발주서 조회
 */
export async function getPurchaseOrdersByStatus(
  status: PurchaseOrderStatus
): Promise<PurchaseOrderWithItems[]> {
  await delay(150)
  return MOCK_PURCHASE_ORDERS.filter((p) => p.status === status)
    .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime())
}

// ============================================
// Purchase Order Item Operations
// ============================================

/**
 * 바코드로 발주서 아이템 조회
 */
export async function getPurchaseOrderItemByBarcode(
  barcode: string
): Promise<PurchaseOrderItemWithProduct | null> {
  await delay(100)

  if (!isPOBarcode(barcode)) {
    return null
  }

  for (const po of MOCK_PURCHASE_ORDERS) {
    const item = po.items.find(
      (i) => i.barcode.toUpperCase() === barcode.toUpperCase()
    )
    if (item) return item
  }
  return null
}

/**
 * 발주서 아이템 작업 시작
 */
export async function startPurchaseOrderItem(
  itemId: number,
  workerId?: number,
  lineCode?: string
): Promise<PurchaseOrderItemWithProduct> {
  await delay(150)

  for (const po of MOCK_PURCHASE_ORDERS) {
    const item = po.items.find((i) => i.id === itemId)
    if (item) {
      item.status = 'IN_PROGRESS'
      item.startedAt = new Date()
      if (workerId) {
        item.worker = { id: workerId, name: `작업자${workerId}` }
      }
      if (lineCode) {
        item.lineCode = lineCode
      }
      po.updatedAt = new Date()
      updatePurchaseOrderStatus(po)
      saveToStorage()
      return item
    }
  }
  throw new Error(`발주서 아이템을 찾을 수 없습니다: ${itemId}`)
}

/**
 * 발주서 아이템 진행률 업데이트
 */
export async function updatePurchaseOrderItemProgress(
  itemId: number,
  completedQty: number,
  defectQty: number = 0
): Promise<PurchaseOrderItemWithProduct> {
  await delay(150)

  for (const po of MOCK_PURCHASE_ORDERS) {
    const item = po.items.find((i) => i.id === itemId)
    if (item) {
      item.completedQty += completedQty
      item.defectQty += defectQty

      if (item.completedQty >= item.plannedQty) {
        item.status = 'COMPLETED'
        item.completedAt = new Date()
      } else {
        item.status = 'IN_PROGRESS'
      }

      po.updatedAt = new Date()
      updatePurchaseOrderStatus(po)
      saveToStorage()
      return item
    }
  }
  throw new Error(`발주서 아이템을 찾을 수 없습니다: ${itemId}`)
}

/**
 * 발주서 아이템 완료 처리
 */
export async function completePurchaseOrderItem(
  itemId: number,
  completedQty: number,
  defectQty: number = 0
): Promise<PurchaseOrderItemWithProduct> {
  await delay(150)

  for (const po of MOCK_PURCHASE_ORDERS) {
    const item = po.items.find((i) => i.id === itemId)
    if (item) {
      item.completedQty = completedQty
      item.defectQty = defectQty
      item.status = 'COMPLETED'
      item.completedAt = new Date()
      po.updatedAt = new Date()
      updatePurchaseOrderStatus(po)
      saveToStorage()
      return item
    }
  }
  throw new Error(`발주서 아이템을 찾을 수 없습니다: ${itemId}`)
}

/**
 * 발주서 상태 자동 업데이트
 */
function updatePurchaseOrderStatus(po: PurchaseOrderWithItems): void {
  if (po.items.length === 0) return

  const hasInProgress = po.items.some((i) => i.status === 'IN_PROGRESS')
  const allCompleted = po.items.every((i) => i.status === 'COMPLETED')

  if (allCompleted) {
    po.status = 'COMPLETED'
  } else if (hasInProgress) {
    po.status = 'IN_PROGRESS'
  } else {
    po.status = 'CREATED'
  }
}

// ============================================
// Statistics & Progress
// ============================================

/**
 * 공정별 진행률 조회
 */
export async function getProgressByProcess(
  orderDate?: Date
): Promise<ProcessProgressSummary[]> {
  await delay(150)

  const processNames: Record<string, string> = {
    CA: '자동절압착',
    MC: '수동압착',
    SB: '서브조립',
    MS: '미드스플라이스',
    SP: '제품조립제공부품',
    PA: '제품조립',
    CI: '회로검사',
    VI: '육안검사',
  }

  const processMap = new Map<string, ProcessProgressSummary>()

  for (const po of MOCK_PURCHASE_ORDERS) {
    // 날짜 필터
    if (orderDate) {
      const poDate = new Date(po.orderDate)
      const targetDate = new Date(orderDate)
      poDate.setHours(0, 0, 0, 0)
      targetDate.setHours(0, 0, 0, 0)
      if (poDate.getTime() !== targetDate.getTime()) continue
    }

    for (const item of po.items) {
      const existing = processMap.get(item.processCode) || {
        processCode: item.processCode,
        processName: processNames[item.processCode] || item.processCode,
        totalPlanned: 0,
        totalCompleted: 0,
        totalDefect: 0,
        progressPercent: 0,
        itemCount: 0,
        completedItems: 0,
      }

      existing.itemCount += 1
      existing.totalPlanned += item.plannedQty
      existing.totalCompleted += item.completedQty
      existing.totalDefect += item.defectQty

      if (item.status === 'COMPLETED') existing.completedItems += 1

      processMap.set(item.processCode, existing)
    }
  }

  const results: ProcessProgressSummary[] = []
  for (const summary of processMap.values()) {
    if (summary.totalPlanned > 0) {
      summary.progressPercent = Math.round(
        (summary.totalCompleted / summary.totalPlanned) * 100
      )
    }
    results.push(summary)
  }

  return results.sort((a, b) => a.processCode.localeCompare(b.processCode))
}

/**
 * 미완료 발주서 목록 조회
 */
export async function getIncompletePurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  await delay(150)
  return MOCK_PURCHASE_ORDERS.filter(
    (p) => p.status === 'CREATED' || p.status === 'IN_PROGRESS'
  ).sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime())
}

// ============================================
// Validation Utilities
// ============================================

/**
 * 생산 예정일 유효성 검사
 */
export function validateOrderDate(orderDate: Date): {
  isValid: boolean
  message?: string
} {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + 7)
  maxDate.setHours(23, 59, 59, 999)

  const checkDate = new Date(orderDate)
  checkDate.setHours(0, 0, 0, 0)

  if (checkDate < today) {
    return {
      isValid: false,
      message: '과거 날짜는 선택할 수 없습니다.',
    }
  }

  if (checkDate > maxDate) {
    return {
      isValid: false,
      message: '7일 후까지만 선택할 수 있습니다.',
    }
  }

  return { isValid: true }
}

/**
 * PO 바코드 파싱 및 아이템 조회
 */
export async function parsePOBarcodeAndGetItem(
  barcode: string
): Promise<{
  parsed: ReturnType<typeof parsePOBarcode>
  item: PurchaseOrderItemWithProduct | null
}> {
  const parsed = parsePOBarcode(barcode)

  if (!parsed) {
    return { parsed: null, item: null }
  }

  const item = await getPurchaseOrderItemByBarcode(barcode)
  return { parsed, item }
}

// ============================================
// Data Management
// ============================================

/**
 * 발주서 삭제
 */
export async function deletePurchaseOrder(id: number): Promise<boolean> {
  await delay(150)
  const index = MOCK_PURCHASE_ORDERS.findIndex((p) => p.id === id)
  if (index !== -1) {
    MOCK_PURCHASE_ORDERS.splice(index, 1)
    saveToStorage()
    return true
  }
  return false
}

/**
 * 발주서 아이템 삭제
 */
export async function deletePurchaseOrderItem(itemId: number): Promise<boolean> {
  await delay(150)
  for (const po of MOCK_PURCHASE_ORDERS) {
    const index = po.items.findIndex((i) => i.id === itemId)
    if (index !== -1) {
      po.items.splice(index, 1)
      po.updatedAt = new Date()
      updatePurchaseOrderStatus(po)
      saveToStorage()
      return true
    }
  }
  return false
}

/**
 * 전체 발주서 데이터 초기화
 */
export function resetPurchaseOrderData(): number {
  const count = MOCK_PURCHASE_ORDERS.length
  MOCK_PURCHASE_ORDERS.length = 0
  nextPurchaseOrderId = 1
  nextItemId = 1
  localStorage.removeItem(STORAGE_KEYS.PURCHASE_ORDERS)
  localStorage.removeItem(STORAGE_KEYS.PO_SEQUENCE)
  return count
}

/**
 * 모든 발주서 조회
 */
export async function getAllPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  await delay(100)
  return [...MOCK_PURCHASE_ORDERS].sort(
    (a, b) => b.orderDate.getTime() - a.orderDate.getTime()
  )
}

// ============================================
// Helper Functions
// ============================================

function formatDateKey(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Re-exports
export { isPOBarcode, parsePOBarcode }
