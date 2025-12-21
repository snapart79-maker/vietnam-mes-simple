/**
 * Stage 4 - MBOM Tree Structure Tests
 *
 * MBOM 트리 구조 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createMBOMEntry,
  getMBOMTree,
  getMBOMSummaryByProcess,
  getMBOMCountByProcess,
  clearProductMBOM,
} from '../../src/services/mbomService'

const prisma = new PrismaClient()

describe('MBOM Tree Structure', () => {
  const testProductCode = 'TREE_PROD_' + String(Date.now()).slice(-6)
  let testProductId: number
  let testMaterialIds: number[] = []

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 완제품 생성
    const product = await prisma.product.create({
      data: {
        code: testProductCode,
        name: 'Tree Test Product',
        type: 'FINISHED',
        processCode: 'PA',
      },
    })
    testProductId = product.id

    // 테스트용 자재들 생성
    const materials = [
      { code: 'TREE_MAT1_' + String(Date.now()).slice(-6), name: '전선', category: '원자재', unit: 'M' },
      { code: 'TREE_MAT2_' + String(Date.now()).slice(-6), name: '단자', category: '부자재', unit: 'EA' },
      { code: 'TREE_MAT3_' + String(Date.now()).slice(-6), name: '커넥터', category: '부자재', unit: 'EA' },
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

  describe('getMBOMTree', () => {
    it('should return empty array when no entries', async () => {
      const tree = await getMBOMTree(testProductId)
      expect(tree).toHaveLength(0)
    })

    it('should return tree with materials grouped by process', async () => {
      // CA 공정에 자재 2개 추가
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 2,
      })
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[1],
        quantity: 4,
      })

      // PA 공정에 자재 1개 추가
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[2],
        quantity: 1,
      })

      const tree = await getMBOMTree(testProductId)

      expect(tree.length).toBe(2)

      // CA 공정 확인
      const caNode = tree.find((n) => n.processCode === 'CA')
      expect(caNode).toBeDefined()
      expect(caNode!.materials).toHaveLength(2)
      expect(caNode!.processName).toBe('자동절단압착')

      // PA 공정 확인
      const paNode = tree.find((n) => n.processCode === 'PA')
      expect(paNode).toBeDefined()
      expect(paNode!.materials).toHaveLength(1)
    })

    it('should order tree by process sequence', async () => {
      // PA 먼저 추가 (seq: 80)
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 1,
      })

      // CA 나중에 추가 (seq: 10)
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[1],
        quantity: 1,
      })

      const tree = await getMBOMTree(testProductId)

      expect(tree[0].processCode).toBe('CA')  // seq 10이 먼저
      expect(tree[1].processCode).toBe('PA')  // seq 80이 나중
    })

    it('should include material details in tree', async () => {
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 5,
        unit: 'M',
      })

      const tree = await getMBOMTree(testProductId)
      const material = tree[0].materials[0]

      expect(material.id).toBe(testMaterialIds[0])
      expect(material.quantity).toBe(5)
      expect(material.unit).toBe('M')
    })
  })

  describe('getMBOMSummaryByProcess', () => {
    it('should return summary with counts', async () => {
      // CA에 자재 2개
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 1,
      })
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[1],
        quantity: 1,
      })

      // PA에 자재 1개
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'PA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[2],
        quantity: 1,
      })

      const summary = await getMBOMSummaryByProcess(testProductId)

      expect(summary.length).toBe(2)

      const caSummary = summary.find((s) => s.processCode === 'CA')
      expect(caSummary?.materialCount).toBe(2)

      const paSummary = summary.find((s) => s.processCode === 'PA')
      expect(paSummary?.materialCount).toBe(1)
    })
  })

  describe('getMBOMCountByProcess', () => {
    it('should return counts grouped by process', async () => {
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[0],
        quantity: 1,
      })
      await createMBOMEntry({
        productId: testProductId,
        processCode: 'CA',
        itemType: 'MATERIAL',
        materialId: testMaterialIds[1],
        quantity: 1,
      })

      const counts = await getMBOMCountByProcess(testProductId)

      expect(counts['CA']).toBeDefined()
      expect(counts['CA'].materials).toBe(2)
      expect(counts['CA'].semiProducts).toBe(0)
    })
  })
})
