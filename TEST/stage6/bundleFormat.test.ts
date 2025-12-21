/**
 * Stage 6 - Bundle Format Tests
 *
 * SET 정보 포맷 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createSetBundle,
  formatSetInfo,
  getProductsInBundle,
} from '../../src/services/bundleService'

const prisma = new PrismaClient()

describe('Bundle Format', () => {
  const testProductCode1 = 'FMT_PROD1_' + String(Date.now()).slice(-6)
  const testProductCode2 = 'FMT_PROD2_' + String(Date.now()).slice(-6)
  const testProductCode3 = 'FMT_PROD3_' + String(Date.now()).slice(-6)
  let testProduct1Id: number
  let testProduct2Id: number
  let testProduct3Id: number
  let testLot1Id: number
  let testLot2Id: number
  let testLot3Id: number
  let testLot4Id: number

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 제품 생성
    const product1 = await prisma.product.create({
      data: {
        code: testProductCode1,
        name: 'Format Test Product 1',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct1Id = product1.id

    const product2 = await prisma.product.create({
      data: {
        code: testProductCode2,
        name: 'Format Test Product 2',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct2Id = product2.id

    const product3 = await prisma.product.create({
      data: {
        code: testProductCode3,
        name: 'Format Test Product 3',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct3Id = product3.id

    // 테스트용 LOT 생성
    const lot1 = await prisma.productionLot.create({
      data: {
        lotNumber: 'FLOT1_' + String(Date.now()).slice(-6),
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
        lotNumber: 'FLOT2_' + String(Date.now()).slice(-6),
        productId: testProduct1Id,
        processCode: 'CA',
        plannedQty: 200,
        status: 'COMPLETED',
        completedQty: 200,
      },
    })
    testLot2Id = lot2.id

    const lot3 = await prisma.productionLot.create({
      data: {
        lotNumber: 'FLOT3_' + String(Date.now()).slice(-6),
        productId: testProduct2Id,
        processCode: 'CA',
        plannedQty: 150,
        status: 'COMPLETED',
        completedQty: 150,
      },
    })
    testLot3Id = lot3.id

    const lot4 = await prisma.productionLot.create({
      data: {
        lotNumber: 'FLOT4_' + String(Date.now()).slice(-6),
        productId: testProduct3Id,
        processCode: 'CA',
        plannedQty: 50,
        status: 'COMPLETED',
        completedQty: 50,
      },
    })
    testLot4Id = lot4.id
  })

  afterAll(async () => {
    await prisma.bundleItem.deleteMany({
      where: {
        bundleLot: {
          productId: { in: [testProduct1Id, testProduct2Id, testProduct3Id] },
        },
      },
    })
    await prisma.bundleLot.deleteMany({
      where: {
        productId: { in: [testProduct1Id, testProduct2Id, testProduct3Id] },
      },
    })
    await prisma.productionLot.deleteMany({
      where: {
        productId: { in: [testProduct1Id, testProduct2Id, testProduct3Id] },
      },
    })
    await prisma.product.deleteMany({
      where: {
        code: { in: [testProductCode1, testProductCode2, testProductCode3] },
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
          productId: { in: [testProduct1Id, testProduct2Id, testProduct3Id] },
        },
      },
    })
    await prisma.bundleLot.deleteMany({
      where: {
        productId: { in: [testProduct1Id, testProduct2Id, testProduct3Id] },
      },
    })
  })

  describe('formatSetInfo', () => {
    it('should format SAME_PRODUCT bundle info', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot2Id, quantity: 200 },
      ])

      const info = await formatSetInfo(bundle.id)

      // "품번코드 × 총수량 (개수개)" 형식
      expect(info).toContain(testProductCode1)
      expect(info).toContain('300')
      expect(info).toContain('2개')
    })

    it('should format MULTI_PRODUCT bundle info', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot3Id, quantity: 150 },
      ])

      const info = await formatSetInfo(bundle.id)

      // "SET × 총수량 (품번수품번)" 형식
      expect(info).toContain('SET')
      expect(info).toContain('250')
      expect(info).toContain('2품번')
    })

    it('should format multi-product bundle with 3+ products', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot3Id, quantity: 150 },
        { lotId: testLot4Id, quantity: 50 },
      ])

      const info = await formatSetInfo(bundle.id)

      expect(info).toContain('SET')
      expect(info).toContain('300')
      expect(info).toContain('3품번')
    })

    it('should throw error for non-existent bundle', async () => {
      await expect(formatSetInfo(999999)).rejects.toThrow(
        '번들을 찾을 수 없습니다'
      )
    })
  })

  describe('getProductsInBundle', () => {
    it('should return products aggregated by code', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot2Id, quantity: 200 },
        { lotId: testLot3Id, quantity: 150 },
      ])

      const products = await getProductsInBundle(bundle.id)

      expect(products).toHaveLength(2)

      const prod1 = products.find((p) => p.productCode === testProductCode1)
      expect(prod1).toBeDefined()
      expect(prod1!.count).toBe(2)
      expect(prod1!.totalQty).toBe(300)

      const prod2 = products.find((p) => p.productCode === testProductCode2)
      expect(prod2).toBeDefined()
      expect(prod2!.count).toBe(1)
      expect(prod2!.totalQty).toBe(150)
    })

    it('should include product name', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
      ])

      const products = await getProductsInBundle(bundle.id)

      expect(products[0].productName).toBe('Format Test Product 1')
    })

    it('should return empty array for empty bundle', async () => {
      const bundle = await prisma.bundleLot.create({
        data: {
          bundleNo: 'EMPTY_FMT_' + Date.now(),
          productId: testProduct1Id,
          bundleType: 'SAME_PRODUCT',
          setQuantity: 0,
          totalQty: 0,
          status: 'CREATED',
        },
      })

      const products = await getProductsInBundle(bundle.id)
      expect(products).toHaveLength(0)
    })
  })
})
