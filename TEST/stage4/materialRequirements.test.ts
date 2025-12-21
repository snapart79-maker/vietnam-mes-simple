/**
 * Stage 4 - Material Requirements Tests
 *
 * 자재 소요량 계산 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createMBOMEntry,
  calculateProcessMaterialRequirements,
  calculateTotalMaterialRequirements,
  clearProductMBOM,
} from '../../src/services/mbomService'

const prisma = new PrismaClient()

describe('Material Requirements Calculation', () => {
  const testProductCode = 'REQ_PROD_' + String(Date.now()).slice(-6)
  let testProductId: number
  let testMaterialIds: number[] = []

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 완제품 생성
    const product = await prisma.product.create({
      data: {
        code: testProductCode,
        name: 'Requirements Test Product',
        type: 'FINISHED',
        processCode: 'PA',
      },
    })
    testProductId = product.id

    // 테스트용 자재들 생성
    const materials = [
      { code: 'REQ_MAT1_' + String(Date.now()).slice(-6), name: '전선 2.5mm', category: '원자재', unit: 'M' },
      { code: 'REQ_MAT2_' + String(Date.now()).slice(-6), name: '단자 Ring', category: '부자재', unit: 'EA' },
      { code: 'REQ_MAT3_' + String(Date.now()).slice(-6), name: '커넥터 2P', category: '부자재', unit: 'EA' },
    ]

    for (const mat of materials) {
      const created = await prisma.material.create({ data: mat })
      testMaterialIds.push(created.id)
    }
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.bOM.deleteMany({
      where: { productId: testProductId },
    })
    await prisma.product.delete({
      where: { code: testProductCode },
    }).catch(() => {})
    for (const id of testMaterialIds) {
      await prisma.material.delete({ where: { id } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await clearProductMBOM(testProductId)
  })

  describe('calculateProcessMaterialRequirements', () => {
    it('should calculate requirements for single material', async () => {
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 2.5,  // 제품당 2.5M
      })

      const requirements = await calculateProcessMaterialRequirements(
        testProductId,
        'CA',
        100  // 100개 생산
      )

      expect(requirements).toHaveLength(1)
      expect(requirements[0].materialId).toBe(testMaterialIds[0])
      expect(requirements[0].quantityPerUnit).toBe(2.5)
      expect(requirements[0].requiredQty).toBe(250)  // 2.5 * 100
    })

    it('should calculate requirements for multiple materials', async () => {
      // 전선 2.5M per unit
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 2.5,
      })

      // 단자 2EA per unit
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[1],
        quantity: 2,
      })

      const requirements = await calculateProcessMaterialRequirements(
        testProductId,
        'CA',
        50
      )

      expect(requirements).toHaveLength(2)

      const wire = requirements.find((r) => r.materialId === testMaterialIds[0])
      expect(wire?.requiredQty).toBe(125)  // 2.5 * 50

      const terminal = requirements.find((r) => r.materialId === testMaterialIds[1])
      expect(terminal?.requiredQty).toBe(100)  // 2 * 50
    })

    it('should only include materials from specified process', async () => {
      // CA 공정
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 1,
      })

      // PA 공정
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[2],
        quantity: 1,
      })

      const caRequirements = await calculateProcessMaterialRequirements(
        testProductId,
        'CA',
        10
      )

      expect(caRequirements).toHaveLength(1)
      expect(caRequirements[0].materialId).toBe(testMaterialIds[0])
    })

    it('should include material details in requirements', async () => {
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 1,
      })

      const requirements = await calculateProcessMaterialRequirements(
        testProductId,
        'CA',
        1
      )

      expect(requirements[0].materialCode).toContain('REQ_MAT1')
      expect(requirements[0].materialName).toBe('전선 2.5mm')
      expect(requirements[0].category).toBe('원자재')
      expect(requirements[0].unit).toBe('M')
      expect(requirements[0].processCode).toBe('CA')
    })
  })

  describe('calculateTotalMaterialRequirements', () => {
    it('should calculate total requirements across all processes', async () => {
      // CA 공정
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 2,
      })

      // PA 공정
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[2],
        quantity: 1,
      })

      const requirements = await calculateTotalMaterialRequirements(
        testProductId,
        100
      )

      expect(requirements).toHaveLength(2)

      const wire = requirements.find((r) => r.materialId === testMaterialIds[0])
      expect(wire?.requiredQty).toBe(200)

      const connector = requirements.find((r) => r.materialId === testMaterialIds[2])
      expect(connector?.requiredQty).toBe(100)
    })

    it('should aggregate same material from different processes', async () => {
      // CA 공정에서 전선 2M
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 2,
      })

      // MC 공정에서 전선 1M
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'MC',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 1,
      })

      const requirements = await calculateTotalMaterialRequirements(
        testProductId,
        10
      )

      expect(requirements).toHaveLength(1)
      expect(requirements[0].materialId).toBe(testMaterialIds[0])
      expect(requirements[0].requiredQty).toBe(30)  // (2 + 1) * 10
    })

    it('should return empty array when no materials', async () => {
      const requirements = await calculateTotalMaterialRequirements(
        testProductId,
        100
      )

      expect(requirements).toHaveLength(0)
    })
  })
})
