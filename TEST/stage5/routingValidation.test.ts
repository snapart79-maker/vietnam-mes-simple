/**
 * Stage 5 - Routing Validation Tests
 *
 * 공정 순서 검증 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createProcessRouting,
  createRoutingFromPattern,
  validateProcessOrder,
  validateRouting,
  validateProcessCodes,
  clearProcessRouting,
} from '../../src/services/processRoutingService'

const prisma = new PrismaClient()

describe('Routing Validation', () => {
  const testProductCode = 'ROUT_VAL_' + String(Date.now()).slice(-6)
  let testProductId: number

  beforeAll(async () => {
    await prisma.$connect()

    const product = await prisma.product.create({
      data: {
        code: testProductCode,
        name: 'Validation Test Product',
        type: 'FINISHED',
        processCode: 'PA',
      },
    })
    testProductId = product.id
  })

  afterAll(async () => {
    await prisma.processRouting.deleteMany({
      where: { productId: testProductId },
    })
    await prisma.product.delete({
      where: { code: testProductCode },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await clearProcessRouting(testProductId)
  })

  describe('validateProcessOrder', () => {
    beforeEach(async () => {
      // 표준 라우팅: CA → MC → PA → CI → VI
      await createProcessRouting(testProductId, ['CA', 'MC', 'PA', 'CI', 'VI'])
    })

    it('should validate correct forward order', async () => {
      const result = await validateProcessOrder(testProductId, 'CA', 'MC')

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should validate order across multiple steps', async () => {
      const result = await validateProcessOrder(testProductId, 'CA', 'PA')
      expect(result.valid).toBe(true)
    })

    it('should reject same process', async () => {
      const result = await validateProcessOrder(testProductId, 'CA', 'CA')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('동일한 공정')
    })

    it('should reject backward order', async () => {
      const result = await validateProcessOrder(testProductId, 'PA', 'MC')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('이후 공정')
    })

    it('should reject process not in routing (from)', async () => {
      const result = await validateProcessOrder(testProductId, 'MS', 'PA')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('라우팅에 없습니다')
    })

    it('should reject process not in routing (to)', async () => {
      const result = await validateProcessOrder(testProductId, 'CA', 'MS')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('라우팅에 없습니다')
    })

    it('should handle lowercase process codes', async () => {
      const result = await validateProcessOrder(testProductId, 'ca', 'mc')
      expect(result.valid).toBe(true)
    })
  })

  describe('validateRouting', () => {
    it('should validate correct routing (simple pattern)', async () => {
      await createRoutingFromPattern(testProductId, 'simple')
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(true)
    })

    it('should validate correct routing (complex pattern)', async () => {
      await createRoutingFromPattern(testProductId, 'complex')
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(true)
    })

    it('should reject empty routing', async () => {
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('라우팅이 없습니다')
    })

    it('should reject routing without start process', async () => {
      // 시작 공정(CA, MC) 없이 라우팅 생성 시도
      await createProcessRouting(testProductId, ['PA', 'CI', 'VI'])
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('시작 공정')
    })

    it('should reject routing not ending with inspection', async () => {
      // 검사 공정으로 끝나지 않는 라우팅
      await createProcessRouting(testProductId, ['CA', 'MC', 'PA'])
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('마지막 공정은 검사')
    })

    it('should accept routing ending with CI (inspection)', async () => {
      await createProcessRouting(testProductId, ['CA', 'PA', 'CI'])
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(true)
    })

    it('should accept routing starting with MC', async () => {
      await createProcessRouting(testProductId, ['MC', 'PA', 'VI'])
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(true)
    })
  })

  describe('validateProcessCodes', () => {
    it('should validate correct process codes', async () => {
      const result = await validateProcessCodes(['CA', 'MC', 'PA', 'VI'])

      expect(result.valid).toBe(true)
    })

    it('should reject empty array', async () => {
      const result = await validateProcessCodes([])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('비어있습니다')
    })

    it('should reject invalid process code', async () => {
      const result = await validateProcessCodes(['CA', 'INVALID', 'VI'])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('유효하지 않은 공정 코드')
    })

    it('should reject duplicate process codes', async () => {
      const result = await validateProcessCodes(['CA', 'MC', 'CA', 'VI'])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('중복')
    })

    it('should handle lowercase codes', async () => {
      const result = await validateProcessCodes(['ca', 'mc', 'vi'])

      expect(result.valid).toBe(true)
    })

    it('should validate all standard process codes', async () => {
      const result = await validateProcessCodes([
        'CA',
        'MS',
        'MC',
        'SB',
        'HS',
        'CQ',
        'SP',
        'PA',
        'CI',
        'VI',
      ])

      expect(result.valid).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle single process routing validation', async () => {
      // CA만 있는 라우팅 - 시작 공정은 있지만 검사로 끝나지 않음
      await createProcessRouting(testProductId, ['CA'])
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('마지막 공정은 검사')
    })

    it('should handle inspection-only routing', async () => {
      // 검사 공정만 있으면 시작 공정 없음
      await createProcessRouting(testProductId, ['VI'])
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('시작 공정')
    })

    it('should validate CA to VI direct path', async () => {
      await createProcessRouting(testProductId, ['CA', 'VI'])
      const result = await validateRouting(testProductId)

      expect(result.valid).toBe(true)
    })
  })
})
