/**
 * Stage 1 - Model Relations Tests
 *
 * 모델 간 관계 무결성 테스트
 * - Process ↔ ProcessRouting 관계
 * - Product ↔ ProcessRouting 관계
 * - Cascade Delete 검증
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Model Relations', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Process - ProcessRouting Relation', () => {
    let testProcess: { id: number; code: string }
    let testProduct: { id: number; code: string }

    beforeEach(async () => {
      // 테스트용 공정 생성 (code는 VarChar(10)이므로 짧게)
      const uniqueCode = 'R' + String(Date.now()).slice(-6)
      testProcess = await prisma.process.create({
        data: {
          code: uniqueCode,
          name: 'Relation Test Process',
          seq: 999,
        },
      })

      // 테스트용 제품 생성
      testProduct = await prisma.product.create({
        data: {
          code: 'REL_PROD_' + Date.now(),
          name: 'Relation Test Product',
        },
      })
    })

    afterEach(async () => {
      // 정리: ProcessRouting 먼저 삭제
      await prisma.processRouting.deleteMany({
        where: { processCode: testProcess.code },
      })
      await prisma.process.delete({ where: { id: testProcess.id } })
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {})
    })

    it('should create ProcessRouting with Process reference', async () => {
      const routing = await prisma.processRouting.create({
        data: {
          productId: testProduct.id,
          processCode: testProcess.code,
          seq: 1,
        },
        include: {
          process: true,
        },
      })

      expect(routing.processCode).toBe(testProcess.code)
      expect(routing.process.name).toBe('Relation Test Process')
    })

    it('should create ProcessRouting with Product reference', async () => {
      const routing = await prisma.processRouting.create({
        data: {
          productId: testProduct.id,
          processCode: testProcess.code,
          seq: 1,
        },
        include: {
          product: true,
        },
      })

      expect(routing.productId).toBe(testProduct.id)
      expect(routing.product.name).toBe('Relation Test Product')
    })

    it('should enforce unique constraint on productId + processCode', async () => {
      // 첫 번째 라우팅 생성
      await prisma.processRouting.create({
        data: {
          productId: testProduct.id,
          processCode: testProcess.code,
          seq: 1,
        },
      })

      // 같은 조합으로 다시 생성 시도 - 에러 예상
      await expect(
        prisma.processRouting.create({
          data: {
            productId: testProduct.id,
            processCode: testProcess.code,
            seq: 2,
          },
        })
      ).rejects.toThrow()
    })
  })

  describe('Cascade Delete', () => {
    it('should delete ProcessRouting when Product is deleted', async () => {
      // 테스트용 공정 생성 (code는 VarChar(10)이므로 짧게)
      const uniqueCode = 'C' + String(Date.now()).slice(-6)
      const process = await prisma.process.create({
        data: {
          code: uniqueCode,
          name: 'Cascade Test Process',
          seq: 999,
        },
      })

      // 테스트용 제품 생성
      const product = await prisma.product.create({
        data: {
          code: 'CASCADE_PROD_' + Date.now(),
          name: 'Cascade Test Product',
        },
      })

      // 라우팅 생성
      const routing = await prisma.processRouting.create({
        data: {
          productId: product.id,
          processCode: process.code,
          seq: 1,
        },
      })

      // 제품 삭제 (Cascade로 라우팅도 삭제되어야 함)
      await prisma.product.delete({ where: { id: product.id } })

      // 라우팅이 삭제되었는지 확인
      const deletedRouting = await prisma.processRouting.findUnique({
        where: { id: routing.id },
      })

      expect(deletedRouting).toBeNull()

      // 정리
      await prisma.process.delete({ where: { id: process.id } })
    })
  })

  describe('Product with ProcessRouting list', () => {
    it('should fetch Product with processRoutings relation', async () => {
      // 테스트용 공정들 생성 (code는 VarChar(10)이므로 짧게)
      const ts = String(Date.now()).slice(-4)
      const process1 = await prisma.process.create({
        data: { code: 'LCA' + ts, name: 'CA Process', seq: 10 },
      })
      const process2 = await prisma.process.create({
        data: { code: 'LMC' + ts, name: 'MC Process', seq: 30 },
      })

      // 테스트용 제품 생성
      const product = await prisma.product.create({
        data: {
          code: 'LIST_PROD_' + Date.now(),
          name: 'List Test Product',
        },
      })

      // 라우팅 생성
      await prisma.processRouting.createMany({
        data: [
          { productId: product.id, processCode: process1.code, seq: 1 },
          { productId: product.id, processCode: process2.code, seq: 2 },
        ],
      })

      // 제품과 라우팅 함께 조회
      const productWithRoutings = await prisma.product.findUnique({
        where: { id: product.id },
        include: {
          processRoutings: {
            orderBy: { seq: 'asc' },
          },
        },
      })

      expect(productWithRoutings?.processRoutings).toHaveLength(2)
      expect(productWithRoutings?.processRoutings[0].seq).toBe(1)
      expect(productWithRoutings?.processRoutings[1].seq).toBe(2)

      // 정리
      await prisma.product.delete({ where: { id: product.id } })
      await prisma.process.deleteMany({
        where: { id: { in: [process1.id, process2.id] } },
      })
    })
  })
})
