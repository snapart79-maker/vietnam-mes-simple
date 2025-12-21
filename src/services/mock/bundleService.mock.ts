/**
 * Bundle Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * Phase 6: 번들 출하 관리
 */

// ============================================
// Types
// ============================================

export type BundleStatus = 'ACTIVE' | 'PARTIAL' | 'SHIPPED' | 'UNBUNDLED'
export type BundleItemStatus = 'BUNDLED' | 'SHIPPED'

export interface MockBundleLot {
  id: number
  bundleNo: string
  productId: number
  productCode: string
  productName: string
  setQuantity: number
  totalQty: number
  status: BundleStatus
  createdAt: Date
  updatedAt: Date
}

export interface MockBundleItem {
  id: number
  bundleLotId: number
  productionLotId: number
  lotNumber: string
  processCode: string
  quantity: number
  status: BundleItemStatus
  shippedAt?: Date
  createdAt: Date
}

export interface BundleLotWithItems extends MockBundleLot {
  items: MockBundleItem[]
}

export interface CreateBundleInput {
  processCode: string
  productId: number
  productCode: string
  productName: string
  setQuantity: number
}

export interface AddToBundleInput {
  bundleLotId: number
  productionLotId: number
  lotNumber: string
  processCode: string
  quantity: number
}

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

// ============================================
// Mock Data Storage
// ============================================

const MOCK_BUNDLES: MockBundleLot[] = []
const MOCK_BUNDLE_ITEMS: MockBundleItem[] = []

let bundleIdCounter = 1
let bundleItemIdCounter = 1

// ============================================
// Utility Functions
// ============================================

/**
 * 번들 상태 자동 계산
 */
function calculateBundleStatus(bundleId: number): BundleStatus {
  const items = MOCK_BUNDLE_ITEMS.filter((i) => i.bundleLotId === bundleId)

  if (items.length === 0) {
    return 'UNBUNDLED'
  }

  const shippedCount = items.filter((i) => i.status === 'SHIPPED').length
  const totalCount = items.length

  if (shippedCount === 0) {
    return 'ACTIVE'
  } else if (shippedCount === totalCount) {
    return 'SHIPPED'
  } else {
    return 'PARTIAL'
  }
}

/**
 * 번들 상태 업데이트
 */
function updateBundleStatus(bundleId: number): void {
  const bundle = MOCK_BUNDLES.find((b) => b.id === bundleId)
  if (bundle) {
    bundle.status = calculateBundleStatus(bundleId)
    bundle.updatedAt = new Date()
  }
}

/**
 * 번들 데이터 초기화 (테스트용)
 */
export function resetBundleData(): { bundles: number; items: number } {
  const bundleCount = MOCK_BUNDLES.length
  const itemCount = MOCK_BUNDLE_ITEMS.length
  MOCK_BUNDLES.length = 0
  MOCK_BUNDLE_ITEMS.length = 0
  bundleIdCounter = 1
  bundleItemIdCounter = 1
  return { bundles: bundleCount, items: itemCount }
}

// ============================================
// Bundle Creation
// ============================================

/**
 * 번들 LOT 생성
 */
export async function createBundle(input: CreateBundleInput): Promise<BundleLotWithItems> {
  await new Promise((r) => setTimeout(r, 100))

  const now = new Date()
  const dateKey = now
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, '')

  const bundleNo = `${input.processCode}${input.productCode}Q${input.setQuantity}-${input.processCode[0]}${dateKey}-B${String(bundleIdCounter).padStart(3, '0')}`

  const bundle: MockBundleLot = {
    id: bundleIdCounter++,
    bundleNo,
    productId: input.productId,
    productCode: input.productCode,
    productName: input.productName,
    setQuantity: input.setQuantity,
    totalQty: 0,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  }

  MOCK_BUNDLES.push(bundle)

  return {
    ...bundle,
    items: [],
  }
}

// ============================================
// Bundle Item Operations
// ============================================

/**
 * 번들에 LOT 추가
 */
export async function addToBundle(input: AddToBundleInput): Promise<BundleLotWithItems> {
  await new Promise((r) => setTimeout(r, 100))

  const bundle = MOCK_BUNDLES.find((b) => b.id === input.bundleLotId)
  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  if (bundle.status === 'SHIPPED') {
    throw new Error('이미 출하 완료된 번들에는 추가할 수 없습니다.')
  }

  const item: MockBundleItem = {
    id: bundleItemIdCounter++,
    bundleLotId: input.bundleLotId,
    productionLotId: input.productionLotId,
    lotNumber: input.lotNumber,
    processCode: input.processCode,
    quantity: input.quantity,
    status: 'BUNDLED',
    createdAt: new Date(),
  }

  MOCK_BUNDLE_ITEMS.push(item)

  bundle.totalQty += input.quantity
  updateBundleStatus(bundle.id)

  return getBundleById(bundle.id) as Promise<BundleLotWithItems>
}

/**
 * 번들에서 LOT 제거 (출하 전)
 */
export async function removeFromBundle(bundleItemId: number): Promise<BundleLotWithItems> {
  await new Promise((r) => setTimeout(r, 100))

  const itemIndex = MOCK_BUNDLE_ITEMS.findIndex((i) => i.id === bundleItemId)
  if (itemIndex === -1) {
    throw new Error('번들 아이템을 찾을 수 없습니다.')
  }

  const item = MOCK_BUNDLE_ITEMS[itemIndex]
  const bundle = MOCK_BUNDLES.find((b) => b.id === item.bundleLotId)

  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  if (item.status === 'SHIPPED') {
    throw new Error('이미 출하된 아이템은 제거할 수 없습니다.')
  }

  MOCK_BUNDLE_ITEMS.splice(itemIndex, 1)
  bundle.totalQty -= item.quantity
  updateBundleStatus(bundle.id)

  return getBundleById(bundle.id) as Promise<BundleLotWithItems>
}

// ============================================
// Phase 6: Shipping Operations
// ============================================

/**
 * 개별 아이템 출하
 */
export async function shipBundleItem(
  bundleId: number,
  itemId: number
): Promise<ShipmentResult> {
  await new Promise((r) => setTimeout(r, 100))

  const bundle = MOCK_BUNDLES.find((b) => b.id === bundleId)
  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  const item = MOCK_BUNDLE_ITEMS.find(
    (i) => i.id === itemId && i.bundleLotId === bundleId
  )
  if (!item) {
    throw new Error('번들 아이템을 찾을 수 없습니다.')
  }

  if (item.status === 'SHIPPED') {
    throw new Error('이미 출하된 아이템입니다.')
  }

  item.status = 'SHIPPED'
  item.shippedAt = new Date()

  updateBundleStatus(bundleId)

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    shippedItemIds: [itemId],
    shippedLotNumbers: [item.lotNumber],
    newBundleStatus: bundle.status,
    message: `아이템 ${item.lotNumber} 출하 완료`,
  }
}

/**
 * 번들 전체 출하
 */
export async function shipEntireBundle(bundleId: number): Promise<ShipmentResult> {
  await new Promise((r) => setTimeout(r, 100))

  const bundle = MOCK_BUNDLES.find((b) => b.id === bundleId)
  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  const items = MOCK_BUNDLE_ITEMS.filter((i) => i.bundleLotId === bundleId)
  if (items.length === 0) {
    throw new Error('번들에 출하할 아이템이 없습니다.')
  }

  const pendingItems = items.filter((i) => i.status === 'BUNDLED')
  if (pendingItems.length === 0) {
    throw new Error('모든 아이템이 이미 출하되었습니다.')
  }

  const now = new Date()
  const shippedItemIds: number[] = []
  const shippedLotNumbers: string[] = []

  for (const item of pendingItems) {
    item.status = 'SHIPPED'
    item.shippedAt = now
    shippedItemIds.push(item.id)
    shippedLotNumbers.push(item.lotNumber)
  }

  updateBundleStatus(bundleId)

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    shippedItemIds,
    shippedLotNumbers,
    newBundleStatus: bundle.status,
    message: `번들 전체 출하 완료 (${shippedLotNumbers.length}개 아이템)`,
  }
}

/**
 * 개별 아이템 출하 취소 (SHIPPED → BUNDLED)
 */
export async function cancelItemShipment(
  bundleId: number,
  itemId: number
): Promise<ShipmentResult> {
  await new Promise((r) => setTimeout(r, 100))

  const bundle = MOCK_BUNDLES.find((b) => b.id === bundleId)
  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  const item = MOCK_BUNDLE_ITEMS.find(
    (i) => i.id === itemId && i.bundleLotId === bundleId
  )
  if (!item) {
    throw new Error('번들 아이템을 찾을 수 없습니다.')
  }

  if (item.status !== 'SHIPPED') {
    throw new Error('출하되지 않은 아이템입니다.')
  }

  item.status = 'BUNDLED'
  item.shippedAt = undefined

  updateBundleStatus(bundleId)

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    shippedItemIds: [itemId],
    shippedLotNumbers: [item.lotNumber],
    newBundleStatus: bundle.status,
    message: `아이템 ${item.lotNumber} 출하 취소`,
  }
}

// ============================================
// Phase 6: Unbundle Operations
// ============================================

/**
 * 개별 아이템 번들 해제
 * - 번들에서 아이템 제거
 * - 원본 LOT 번호 반환
 */
export async function unbundleItem(
  bundleId: number,
  itemId: number
): Promise<UnbundleResult> {
  await new Promise((r) => setTimeout(r, 100))

  const bundle = MOCK_BUNDLES.find((b) => b.id === bundleId)
  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  const itemIndex = MOCK_BUNDLE_ITEMS.findIndex(
    (i) => i.id === itemId && i.bundleLotId === bundleId
  )
  if (itemIndex === -1) {
    throw new Error('번들 아이템을 찾을 수 없습니다.')
  }

  const item = MOCK_BUNDLE_ITEMS[itemIndex]

  if (item.status === 'SHIPPED') {
    throw new Error('이미 출하된 아이템은 번들 해제할 수 없습니다.')
  }

  const unbundledLotNumber = item.lotNumber

  // 아이템 제거
  MOCK_BUNDLE_ITEMS.splice(itemIndex, 1)
  bundle.totalQty -= item.quantity
  updateBundleStatus(bundleId)

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    unbundledItemIds: [itemId],
    unbundledLotNumbers: [unbundledLotNumber],
    newBundleStatus: bundle.status,
    message: `아이템 ${unbundledLotNumber} 번들 해제 완료`,
  }
}

/**
 * 번들 전체 해제
 * - 출하되지 않은 모든 아이템 제거
 * - 원본 LOT 번호 목록 반환
 */
export async function unbundleAll(bundleId: number): Promise<UnbundleResult> {
  await new Promise((r) => setTimeout(r, 100))

  const bundle = MOCK_BUNDLES.find((b) => b.id === bundleId)
  if (!bundle) {
    throw new Error('번들 LOT를 찾을 수 없습니다.')
  }

  const items = MOCK_BUNDLE_ITEMS.filter((i) => i.bundleLotId === bundleId)
  const unbundleableItems = items.filter((i) => i.status === 'BUNDLED')

  if (unbundleableItems.length === 0) {
    if (items.length > 0) {
      throw new Error('모든 아이템이 이미 출하되어 번들 해제할 수 없습니다.')
    }
    throw new Error('번들에 해제할 아이템이 없습니다.')
  }

  const unbundledItemIds: number[] = []
  const unbundledLotNumbers: string[] = []

  // 출하되지 않은 아이템 모두 제거
  for (const item of unbundleableItems) {
    const index = MOCK_BUNDLE_ITEMS.findIndex((i) => i.id === item.id)
    if (index !== -1) {
      MOCK_BUNDLE_ITEMS.splice(index, 1)
      bundle.totalQty -= item.quantity
      unbundledItemIds.push(item.id)
      unbundledLotNumbers.push(item.lotNumber)
    }
  }

  updateBundleStatus(bundleId)

  return {
    success: true,
    bundleId,
    bundleNo: bundle.bundleNo,
    unbundledItemIds,
    unbundledLotNumbers,
    newBundleStatus: bundle.status,
    message: `번들 전체 해제 완료 (${unbundledLotNumbers.length}개 아이템)`,
  }
}

// ============================================
// Bundle Queries
// ============================================

/**
 * 번들 ID로 조회
 */
export async function getBundleById(bundleLotId: number): Promise<BundleLotWithItems | null> {
  await new Promise((r) => setTimeout(r, 50))

  const bundle = MOCK_BUNDLES.find((b) => b.id === bundleLotId)
  if (!bundle) return null

  const items = MOCK_BUNDLE_ITEMS.filter((i) => i.bundleLotId === bundleLotId)

  return {
    ...bundle,
    items: items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  }
}

/**
 * 번들 번호로 조회
 */
export async function getBundleByNo(bundleNo: string): Promise<BundleLotWithItems | null> {
  const bundle = MOCK_BUNDLES.find((b) => b.bundleNo === bundleNo)
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
  await new Promise((r) => setTimeout(r, 100))

  let bundles = MOCK_BUNDLES.filter((b) => b.productId === productId)
  if (status) {
    bundles = bundles.filter((b) => b.status === status)
  }

  const result: BundleLotWithItems[] = []
  for (const bundle of bundles) {
    const withItems = await getBundleById(bundle.id)
    if (withItems) result.push(withItems)
  }

  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * 상태별 번들 조회
 */
export async function getBundlesByStatus(status: BundleStatus): Promise<BundleLotWithItems[]> {
  await new Promise((r) => setTimeout(r, 100))

  const bundles = MOCK_BUNDLES.filter((b) => b.status === status)

  const result: BundleLotWithItems[] = []
  for (const bundle of bundles) {
    const withItems = await getBundleById(bundle.id)
    if (withItems) result.push(withItems)
  }

  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * 진행 중인 번들 조회 (ACTIVE + PARTIAL)
 */
export async function getActiveBundles(): Promise<BundleLotWithItems[]> {
  await new Promise((r) => setTimeout(r, 100))

  const bundles = MOCK_BUNDLES.filter(
    (b) => b.status === 'ACTIVE' || b.status === 'PARTIAL'
  )

  const result: BundleLotWithItems[] = []
  for (const bundle of bundles) {
    const withItems = await getBundleById(bundle.id)
    if (withItems) result.push(withItems)
  }

  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * 번들 출하 통계
 */
export async function getBundleShippingStats(): Promise<{
  totalBundles: number
  byStatus: Record<BundleStatus, number>
  totalItems: number
  shippedItems: number
  pendingItems: number
}> {
  await new Promise((r) => setTimeout(r, 50))

  const byStatus: Record<BundleStatus, number> = {
    ACTIVE: 0,
    PARTIAL: 0,
    SHIPPED: 0,
    UNBUNDLED: 0,
  }

  for (const bundle of MOCK_BUNDLES) {
    byStatus[bundle.status]++
  }

  const shippedItems = MOCK_BUNDLE_ITEMS.filter((i) => i.status === 'SHIPPED').length
  const pendingItems = MOCK_BUNDLE_ITEMS.filter((i) => i.status === 'BUNDLED').length

  return {
    totalBundles: MOCK_BUNDLES.length,
    byStatus,
    totalItems: MOCK_BUNDLE_ITEMS.length,
    shippedItems,
    pendingItems,
  }
}

/**
 * 아이템 상태별 조회
 */
export async function getBundleItemsByStatus(
  bundleId: number,
  status: BundleItemStatus
): Promise<MockBundleItem[]> {
  await new Promise((r) => setTimeout(r, 50))

  return MOCK_BUNDLE_ITEMS.filter(
    (i) => i.bundleLotId === bundleId && i.status === status
  )
}

/**
 * 출하된 아이템 조회 (전체)
 */
export async function getShippedItems(): Promise<Array<MockBundleItem & { bundleNo: string }>> {
  await new Promise((r) => setTimeout(r, 100))

  const shippedItems = MOCK_BUNDLE_ITEMS.filter((i) => i.status === 'SHIPPED')

  return shippedItems.map((item) => {
    const bundle = MOCK_BUNDLES.find((b) => b.id === item.bundleLotId)
    return {
      ...item,
      bundleNo: bundle?.bundleNo || 'UNKNOWN',
    }
  })
}

// ============================================
// Bundle Status Constants
// ============================================

export const BUNDLE_STATUS_NAMES: Record<BundleStatus, string> = {
  ACTIVE: '활성',
  PARTIAL: '일부 출하',
  SHIPPED: '출하 완료',
  UNBUNDLED: '해제됨',
}

export const BUNDLE_ITEM_STATUS_NAMES: Record<BundleItemStatus, string> = {
  BUNDLED: '번들 포함',
  SHIPPED: '출하됨',
}
