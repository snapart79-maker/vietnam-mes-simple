/**
 * Purchase Order Service
 *
 * 발주서(일일 생산계획) 관리 서비스
 * - 발주서 생성, 조회, 수정
 * - 발주서 아이템 관리
 * - 바코드 생성 및 스캔 처리
 */
import { prisma } from '../lib/prisma'
import { Prisma, PurchaseOrderStatus, PurchaseOrderItemStatus } from '@prisma/client'
import { getNextPOSequence } from './sequenceService'
import { generatePOBarcode, parsePOBarcode, isPOBarcode } from './barcodeService'

// ============================================
// Types
// ============================================

export interface CreatePurchaseOrderInput {
  orderDate: Date           // 생산 예정일
  description?: string      // 설명
  createdById?: number      // 생성자 ID
}

export interface AddPurchaseOrderItemInput {
  purchaseOrderId: number
  productId: number
  productCode: string
  processCode: string       // CA, MC, SB 등
  plannedQty: number
  crimpCode?: string        // CA 공정용 절압착 품번
  lineCode?: string
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
}

export interface PurchaseOrderItemWithProduct {
  id: number
  barcode: string
  processCode: string
  plannedQty: number
  completedQty: number
  defectQty: number
  status: PurchaseOrderItemStatus
  crimpCode: string | null
  lineCode: string | null
  startedAt: Date | null
  completedAt: Date | null
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
  totalItems: number
  totalPlanned: number
  totalCompleted: number
  totalDefect: number
  pendingCount: number
  inProgressCount: number
  completedCount: number
  progressRate: number
}

// ============================================
// Purchase Order CRUD
// ============================================

/**
 * 발주서 생성
 * 발주서 번호 형식: PO-YYMMDD-XXX
 */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<PurchaseOrderWithItems> {
  const { orderDate, description, createdById } = input

  // 발주서 번호 생성
  const dateStr = formatDateKey(orderDate)
  const sequence = await getNextPOSequence(orderDate)
  const orderNo = `PO-${dateStr}-${sequence.formatted}`

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      orderNo,
      orderDate,
      description,
      createdById,
      status: 'CREATED',
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
          worker: {
            select: { id: true, name: true },
          },
        },
      },
    },
  })

  return purchaseOrder
}

/**
 * 발주서 아이템 추가 (바코드 자동 생성)
 */
export async function addPurchaseOrderItem(
  input: AddPurchaseOrderItemInput
): Promise<PurchaseOrderItemWithProduct> {
  const {
    purchaseOrderId,
    productId,
    productCode,
    processCode,
    plannedQty,
    crimpCode,
    lineCode,
  } = input

  // 발주서 조회 (날짜 확인용)
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
  })

  if (!purchaseOrder) {
    throw new Error(`발주서를 찾을 수 없습니다: ${purchaseOrderId}`)
  }

  // 바코드 생성용 시퀀스
  const sequence = await getNextPOSequence(purchaseOrder.orderDate)

  // 품번: CA 공정의 경우 절압착 품번 사용
  const barcodeProductCode = crimpCode || productCode

  // 발주서 아이템 바코드 생성
  const barcode = generatePOBarcode(
    barcodeProductCode,
    plannedQty,
    purchaseOrder.orderDate,
    sequence.sequence
  )

  const item = await prisma.purchaseOrderItem.create({
    data: {
      purchaseOrderId,
      productId,
      barcode,
      processCode: processCode.toUpperCase(),
      plannedQty,
      crimpCode,
      lineCode,
      status: 'PENDING',
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
    },
  })

  // 발주서 상태 업데이트 (아이템이 추가되면 CREATED 유지)
  return item
}

/**
 * 발주서 ID로 조회
 */
export async function getPurchaseOrderById(
  id: number
): Promise<PurchaseOrderWithItems | null> {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
          worker: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  })
}

/**
 * 발주서 번호로 조회
 */
export async function getPurchaseOrderByNo(
  orderNo: string
): Promise<PurchaseOrderWithItems | null> {
  return prisma.purchaseOrder.findUnique({
    where: { orderNo },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
          worker: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  })
}

/**
 * 오늘 날짜 발주서 목록 조회
 */
export async function getTodayPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return prisma.purchaseOrder.findMany({
    where: {
      orderDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
          worker: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { orderNo: 'asc' },
  })
}

/**
 * 날짜 범위로 발주서 조회
 */
export async function getPurchaseOrdersByDateRange(
  startDate: Date,
  endDate: Date
): Promise<PurchaseOrderWithItems[]> {
  return prisma.purchaseOrder.findMany({
    where: {
      orderDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
          worker: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { orderDate: 'desc' },
  })
}

/**
 * 상태별 발주서 조회
 */
export async function getPurchaseOrdersByStatus(
  status: PurchaseOrderStatus
): Promise<PurchaseOrderWithItems[]> {
  return prisma.purchaseOrder.findMany({
    where: { status },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
          worker: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { orderDate: 'desc' },
  })
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
  // PO 바코드 형식 확인
  if (!isPOBarcode(barcode)) {
    return null
  }

  return prisma.purchaseOrderItem.findUnique({
    where: { barcode: barcode.toUpperCase() },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
    },
  })
}

/**
 * 발주서 아이템 작업 시작
 */
export async function startPurchaseOrderItem(
  itemId: number,
  workerId?: number,
  lineCode?: string
): Promise<PurchaseOrderItemWithProduct> {
  const item = await prisma.purchaseOrderItem.update({
    where: { id: itemId },
    data: {
      status: 'IN_PROGRESS',
      workerId,
      lineCode,
      startedAt: new Date(),
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
    },
  })

  // 발주서 상태 업데이트
  await updatePurchaseOrderStatus(item.purchaseOrderId)

  return item
}

/**
 * 발주서 아이템 진행률 업데이트
 */
export async function updatePurchaseOrderItemProgress(
  itemId: number,
  completedQty: number,
  defectQty: number = 0
): Promise<PurchaseOrderItemWithProduct> {
  const item = await prisma.purchaseOrderItem.findUnique({
    where: { id: itemId },
  })

  if (!item) {
    throw new Error(`발주서 아이템을 찾을 수 없습니다: ${itemId}`)
  }

  const newCompletedQty = item.completedQty + completedQty
  const newDefectQty = item.defectQty + defectQty

  // 상태 결정: 완료 수량 >= 계획 수량이면 COMPLETED
  const status: PurchaseOrderItemStatus =
    newCompletedQty >= item.plannedQty ? 'COMPLETED' : 'IN_PROGRESS'

  const updatedItem = await prisma.purchaseOrderItem.update({
    where: { id: itemId },
    data: {
      completedQty: newCompletedQty,
      defectQty: newDefectQty,
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
    },
  })

  // 발주서 상태 업데이트
  await updatePurchaseOrderStatus(updatedItem.purchaseOrderId)

  return updatedItem
}

/**
 * 발주서 아이템 완료 처리
 */
export async function completePurchaseOrderItem(
  itemId: number,
  completedQty: number,
  defectQty: number = 0
): Promise<PurchaseOrderItemWithProduct> {
  const item = await prisma.purchaseOrderItem.update({
    where: { id: itemId },
    data: {
      completedQty,
      defectQty,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
    },
  })

  // 발주서 상태 업데이트
  await updatePurchaseOrderStatus(item.purchaseOrderId)

  return item
}

/**
 * 발주서 상태 자동 업데이트
 * - 하나라도 IN_PROGRESS → 발주서 IN_PROGRESS
 * - 모두 COMPLETED → 발주서 COMPLETED
 */
async function updatePurchaseOrderStatus(purchaseOrderId: number): Promise<void> {
  const items = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
    select: { status: true },
  })

  if (items.length === 0) return

  const hasInProgress = items.some((i) => i.status === 'IN_PROGRESS')
  const allCompleted = items.every((i) => i.status === 'COMPLETED')

  let newStatus: PurchaseOrderStatus = 'CREATED'

  if (allCompleted) {
    newStatus = 'COMPLETED'
  } else if (hasInProgress) {
    newStatus = 'IN_PROGRESS'
  }

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status: newStatus },
  })
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
  const where: Prisma.PurchaseOrderItemWhereInput = {}

  if (orderDate) {
    const startOfDay = new Date(orderDate)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(orderDate)
    endOfDay.setHours(23, 59, 59, 999)

    where.purchaseOrder = {
      orderDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    }
  }

  const items = await prisma.purchaseOrderItem.groupBy({
    by: ['processCode', 'status'],
    where,
    _count: true,
    _sum: {
      plannedQty: true,
      completedQty: true,
      defectQty: true,
    },
  })

  // 공정별로 집계
  const processMap = new Map<string, ProcessProgressSummary>()

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

  for (const item of items) {
    const existing = processMap.get(item.processCode) || {
      processCode: item.processCode,
      processName: processNames[item.processCode] || item.processCode,
      totalItems: 0,
      totalPlanned: 0,
      totalCompleted: 0,
      totalDefect: 0,
      pendingCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      progressRate: 0,
    }

    existing.totalItems += item._count
    existing.totalPlanned += item._sum.plannedQty || 0
    existing.totalCompleted += item._sum.completedQty || 0
    existing.totalDefect += item._sum.defectQty || 0

    if (item.status === 'PENDING') {
      existing.pendingCount += item._count
    } else if (item.status === 'IN_PROGRESS') {
      existing.inProgressCount += item._count
    } else if (item.status === 'COMPLETED') {
      existing.completedCount += item._count
    }

    processMap.set(item.processCode, existing)
  }

  // 진행률 계산
  const results: ProcessProgressSummary[] = []
  for (const summary of processMap.values()) {
    if (summary.totalPlanned > 0) {
      summary.progressRate = Math.round(
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
  return prisma.purchaseOrder.findMany({
    where: {
      status: {
        in: ['CREATED', 'IN_PROGRESS'],
      },
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
          worker: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { orderDate: 'asc' },
  })
}

// ============================================
// Validation Utilities
// ============================================

/**
 * 생산 예정일 유효성 검사
 * - 오늘 ~ 7일 후까지만 허용
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
// Helper Functions
// ============================================

function formatDateKey(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

// Re-export types for convenience
export { PurchaseOrderStatus, PurchaseOrderItemStatus }
export { isPOBarcode, parsePOBarcode }
