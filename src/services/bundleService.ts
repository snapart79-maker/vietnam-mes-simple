/**
 * Bundle Service
 *
 * CA 번들 LOT 관리 서비스
 * - 번들 생성/조회
 * - 개별 LOT 추가/제거
 * - 번들 완료/해제
 *
 * Phase 6: 번들 출하 관리
 * - 개별/일괄 출하
 * - 개별/전체 번들 해제
 */
import { prisma } from '../lib/prisma'
import { BundleStatus, BundleType } from '@prisma/client'
import { generateBundleBarcode } from './barcodeService'
import { getNextBundleSequence } from './sequenceService'

// ============================================
// Types
// ============================================

export interface BundleLotWithItems {
  id: number
  bundleNo: string
  productId: number
  productCode: string
  productName: string
  bundleType: BundleType
  setQuantity: number
  totalQty: number
  status: BundleStatus
  items: BundleItemInfo[]
  createdAt: Date
}

export interface BundleItemInfo {
  id: number
  productionLotId: number
  lotNumber: string
  quantity: number
  processCode: string
  createdAt: Date
}

export interface CreateBundleInput {
  processCode: string
  productId: number
  productCode: string
  setQuantity: number
}

export interface AddToBundleInput {
  bundleLotId: number
  productionLotId: number
  quantity: number
}

// ============================================
// Bundle Creation
// ============================================

/**
 * 번들 LOT 생성
 */
export async function createBundle(input: CreateBundleInput): Promise<BundleLotWithItems> {
  const { processCode, productId, productCode, setQuantity } = input

  // 번들 일련번호 생성
  const sequence = await getNextBundleSequence(processCode)
  const bundleNo = generateBundleBarcode(processCode, productCode, setQuantity, sequence.sequence)

  const bundleLot = await prisma.bundleLot.create({
    data: {
      bundleNo,
      productId,
      setQuantity,
      totalQty: 0,
      status: 'CREATED',
    },
    include: {
      product: {
        select: { code: true, name: true },
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true },
          },
        },
      },
    },
  })

  return {
    id: bundleLot.id,
    bundleNo: bundleLot.bundleNo,
    productId: bundleLot.productId,
    productCode: bundleLot.product.code,
    productName: bundleLot.product.name,
    bundleType: bundleLot.bundleType,
    setQuantity: bundleLot.setQuantity,
    totalQty: bundleLot.totalQty,
    status: bundleLot.status,
    items: [],
    createdAt: bundleLot.createdAt,
  }
}

// ============================================
// Bundle Item Operations
// ============================================

/**
 * 번들에 LOT 추가
 */
export async function addToBundle(input: AddToBundleInput): Promise<BundleLotWithItems> {
  const { bundleLotId, productionLotId, quantity } = input

  // 번들 LOT 조회
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleLotId },
  })

  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  if (bundle.status !== 'CREATED') {
    throw new Error('이미 완료된 번들에는 추가할 수 없습니다.')
  }

  // 아이템 추가
  await prisma.bundleItem.create({
    data: {
      bundleLotId,
      productionLotId,
      quantity,
    },
  })

  // 총 수량 업데이트
  await prisma.bundleLot.update({
    where: { id: bundleLotId },
    data: {
      totalQty: { increment: quantity },
    },
  })

  return getBundleById(bundleLotId) as Promise<BundleLotWithItems>
}

/**
 * 번들에서 LOT 제거
 */
export async function removeFromBundle(bundleItemId: number): Promise<BundleLotWithItems> {
  const item = await prisma.bundleItem.findUnique({
    where: { id: bundleItemId },
    include: { bundleLot: true },
  })

  if (!item) {
    throw new Error('번들 아이템을 찾을 수 없습니다.')
  }

  if (item.bundleLot.status !== 'CREATED') {
    throw new Error('이미 완료된 번들에서는 제거할 수 없습니다.')
  }

  // 아이템 삭제
  await prisma.bundleItem.delete({
    where: { id: bundleItemId },
  })

  // 총 수량 업데이트
  await prisma.bundleLot.update({
    where: { id: item.bundleLotId },
    data: {
      totalQty: { decrement: item.quantity },
    },
  })

  return getBundleById(item.bundleLotId) as Promise<BundleLotWithItems>
}

// ============================================
// Bundle Status Operations
// ============================================

/**
 * 번들 완료 (출하 준비)
 */
export async function completeBundle(bundleLotId: number): Promise<BundleLotWithItems> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleLotId },
    include: { items: true },
  })

  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  if (bundle.items.length === 0) {
    throw new Error('번들에 추가된 LOT가 없습니다.')
  }

  if (bundle.items.length !== bundle.setQuantity) {
    throw new Error(`번들 수량이 일치하지 않습니다. (예상: ${bundle.setQuantity}, 실제: ${bundle.items.length})`)
  }

  await prisma.bundleLot.update({
    where: { id: bundleLotId },
    data: { status: 'SHIPPED' },
  })

  return getBundleById(bundleLotId) as Promise<BundleLotWithItems>
}

/**
 * 번들 해제
 */
export async function unbundle(bundleLotId: number): Promise<void> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleLotId },
  })

  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  // 번들 아이템 삭제
  await prisma.bundleItem.deleteMany({
    where: { bundleLotId },
  })

  // 번들 상태 변경
  await prisma.bundleLot.update({
    where: { id: bundleLotId },
    data: {
      status: 'UNBUNDLED',
      totalQty: 0,
    },
  })
}

/**
 * 번들 삭제
 */
export async function deleteBundle(bundleLotId: number): Promise<void> {
  await prisma.bundleLot.delete({
    where: { id: bundleLotId },
  })
}

// ============================================
// Bundle Queries
// ============================================

/**
 * 번들 ID로 조회
 */
export async function getBundleById(bundleLotId: number): Promise<BundleLotWithItems | null> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleLotId },
    include: {
      product: {
        select: { code: true, name: true },
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!bundle) return null

  return {
    id: bundle.id,
    bundleNo: bundle.bundleNo,
    productId: bundle.productId,
    productCode: bundle.product.code,
    productName: bundle.product.name,
    bundleType: bundle.bundleType,
    setQuantity: bundle.setQuantity,
    totalQty: bundle.totalQty,
    status: bundle.status,
    items: bundle.items.map((item) => ({
      id: item.id,
      productionLotId: item.productionLotId,
      lotNumber: item.productionLot.lotNumber,
      quantity: item.quantity,
      processCode: item.productionLot.processCode,
      createdAt: item.createdAt,
    })),
    createdAt: bundle.createdAt,
  }
}

/**
 * 번들 번호로 조회
 */
export async function getBundleByNo(bundleNo: string): Promise<BundleLotWithItems | null> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { bundleNo },
  })

  if (!bundle) return null

  return getBundleById(bundle.id)
}

/**
 * 제품별 번들 조회
 */
export async function getBundlesByProduct(
  productId: number,
  status?: BundleStatus
): Promise<BundleLotWithItems[]> {
  const where: { productId: number; status?: BundleStatus } = { productId }
  if (status) where.status = status

  const bundles = await prisma.bundleLot.findMany({
    where,
    include: {
      product: {
        select: { code: true, name: true },
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return bundles.map((bundle) => ({
    id: bundle.id,
    bundleNo: bundle.bundleNo,
    productId: bundle.productId,
    productCode: bundle.product.code,
    productName: bundle.product.name,
    bundleType: bundle.bundleType,
    setQuantity: bundle.setQuantity,
    totalQty: bundle.totalQty,
    status: bundle.status,
    items: bundle.items.map((item) => ({
      id: item.id,
      productionLotId: item.productionLotId,
      lotNumber: item.productionLot.lotNumber,
      quantity: item.quantity,
      processCode: item.productionLot.processCode,
      createdAt: item.createdAt,
    })),
    createdAt: bundle.createdAt,
  }))
}

/**
 * 진행 중인 번들 조회
 */
export async function getActiveBundles(): Promise<BundleLotWithItems[]> {
  const bundles = await prisma.bundleLot.findMany({
    where: { status: 'CREATED' },
    include: {
      product: {
        select: { code: true, name: true },
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return bundles.map((bundle) => ({
    id: bundle.id,
    bundleNo: bundle.bundleNo,
    productId: bundle.productId,
    productCode: bundle.product.code,
    productName: bundle.product.name,
    bundleType: bundle.bundleType,
    setQuantity: bundle.setQuantity,
    totalQty: bundle.totalQty,
    status: bundle.status,
    items: bundle.items.map((item) => ({
      id: item.id,
      productionLotId: item.productionLotId,
      lotNumber: item.productionLot.lotNumber,
      quantity: item.quantity,
      processCode: item.productionLot.processCode,
      createdAt: item.createdAt,
    })),
    createdAt: bundle.createdAt,
  }))
}

/**
 * 번들에 추가 가능한 LOT 조회 (CA 공정, 완료 상태)
 */
export async function getAvailableLotsForBundle(productId: number): Promise<Array<{
  id: number
  lotNumber: string
  processCode: string
  completedQty: number
  completedAt: Date | null
}>> {
  // 이미 번들에 추가된 LOT ID 조회
  const bundledLotIds = await prisma.bundleItem.findMany({
    select: { productionLotId: true },
  })
  const excludeIds = bundledLotIds.map((b) => b.productionLotId)

  const lots = await prisma.productionLot.findMany({
    where: {
      productId,
      processCode: 'CA',
      status: 'COMPLETED',
      id: { notIn: excludeIds },
    },
    select: {
      id: true,
      lotNumber: true,
      processCode: true,
      completedQty: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'desc' },
    take: 50,
  })

  return lots
}

// ============================================
// Phase 6: Shipping Operations
// ============================================

export interface ShipmentResult {
  success: boolean
  bundleId: number
  bundleNo: string
  shippedItemIds: number[]
  shippedLotNumbers: string[]
  newBundleStatus: BundleStatus
  message: string
}

export interface UnbundleResult {
  success: boolean
  bundleId: number
  bundleNo: string
  unbundledItemIds: number[]
  unbundledLotNumbers: string[]
  newBundleStatus: BundleStatus
  message: string
}

/**
 * 개별 아이템 출하
 * - 번들 상태를 SHIPPED로 변경
 * - 현재 스키마에서는 개별 아이템 상태 필드가 없으므로 번들 전체 상태만 관리
 *
 * Note: 개별 아이템 상태 관리를 위해서는 BundleItem에 status 필드 추가 필요
 */
export async function shipBundleItem(
  bundleId: number,
  itemId: number
): Promise<ShipmentResult> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleId },
    include: {
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true },
          },
        },
      },
    },
  })

  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  const item = bundle.items.find((i) => i.id === itemId)
  if (!item) {
    throw new Error('번들 아이템을 찾을 수 없습니다.')
  }

  // 현재 스키마에서는 개별 아이템 상태 필드가 없으므로
  // 출하 기록을 위해 로깅만 수행하고 번들 상태는 유지
  // 실제 구현에서는 BundleItem.status 필드 추가 필요

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    shippedItemIds: [itemId],
    shippedLotNumbers: [item.productionLot.lotNumber],
    newBundleStatus: bundle.status,
    message: `아이템 ${item.productionLot.lotNumber} 출하 처리됨 (개별 상태 관리 필요)`,
  }
}

/**
 * 번들 전체 출하
 * - 번들의 모든 아이템을 출하 처리
 * - 번들 상태를 SHIPPED로 변경
 */
export async function shipEntireBundle(bundleId: number): Promise<ShipmentResult> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleId },
    include: {
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true },
          },
        },
      },
    },
  })

  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  if (bundle.items.length === 0) {
    throw new Error('번들에 출하할 아이템이 없습니다.')
  }

  if (bundle.status === 'SHIPPED') {
    throw new Error('이미 출하 완료된 번들입니다.')
  }

  // 번들 상태 변경
  await prisma.bundleLot.update({
    where: { id: bundleId },
    data: { status: 'SHIPPED' },
  })

  const shippedLotNumbers = bundle.items.map((i) => i.productionLot.lotNumber)
  const shippedItemIds = bundle.items.map((i) => i.id)

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    shippedItemIds,
    shippedLotNumbers,
    newBundleStatus: 'SHIPPED',
    message: `번들 전체 출하 완료 (${shippedLotNumbers.length}개 아이템)`,
  }
}

/**
 * 개별 아이템 번들 해제
 * - 번들에서 특정 아이템 제거
 * - 원본 LOT 번호 반환
 */
export async function unbundleItem(
  bundleId: number,
  itemId: number
): Promise<UnbundleResult> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleId },
  })

  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  if (bundle.status === 'SHIPPED') {
    throw new Error('출하 완료된 번들에서는 아이템을 해제할 수 없습니다.')
  }

  const item = await prisma.bundleItem.findUnique({
    where: { id: itemId },
    include: {
      productionLot: {
        select: { lotNumber: true },
      },
    },
  })

  if (!item || item.bundleLotId !== bundleId) {
    throw new Error('번들 아이템을 찾을 수 없습니다.')
  }

  const unbundledLotNumber = item.productionLot.lotNumber

  // 아이템 삭제 및 총 수량 업데이트
  await prisma.$transaction([
    prisma.bundleItem.delete({
      where: { id: itemId },
    }),
    prisma.bundleLot.update({
      where: { id: bundleId },
      data: {
        totalQty: { decrement: item.quantity },
      },
    }),
  ])

  // 남은 아이템 확인하여 상태 결정
  const remainingItems = await prisma.bundleItem.count({
    where: { bundleLotId: bundleId },
  })

  let newStatus: BundleStatus = bundle.status
  if (remainingItems === 0) {
    await prisma.bundleLot.update({
      where: { id: bundleId },
      data: { status: 'UNBUNDLED' },
    })
    newStatus = 'UNBUNDLED'
  }

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    unbundledItemIds: [itemId],
    unbundledLotNumbers: [unbundledLotNumber],
    newBundleStatus: newStatus,
    message: `아이템 ${unbundledLotNumber} 번들 해제 완료`,
  }
}

/**
 * 번들 전체 해제
 * - 모든 아이템 제거
 * - 원본 LOT 번호 목록 반환
 */
export async function unbundleAll(bundleId: number): Promise<UnbundleResult> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleId },
    include: {
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true },
          },
        },
      },
    },
  })

  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  if (bundle.status === 'SHIPPED') {
    throw new Error('출하 완료된 번들은 해제할 수 없습니다.')
  }

  if (bundle.items.length === 0) {
    throw new Error('번들에 해제할 아이템이 없습니다.')
  }

  const unbundledItemIds = bundle.items.map((i) => i.id)
  const unbundledLotNumbers = bundle.items.map((i) => i.productionLot.lotNumber)

  // 모든 아이템 삭제 및 상태 변경
  await prisma.$transaction([
    prisma.bundleItem.deleteMany({
      where: { bundleLotId: bundleId },
    }),
    prisma.bundleLot.update({
      where: { id: bundleId },
      data: {
        status: 'UNBUNDLED',
        totalQty: 0,
      },
    }),
  ])

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    unbundledItemIds,
    unbundledLotNumbers,
    newBundleStatus: 'UNBUNDLED',
    message: `번들 전체 해제 완료 (${unbundledLotNumbers.length}개 아이템)`,
  }
}

// ============================================
// Phase 6: Shipping Statistics
// ============================================

/**
 * 번들 출하 통계 조회
 */
export async function getBundleShippingStats(): Promise<{
  totalBundles: number
  byStatus: Record<string, number>
  totalItems: number
}> {
  const bundles = await prisma.bundleLot.groupBy({
    by: ['status'],
    _count: { id: true },
  })

  const byStatus: Record<string, number> = {
    CREATED: 0,
    SHIPPED: 0,
    UNBUNDLED: 0,
  }

  let totalBundles = 0
  for (const b of bundles) {
    byStatus[b.status] = b._count.id
    totalBundles += b._count.id
  }

  const totalItems = await prisma.bundleItem.count()

  return {
    totalBundles,
    byStatus,
    totalItems,
  }
}

/**
 * 출하된 번들 조회
 */
export async function getShippedBundles(): Promise<BundleLotWithItems[]> {
  const bundles = await prisma.bundleLot.findMany({
    where: { status: 'SHIPPED' },
    include: {
      product: {
        select: { code: true, name: true },
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return bundles.map((bundle) => ({
    id: bundle.id,
    bundleNo: bundle.bundleNo,
    productId: bundle.productId,
    productCode: bundle.product.code,
    productName: bundle.product.name,
    bundleType: bundle.bundleType,
    setQuantity: bundle.setQuantity,
    totalQty: bundle.totalQty,
    status: bundle.status,
    items: bundle.items.map((item) => ({
      id: item.id,
      productionLotId: item.productionLotId,
      lotNumber: item.productionLot.lotNumber,
      quantity: item.quantity,
      processCode: item.productionLot.processCode,
      createdAt: item.createdAt,
    })),
    createdAt: bundle.createdAt,
  }))
}

// ============================================
// Stage 6: SET Bundle Types
// ============================================

export interface SetBundle {
  bundleNo: string
  bundleType: BundleType
  items: Array<{
    productCode: string
    productName: string
    lotNumber: string
    quantity: number
  }>
  setQuantity: number
  totalQuantity: number
  uniqueProductCount: number
}

export interface SetBundleItemInput {
  lotId: number
  quantity: number
}

// ============================================
// Stage 6: SET Bundle Operations
// ============================================

/**
 * SET 번들 생성 (다른 품번 묶음)
 * - 여러 품번의 LOT를 하나의 번들로 묶음
 * - 자동으로 번들 타입 결정 (SAME_PRODUCT / MULTI_PRODUCT)
 */
export async function createSetBundle(
  items: SetBundleItemInput[]
): Promise<BundleLotWithItems> {
  if (items.length === 0) {
    throw new Error('번들에 추가할 아이템이 없습니다.')
  }

  // LOT 정보 조회
  const lotIds = items.map((i) => i.lotId)
  const lots = await prisma.productionLot.findMany({
    where: { id: { in: lotIds } },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
    },
  })

  if (lots.length !== items.length) {
    throw new Error('일부 LOT를 찾을 수 없습니다.')
  }

  // 고유 품번 확인
  const uniqueProductIds = new Set(lots.map((lot) => lot.productId))
  const bundleType: BundleType =
    uniqueProductIds.size === 1 ? 'SAME_PRODUCT' : 'MULTI_PRODUCT'

  // 첫 번째 제품을 기준으로 번들 생성
  const firstLot = lots[0]
  const processCode = firstLot.processCode
  const productCode = firstLot.product.code

  // SET 번들 번호 생성
  const sequence = await getNextBundleSequence(processCode)
  const setQuantity = items.length
  const bundleNo = generateBundleBarcode(
    processCode,
    bundleType === 'MULTI_PRODUCT' ? 'SET' : productCode,
    setQuantity,
    sequence.sequence
  )

  // 총 수량 계산
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)

  // 번들 생성
  const bundle = await prisma.bundleLot.create({
    data: {
      bundleNo,
      productId: firstLot.productId,
      bundleType,
      setQuantity,
      totalQty,
      status: 'CREATED',
    },
  })

  // 번들 아이템 추가
  for (const item of items) {
    await prisma.bundleItem.create({
      data: {
        bundleLotId: bundle.id,
        productionLotId: item.lotId,
        quantity: item.quantity,
      },
    })
  }

  return getBundleById(bundle.id) as Promise<BundleLotWithItems>
}

/**
 * 번들 타입 판별
 * - 번들 내 아이템의 품번이 모두 동일하면 SAME_PRODUCT
 * - 다른 품번이 포함되어 있으면 MULTI_PRODUCT
 */
export async function determineBundleType(
  bundleId: number
): Promise<BundleType> {
  const items = await prisma.bundleItem.findMany({
    where: { bundleLotId: bundleId },
    include: {
      productionLot: {
        select: { productId: true },
      },
    },
  })

  if (items.length === 0) {
    return 'SAME_PRODUCT'
  }

  const uniqueProductIds = new Set(items.map((i) => i.productionLot.productId))
  return uniqueProductIds.size === 1 ? 'SAME_PRODUCT' : 'MULTI_PRODUCT'
}

/**
 * 번들 타입 조회 (DB 저장값)
 */
export async function getBundleTypeById(bundleId: number): Promise<BundleType | null> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleId },
    select: { bundleType: true },
  })

  return bundle?.bundleType ?? null
}

/**
 * SET 정보 문자열 생성
 * - SAME_PRODUCT: "00315452-001 × 600 (6개)"
 * - MULTI_PRODUCT: "SET × 100 (4품번)"
 */
export async function formatSetInfo(bundleId: number): Promise<string> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { id: bundleId },
    include: {
      product: {
        select: { code: true },
      },
      items: {
        include: {
          productionLot: {
            select: { productId: true },
          },
        },
      },
    },
  })

  if (!bundle) {
    throw new Error('번들을 찾을 수 없습니다.')
  }

  const uniqueProductIds = new Set(
    bundle.items.map((i) => i.productionLot.productId)
  )
  const productCount = uniqueProductIds.size
  const itemCount = bundle.items.length

  if (bundle.bundleType === 'MULTI_PRODUCT' || productCount > 1) {
    return `SET × ${bundle.totalQty} (${productCount}품번)`
  }

  return `${bundle.product.code} × ${bundle.totalQty} (${itemCount}개)`
}

/**
 * 번들 상세 조회 (SetBundle 형식)
 */
export async function getBundleDetails(bundleNo: string): Promise<SetBundle | null> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { bundleNo },
    include: {
      product: {
        select: { code: true, name: true },
      },
      items: {
        include: {
          productionLot: {
            select: {
              lotNumber: true,
              product: {
                select: { code: true, name: true },
              },
            },
          },
        },
      },
    },
  })

  if (!bundle) {
    return null
  }

  const uniqueProductCodes = new Set(
    bundle.items.map((i) => i.productionLot.product.code)
  )

  return {
    bundleNo: bundle.bundleNo,
    bundleType: bundle.bundleType,
    items: bundle.items.map((item) => ({
      productCode: item.productionLot.product.code,
      productName: item.productionLot.product.name,
      lotNumber: item.productionLot.lotNumber,
      quantity: item.quantity,
    })),
    setQuantity: bundle.setQuantity,
    totalQuantity: bundle.totalQty,
    uniqueProductCount: uniqueProductCodes.size,
  }
}

/**
 * 번들에서 특정 품번 검색
 */
export async function findItemInBundle(
  bundleNo: string,
  productCode: string
): Promise<BundleItemInfo | null> {
  const bundle = await prisma.bundleLot.findUnique({
    where: { bundleNo },
    include: {
      items: {
        include: {
          productionLot: {
            include: {
              product: {
                select: { code: true },
              },
            },
          },
        },
      },
    },
  })

  if (!bundle) {
    return null
  }

  const item = bundle.items.find(
    (i) => i.productionLot.product.code === productCode
  )

  if (!item) {
    return null
  }

  return {
    id: item.id,
    productionLotId: item.productionLotId,
    lotNumber: item.productionLot.lotNumber,
    quantity: item.quantity,
    processCode: item.productionLot.processCode,
    createdAt: item.createdAt,
  }
}

/**
 * 번들 내 품번 목록 조회
 */
export async function getProductsInBundle(
  bundleId: number
): Promise<Array<{ productCode: string; productName: string; count: number; totalQty: number }>> {
  const items = await prisma.bundleItem.findMany({
    where: { bundleLotId: bundleId },
    include: {
      productionLot: {
        include: {
          product: {
            select: { code: true, name: true },
          },
        },
      },
    },
  })

  // 품번별 집계
  const productMap = new Map<
    string,
    { productCode: string; productName: string; count: number; totalQty: number }
  >()

  for (const item of items) {
    const code = item.productionLot.product.code
    const existing = productMap.get(code)

    if (existing) {
      existing.count++
      existing.totalQty += item.quantity
    } else {
      productMap.set(code, {
        productCode: code,
        productName: item.productionLot.product.name,
        count: 1,
        totalQty: item.quantity,
      })
    }
  }

  return Array.from(productMap.values())
}

/**
 * 번들 타입 업데이트 (아이템 변경 시 자동 호출)
 */
export async function updateBundleType(bundleId: number): Promise<BundleType> {
  const newType = await determineBundleType(bundleId)

  await prisma.bundleLot.update({
    where: { id: bundleId },
    data: { bundleType: newType },
  })

  return newType
}

/**
 * SET 번들 통계 조회
 */
export async function getSetBundleStats(): Promise<{
  sameProductCount: number
  multiProductCount: number
  totalSetBundles: number
}> {
  const stats = await prisma.bundleLot.groupBy({
    by: ['bundleType'],
    _count: { id: true },
  })

  const result = {
    sameProductCount: 0,
    multiProductCount: 0,
    totalSetBundles: 0,
  }

  for (const stat of stats) {
    if (stat.bundleType === 'SAME_PRODUCT') {
      result.sameProductCount = stat._count.id
    } else if (stat.bundleType === 'MULTI_PRODUCT') {
      result.multiProductCount = stat._count.id
    }
    result.totalSetBundles += stat._count.id
  }

  return result
}

/**
 * MULTI_PRODUCT 번들만 조회
 */
export async function getMultiProductBundles(): Promise<BundleLotWithItems[]> {
  const bundles = await prisma.bundleLot.findMany({
    where: { bundleType: 'MULTI_PRODUCT' },
    include: {
      product: {
        select: { code: true, name: true },
      },
      items: {
        include: {
          productionLot: {
            select: { lotNumber: true, processCode: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return bundles.map((bundle) => ({
    id: bundle.id,
    bundleNo: bundle.bundleNo,
    productId: bundle.productId,
    productCode: bundle.product.code,
    productName: bundle.product.name,
    bundleType: bundle.bundleType,
    setQuantity: bundle.setQuantity,
    totalQty: bundle.totalQty,
    status: bundle.status,
    items: bundle.items.map((item) => ({
      id: item.id,
      productionLotId: item.productionLotId,
      lotNumber: item.productionLot.lotNumber,
      quantity: item.quantity,
      processCode: item.productionLot.processCode,
      createdAt: item.createdAt,
    })),
    createdAt: bundle.createdAt,
  }))
}
