/**
 * Stage 5 - Process Navigation Tests
 *
 * 다음/이전 공정 조회 테스트
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createProcessRouting,
  getNextProcess,
  getPreviousProcess,
  getFirstProcess,
  getLastProcess,
  isProcessInRouting,
  getProcessSeqInRouting,
  clearProcessRouting,
  getRequiredProcesses,
  getMaterialInputRoutings,
  getInspectionRoutings,
} from '../../src/services/processRoutingService'

const prisma = new PrismaClient()

describe('Process Navigation', () => {
  const testProductCode = 'ROUT_NAV_' + String(Date.now()).slice(-6)
  let testProductId: number

  beforeAll(async () => {
    await prisma.$connect()

    const product = await prisma.product.create({
      data: {
        code: testProductCode,
        name: 'Navigation Test Product',
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
    // 표준 라우팅 설정: CA → MC → PA → CI → VI
    await createProcessRouting(testProductId, ['CA', 'MC', 'PA', 'CI', 'VI'])
  })

  describe('getNextProcess', () => {
    it('should return next process in routing', async () => {
      const next = await getNextProcess(testProductId, 'CA')
      expect(next).toBe('MC')
    })

    it('should return null for last process', async () => {
      const next = await getNextProcess(testProductId, 'VI')
      expect(next).toBeNull()
    })

    it('should return null for process not in routing', async () => {
      const next = await getNextProcess(testProductId, 'MS')
      expect(next).toBeNull()
    })

    it('should handle lowercase process code', async () => {
      const next = await getNextProcess(testProductId, 'ca')
      expect(next).toBe('MC')
    })

    it('should skip intermediate processes correctly', async () => {
      const next = await getNextProcess(testProductId, 'PA')
      expect(next).toBe('CI')
    })
  })

  describe('getPreviousProcess', () => {
    it('should return previous process in routing', async () => {
      const prev = await getPreviousProcess(testProductId, 'MC')
      expect(prev).toBe('CA')
    })

    it('should return null for first process', async () => {
      const prev = await getPreviousProcess(testProductId, 'CA')
      expect(prev).toBeNull()
    })

    it('should return null for process not in routing', async () => {
      const prev = await getPreviousProcess(testProductId, 'MS')
      expect(prev).toBeNull()
    })

    it('should handle lowercase process code', async () => {
      const prev = await getPreviousProcess(testProductId, 'vi')
      expect(prev).toBe('CI')
    })
  })

  describe('getFirstProcess', () => {
    it('should return first process in routing', async () => {
      const first = await getFirstProcess(testProductId)
      expect(first).toBe('CA')
    })

    it('should return null for empty routing', async () => {
      await clearProcessRouting(testProductId)
      const first = await getFirstProcess(testProductId)
      expect(first).toBeNull()
    })
  })

  describe('getLastProcess', () => {
    it('should return last process in routing', async () => {
      const last = await getLastProcess(testProductId)
      expect(last).toBe('VI')
    })

    it('should return null for empty routing', async () => {
      await clearProcessRouting(testProductId)
      const last = await getLastProcess(testProductId)
      expect(last).toBeNull()
    })
  })

  describe('isProcessInRouting', () => {
    it('should return true for process in routing', async () => {
      const inRouting = await isProcessInRouting(testProductId, 'MC')
      expect(inRouting).toBe(true)
    })

    it('should return false for process not in routing', async () => {
      const inRouting = await isProcessInRouting(testProductId, 'MS')
      expect(inRouting).toBe(false)
    })

    it('should handle lowercase process code', async () => {
      const inRouting = await isProcessInRouting(testProductId, 'ca')
      expect(inRouting).toBe(true)
    })
  })

  describe('getProcessSeqInRouting', () => {
    it('should return seq for process in routing', async () => {
      const seq = await getProcessSeqInRouting(testProductId, 'CA')
      expect(seq).toBe(10)
    })

    it('should return correct seq for each process', async () => {
      expect(await getProcessSeqInRouting(testProductId, 'CA')).toBe(10)
      expect(await getProcessSeqInRouting(testProductId, 'MC')).toBe(20)
      expect(await getProcessSeqInRouting(testProductId, 'PA')).toBe(30)
      expect(await getProcessSeqInRouting(testProductId, 'CI')).toBe(40)
      expect(await getProcessSeqInRouting(testProductId, 'VI')).toBe(50)
    })

    it('should return null for process not in routing', async () => {
      const seq = await getProcessSeqInRouting(testProductId, 'MS')
      expect(seq).toBeNull()
    })
  })

  describe('getRequiredProcesses', () => {
    it('should return all required processes', async () => {
      const required = await getRequiredProcesses(testProductId)

      expect(required).toHaveLength(5)
      expect(required.every((r) => r.isRequired === true)).toBe(true)
    })

    it('should be ordered by seq', async () => {
      const required = await getRequiredProcesses(testProductId)

      expect(required[0].processCode).toBe('CA')
      expect(required[4].processCode).toBe('VI')
    })
  })

  describe('getMaterialInputRoutings', () => {
    it('should return only material input processes', async () => {
      const materialInputs = await getMaterialInputRoutings(testProductId)

      // CA, MC, PA are material input processes in our routing
      expect(materialInputs.length).toBeGreaterThan(0)
      expect(
        materialInputs.every((r) => r.process.hasMaterialInput === true)
      ).toBe(true)
    })

    it('should include process details', async () => {
      const materialInputs = await getMaterialInputRoutings(testProductId)

      expect(materialInputs[0].process).toBeDefined()
      expect(materialInputs[0].process.name).toBeDefined()
    })
  })

  describe('getInspectionRoutings', () => {
    it('should return only inspection processes', async () => {
      const inspections = await getInspectionRoutings(testProductId)

      // CI, VI are inspection processes in our routing
      expect(inspections).toHaveLength(2)
      expect(inspections.every((r) => r.process.isInspection === true)).toBe(
        true
      )
    })

    it('should be ordered by seq', async () => {
      const inspections = await getInspectionRoutings(testProductId)

      expect(inspections[0].processCode).toBe('CI')
      expect(inspections[1].processCode).toBe('VI')
    })
  })
})
