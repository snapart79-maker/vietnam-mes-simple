/**
 * Stage 1 - Migration Success Tests
 *
 * 마이그레이션 성공 확인 테스트
 * - 테이블 생성 확인
 * - 칼럼 추가 확인
 * - 인덱스 생성 확인
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Migration Success', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Tables Created', () => {
    it('should have processes table', async () => {
      // 테이블 존재 확인 - 빈 쿼리 실행
      const result = await prisma.process.findMany({ take: 0 })
      expect(Array.isArray(result)).toBe(true)
    })

    it('should have process_routings table', async () => {
      const result = await prisma.processRouting.findMany({ take: 0 })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Product Extension Fields', () => {
    it('should accept parentCode field', async () => {
      // 테스트용 제품 생성
      const product = await prisma.product.create({
        data: {
          code: 'TEST_PARENT_' + Date.now(),
          name: 'Test Product',
          parentCode: 'PARENT001',
        },
      })

      expect(product.parentCode).toBe('PARENT001')

      // 정리
      await prisma.product.delete({ where: { id: product.id } })
    })

    it('should accept circuitNo field', async () => {
      const product = await prisma.product.create({
        data: {
          code: 'TEST_CIRCUIT_' + Date.now(),
          name: 'Test Circuit Product',
          type: 'SEMI_CA',
          circuitNo: 5,
        },
      })

      expect(product.circuitNo).toBe(5)

      await prisma.product.delete({ where: { id: product.id } })
    })

    it('should have bundleQty with default value 100', async () => {
      const product = await prisma.product.create({
        data: {
          code: 'TEST_BUNDLE_' + Date.now(),
          name: 'Test Bundle Product',
        },
      })

      expect(product.bundleQty).toBe(100)

      await prisma.product.delete({ where: { id: product.id } })
    })
  })

  describe('Process Model Fields', () => {
    it('should create process with all fields', async () => {
      // code는 VarChar(10)이므로 짧은 코드 사용
      const uniqueCode = 'T' + String(Date.now()).slice(-6)  // 7자: T + 6자리

      const process = await prisma.process.create({
        data: {
          code: uniqueCode,
          name: 'Test Process',
          seq: 999,
          hasMaterialInput: true,
          isInspection: false,
          shortCode: 'T',
        },
      })

      expect(process.code).toBe(uniqueCode)
      expect(process.name).toBe('Test Process')
      expect(process.seq).toBe(999)
      expect(process.hasMaterialInput).toBe(true)
      expect(process.isInspection).toBe(false)
      expect(process.shortCode).toBe('T')
      expect(process.isActive).toBe(true)

      await prisma.process.delete({ where: { id: process.id } })
    })
  })
})
