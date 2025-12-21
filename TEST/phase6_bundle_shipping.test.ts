/**
 * Phase 6: 번들 출하 관리 테스트
 *
 * 테스트 항목:
 * 1. 개별 아이템 출하 (shipBundleItem)
 * 2. 전체 번들 출하 (shipEntireBundle)
 * 3. 개별 아이템 번들 해제 (unbundleItem)
 * 4. 전체 번들 해제 (unbundleAll)
 * 5. 번들 상태 자동 전이
 * 6. 출하 통계 조회
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createBundle,
  addToBundle,
  removeFromBundle,
  getBundleById,
  getBundlesByStatus,
  getActiveBundles,
  shipBundleItem,
  shipEntireBundle,
  cancelItemShipment,
  unbundleItem,
  unbundleAll,
  getBundleShippingStats,
  getShippedItems,
  getBundleItemsByStatus,
  resetBundleData,
  BUNDLE_STATUS_NAMES,
  BUNDLE_ITEM_STATUS_NAMES,
  type BundleStatus,
  type BundleItemStatus,
} from '../src/services/mock/bundleService.mock'

describe('Phase 6: 번들 출하 관리', () => {
  beforeEach(() => {
    resetBundleData()
  })

  // ============================================
  // 번들 생성 및 아이템 추가 테스트
  // ============================================

  describe('번들 생성 및 아이템 추가', () => {
    it('번들 생성 → ACTIVE 상태', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      expect(bundle.status).toBe('ACTIVE')
      expect(bundle.items).toHaveLength(0)
    })

    it('번들에 아이템 추가', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      expect(updated.items).toHaveLength(1)
      expect(updated.items[0].status).toBe('BUNDLED')
      expect(updated.totalQty).toBe(100)
    })

    it('아이템 추가 시 BUNDLED 상태로 시작', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const result = await getBundleItemsByStatus(bundle.id, 'BUNDLED')
      expect(result).toHaveLength(1)
    })
  })

  // ============================================
  // 개별 아이템 출하 테스트
  // ============================================

  describe('shipBundleItem (개별 아이템 출하)', () => {
    it('개별 아이템 출하 성공', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const result = await shipBundleItem(bundle.id, updated.items[0].id)

      expect(result.success).toBe(true)
      expect(result.shippedLotNumbers).toContain('CA-241221-0001')
    })

    it('개별 출하 후 PARTIAL 상태로 전이', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      // 2개 아이템 추가
      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      // 1개만 출하
      const result = await shipBundleItem(bundle.id, updated.items[0].id)

      expect(result.newBundleStatus).toBe('PARTIAL')
    })

    it('이미 출하된 아이템 재출하 → 에러', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await shipBundleItem(bundle.id, updated.items[0].id)

      await expect(shipBundleItem(bundle.id, updated.items[0].id)).rejects.toThrow(
        '이미 출하된 아이템입니다.'
      )
    })

    it('존재하지 않는 번들 → 에러', async () => {
      await expect(shipBundleItem(9999, 1)).rejects.toThrow('번들 LOT를 찾을 수 없습니다.')
    })

    it('존재하지 않는 아이템 → 에러', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      await expect(shipBundleItem(bundle.id, 9999)).rejects.toThrow(
        '번들 아이템을 찾을 수 없습니다.'
      )
    })
  })

  // ============================================
  // 전체 번들 출하 테스트
  // ============================================

  describe('shipEntireBundle (전체 번들 출하)', () => {
    it('전체 번들 출하 성공', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 2,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      const result = await shipEntireBundle(bundle.id)

      expect(result.success).toBe(true)
      expect(result.shippedLotNumbers).toHaveLength(2)
      expect(result.newBundleStatus).toBe('SHIPPED')
    })

    it('전체 출하 후 SHIPPED 상태', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await shipEntireBundle(bundle.id)

      const updated = await getBundleById(bundle.id)
      expect(updated?.status).toBe('SHIPPED')
    })

    it('일부 출하된 번들의 나머지 전체 출하', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 3,
      })

      // 3개 아이템 추가
      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 103,
        lotNumber: 'CA-241221-0003',
        processCode: 'CA',
        quantity: 100,
      })

      // 1개 먼저 출하
      await shipBundleItem(bundle.id, updated.items[0].id)

      // 나머지 전체 출하
      const result = await shipEntireBundle(bundle.id)

      expect(result.shippedLotNumbers).toHaveLength(2) // 나머지 2개만 출하
      expect(result.newBundleStatus).toBe('SHIPPED')
    })

    it('아이템 없는 번들 출하 → 에러', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      await expect(shipEntireBundle(bundle.id)).rejects.toThrow('번들에 출하할 아이템이 없습니다.')
    })

    it('이미 전체 출하된 번들 재출하 → 에러', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await shipEntireBundle(bundle.id)

      await expect(shipEntireBundle(bundle.id)).rejects.toThrow(
        '모든 아이템이 이미 출하되었습니다.'
      )
    })
  })

  // ============================================
  // 출하 취소 테스트
  // ============================================

  describe('cancelItemShipment (출하 취소)', () => {
    it('출하 취소 후 BUNDLED 상태로 복원', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await shipBundleItem(bundle.id, updated.items[0].id)
      const result = await cancelItemShipment(bundle.id, updated.items[0].id)

      expect(result.success).toBe(true)
      expect(result.newBundleStatus).toBe('ACTIVE')
    })

    it('출하되지 않은 아이템 취소 → 에러', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await expect(cancelItemShipment(bundle.id, updated.items[0].id)).rejects.toThrow(
        '출하되지 않은 아이템입니다.'
      )
    })
  })

  // ============================================
  // 개별 아이템 번들 해제 테스트
  // ============================================

  describe('unbundleItem (개별 아이템 번들 해제)', () => {
    it('개별 아이템 해제 성공', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 2,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      const result = await unbundleItem(bundle.id, updated.items[0].id)

      expect(result.success).toBe(true)
      expect(result.unbundledLotNumbers).toContain('CA-241221-0001')
    })

    it('해제 후 아이템 수량 감소', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 2,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 50,
      })

      await unbundleItem(bundle.id, updated.items[1].id)

      const final = await getBundleById(bundle.id)
      expect(final?.items).toHaveLength(1)
      expect(final?.totalQty).toBe(100)
    })

    it('마지막 아이템 해제 → UNBUNDLED 상태', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const result = await unbundleItem(bundle.id, updated.items[0].id)

      expect(result.newBundleStatus).toBe('UNBUNDLED')
    })

    it('출하된 아이템 해제 → 에러', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await shipBundleItem(bundle.id, updated.items[0].id)

      await expect(unbundleItem(bundle.id, updated.items[0].id)).rejects.toThrow(
        '이미 출하된 아이템은 번들 해제할 수 없습니다.'
      )
    })
  })

  // ============================================
  // 전체 번들 해제 테스트
  // ============================================

  describe('unbundleAll (전체 번들 해제)', () => {
    it('전체 해제 성공', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 2,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      const result = await unbundleAll(bundle.id)

      expect(result.success).toBe(true)
      expect(result.unbundledLotNumbers).toHaveLength(2)
      expect(result.newBundleStatus).toBe('UNBUNDLED')
    })

    it('해제 후 원본 LOT 번호 목록 반환', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 3,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 103,
        lotNumber: 'CA-241221-0003',
        processCode: 'CA',
        quantity: 100,
      })

      const result = await unbundleAll(bundle.id)

      expect(result.unbundledLotNumbers).toContain('CA-241221-0001')
      expect(result.unbundledLotNumbers).toContain('CA-241221-0002')
      expect(result.unbundledLotNumbers).toContain('CA-241221-0003')
    })

    it('일부 출하된 번들의 나머지만 해제', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 3,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 103,
        lotNumber: 'CA-241221-0003',
        processCode: 'CA',
        quantity: 100,
      })

      // 1개 출하
      await shipBundleItem(bundle.id, updated.items[0].id)

      // 나머지 해제
      const result = await unbundleAll(bundle.id)

      // 출하된 것 제외한 2개만 해제
      expect(result.unbundledLotNumbers).toHaveLength(2)
      expect(result.unbundledLotNumbers).not.toContain('CA-241221-0001')
    })

    it('빈 번들 해제 → 에러', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })

      await expect(unbundleAll(bundle.id)).rejects.toThrow('번들에 해제할 아이템이 없습니다.')
    })

    it('전부 출하된 번들 해제 → 에러', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await shipEntireBundle(bundle.id)

      await expect(unbundleAll(bundle.id)).rejects.toThrow(
        '모든 아이템이 이미 출하되어 번들 해제할 수 없습니다.'
      )
    })
  })

  // ============================================
  // 번들 상태 자동 전이 테스트
  // ============================================

  describe('번들 상태 자동 전이', () => {
    it('ACTIVE → PARTIAL (일부 출하)', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 2,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      expect(updated.status).toBe('ACTIVE')

      await shipBundleItem(bundle.id, updated.items[0].id)
      const afterShip = await getBundleById(bundle.id)

      expect(afterShip?.status).toBe('PARTIAL')
    })

    it('PARTIAL → SHIPPED (전체 출하)', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 2,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      // 1개 출하 → PARTIAL
      await shipBundleItem(bundle.id, updated.items[0].id)

      // 나머지 1개 출하 → SHIPPED
      await shipBundleItem(bundle.id, updated.items[1].id)
      const afterShip = await getBundleById(bundle.id)

      expect(afterShip?.status).toBe('SHIPPED')
    })

    it('ACTIVE → UNBUNDLED (전체 해제)', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      expect(updated.status).toBe('ACTIVE')

      await unbundleItem(bundle.id, updated.items[0].id)
      const afterUnbundle = await getBundleById(bundle.id)

      expect(afterUnbundle?.status).toBe('UNBUNDLED')
    })

    it('PARTIAL → ACTIVE (출하 취소)', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 2,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-241221-0002',
        processCode: 'CA',
        quantity: 100,
      })

      // 1개 출하 → PARTIAL
      await shipBundleItem(bundle.id, updated.items[0].id)
      let current = await getBundleById(bundle.id)
      expect(current?.status).toBe('PARTIAL')

      // 출하 취소 → ACTIVE
      await cancelItemShipment(bundle.id, updated.items[0].id)
      current = await getBundleById(bundle.id)
      expect(current?.status).toBe('ACTIVE')
    })
  })

  // ============================================
  // 출하 통계 테스트
  // ============================================

  describe('getBundleShippingStats (출하 통계)', () => {
    it('빈 상태에서 통계 조회', async () => {
      const stats = await getBundleShippingStats()

      expect(stats.totalBundles).toBe(0)
      expect(stats.byStatus.ACTIVE).toBe(0)
      expect(stats.byStatus.SHIPPED).toBe(0)
      expect(stats.totalItems).toBe(0)
    })

    it('여러 상태의 번들 통계', async () => {
      // ACTIVE 번들 1개
      const bundle1 = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '제품1',
        setQuantity: 2,
      })
      await addToBundle({
        bundleLotId: bundle1.id,
        productionLotId: 101,
        lotNumber: 'CA-0001',
        processCode: 'CA',
        quantity: 100,
      })

      // SHIPPED 번들 1개
      const bundle2 = await createBundle({
        processCode: 'CA',
        productId: 2,
        productCode: 'P002',
        productName: '제품2',
        setQuantity: 1,
      })
      await addToBundle({
        bundleLotId: bundle2.id,
        productionLotId: 102,
        lotNumber: 'CA-0002',
        processCode: 'CA',
        quantity: 50,
      })
      await shipEntireBundle(bundle2.id)

      const stats = await getBundleShippingStats()

      expect(stats.totalBundles).toBe(2)
      expect(stats.byStatus.ACTIVE).toBe(1)
      expect(stats.byStatus.SHIPPED).toBe(1)
      expect(stats.totalItems).toBe(2)
      expect(stats.shippedItems).toBe(1)
      expect(stats.pendingItems).toBe(1)
    })
  })

  // ============================================
  // 조회 기능 테스트
  // ============================================

  describe('조회 기능', () => {
    it('상태별 번들 조회', async () => {
      // ACTIVE 번들
      const bundle1 = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '제품1',
        setQuantity: 2,
      })
      await addToBundle({
        bundleLotId: bundle1.id,
        productionLotId: 101,
        lotNumber: 'CA-0001',
        processCode: 'CA',
        quantity: 100,
      })

      // SHIPPED 번들
      const bundle2 = await createBundle({
        processCode: 'CA',
        productId: 2,
        productCode: 'P002',
        productName: '제품2',
        setQuantity: 1,
      })
      await addToBundle({
        bundleLotId: bundle2.id,
        productionLotId: 102,
        lotNumber: 'CA-0002',
        processCode: 'CA',
        quantity: 50,
      })
      await shipEntireBundle(bundle2.id)

      const activeBundles = await getBundlesByStatus('ACTIVE')
      const shippedBundles = await getBundlesByStatus('SHIPPED')

      expect(activeBundles).toHaveLength(1)
      expect(shippedBundles).toHaveLength(1)
    })

    it('활성 번들 조회 (ACTIVE + PARTIAL)', async () => {
      // ACTIVE 번들
      const bundle1 = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '제품1',
        setQuantity: 2,
      })
      await addToBundle({
        bundleLotId: bundle1.id,
        productionLotId: 101,
        lotNumber: 'CA-0001',
        processCode: 'CA',
        quantity: 100,
      })

      // PARTIAL 번들
      const bundle2 = await createBundle({
        processCode: 'CA',
        productId: 2,
        productCode: 'P002',
        productName: '제품2',
        setQuantity: 2,
      })
      await addToBundle({
        bundleLotId: bundle2.id,
        productionLotId: 102,
        lotNumber: 'CA-0002',
        processCode: 'CA',
        quantity: 50,
      })
      const updated = await addToBundle({
        bundleLotId: bundle2.id,
        productionLotId: 103,
        lotNumber: 'CA-0003',
        processCode: 'CA',
        quantity: 50,
      })
      await shipBundleItem(bundle2.id, updated.items[0].id)

      // SHIPPED 번들
      const bundle3 = await createBundle({
        processCode: 'CA',
        productId: 3,
        productCode: 'P003',
        productName: '제품3',
        setQuantity: 1,
      })
      await addToBundle({
        bundleLotId: bundle3.id,
        productionLotId: 104,
        lotNumber: 'CA-0004',
        processCode: 'CA',
        quantity: 100,
      })
      await shipEntireBundle(bundle3.id)

      const activeBundles = await getActiveBundles()

      expect(activeBundles).toHaveLength(2) // ACTIVE + PARTIAL
    })

    it('출하된 아이템 조회', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '제품1',
        setQuantity: 2,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-0001',
        processCode: 'CA',
        quantity: 100,
      })

      const updated = await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 102,
        lotNumber: 'CA-0002',
        processCode: 'CA',
        quantity: 50,
      })

      await shipBundleItem(bundle.id, updated.items[0].id)

      const shippedItems = await getShippedItems()

      expect(shippedItems).toHaveLength(1)
      expect(shippedItems[0].lotNumber).toBe('CA-0001')
    })
  })

  // ============================================
  // 상수 검증 테스트
  // ============================================

  describe('상수 검증', () => {
    it('BUNDLE_STATUS_NAMES: 4개 상태 포함', () => {
      expect(Object.keys(BUNDLE_STATUS_NAMES)).toHaveLength(4)
      expect(BUNDLE_STATUS_NAMES.ACTIVE).toBe('활성')
      expect(BUNDLE_STATUS_NAMES.PARTIAL).toBe('일부 출하')
      expect(BUNDLE_STATUS_NAMES.SHIPPED).toBe('출하 완료')
      expect(BUNDLE_STATUS_NAMES.UNBUNDLED).toBe('해제됨')
    })

    it('BUNDLE_ITEM_STATUS_NAMES: 2개 상태 포함', () => {
      expect(Object.keys(BUNDLE_ITEM_STATUS_NAMES)).toHaveLength(2)
      expect(BUNDLE_ITEM_STATUS_NAMES.BUNDLED).toBe('번들 포함')
      expect(BUNDLE_ITEM_STATUS_NAMES.SHIPPED).toBe('출하됨')
    })
  })

  // ============================================
  // 복합 시나리오 테스트
  // ============================================

  describe('복합 시나리오', () => {
    it('전체 워크플로우: 생성 → 추가 → 일부 출하 → 나머지 해제', async () => {
      // 1. 번들 생성
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 4,
      })
      expect(bundle.status).toBe('ACTIVE')

      // 2. 4개 아이템 추가
      for (let i = 1; i <= 4; i++) {
        await addToBundle({
          bundleLotId: bundle.id,
          productionLotId: 100 + i,
          lotNumber: `CA-241221-000${i}`,
          processCode: 'CA',
          quantity: 100,
        })
      }

      let current = await getBundleById(bundle.id)
      expect(current?.items).toHaveLength(4)

      // 3. 2개 출하
      await shipBundleItem(bundle.id, current!.items[0].id)
      await shipBundleItem(bundle.id, current!.items[1].id)

      current = await getBundleById(bundle.id)
      expect(current?.status).toBe('PARTIAL')

      // 4. 나머지 2개 해제
      const unbundleResult = await unbundleAll(bundle.id)
      expect(unbundleResult.unbundledLotNumbers).toHaveLength(2)

      current = await getBundleById(bundle.id)
      // 출하된 2개만 남음
      expect(current?.items).toHaveLength(2)
      expect(current?.status).toBe('SHIPPED') // 모든 남은 아이템이 출하됨
    })

    it('여러 번들 관리: 동시 출하 및 해제', async () => {
      // 번들 2개 생성
      const bundle1 = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '제품1',
        setQuantity: 2,
      })

      const bundle2 = await createBundle({
        processCode: 'CA',
        productId: 2,
        productCode: 'P002',
        productName: '제품2',
        setQuantity: 2,
      })

      // 각각 2개씩 아이템 추가
      for (let i = 1; i <= 2; i++) {
        await addToBundle({
          bundleLotId: bundle1.id,
          productionLotId: 100 + i,
          lotNumber: `CA-B1-000${i}`,
          processCode: 'CA',
          quantity: 100,
        })

        await addToBundle({
          bundleLotId: bundle2.id,
          productionLotId: 200 + i,
          lotNumber: `CA-B2-000${i}`,
          processCode: 'CA',
          quantity: 100,
        })
      }

      // 번들1 전체 출하
      await shipEntireBundle(bundle1.id)

      // 번들2 전체 해제
      await unbundleAll(bundle2.id)

      const stats = await getBundleShippingStats()
      expect(stats.byStatus.SHIPPED).toBe(1)
      expect(stats.byStatus.UNBUNDLED).toBe(1)
      expect(stats.shippedItems).toBe(2)
      expect(stats.pendingItems).toBe(0)
    })

    it('출하 완료 번들 재출하/해제 방지', async () => {
      const bundle = await createBundle({
        processCode: 'CA',
        productId: 1,
        productCode: 'P001',
        productName: '테스트 제품',
        setQuantity: 1,
      })

      await addToBundle({
        bundleLotId: bundle.id,
        productionLotId: 101,
        lotNumber: 'CA-241221-0001',
        processCode: 'CA',
        quantity: 100,
      })

      await shipEntireBundle(bundle.id)

      // 재출하 시도 → 에러
      await expect(shipEntireBundle(bundle.id)).rejects.toThrow()

      // 해제 시도 → 에러
      await expect(unbundleAll(bundle.id)).rejects.toThrow()
    })
  })
})
