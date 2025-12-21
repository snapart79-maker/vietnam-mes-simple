/**
 * Stage 5 - Routing Pattern Tests
 *
 * 패턴 기반 공정 라우팅 생성 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createRoutingFromPattern,
  getProcessRouting,
  clearProcessRouting,
  getPatternName,
  getAvailablePatterns,
  PROCESS_PATTERNS,
} from '../../src/services/processRoutingService'

const prisma = new PrismaClient()

describe('Routing Pattern', () => {
  const testProductCode = 'ROUT_PAT_' + String(Date.now()).slice(-6)
  let testProductId: number

  beforeAll(async () => {
    await prisma.$connect()

    const product = await prisma.product.create({
      data: {
        code: testProductCode,
        name: 'Routing Pattern Test Product',
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

  describe('PROCESS_PATTERNS', () => {
    it('should have simple pattern with 5 processes', () => {
      expect(PROCESS_PATTERNS.simple).toEqual(['CA', 'SP', 'PA', 'CI', 'VI'])
      expect(PROCESS_PATTERNS.simple).toHaveLength(5)
    })

    it('should have medium pattern with 8 processes', () => {
      expect(PROCESS_PATTERNS.medium).toEqual([
        'CA',
        'SB',
        'MC',
        'CQ',
        'SP',
        'PA',
        'CI',
        'VI',
      ])
      expect(PROCESS_PATTERNS.medium).toHaveLength(8)
    })

    it('should have complex pattern with 10 processes', () => {
      expect(PROCESS_PATTERNS.complex).toEqual([
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
      expect(PROCESS_PATTERNS.complex).toHaveLength(10)
    })
  })

  describe('createRoutingFromPattern', () => {
    it('should create routing from simple pattern', async () => {
      const routings = await createRoutingFromPattern(testProductId, 'simple')

      expect(routings).toHaveLength(5)
      expect(routings.map((r) => r.processCode)).toEqual([
        'CA',
        'SP',
        'PA',
        'CI',
        'VI',
      ])
    })

    it('should create routing from medium pattern', async () => {
      const routings = await createRoutingFromPattern(testProductId, 'medium')

      expect(routings).toHaveLength(8)
      expect(routings[0].processCode).toBe('CA')
      expect(routings[7].processCode).toBe('VI')
    })

    it('should create routing from complex pattern', async () => {
      const routings = await createRoutingFromPattern(testProductId, 'complex')

      expect(routings).toHaveLength(10)
      expect(routings.map((r) => r.processCode)).toEqual([
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
    })

    it('should throw error for invalid pattern name', async () => {
      await expect(
        createRoutingFromPattern(testProductId, 'invalid' as never)
      ).rejects.toThrow('유효하지 않은 패턴명')
    })

    it('should replace existing routing when applying pattern', async () => {
      await createRoutingFromPattern(testProductId, 'complex')
      const newRoutings = await createRoutingFromPattern(
        testProductId,
        'simple'
      )

      expect(newRoutings).toHaveLength(5)

      const storedRoutings = await getProcessRouting(testProductId)
      expect(storedRoutings).toHaveLength(5)
    })

    it('should set correct seq values', async () => {
      const routings = await createRoutingFromPattern(testProductId, 'simple')

      expect(routings[0].seq).toBe(10)
      expect(routings[1].seq).toBe(20)
      expect(routings[2].seq).toBe(30)
      expect(routings[3].seq).toBe(40)
      expect(routings[4].seq).toBe(50)
    })

    it('should mark all processes as required by default', async () => {
      const routings = await createRoutingFromPattern(testProductId, 'simple')

      expect(routings.every((r) => r.isRequired === true)).toBe(true)
    })
  })

  describe('getPatternName', () => {
    it('should identify simple pattern', () => {
      const name = getPatternName(['CA', 'SP', 'PA', 'CI', 'VI'])
      expect(name).toBe('simple')
    })

    it('should identify medium pattern', () => {
      const name = getPatternName([
        'CA',
        'SB',
        'MC',
        'CQ',
        'SP',
        'PA',
        'CI',
        'VI',
      ])
      expect(name).toBe('medium')
    })

    it('should identify complex pattern', () => {
      const name = getPatternName([
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
      expect(name).toBe('complex')
    })

    it('should return null for unknown pattern', () => {
      const name = getPatternName(['CA', 'PA'])
      expect(name).toBeNull()
    })

    it('should handle lowercase codes', () => {
      const name = getPatternName(['ca', 'sp', 'pa', 'ci', 'vi'])
      expect(name).toBe('simple')
    })
  })

  describe('getAvailablePatterns', () => {
    it('should return all 3 patterns', () => {
      const patterns = getAvailablePatterns()
      expect(patterns).toHaveLength(3)
    })

    it('should include pattern names and processes', () => {
      const patterns = getAvailablePatterns()

      const simple = patterns.find((p) => p.name === 'simple')
      expect(simple).toBeDefined()
      expect(simple!.processes).toEqual(['CA', 'SP', 'PA', 'CI', 'VI'])
      expect(simple!.description).toContain('5공정')
    })

    it('should include descriptions', () => {
      const patterns = getAvailablePatterns()

      expect(patterns.every((p) => p.description.length > 0)).toBe(true)
    })
  })
})
