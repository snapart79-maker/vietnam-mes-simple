/**
 * Stage 3 - Crimp Products Generation Tests
 *
 * 절압품 생성 테스트
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  generateCrimpProducts,
  createMSProduct,
  createSemiProduct,
  getCrimpProductsByFinished,
  getSemiProductsByFinished,
  countSemiProducts,
} from '../../src/services/semiProductService'

const prisma = new PrismaClient()

describe('Crimp Products Generation', () => {
  const testFinishedCode = 'TEST_FIN_' + String(Date.now()).slice(-6)
  let testProductId: number

  beforeAll(async () => {
    await prisma.$connect()

    // 테스트용 완제품 생성
    const product = await prisma.product.create({
      data: {
        code: testFinishedCode,
        name: 'Test Finished Product',
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

  describe('generateCrimpProducts', () => {
    it('should generate crimp products for circuit count', async () => {
      const crimpProducts = await generateCrimpProducts(testFinishedCode, 3)

      expect(crimpProducts).toHaveLength(3)
      expect(crimpProducts[0].code).toBe(`${testFinishedCode}-001`)
      expect(crimpProducts[1].code).toBe(`${testFinishedCode}-002`)
      expect(crimpProducts[2].code).toBe(`${testFinishedCode}-003`)
    })

    it('should set correct product type and process code', async () => {
      const crimpProducts = await generateCrimpProducts(testFinishedCode, 2)

      crimpProducts.forEach((p) => {
        expect(p.type).toBe('SEMI_CA')
        expect(p.processCode).toBe('CA')
        expect(p.parentCode).toBe(testFinishedCode)
      })
    })

    it('should set circuit numbers correctly', async () => {
      const crimpProducts = await generateCrimpProducts(testFinishedCode, 3)

      expect(crimpProducts[0].circuitNo).toBe(1)
      expect(crimpProducts[1].circuitNo).toBe(2)
      expect(crimpProducts[2].circuitNo).toBe(3)
    })

    it('should return existing products if already created', async () => {
      const first = await generateCrimpProducts(testFinishedCode, 2)
      const second = await generateCrimpProducts(testFinishedCode, 2)

      expect(first[0].id).toBe(second[0].id)
      expect(first[1].id).toBe(second[1].id)
    })

    it('should throw error for non-existent finished product', async () => {
      await expect(
        generateCrimpProducts('NON_EXISTENT_CODE', 5)
      ).rejects.toThrow('완제품을 찾을 수 없습니다')
    })
  })

  describe('createMSProduct', () => {
    it('should create MS product from crimp product', async () => {
      // 먼저 절압품 생성
      const crimpProducts = await generateCrimpProducts(testFinishedCode, 1)
      const crimpCode = crimpProducts[0].code

      const msProduct = await createMSProduct(crimpCode)

      expect(msProduct.code).toBe(`MS${crimpCode}`)
      expect(msProduct.type).toBe('SEMI_MS')
      expect(msProduct.processCode).toBe('MS')
      expect(msProduct.parentCode).toBe(testFinishedCode)
      expect(msProduct.circuitNo).toBe(1)
    })

    it('should return existing MS product if already created', async () => {
      const crimpProducts = await generateCrimpProducts(testFinishedCode, 1)
      const crimpCode = crimpProducts[0].code

      const first = await createMSProduct(crimpCode)
      const second = await createMSProduct(crimpCode)

      expect(first.id).toBe(second.id)
    })

    it('should throw error for non-existent crimp product', async () => {
      await expect(
        createMSProduct('NON_EXISTENT-001')
      ).rejects.toThrow('절압품을 찾을 수 없습니다')
    })
  })

  describe('createSemiProduct (MC/SB/HS)', () => {
    it('should create MC product', async () => {
      const mcProduct = await createSemiProduct('MC', testFinishedCode)

      expect(mcProduct.code).toBe(`MC${testFinishedCode}`)
      expect(mcProduct.type).toBe('SEMI_MC')
      expect(mcProduct.processCode).toBe('MC')
      expect(mcProduct.parentCode).toBe(testFinishedCode)
    })

    it('should create SB product', async () => {
      const sbProduct = await createSemiProduct('SB', testFinishedCode)

      expect(sbProduct.code).toBe(`SB${testFinishedCode}`)
      expect(sbProduct.type).toBe('SEMI_SB')
      expect(sbProduct.processCode).toBe('SB')
    })

    it('should create HS product', async () => {
      const hsProduct = await createSemiProduct('HS', testFinishedCode)

      expect(hsProduct.code).toBe(`HS${testFinishedCode}`)
      expect(hsProduct.type).toBe('SEMI_HS')
      expect(hsProduct.processCode).toBe('HS')
    })

    it('should return existing product if already created', async () => {
      const first = await createSemiProduct('MC', testFinishedCode)
      const second = await createSemiProduct('MC', testFinishedCode)

      expect(first.id).toBe(second.id)
    })
  })

  describe('Query Functions', () => {
    it('getCrimpProductsByFinished should return crimp products', async () => {
      await generateCrimpProducts(testFinishedCode, 3)

      const crimpProducts = await getCrimpProductsByFinished(testFinishedCode)

      expect(crimpProducts.length).toBeGreaterThanOrEqual(3)
      crimpProducts.forEach((p) => {
        expect(p.type).toBe('SEMI_CA')
        expect(p.parentCode).toBe(testFinishedCode)
      })
    })

    it('getSemiProductsByFinished should return all semi products', async () => {
      const semiProducts = await getSemiProductsByFinished(testFinishedCode)

      expect(semiProducts.length).toBeGreaterThan(0)
      semiProducts.forEach((p) => {
        expect(p.parentCode).toBe(testFinishedCode)
      })
    })

    it('countSemiProducts should return correct counts', async () => {
      const counts = await countSemiProducts(testFinishedCode)

      expect(counts.total).toBeGreaterThan(0)
      expect(counts.byType).toBeDefined()
      expect(counts.byType['SEMI_CA']).toBeGreaterThanOrEqual(1)
    })
  })
})
