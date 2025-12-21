/**
 * Carry Over Service
 *
 * 이월 수량 관리 서비스
 * - 이월 수량 등록/조회
 * - 이월 수량 사용
 * - 품번별 이월 현황
 */
import { prisma } from '../lib/prisma'

// ============================================
// Types
// ============================================

export interface CarryOverWithProduct {
  id: number
  processCode: string
  productId: number
  productCode: string
  productName: string
  lineCode: string
  sourceDate: Date
  sourceLotNo: string
  quantity: number
  usedQty: number
  availableQty: number
  targetLotNo: string | null
  isUsed: boolean
  createdAt: Date
}

export interface CreateCarryOverInput {
  processCode: string
  productId: number
  lineCode: string
  sourceLotNo: string
  quantity: number
}

export interface UseCarryOverInput {
  carryOverId: number
  quantity: number
  targetLotNo: string
}

// ============================================
// Carry Over Creation
// ============================================

/**
 * 이월 수량 등록
 */
export async function createCarryOver(input: CreateCarryOverInput): Promise<CarryOverWithProduct> {
  const { processCode, productId, lineCode, sourceLotNo, quantity } = input

  const carryOver = await prisma.carryOver.create({
    data: {
      processCode: processCode.toUpperCase(),
      productId,
      lineCode,
      sourceDate: new Date(),
      sourceLotNo,
      quantity,
      usedQty: 0,
      isUsed: false,
    },
    include: {
      product: {
        select: { code: true, name: true },
      },
    },
  })

  return {
    id: carryOver.id,
    processCode: carryOver.processCode,
    productId: carryOver.productId,
    productCode: carryOver.product.code,
    productName: carryOver.product.name,
    lineCode: carryOver.lineCode,
    sourceDate: carryOver.sourceDate,
    sourceLotNo: carryOver.sourceLotNo,
    quantity: carryOver.quantity,
    usedQty: carryOver.usedQty,
    availableQty: carryOver.quantity - carryOver.usedQty,
    targetLotNo: carryOver.targetLotNo,
    isUsed: carryOver.isUsed,
    createdAt: carryOver.createdAt,
  }
}

// ============================================
// Carry Over Usage
// ============================================

/**
 * 이월 수량 사용
 */
export async function useCarryOver(input: UseCarryOverInput): Promise<CarryOverWithProduct> {
  const { carryOverId, quantity, targetLotNo } = input

  const carryOver = await prisma.carryOver.findUnique({
    where: { id: carryOverId },
  })

  if (!carryOver) {
    throw new Error('이월 수량을 찾을 수 없습니다.')
  }

  const availableQty = carryOver.quantity - carryOver.usedQty

  if (quantity > availableQty) {
    throw new Error(`사용 가능한 수량이 부족합니다. (가용: ${availableQty}, 요청: ${quantity})`)
  }

  const newUsedQty = carryOver.usedQty + quantity
  const isFullyUsed = newUsedQty >= carryOver.quantity

  const updated = await prisma.carryOver.update({
    where: { id: carryOverId },
    data: {
      usedQty: newUsedQty,
      targetLotNo,
      isUsed: isFullyUsed,
    },
    include: {
      product: {
        select: { code: true, name: true },
      },
    },
  })

  return {
    id: updated.id,
    processCode: updated.processCode,
    productId: updated.productId,
    productCode: updated.product.code,
    productName: updated.product.name,
    lineCode: updated.lineCode,
    sourceDate: updated.sourceDate,
    sourceLotNo: updated.sourceLotNo,
    quantity: updated.quantity,
    usedQty: updated.usedQty,
    availableQty: updated.quantity - updated.usedQty,
    targetLotNo: updated.targetLotNo,
    isUsed: updated.isUsed,
    createdAt: updated.createdAt,
  }
}

/**
 * 이월 수량 취소 (복원)
 */
export async function cancelCarryOverUsage(
  carryOverId: number,
  quantity: number
): Promise<CarryOverWithProduct> {
  const carryOver = await prisma.carryOver.findUnique({
    where: { id: carryOverId },
  })

  if (!carryOver) {
    throw new Error('이월 수량을 찾을 수 없습니다.')
  }

  if (quantity > carryOver.usedQty) {
    throw new Error(`취소 가능한 수량이 부족합니다. (사용: ${carryOver.usedQty}, 취소 요청: ${quantity})`)
  }

  const newUsedQty = carryOver.usedQty - quantity

  const updated = await prisma.carryOver.update({
    where: { id: carryOverId },
    data: {
      usedQty: newUsedQty,
      isUsed: false,
      targetLotNo: newUsedQty === 0 ? null : carryOver.targetLotNo,
    },
    include: {
      product: {
        select: { code: true, name: true },
      },
    },
  })

  return {
    id: updated.id,
    processCode: updated.processCode,
    productId: updated.productId,
    productCode: updated.product.code,
    productName: updated.product.name,
    lineCode: updated.lineCode,
    sourceDate: updated.sourceDate,
    sourceLotNo: updated.sourceLotNo,
    quantity: updated.quantity,
    usedQty: updated.usedQty,
    availableQty: updated.quantity - updated.usedQty,
    targetLotNo: updated.targetLotNo,
    isUsed: updated.isUsed,
    createdAt: updated.createdAt,
  }
}

/**
 * 이월 수량 삭제
 */
export async function deleteCarryOver(carryOverId: number): Promise<void> {
  await prisma.carryOver.delete({
    where: { id: carryOverId },
  })
}

// ============================================
// Carry Over Queries
// ============================================

/**
 * 이월 수량 ID로 조회
 */
export async function getCarryOverById(carryOverId: number): Promise<CarryOverWithProduct | null> {
  const carryOver = await prisma.carryOver.findUnique({
    where: { id: carryOverId },
    include: {
      product: {
        select: { code: true, name: true },
      },
    },
  })

  if (!carryOver) return null

  return {
    id: carryOver.id,
    processCode: carryOver.processCode,
    productId: carryOver.productId,
    productCode: carryOver.product.code,
    productName: carryOver.product.name,
    lineCode: carryOver.lineCode,
    sourceDate: carryOver.sourceDate,
    sourceLotNo: carryOver.sourceLotNo,
    quantity: carryOver.quantity,
    usedQty: carryOver.usedQty,
    availableQty: carryOver.quantity - carryOver.usedQty,
    targetLotNo: carryOver.targetLotNo,
    isUsed: carryOver.isUsed,
    createdAt: carryOver.createdAt,
  }
}

/**
 * 제품별 이월 수량 조회
 */
export async function getCarryOversByProduct(
  productId: number,
  options?: {
    processCode?: string
    includeUsed?: boolean
  }
): Promise<CarryOverWithProduct[]> {
  const { processCode, includeUsed = false } = options || {}

  const where: {
    productId: number
    processCode?: string
    isUsed?: boolean
  } = { productId }

  if (processCode) {
    where.processCode = processCode.toUpperCase()
  }

  if (!includeUsed) {
    where.isUsed = false
  }

  const carryOvers = await prisma.carryOver.findMany({
    where,
    include: {
      product: {
        select: { code: true, name: true },
      },
    },
    orderBy: { sourceDate: 'asc' },
  })

  return carryOvers.map((co) => ({
    id: co.id,
    processCode: co.processCode,
    productId: co.productId,
    productCode: co.product.code,
    productName: co.product.name,
    lineCode: co.lineCode,
    sourceDate: co.sourceDate,
    sourceLotNo: co.sourceLotNo,
    quantity: co.quantity,
    usedQty: co.usedQty,
    availableQty: co.quantity - co.usedQty,
    targetLotNo: co.targetLotNo,
    isUsed: co.isUsed,
    createdAt: co.createdAt,
  }))
}

/**
 * 공정별 이월 수량 조회
 */
export async function getCarryOversByProcess(
  processCode: string,
  options?: {
    includeUsed?: boolean
    lineCode?: string
  }
): Promise<CarryOverWithProduct[]> {
  const { includeUsed = false, lineCode } = options || {}

  const where: {
    processCode: string
    isUsed?: boolean
    lineCode?: string
  } = { processCode: processCode.toUpperCase() }

  if (!includeUsed) {
    where.isUsed = false
  }

  if (lineCode) {
    where.lineCode = lineCode
  }

  const carryOvers = await prisma.carryOver.findMany({
    where,
    include: {
      product: {
        select: { code: true, name: true },
      },
    },
    orderBy: [
      { product: { code: 'asc' } },
      { sourceDate: 'asc' },
    ],
  })

  return carryOvers.map((co) => ({
    id: co.id,
    processCode: co.processCode,
    productId: co.productId,
    productCode: co.product.code,
    productName: co.product.name,
    lineCode: co.lineCode,
    sourceDate: co.sourceDate,
    sourceLotNo: co.sourceLotNo,
    quantity: co.quantity,
    usedQty: co.usedQty,
    availableQty: co.quantity - co.usedQty,
    targetLotNo: co.targetLotNo,
    isUsed: co.isUsed,
    createdAt: co.createdAt,
  }))
}

/**
 * 사용 가능한 이월 수량 조회 (FIFO 순서)
 */
export async function getAvailableCarryOvers(
  productId: number,
  processCode: string
): Promise<CarryOverWithProduct[]> {
  const carryOvers = await prisma.carryOver.findMany({
    where: {
      productId,
      processCode: processCode.toUpperCase(),
      isUsed: false,
    },
    include: {
      product: {
        select: { code: true, name: true },
      },
    },
    orderBy: { sourceDate: 'asc' },
  })

  return carryOvers
    .filter((co) => co.quantity - co.usedQty > 0)
    .map((co) => ({
      id: co.id,
      processCode: co.processCode,
      productId: co.productId,
      productCode: co.product.code,
      productName: co.product.name,
      lineCode: co.lineCode,
      sourceDate: co.sourceDate,
      sourceLotNo: co.sourceLotNo,
      quantity: co.quantity,
      usedQty: co.usedQty,
      availableQty: co.quantity - co.usedQty,
      targetLotNo: co.targetLotNo,
      isUsed: co.isUsed,
      createdAt: co.createdAt,
    }))
}

/**
 * 이월 수량 요약 (품번별)
 */
export async function getCarryOverSummary(processCode?: string): Promise<Array<{
  productId: number
  productCode: string
  productName: string
  totalQuantity: number
  totalUsed: number
  totalAvailable: number
  count: number
}>> {
  const where: { processCode?: string; isUsed: boolean } = { isUsed: false }

  if (processCode) {
    where.processCode = processCode.toUpperCase()
  }

  const carryOvers = await prisma.carryOver.findMany({
    where,
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
    },
  })

  // 품번별 그룹핑
  const summaryMap = new Map<number, {
    productCode: string
    productName: string
    totalQuantity: number
    totalUsed: number
    count: number
  }>()

  for (const co of carryOvers) {
    const existing = summaryMap.get(co.productId)
    if (existing) {
      existing.totalQuantity += co.quantity
      existing.totalUsed += co.usedQty
      existing.count++
    } else {
      summaryMap.set(co.productId, {
        productCode: co.product.code,
        productName: co.product.name,
        totalQuantity: co.quantity,
        totalUsed: co.usedQty,
        count: 1,
      })
    }
  }

  return Array.from(summaryMap.entries()).map(([productId, data]) => ({
    productId,
    ...data,
    totalAvailable: data.totalQuantity - data.totalUsed,
  }))
}
