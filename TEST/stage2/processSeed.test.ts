/**
 * Stage 2 - Process Seed Data Tests
 *
 * 공정 초기 데이터 Seed 테스트
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  seedProcesses,
  hasProcesses,
  countProcesses,
  PROCESS_SEED_DATA,
} from '../../src/services/processService'

const prisma = new PrismaClient()

describe('Process Seed Data', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Seed Data Validation', () => {
    it('should have 10 processes in seed data', () => {
      expect(PROCESS_SEED_DATA).toHaveLength(10)
    })

    it('should have all required process codes', () => {
      const requiredCodes = ['CA', 'MS', 'MC', 'SB', 'HS', 'CQ', 'SP', 'PA', 'CI', 'VI']
      const seedCodes = PROCESS_SEED_DATA.map((p) => p.code)

      requiredCodes.forEach((code) => {
        expect(seedCodes).toContain(code)
      })
    })

    it('should have unique seq values', () => {
      const seqs = PROCESS_SEED_DATA.map((p) => p.seq)
      const uniqueSeqs = [...new Set(seqs)]

      expect(seqs.length).toBe(uniqueSeqs.length)
    })

    it('should have seq values in ascending order', () => {
      for (let i = 1; i < PROCESS_SEED_DATA.length; i++) {
        expect(PROCESS_SEED_DATA[i].seq).toBeGreaterThan(PROCESS_SEED_DATA[i - 1].seq)
      }
    })

    it('should have correct material input flags', () => {
      const materialInputProcesses = ['CA', 'MC', 'SB', 'SP', 'PA']
      const noMaterialInputProcesses = ['MS', 'HS', 'CQ', 'CI', 'VI']

      PROCESS_SEED_DATA.forEach((p) => {
        if (materialInputProcesses.includes(p.code)) {
          expect(p.hasMaterialInput).toBe(true)
        }
        if (noMaterialInputProcesses.includes(p.code)) {
          expect(p.hasMaterialInput).toBe(false)
        }
      })
    })

    it('should have correct inspection flags', () => {
      const inspectionProcesses = ['CQ', 'CI', 'VI']
      const nonInspectionProcesses = ['CA', 'MS', 'MC', 'SB', 'HS', 'SP', 'PA']

      PROCESS_SEED_DATA.forEach((p) => {
        if (inspectionProcesses.includes(p.code)) {
          expect(p.isInspection).toBe(true)
        }
        if (nonInspectionProcesses.includes(p.code)) {
          expect(p.isInspection).toBe(false)
        }
      })
    })

    it('should have unique short codes', () => {
      const shortCodes = PROCESS_SEED_DATA.map((p) => p.shortCode).filter(Boolean)
      const uniqueShortCodes = [...new Set(shortCodes)]

      expect(shortCodes.length).toBe(uniqueShortCodes.length)
    })
  })

  describe('Seed Function', () => {
    it('seedProcesses should return created/skipped counts', async () => {
      const result = await seedProcesses()

      expect(result).toHaveProperty('created')
      expect(result).toHaveProperty('skipped')
      expect(typeof result.created).toBe('number')
      expect(typeof result.skipped).toBe('number')
      expect(result.created + result.skipped).toBe(10)
    })

    it('hasProcesses should return true after seed', async () => {
      const has = await hasProcesses()
      expect(has).toBe(true)
    })

    it('countProcesses should return correct count', async () => {
      const count = await countProcesses()
      expect(count).toBeGreaterThanOrEqual(10)
    })
  })

  describe('Seeded Data in DB', () => {
    it('should have CA process in database', async () => {
      const ca = await prisma.process.findUnique({ where: { code: 'CA' } })

      expect(ca).not.toBeNull()
      expect(ca!.name).toBe('자동절단압착')
      expect(ca!.seq).toBe(10)
      expect(ca!.hasMaterialInput).toBe(true)
      expect(ca!.isInspection).toBe(false)
      expect(ca!.shortCode).toBe('C')
    })

    it('should have all 10 processes in database', async () => {
      const requiredCodes = ['CA', 'MS', 'MC', 'SB', 'HS', 'CQ', 'SP', 'PA', 'CI', 'VI']

      for (const code of requiredCodes) {
        const process = await prisma.process.findUnique({ where: { code } })
        expect(process).not.toBeNull()
        expect(process!.isActive).toBe(true)
      }
    })

    it('should have inspection processes marked correctly', async () => {
      // 원본 공정 중 검사 공정만 확인 (테스트 공정 제외)
      const inspectionProcesses = await prisma.process.findMany({
        where: {
          isInspection: true,
          code: { in: ['CQ', 'CI', 'VI'] },
        },
      })

      const codes = inspectionProcesses.map((p) => p.code)
      expect(codes).toContain('CQ')
      expect(codes).toContain('CI')
      expect(codes).toContain('VI')
      expect(codes).toHaveLength(3)
    })

    it('should have material input processes marked correctly', async () => {
      // 원본 공정 중 자재투입 공정만 확인 (테스트 공정 제외)
      const materialProcesses = await prisma.process.findMany({
        where: {
          hasMaterialInput: true,
          code: { in: ['CA', 'MC', 'SB', 'SP', 'PA'] },
        },
      })

      const codes = materialProcesses.map((p) => p.code)
      expect(codes).toContain('CA')
      expect(codes).toContain('MC')
      expect(codes).toContain('SB')
      expect(codes).toContain('SP')
      expect(codes).toContain('PA')
      expect(codes).toHaveLength(5)
    })
  })
})
