/**
 * Stage 4 - Semi-Product Flow Tests
 *
 * 반제품 흐름 테스트 (전공정품 소요량)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createMBOMEntry,
  calculateSemiProductRequirements,
  addMaterialsToProcess,
  clearProcessMaterials,
  canAddMaterialToProcess,
  copyMBOM,
  clearProductMBOM,
} from '../../src/services/mbomService'

const prisma = new PrismaClient()

describe('Semi-Product Flow', () => {
  const testProductCode = 'FLOW_PROD_' + String(Date.now()).slice(-6)
  let testProductId: number
  let testSemiProductId: number
  let testMaterialId: number

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 완제품 생성
    const product = await prisma.product.create({
      data: {
        code: testProductCode,
        name: 'Flow Test Product',
        type: 'FINISHED',
        processCode: 'PA',
      },
    })
    testProductId = product.id

    // 테스트용 반제품(절압품) 생성
    const semiProduct = await prisma.product.create({
      data: {
        code: testProductCode + '-001',
        name: 'Flow Test Semi Product',
        type: 'SEMI_CA',
        processCode: 'CA',
        parentCode: testProductCode,
        circuitNo: 1,
      },
    })
    testSemiProductId = semiProduct.id

    // 테스트용 자재 생성
    const material = await prisma.material.create({
      data: {
        code: 'FLOW_MAT_' + String(Date.now()).slice(-6),
        name: 'Flow Test Material',
        category: '원자재',
        unit: 'EA',
      },
    })
    testMaterialId = material.id
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.bOM.deleteMany({
      where: {
        productId: { in: [testProductId, testProductId + 1000] },
      },
    })
    await prisma.product.deleteMany({
      where: {
        OR: [
          { code: testProductCode },
          { parentCode: testProductCode },
          { code: testProductCode + '_COPY' },
        ],
      },
    })
    await prisma.material.delete({
      where: { id: testMaterialId },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await clearProductMBOM(testProductId)
  })

  describe('calculateSemiProductRequirements', () => {
    it('should calculate semi-product requirements', async () => {
      // PA 공정에 절압품 투입
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'SEMI_PRODUCT',
        inputSemiId: testSemiProductId,
        quantity: 2,  // 완제품당 절압품 2개
      })

      const requirements = await calculateSemiProductRequirements(
        testProductId,
        'PA',
        100
      )

      expect(requirements).toHaveLength(1)
      expect(requirements[0].productId).toBe(testSemiProductId)
      expect(requirements[0].quantityPerUnit).toBe(2)
      expect(requirements[0].requiredQty).toBe(200)
    })

    it('should include product details in requirements', async () => {
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'SEMI_PRODUCT',
        inputSemiId: testSemiProductId,
        quantity: 1,
      })

      const requirements = await calculateSemiProductRequirements(
        testProductId,
        'PA',
        1
      )

      expect(requirements[0].productCode).toBe(testProductCode + '-001')
      expect(requirements[0].type).toBe('SEMI_CA')
      expect(requirements[0].fromProcess).toBe('CA')
    })

    it('should return empty array when no semi-products', async () => {
      const requirements = await calculateSemiProductRequirements(
        testProductId,
        'PA',
        100
      )

      expect(requirements).toHaveLength(0)
    })
  })

  describe('Bulk Operations', () => {
    it('addMaterialsToProcess should add multiple materials', async () => {
      const count = await addMaterialsToProcess(testProductId, 'CA', [
        { materialId: testMaterialId, quantity: 2, unit: 'M' },
        { materialId: testMaterialId, quantity: 3, unit: 'EA' },
      ])

      expect(count).toBe(2)

      const entries = await prisma.bOM.findMany({
        where: { productId: testProductId, processCode: 'CA' },
      })

      expect(entries).toHaveLength(2)
    })

    it('clearProcessMaterials should remove all materials from process', async () => {
      // 먼저 자재 추가
      await addMaterialsToProcess(testProductId, 'CA', [
        { materialId: testMaterialId, quantity: 1 },
        { materialId: testMaterialId, quantity: 2 },
      ])

      const count = await clearProcessMaterials(testProductId, 'CA')

      expect(count).toBe(2)

      const remaining = await prisma.bOM.findMany({
        where: { productId: testProductId, processCode: 'CA' },
      })

      expect(remaining).toHaveLength(0)
    })
  })

  describe('Validation', () => {
    it('canAddMaterialToProcess should return true for CA', async () => {
      const can = await canAddMaterialToProcess('CA')
      expect(can).toBe(true)
    })

    it('canAddMaterialToProcess should return false for MS (no material input)', async () => {
      const can = await canAddMaterialToProcess('MS')
      expect(can).toBe(false)
    })

    it('canAddMaterialToProcess should return false for CQ (inspection)', async () => {
      const can = await canAddMaterialToProcess('CQ')
      expect(can).toBe(false)
    })

    it('canAddMaterialToProcess should return false for invalid process', async () => {
      const can = await canAddMaterialToProcess('INVALID')
      expect(can).toBe(false)
    })
  })

  describe('Copy Operations', () => {
    it('copyMBOM should copy all entries to new product', async () => {
      // 원본에 항목 추가
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialId,
        quantity: 2,
      })
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'MATERIAL',
        materialId: testMaterialId,
        quantity: 1,
      })

      // 복사 대상 제품 생성
      const targetProduct = await prisma.product.create({
        data: {
          code: testProductCode + '_COPY',
          name: 'Copy Target Product',
          type: 'FINISHED',
        },
      })

      const count = await copyMBOM(testProductId, targetProduct.id)

      expect(count).toBe(2)

      const targetEntries = await prisma.bOM.findMany({
        where: { productId: targetProduct.id },
      })

      expect(targetEntries).toHaveLength(2)

      // 정리
      await prisma.bOM.deleteMany({
        where: { productId: targetProduct.id },
      })
      await prisma.product.delete({
        where: { id: targetProduct.id },
      })
    })
  })
})
