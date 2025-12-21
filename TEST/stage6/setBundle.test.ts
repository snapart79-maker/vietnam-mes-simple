/**
 * Stage 6 - SET Bundle Tests
 *
 * SET 번들 생성 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createSetBundle,
  getBundleById,
  getBundleDetails,
  getMultiProductBundles,
  getSetBundleStats,
} from '../../src/services/bundleService'

const prisma = new PrismaClient()

describe('SET Bundle Creation', () => {
  const testProductCode1 = 'SET_PROD1_' + String(Date.now()).slice(-6)
  const testProductCode2 = 'SET_PROD2_' + String(Date.now()).slice(-6)
  let testProduct1Id: number
  let testProduct2Id: number
  let testLot1Id: number
  let testLot2Id: number
  let testLot3Id: number

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 제품 1 생성
    const product1 = await prisma.product.create({
      data: {
        code: testProductCode1,
        name: 'SET Test Product 1',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct1Id = product1.id

    // 테스트용 제품 2 생성
    const product2 = await prisma.product.create({
      data: {
        code: testProductCode2,
        name: 'SET Test Product 2',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct2Id = product2.id

    // 테스트용 LOT 생성 (제품 1에 2개)
    const lot1 = await prisma.productionLot.create({
      data: {
        lotNumber: 'LOT1_' + String(Date.now()).slice(-6),
        productId: testProduct1Id,
        processCode: 'CA',
        plannedQty: 100,
        status: 'COMPLETED',
        completedQty: 100,
      },
    })
    testLot1Id = lot1.id

    const lot2 = await prisma.productionLot.create({
      data: {
        lotNumber: 'LOT2_' + String(Date.now()).slice(-6),
        productId: testProduct1Id,
        processCode: 'CA',
        plannedQty: 100,
        status: 'COMPLETED',
        completedQty: 100,
      },
    })
    testLot2Id = lot2.id

    // 테스트용 LOT 생성 (제품 2에 1개)
    const lot3 = await prisma.productionLot.create({
      data: {
        lotNumber: 'LOT3_' + String(Date.now()).slice(-6),
        productId: testProduct2Id,
        processCode: 'CA',
        plannedQty: 100,
        status: 'COMPLETED',
        completedQty: 100,
      },
    })
    testLot3Id = lot3.id
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.bundleItem.deleteMany({
      where: {
        bundleLot: {
          productId: { in: [testProduct1Id, testProduct2Id] },
        },
      },
    })
    await prisma.bundleLot.deleteMany({
      where: {
        productId: { in: [testProduct1Id, testProduct2Id] },
      },
    })
    await prisma.productionLot.deleteMany({
      where: {
        productId: { in: [testProduct1Id, testProduct2Id] },
      },
    })
    await prisma.product.deleteMany({
      where: {
        code: { in: [testProductCode1, testProductCode2] },
      },
    })
    // 시퀀스 카운터 정리
    await prisma.sequenceCounter.deleteMany({
      where: {
        prefix: { contains: 'BUNDLE' },
      },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // 각 테스트 전에 번들 정리
    await prisma.bundleItem.deleteMany({
      where: {
        bundleLot: {
          productId: { in: [testProduct1Id, testProduct2Id] },
        },
      },
    })
    await prisma.bundleLot.deleteMany({
      where: {
        productId: { in: [testProduct1Id, testProduct2Id] },
      },
    })
  })

  describe('createSetBundle', () => {
    it('should create SAME_PRODUCT bundle with same product lots', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot2Id, quantity: 100 },
      ])

      expect(bundle.bundleType).toBe('SAME_PRODUCT')
      expect(bundle.items).toHaveLength(2)
      expect(bundle.setQuantity).toBe(2)
      expect(bundle.totalQty).toBe(200)
    })

    it('should create MULTI_PRODUCT bundle with different product lots', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot3Id, quantity: 100 },
      ])

      expect(bundle.bundleType).toBe('MULTI_PRODUCT')
      expect(bundle.items).toHaveLength(2)
      expect(bundle.setQuantity).toBe(2)
      expect(bundle.totalQty).toBe(200)
    })

    it('should include SET in bundle number for multi-product', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot3Id, quantity: 100 },
      ])

      expect(bundle.bundleNo).toContain('SET')
    })

    it('should throw error for empty items', async () => {
      await expect(createSetBundle([])).rejects.toThrow(
        '번들에 추가할 아이템이 없습니다'
      )
    })

    it('should throw error for invalid lot ids', async () => {
      await expect(
        createSetBundle([{ lotId: 999999, quantity: 100 }])
      ).rejects.toThrow('일부 LOT를 찾을 수 없습니다')
    })

    it('should calculate total quantity correctly', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 50 },
        { lotId: testLot2Id, quantity: 75 },
        { lotId: testLot3Id, quantity: 25 },
      ])

      expect(bundle.totalQty).toBe(150)
      expect(bundle.setQuantity).toBe(3)
    })
  })

  describe('getBundleDetails', () => {
    it('should return bundle details with item info', async () => {
      const created = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot3Id, quantity: 100 },
      ])

      const details = await getBundleDetails(created.bundleNo)

      expect(details).not.toBeNull()
      expect(details!.bundleType).toBe('MULTI_PRODUCT')
      expect(details!.uniqueProductCount).toBe(2)
      expect(details!.items).toHaveLength(2)
    })

    it('should include product info in items', async () => {
      const created = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
      ])

      const details = await getBundleDetails(created.bundleNo)

      expect(details!.items[0].productCode).toBe(testProductCode1)
      expect(details!.items[0].productName).toBeDefined()
    })

    it('should return null for non-existent bundle', async () => {
      const details = await getBundleDetails('NON_EXISTENT_BUNDLE')
      expect(details).toBeNull()
    })
  })

  describe('getMultiProductBundles', () => {
    it('should return only multi-product bundles', async () => {
      // 동일 품번 번들 생성
      await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot2Id, quantity: 100 },
      ])

      // 다른 품번 번들 생성
      await createSetBundle([
        { lotId: testLot1Id, quantity: 50 },
        { lotId: testLot3Id, quantity: 50 },
      ])

      const multiBundles = await getMultiProductBundles()

      expect(multiBundles.length).toBeGreaterThanOrEqual(1)
      expect(multiBundles.every((b) => b.bundleType === 'MULTI_PRODUCT')).toBe(
        true
      )
    })
  })

  describe('getSetBundleStats', () => {
    it('should return bundle type statistics', async () => {
      // 동일 품번 번들 생성
      await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
      ])

      // 다른 품번 번들 생성
      await createSetBundle([
        { lotId: testLot2Id, quantity: 50 },
        { lotId: testLot3Id, quantity: 50 },
      ])

      const stats = await getSetBundleStats()

      expect(stats.totalSetBundles).toBeGreaterThanOrEqual(2)
      expect(stats.sameProductCount).toBeGreaterThanOrEqual(1)
      expect(stats.multiProductCount).toBeGreaterThanOrEqual(1)
    })
  })
})
