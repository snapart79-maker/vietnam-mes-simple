/**
 * Stage 6 - Bundle Type Tests
 *
 * 번들 타입 판별 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createSetBundle,
  determineBundleType,
  getBundleTypeById,
  updateBundleType,
} from '../../src/services/bundleService'

const prisma = new PrismaClient()

describe('Bundle Type', () => {
  const testProductCode1 = 'TYPE_PROD1_' + String(Date.now()).slice(-6)
  const testProductCode2 = 'TYPE_PROD2_' + String(Date.now()).slice(-6)
  let testProduct1Id: number
  let testProduct2Id: number
  let testLot1Id: number
  let testLot2Id: number
  let testLot3Id: number

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 제품 생성
    const product1 = await prisma.product.create({
      data: {
        code: testProductCode1,
        name: 'Type Test Product 1',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct1Id = product1.id

    const product2 = await prisma.product.create({
      data: {
        code: testProductCode2,
        name: 'Type Test Product 2',
        type: 'FINISHED',
        processCode: 'CA',
      },
    })
    testProduct2Id = product2.id

    // 테스트용 LOT 생성
    const lot1 = await prisma.productionLot.create({
      data: {
        lotNumber: 'TLOT1_' + String(Date.now()).slice(-6),
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
        lotNumber: 'TLOT2_' + String(Date.now()).slice(-6),
        productId: testProduct1Id,
        processCode: 'CA',
        plannedQty: 100,
        status: 'COMPLETED',
        completedQty: 100,
      },
    })
    testLot2Id = lot2.id

    const lot3 = await prisma.productionLot.create({
      data: {
        lotNumber: 'TLOT3_' + String(Date.now()).slice(-6),
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
  })

  describe('determineBundleType', () => {
    it('should return SAME_PRODUCT for single product bundle', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot2Id, quantity: 100 },
      ])

      const type = await determineBundleType(bundle.id)
      expect(type).toBe('SAME_PRODUCT')
    })

    it('should return MULTI_PRODUCT for multi-product bundle', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot3Id, quantity: 100 },
      ])

      const type = await determineBundleType(bundle.id)
      expect(type).toBe('MULTI_PRODUCT')
    })

    it('should return SAME_PRODUCT for empty bundle', async () => {
      const bundle = await prisma.bundleLot.create({
        data: {
          bundleNo: 'EMPTY_' + Date.now(),
          productId: testProduct1Id,
          bundleType: 'SAME_PRODUCT',
          setQuantity: 0,
          totalQty: 0,
          status: 'CREATED',
        },
      })

      const type = await determineBundleType(bundle.id)
      expect(type).toBe('SAME_PRODUCT')
    })
  })

  describe('getBundleTypeById', () => {
    it('should return stored bundle type', async () => {
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
        { lotId: testLot3Id, quantity: 100 },
      ])

      const type = await getBundleTypeById(bundle.id)
      expect(type).toBe('MULTI_PRODUCT')
    })

    it('should return null for non-existent bundle', async () => {
      const type = await getBundleTypeById(999999)
      expect(type).toBeNull()
    })
  })

  describe('updateBundleType', () => {
    it('should update bundle type based on items', async () => {
      // 먼저 동일 품번 번들 생성
      const bundle = await createSetBundle([
        { lotId: testLot1Id, quantity: 100 },
      ])

      expect(bundle.bundleType).toBe('SAME_PRODUCT')

      // 다른 품번 LOT 추가
      await prisma.bundleItem.create({
        data: {
          bundleLotId: bundle.id,
          productionLotId: testLot3Id,
          quantity: 100,
        },
      })

      // 타입 업데이트
      const newType = await updateBundleType(bundle.id)
      expect(newType).toBe('MULTI_PRODUCT')

      // DB 확인
      const storedType = await getBundleTypeById(bundle.id)
      expect(storedType).toBe('MULTI_PRODUCT')
    })
  })
})
