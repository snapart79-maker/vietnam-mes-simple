/**
 * Stage 5 - Routing CRUD Tests
 *
 * 공정 라우팅 CRUD 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createProcessRouting,
  createRoutingEntry,
  getProcessRouting,
  updateRoutingEntry,
  deleteRoutingEntry,
  clearProcessRouting,
  hasProcessRouting,
  countRoutings,
  getProcessCodes,
  copyRouting,
} from '../../src/services/processRoutingService'

const prisma = new PrismaClient()

describe('Routing CRUD', () => {
  const testProductCode = 'ROUT_CRUD_' + String(Date.now()).slice(-6)
  let testProductId: number
  let testProduct2Id: number

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 완제품 생성
    const product = await prisma.product.create({
      data: {
        code: testProductCode,
        name: 'Routing CRUD Test Product',
        type: 'FINISHED',
        processCode: 'PA',
      },
    })
    testProductId = product.id

    // 복사 테스트용 제품 생성
    const product2 = await prisma.product.create({
      data: {
        code: testProductCode + '_COPY',
        name: 'Routing Copy Target',
        type: 'FINISHED',
        processCode: 'PA',
      },
    })
    testProduct2Id = product2.id
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.processRouting.deleteMany({
      where: {
        productId: { in: [testProductId, testProduct2Id] },
      },
    })
    await prisma.product.deleteMany({
      where: {
        OR: [{ code: testProductCode }, { code: testProductCode + '_COPY' }],
      },
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await clearProcessRouting(testProductId)
    await clearProcessRouting(testProduct2Id)
  })

  describe('createProcessRouting', () => {
    it('should create routing with multiple processes', async () => {
      const routings = await createProcessRouting(testProductId, [
        'CA',
        'PA',
        'CI',
        'VI',
      ])

      expect(routings).toHaveLength(4)
      expect(routings[0].processCode).toBe('CA')
      expect(routings[0].seq).toBe(10)
      expect(routings[1].processCode).toBe('PA')
      expect(routings[1].seq).toBe(20)
    })

    it('should include process details in routing', async () => {
      const routings = await createProcessRouting(testProductId, ['CA', 'VI'])

      expect(routings[0].process.name).toBe('자동절단압착')
      expect(routings[1].process.name).toBe('육안검사')
    })

    it('should throw error for empty process codes', async () => {
      await expect(createProcessRouting(testProductId, [])).rejects.toThrow(
        '공정 코드 목록이 비어있습니다'
      )
    })

    it('should throw error for invalid process code', async () => {
      await expect(
        createProcessRouting(testProductId, ['CA', 'INVALID', 'VI'])
      ).rejects.toThrow('유효하지 않은 공정 코드')
    })

    it('should uppercase process codes', async () => {
      const routings = await createProcessRouting(testProductId, ['ca', 'vi'])

      expect(routings[0].processCode).toBe('CA')
      expect(routings[1].processCode).toBe('VI')
    })

    it('should replace existing routing', async () => {
      await createProcessRouting(testProductId, ['CA', 'PA', 'VI'])
      const newRoutings = await createProcessRouting(testProductId, [
        'CA',
        'MC',
        'CI',
        'VI',
      ])

      expect(newRoutings).toHaveLength(4)
      expect(newRoutings[1].processCode).toBe('MC')
    })
  })

  describe('createRoutingEntry', () => {
    it('should create single routing entry', async () => {
      const entry = await createRoutingEntry({
        productId: testProductId,
        processCode: 'CA',
        seq: 10,
      })

      expect(entry.productId).toBe(testProductId)
      expect(entry.processCode).toBe('CA')
      expect(entry.seq).toBe(10)
      expect(entry.isRequired).toBe(true)
    })

    it('should create optional routing entry', async () => {
      const entry = await createRoutingEntry({
        productId: testProductId,
        processCode: 'MS',
        seq: 20,
        isRequired: false,
      })

      expect(entry.isRequired).toBe(false)
    })
  })

  describe('getProcessRouting', () => {
    it('should return routing ordered by seq', async () => {
      await createProcessRouting(testProductId, ['PA', 'CA', 'VI'])
      const routings = await getProcessRouting(testProductId)

      expect(routings).toHaveLength(3)
      // 생성 순서와 관계없이 seq 순으로 정렬
      expect(routings[0].processCode).toBe('PA')
      expect(routings[1].processCode).toBe('CA')
      expect(routings[2].processCode).toBe('VI')
    })

    it('should return empty array for product without routing', async () => {
      const routings = await getProcessRouting(testProductId)
      expect(routings).toHaveLength(0)
    })
  })

  describe('updateRoutingEntry', () => {
    it('should update seq', async () => {
      const routings = await createProcessRouting(testProductId, ['CA', 'VI'])
      const updated = await updateRoutingEntry(routings[0].id, { seq: 5 })

      expect(updated.seq).toBe(5)
    })

    it('should update isRequired', async () => {
      const routings = await createProcessRouting(testProductId, ['CA', 'VI'])
      const updated = await updateRoutingEntry(routings[0].id, {
        isRequired: false,
      })

      expect(updated.isRequired).toBe(false)
    })
  })

  describe('deleteRoutingEntry', () => {
    it('should delete single entry', async () => {
      const routings = await createProcessRouting(testProductId, [
        'CA',
        'PA',
        'VI',
      ])
      await deleteRoutingEntry(routings[1].id)

      const remaining = await getProcessRouting(testProductId)
      expect(remaining).toHaveLength(2)
      expect(remaining.map((r) => r.processCode)).not.toContain('PA')
    })
  })

  describe('clearProcessRouting', () => {
    it('should clear all routings for product', async () => {
      await createProcessRouting(testProductId, ['CA', 'PA', 'CI', 'VI'])
      const count = await clearProcessRouting(testProductId)

      expect(count).toBe(4)

      const remaining = await getProcessRouting(testProductId)
      expect(remaining).toHaveLength(0)
    })
  })

  describe('hasProcessRouting', () => {
    it('should return true when routing exists', async () => {
      await createProcessRouting(testProductId, ['CA', 'VI'])
      const has = await hasProcessRouting(testProductId)
      expect(has).toBe(true)
    })

    it('should return false when no routing', async () => {
      const has = await hasProcessRouting(testProductId)
      expect(has).toBe(false)
    })
  })

  describe('countRoutings', () => {
    it('should return correct count', async () => {
      await createProcessRouting(testProductId, ['CA', 'PA', 'CI', 'VI'])
      const count = await countRoutings(testProductId)
      expect(count).toBe(4)
    })
  })

  describe('getProcessCodes', () => {
    it('should return process codes in order', async () => {
      await createProcessRouting(testProductId, ['CA', 'PA', 'VI'])
      const codes = await getProcessCodes(testProductId)

      expect(codes).toEqual(['CA', 'PA', 'VI'])
    })
  })

  describe('copyRouting', () => {
    it('should copy routing to another product', async () => {
      await createProcessRouting(testProductId, ['CA', 'MC', 'PA', 'VI'])
      const copied = await copyRouting(testProductId, testProduct2Id)

      expect(copied).toHaveLength(4)
      expect(copied.map((r) => r.processCode)).toEqual([
        'CA',
        'MC',
        'PA',
        'VI',
      ])
      expect(copied[0].productId).toBe(testProduct2Id)
    })

    it('should throw error when source has no routing', async () => {
      await expect(
        copyRouting(testProductId, testProduct2Id)
      ).rejects.toThrow('복사할 라우팅이 없습니다')
    })
  })
})
