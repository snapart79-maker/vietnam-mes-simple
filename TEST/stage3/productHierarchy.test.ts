/**
 * Stage 3 - Product Hierarchy Tests
 *
 * 제품 계층 구조 테스트
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createProductHierarchy,
  inferProductType,
  extractFinishedCode,
} from '../../src/services/semiProductService'

const prisma = new PrismaClient()

describe('Product Hierarchy', () => {
  const testFinishedCode = 'HIER_' + String(Date.now()).slice(-6)
  let testProductId: number

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 완제품 생성
    const product = await prisma.product.create({
      data: {
        code: testFinishedCode,
        name: 'Hierarchy Test Product',
        spec: 'Test Spec',
        type: 'FINISHED',
        processCode: 'PA',
      },
    })
    testProductId = product.id
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.product.deleteMany({
      where: {
        OR: [
          { code: testFinishedCode },
          { parentCode: testFinishedCode },
        ],
      },
    })
    await prisma.$disconnect()
  })

  describe('createProductHierarchy', () => {
    it('should create basic hierarchy with CA only', async () => {
      const hierarchy = await createProductHierarchy(
        testFinishedCode,
        3,
        ['CA']
      )

      expect(hierarchy.finished.code).toBe(testFinishedCode)
      expect(hierarchy.crimpProducts).toHaveLength(3)
      expect(hierarchy.semiProducts.ms).toHaveLength(0)
      expect(hierarchy.semiProducts.mc).toBeNull()
      expect(hierarchy.semiProducts.sb).toBeNull()
      expect(hierarchy.semiProducts.hs).toBeNull()
    })

    it('should create hierarchy with MS products', async () => {
      const hierarchy = await createProductHierarchy(
        testFinishedCode,
        2,
        ['CA', 'MS']
      )

      // 절압품은 최소 2개 (현재 요청한 수량)
      expect(hierarchy.crimpProducts.length).toBeGreaterThanOrEqual(2)
      // MS 제품도 최소 2개
      expect(hierarchy.semiProducts.ms.length).toBeGreaterThanOrEqual(2)

      // MS 제품 확인
      hierarchy.semiProducts.ms.forEach((ms) => {
        expect(ms.type).toBe('SEMI_MS')
        expect(ms.code).toMatch(/^MS/)
      })
    })

    it('should create hierarchy with MC/SB/HS products', async () => {
      const hierarchy = await createProductHierarchy(
        testFinishedCode,
        2,
        ['CA', 'MC', 'SB', 'HS']
      )

      expect(hierarchy.semiProducts.mc).not.toBeNull()
      expect(hierarchy.semiProducts.mc!.type).toBe('SEMI_MC')
      expect(hierarchy.semiProducts.mc!.code).toBe(`MC${testFinishedCode}`)

      expect(hierarchy.semiProducts.sb).not.toBeNull()
      expect(hierarchy.semiProducts.sb!.type).toBe('SEMI_SB')
      expect(hierarchy.semiProducts.sb!.code).toBe(`SB${testFinishedCode}`)

      expect(hierarchy.semiProducts.hs).not.toBeNull()
      expect(hierarchy.semiProducts.hs!.type).toBe('SEMI_HS')
      expect(hierarchy.semiProducts.hs!.code).toBe(`HS${testFinishedCode}`)
    })

    it('should create full complex hierarchy', async () => {
      const hierarchy = await createProductHierarchy(
        testFinishedCode,
        5,
        ['CA', 'MS', 'MC', 'SB', 'HS']
      )

      // 완제품 확인
      expect(hierarchy.finished.code).toBe(testFinishedCode)
      expect(hierarchy.finished.type).toBe('FINISHED')

      // 절압품 확인 (5개 회로)
      expect(hierarchy.crimpProducts.length).toBeGreaterThanOrEqual(5)

      // MS 확인 (절압품 각각에 대해)
      expect(hierarchy.semiProducts.ms.length).toBeGreaterThanOrEqual(5)

      // MC/SB/HS 확인 (각 1개)
      expect(hierarchy.semiProducts.mc).not.toBeNull()
      expect(hierarchy.semiProducts.sb).not.toBeNull()
      expect(hierarchy.semiProducts.hs).not.toBeNull()
    })

    it('should throw error for non-existent finished product', async () => {
      await expect(
        createProductHierarchy('NON_EXISTENT', 3, ['CA'])
      ).rejects.toThrow('완제품을 찾을 수 없습니다')
    })
  })

  describe('Hierarchy Code Consistency', () => {
    it('all products should reference same finished code', async () => {
      const hierarchy = await createProductHierarchy(
        testFinishedCode,
        3,
        ['CA', 'MS', 'MC', 'SB', 'HS']
      )

      // 절압품
      hierarchy.crimpProducts.forEach((p) => {
        expect(p.parentCode).toBe(testFinishedCode)
        expect(extractFinishedCode(p.code)).toBe(testFinishedCode)
      })

      // MS
      hierarchy.semiProducts.ms.forEach((p) => {
        expect(p.parentCode).toBe(testFinishedCode)
        expect(extractFinishedCode(p.code)).toBe(testFinishedCode)
      })

      // MC/SB/HS
      if (hierarchy.semiProducts.mc) {
        expect(extractFinishedCode(hierarchy.semiProducts.mc.code)).toBe(testFinishedCode)
      }
      if (hierarchy.semiProducts.sb) {
        expect(extractFinishedCode(hierarchy.semiProducts.sb.code)).toBe(testFinishedCode)
      }
      if (hierarchy.semiProducts.hs) {
        expect(extractFinishedCode(hierarchy.semiProducts.hs.code)).toBe(testFinishedCode)
      }
    })

    it('all products should have correct types inferred', async () => {
      const hierarchy = await createProductHierarchy(
        testFinishedCode,
        2,
        ['CA', 'MS', 'MC', 'SB', 'HS']
      )

      // 완제품
      expect(inferProductType(hierarchy.finished.code)).toBe('FINISHED')

      // 절압품
      hierarchy.crimpProducts.forEach((p) => {
        expect(inferProductType(p.code)).toBe('SEMI_CA')
      })

      // MS
      hierarchy.semiProducts.ms.forEach((p) => {
        expect(inferProductType(p.code)).toBe('SEMI_MS')
      })

      // MC/SB/HS
      if (hierarchy.semiProducts.mc) {
        expect(inferProductType(hierarchy.semiProducts.mc.code)).toBe('SEMI_MC')
      }
      if (hierarchy.semiProducts.sb) {
        expect(inferProductType(hierarchy.semiProducts.sb.code)).toBe('SEMI_SB')
      }
      if (hierarchy.semiProducts.hs) {
        expect(inferProductType(hierarchy.semiProducts.hs.code)).toBe('SEMI_HS')
      }
    })
  })
})
