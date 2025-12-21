/**
 * Stage 2 - Process Order Tests
 *
 * 공정 순서 관련 테스트
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  getProcessSequence,
  getMaterialInputProcesses,
  getInspectionProcesses,
  getNextProcessBySeq,
  getPreviousProcessBySeq,
  getProcessSeq,
  isValidProcessCode,
  getProcessByShortCode,
  getShortCodeFromProcess,
  getProcessCodeFromShort,
} from '../../src/services/processService'

const prisma = new PrismaClient()

describe('Process Order', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('getProcessSequence', () => {
    it('should return processes in correct order', async () => {
      const codes = ['PA', 'CA', 'MC']  // 순서 섞음
      const processes = await getProcessSequence(codes)

      expect(processes).toHaveLength(3)
      expect(processes[0].code).toBe('CA')  // seq 10
      expect(processes[1].code).toBe('MC')  // seq 30
      expect(processes[2].code).toBe('PA')  // seq 80
    })

    it('should handle lowercase codes', async () => {
      const codes = ['ca', 'mc']
      const processes = await getProcessSequence(codes)

      expect(processes).toHaveLength(2)
      expect(processes[0].code).toBe('CA')
    })

    it('should return empty array for non-existent codes', async () => {
      const codes = ['NONEXIST', 'ALSO_NONEXIST']
      const processes = await getProcessSequence(codes)

      expect(processes).toHaveLength(0)
    })
  })

  describe('getMaterialInputProcesses', () => {
    it('should return only material input processes', async () => {
      const processes = await getMaterialInputProcesses()

      expect(processes.length).toBeGreaterThanOrEqual(5)
      processes.forEach((p) => {
        expect(p.hasMaterialInput).toBe(true)
      })
    })

    it('should be ordered by seq', async () => {
      const processes = await getMaterialInputProcesses()

      for (let i = 1; i < processes.length; i++) {
        expect(processes[i].seq).toBeGreaterThan(processes[i - 1].seq)
      }
    })

    it('should include CA, MC, SB, SP, PA', async () => {
      const processes = await getMaterialInputProcesses()
      const codes = processes.map((p) => p.code)

      expect(codes).toContain('CA')
      expect(codes).toContain('MC')
      expect(codes).toContain('SB')
      expect(codes).toContain('SP')
      expect(codes).toContain('PA')
    })
  })

  describe('getInspectionProcesses', () => {
    it('should return only inspection processes', async () => {
      const processes = await getInspectionProcesses()

      expect(processes.length).toBeGreaterThanOrEqual(3)
      processes.forEach((p) => {
        expect(p.isInspection).toBe(true)
      })
    })

    it('should include CQ, CI, VI', async () => {
      const processes = await getInspectionProcesses()
      const codes = processes.map((p) => p.code)

      expect(codes).toContain('CQ')
      expect(codes).toContain('CI')
      expect(codes).toContain('VI')
    })
  })

  describe('getProcessSeq', () => {
    it('should return correct seq for CA', async () => {
      const seq = await getProcessSeq('CA')
      expect(seq).toBe(10)
    })

    it('should return correct seq for VI', async () => {
      const seq = await getProcessSeq('VI')
      expect(seq).toBe(100)
    })

    it('should return null for non-existent code', async () => {
      const seq = await getProcessSeq('NONEXIST')
      expect(seq).toBeNull()
    })
  })

  describe('getNextProcessBySeq', () => {
    it('should return MS after CA', async () => {
      const next = await getNextProcessBySeq(10)  // CA seq
      expect(next).not.toBeNull()
      expect(next!.code).toBe('MS')
    })

    it('should return CI after PA', async () => {
      const next = await getNextProcessBySeq(80)  // PA seq
      expect(next).not.toBeNull()
      expect(next!.code).toBe('CI')  // seq 90
    })

    it('should return VI after CI', async () => {
      const next = await getNextProcessBySeq(90)  // CI seq
      expect(next).not.toBeNull()
      expect(next!.code).toBe('VI')  // seq 100
    })
  })

  describe('getPreviousProcessBySeq', () => {
    it('should return CA before MS', async () => {
      const prev = await getPreviousProcessBySeq(20)  // MS seq
      expect(prev).not.toBeNull()
      expect(prev!.code).toBe('CA')
    })

    it('should return null before CA', async () => {
      const prev = await getPreviousProcessBySeq(10)  // CA seq
      expect(prev).toBeNull()
    })
  })

  describe('isValidProcessCode', () => {
    it('should return true for valid code', async () => {
      const valid = await isValidProcessCode('CA')
      expect(valid).toBe(true)
    })

    it('should return true for lowercase valid code', async () => {
      const valid = await isValidProcessCode('ca')
      expect(valid).toBe(true)
    })

    it('should return false for invalid code', async () => {
      const valid = await isValidProcessCode('INVALID')
      expect(valid).toBe(false)
    })
  })

  describe('getProcessByShortCode', () => {
    it('should find CA by short code C', async () => {
      const process = await getProcessByShortCode('C')
      expect(process).not.toBeNull()
      expect(process!.code).toBe('CA')
    })

    it('should find VI by short code V', async () => {
      const process = await getProcessByShortCode('V')
      expect(process).not.toBeNull()
      expect(process!.code).toBe('VI')
    })

    it('should handle lowercase short code', async () => {
      const process = await getProcessByShortCode('c')
      expect(process).not.toBeNull()
      expect(process!.code).toBe('CA')
    })
  })

  describe('Short Code Utilities', () => {
    it('getShortCodeFromProcess should return correct short codes', () => {
      expect(getShortCodeFromProcess('CA')).toBe('C')
      expect(getShortCodeFromProcess('MS')).toBe('S')
      expect(getShortCodeFromProcess('MC')).toBe('M')
      expect(getShortCodeFromProcess('SB')).toBe('B')
      expect(getShortCodeFromProcess('HS')).toBe('H')
      expect(getShortCodeFromProcess('CQ')).toBe('Q')
      expect(getShortCodeFromProcess('SP')).toBe('P')
      expect(getShortCodeFromProcess('PA')).toBe('A')
      expect(getShortCodeFromProcess('CI')).toBe('I')
      expect(getShortCodeFromProcess('VI')).toBe('V')
    })

    it('getProcessCodeFromShort should return correct process codes', () => {
      expect(getProcessCodeFromShort('C')).toBe('CA')
      expect(getProcessCodeFromShort('S')).toBe('MS')
      expect(getProcessCodeFromShort('M')).toBe('MC')
      expect(getProcessCodeFromShort('B')).toBe('SB')
      expect(getProcessCodeFromShort('H')).toBe('HS')
      expect(getProcessCodeFromShort('Q')).toBe('CQ')
      expect(getProcessCodeFromShort('P')).toBe('SP')
      expect(getProcessCodeFromShort('A')).toBe('PA')
      expect(getProcessCodeFromShort('I')).toBe('CI')
      expect(getProcessCodeFromShort('V')).toBe('VI')
    })

    it('getProcessCodeFromShort should return null for unknown short code', () => {
      expect(getProcessCodeFromShort('X')).toBeNull()
      expect(getProcessCodeFromShort('Z')).toBeNull()
    })
  })
})
