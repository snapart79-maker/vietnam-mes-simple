/**
 * Stage 6 - Bundle Search Tests
 *
 * 번들 내 검색 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createSetBundle,
  findItemInBundle,
  getBundleDetails,
  getBundleByNo,
} from '../../src/services/bundleService'

const prisma = new PrismaClient()

describe('Bundle Search', () => {
  const testProductCode1 = 'SRCH_PROD1_' + String(Date.now()).slice(-6)
  const testProductCode2 = 'SRCH_PROD2_' + String(Date.now()).slice(-6)
  let testProduct1Id: number
  let testProduct2Id: number
  let testLot1Id: number
  let testLot2Id: number
  let testLot3Id: number
  let testBundleNo: string

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 제품 생성
    const product1 = await prisma.product.create({
      data: {
        code: testProductCode1,
        name: 'Search Test Product 1',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct1Id = product1.id

    const product2 = await prisma.product.create({
      data: {
        code: testProductCode2,
        name: 'Search Test Product 2',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct2Id = product2.id

    // 테스트용 LOT 생성
    const lot1 = await prisma.productionLot.create({
      data: {
        lotNumber: 'SLOT1_' + String(Date.now()).slice(-6),
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
        lotNumber: 'SLOT2_' + String(Date.now()).slice(-6),
        productId: testProduct1Id,
        processCode: 'CA',
        plannedQty: 150,
        status: 'COMPLETED',
        completedQty: 150,
      },
    })
    testLot2Id = lot2.id

    const lot3 = await prisma.productionLot.create({
      data: {
        lotNumber: 'SLOT3_' + String(Date.now()).slice(-6),
        productId: testProduct2Id,
        processCode: 'CA',
        plannedQty: 200,
        status: 'COMPLETED',
        completedQty: 200,
      },
    })
    testLot3Id = lot3.id
  })

  afterAll(async () => {
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

    // 테스트용 번들 생성
    const bundle = await createSetBundle([
      { lotId: testLot1Id, quantity: 100 },
      { lotId: testLot2Id, quantity: 150 },
      { lotId: testLot3Id, quantity: 200 },
    ])
    testBundleNo = bundle.bundleNo
  })

  describe('findItemInBundle', () => {
    it('should find item by product code', async () => {
      const item = await findItemInBundle(testBundleNo, testProductCode1)

      expect(item).not.toBeNull()
      expect(item!.quantity).toBeGreaterThan(0)
      expect(item!.processCode).toBe('CA')
    })

    it('should return first matching item for same product', async () => {
      // testProductCode1에 2개 LOT가 있으므로 첫 번째 것을 반환
      const item = await findItemInBundle(testBundleNo, testProductCode1)

      expect(item).not.toBeNull()
      expect(item!.lotNumber).toContain('SLOT')
    })

    it('should find item from different product', async () => {
      const item = await findItemInBundle(testBundleNo, testProductCode2)

      expect(item).not.toBeNull()
      expect(item!.quantity).toBe(200)
    })

    it('should return null for non-existent product in bundle', async () => {
      const item = await findItemInBundle(testBundleNo, 'NON_EXISTENT_PRODUCT')
      expect(item).toBeNull()
    })

    it('should return null for non-existent bundle', async () => {
      const item = await findItemInBundle('NON_EXISTENT_BUNDLE', testProductCode1)
      expect(item).toBeNull()
    })
  })

  describe('getBundleByNo', () => {
    it('should find bundle by bundle number', async () => {
      const bundle = await getBundleByNo(testBundleNo)

      expect(bundle).not.toBeNull()
      expect(bundle!.bundleNo).toBe(testBundleNo)
      expect(bundle!.items).toHaveLength(3)
    })

    it('should include bundle type', async () => {
      const bundle = await getBundleByNo(testBundleNo)

      expect(bundle!.bundleType).toBe('MULTI_PRODUCT')
    })

    it('should return null for non-existent bundle', async () => {
      const bundle = await getBundleByNo('NON_EXISTENT')
      expect(bundle).toBeNull()
    })
  })

  describe('getBundleDetails', () => {
    it('should return detailed item information', async () => {
      const details = await getBundleDetails(testBundleNo)

      expect(details).not.toBeNull()
      expect(details!.items).toHaveLength(3)

      // 각 아이템에 품번 정보가 포함되어야 함
      const item1 = details!.items.find(
        (i) => i.productCode === testProductCode1
      )
      expect(item1).toBeDefined()
      expect(item1!.productName).toBe('Search Test Product 1')
    })

    it('should count unique products correctly', async () => {
      const details = await getBundleDetails(testBundleNo)

      // testProductCode1에 2개, testProductCode2에 1개
      expect(details!.uniqueProductCount).toBe(2)
    })

    it('should calculate total quantity', async () => {
      const details = await getBundleDetails(testBundleNo)

      // 100 + 150 + 200 = 450
      expect(details!.totalQuantity).toBe(450)
    })

    it('should include all items with lot numbers', async () => {
      const details = await getBundleDetails(testBundleNo)

      expect(details!.items.every((i) => i.lotNumber.length > 0)).toBe(true)
      expect(details!.items.every((i) => i.quantity > 0)).toBe(true)
    })
  })

  describe('Search Integration', () => {
    it('should find and get details for searched item', async () => {
      // 품번으로 아이템 검색
      const item = await findItemInBundle(testBundleNo, testProductCode2)
      expect(item).not.toBeNull()

      // 번들 상세 조회
      const details = await getBundleDetails(testBundleNo)
      expect(details).not.toBeNull()

      // 검색 결과와 상세 정보 일치 확인
      const detailItem = details!.items.find(
        (i) => i.productCode === testProductCode2
      )
      expect(detailItem).toBeDefined()
      expect(detailItem!.lotNumber).toBe(item!.lotNumber)
    })
  })
})
