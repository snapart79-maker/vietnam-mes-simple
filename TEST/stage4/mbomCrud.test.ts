/**
 * Stage 4 - MBOM CRUD Tests
 *
 * MBOM 서비스 CRUD 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createMBOMEntry,
  updateMBOMEntry,
  deleteMBOMEntry,
  getMBOMByProduct,
  getMBOMByProcess,
  hasMBOM,
  clearProductMBOM,
} from '../../src/services/mbomService'

const prisma = new PrismaClient()

describe('MBOM CRUD', () => {
  const testProductCode = 'MBOM_PROD_' + String(Date.now()).slice(-6)
  const testMaterialCode = 'MBOM_MAT_' + String(Date.now()).slice(-6)
  let testProductId: number
  let testMaterialId: number
  let testSemiProductId: number

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 완제품 생성
    const product = await prisma.product.create({
      data: {
        code: testProductCode,
        name: 'MBOM Test Product',
        type: 'FINISHED',
        processCode: 'PA',
      },
    })
    testProductId = product.id

    // 테스트용 자재 생성
    const material = await prisma.material.create({
      data: {
        code: testMaterialCode,
        name: 'MBOM Test Material',
        category: '원자재',
        unit: 'EA',
      },
    })
    testMaterialId = material.id

    // 테스트용 반제품 생성
    const semiProduct = await prisma.product.create({
      data: {
        code: testProductCode + '-001',
        name: 'MBOM Test Semi Product',
        type: 'SEMI_CA',
        processCode: 'CA',
        parentCode: testProductCode,
      },
    })
    testSemiProductId = semiProduct.id
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.bOM.deleteMany({
      where: { productId: testProductId },
    })
    await prisma.product.deleteMany({
      where: {
        OR: [
          { code: testProductCode },
          { parentCode: testProductCode },
        ],
      },
    })
    await prisma.material.delete({
      where: { code: testMaterialCode },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // 각 테스트 전 BOM 초기화
    await prisma.bOM.deleteMany({
      where: { productId: testProductId },
    })
  })

  describe('createMBOMEntry', () => {
    it('should create material entry for CA process', async () => {
      const entry = await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialId,
        quantity: 2.5,
        unit: 'M',
      })

      expect(entry.productId).toBe(testProductId)
      expect(entry.processCode).toBe('CA')
      expect(entry.itemType).toBe('MATERIAL')
      expect(entry.quantity).toBe(2.5)
      expect(entry.material?.id).toBe(testMaterialId)
    })

    it('should create semi-product entry', async () => {
      const entry = await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'SEMI_PRODUCT',
        inputSemiId: testSemiProductId,
        quantity: 1,
      })

      expect(entry.processCode).toBe('PA')
      expect(entry.itemType).toBe('PRODUCT')
      expect(entry.childProduct?.id).toBe(testSemiProductId)
    })

    it('should uppercase process code', async () => {
      const entry = await createMBOMEntry({
        productId: testProductId,
        processCode: 'ca',  // lowercase
        itemType: 'MATERIAL',
        materialId: testMaterialId,
        quantity: 1,
      })

      expect(entry.processCode).toBe('CA')
    })

    it('should throw error for invalid process code', async () => {
      await expect(
        createMBOMEntry({
          productId: testProductId,
          processCode: 'INVALID',
          itemType: 'MATERIAL',
          materialId: testMaterialId,
          quantity: 1,
        })
      ).rejects.toThrow('유효하지 않은 공정 코드')
    })

    it('should throw error for material entry without materialId', async () => {
      await expect(
        createMBOMEntry({
          productId: testProductId,
          processCode: 'CA',
          itemType: 'MATERIAL',
          quantity: 1,
        })
      ).rejects.toThrow('materialId가 필요합니다')
    })
  })

  describe('updateMBOMEntry', () => {
    it('should update quantity', async () => {
      const entry = await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialId,
        quantity: 1,
      })

      const updated = await updateMBOMEntry(entry.id, { quantity: 5 })

      expect(updated.quantity).toBe(5)
    })

    it('should update process code', async () => {
      const entry = await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialId,
        quantity: 1,
      })

      const updated = await updateMBOMEntry(entry.id, { processCode: 'MC' })

      expect(updated.processCode).toBe('MC')
    })
  })

  describe('deleteMBOMEntry', () => {
    it('should delete entry', async () => {
      const entry = await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialId,
        quantity: 1,
      })

      await deleteMBOMEntry(entry.id)

      const deleted = await prisma.bOM.findUnique({
        where: { id: entry.id },
      })

      expect(deleted).toBeNull()
    })
  })

  describe('Query Operations', () => {
    beforeEach(async () => {
      // 테스트 데이터 생성
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
        quantity: 3,
      })
    })

    it('getMBOMByProduct should return all entries', async () => {
      const entries = await getMBOMByProduct(testProductId)

      expect(entries.length).toBe(2)
    })

    it('getMBOMByProcess should filter by process', async () => {
      const entries = await getMBOMByProcess(testProductId, 'CA')

      expect(entries.length).toBe(1)
      expect(entries[0].processCode).toBe('CA')
    })

    it('hasMBOM should return true when entries exist', async () => {
      const has = await hasMBOM(testProductId)
      expect(has).toBe(true)
    })

    it('hasMBOM should return false when no entries', async () => {
      await clearProductMBOM(testProductId)
      const has = await hasMBOM(testProductId)
      expect(has).toBe(false)
    })
  })
})
