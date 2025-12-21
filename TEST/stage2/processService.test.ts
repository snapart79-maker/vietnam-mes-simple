/**
 * Stage 2 - ProcessService CRUD Tests
 *
 * 공정 마스터 서비스 CRUD 테스트
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createProcess,
  getProcessById,
  getProcessByCode,
  updateProcess,
  deleteProcess,
  hardDeleteProcess,
  getAllProcesses,
} from '../../src/services/processService'

const prisma = new PrismaClient()

describe('ProcessService CRUD', () => {
  const createdIds: number[] = []

  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    // 테스트로 생성된 공정 정리
    for (const id of createdIds) {
      await prisma.process.delete({ where: { id } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  describe('Create Process', () => {
    it('should create a process with all fields', async () => {
      const input = {
        code: 'T1' + String(Date.now()).slice(-4),
        name: 'Test Process',
        seq: 999,
        hasMaterialInput: true,
        isInspection: false,
        shortCode: 'T',
        description: 'Test description',
      }

      const process = await createProcess(input)
      createdIds.push(process.id)

      expect(process.code).toBe(input.code.toUpperCase())
      expect(process.name).toBe('Test Process')
      expect(process.seq).toBe(999)
      expect(process.hasMaterialInput).toBe(true)
      expect(process.isInspection).toBe(false)
      expect(process.shortCode).toBe('T')
      expect(process.description).toBe('Test description')
      expect(process.isActive).toBe(true)
    })

    it('should create process with defaults', async () => {
      const input = {
        code: 'T2' + String(Date.now()).slice(-4),
        name: 'Minimal Process',
        seq: 998,
      }

      const process = await createProcess(input)
      createdIds.push(process.id)

      expect(process.hasMaterialInput).toBe(false)
      expect(process.isInspection).toBe(false)
      expect(process.shortCode).toBeNull()
      expect(process.description).toBeNull()
    })

    it('should uppercase process code', async () => {
      const input = {
        code: 'lc' + String(Date.now()).slice(-4),
        name: 'Lowercase Code Process',
        seq: 997,
      }

      const process = await createProcess(input)
      createdIds.push(process.id)

      expect(process.code).toBe(input.code.toUpperCase())
    })
  })

  describe('Read Process', () => {
    let testProcessId: number
    let testProcessCode: string

    beforeAll(async () => {
      testProcessCode = 'RD' + String(Date.now()).slice(-4)
      const process = await createProcess({
        code: testProcessCode,
        name: 'Read Test Process',
        seq: 996,
        shortCode: 'R',
      })
      testProcessId = process.id
      createdIds.push(testProcessId)
    })

    it('should get process by ID', async () => {
      const process = await getProcessById(testProcessId)

      expect(process).not.toBeNull()
      expect(process!.id).toBe(testProcessId)
      expect(process!.name).toBe('Read Test Process')
    })

    it('should get process by code', async () => {
      const process = await getProcessByCode(testProcessCode)

      expect(process).not.toBeNull()
      expect(process!.code).toBe(testProcessCode.toUpperCase())
    })

    it('should get process by lowercase code', async () => {
      const process = await getProcessByCode(testProcessCode.toLowerCase())

      expect(process).not.toBeNull()
      expect(process!.code).toBe(testProcessCode.toUpperCase())
    })

    it('should return null for non-existent ID', async () => {
      const process = await getProcessById(999999)
      expect(process).toBeNull()
    })

    it('should return null for non-existent code', async () => {
      const process = await getProcessByCode('NONEXIST')
      expect(process).toBeNull()
    })
  })

  describe('Update Process', () => {
    let testProcessId: number

    beforeAll(async () => {
      const process = await createProcess({
        code: 'UP' + String(Date.now()).slice(-4),
        name: 'Update Test Process',
        seq: 995,
      })
      testProcessId = process.id
      createdIds.push(testProcessId)
    })

    it('should update process name', async () => {
      const updated = await updateProcess(testProcessId, { name: 'Updated Name' })
      expect(updated.name).toBe('Updated Name')
    })

    it('should update process seq', async () => {
      const updated = await updateProcess(testProcessId, { seq: 500 })
      expect(updated.seq).toBe(500)
    })

    it('should update multiple fields', async () => {
      const updated = await updateProcess(testProcessId, {
        hasMaterialInput: true,
        isInspection: true,
        description: 'Updated description',
      })

      expect(updated.hasMaterialInput).toBe(true)
      expect(updated.isInspection).toBe(true)
      expect(updated.description).toBe('Updated description')
    })
  })

  describe('Delete Process', () => {
    it('should soft delete process', async () => {
      const process = await createProcess({
        code: 'SD' + String(Date.now()).slice(-4),
        name: 'Soft Delete Test',
        seq: 994,
      })
      createdIds.push(process.id)

      await deleteProcess(process.id)

      const deleted = await getProcessById(process.id)
      expect(deleted!.isActive).toBe(false)
    })

    it('should hard delete process', async () => {
      const process = await createProcess({
        code: 'HD' + String(Date.now()).slice(-4),
        name: 'Hard Delete Test',
        seq: 993,
      })

      await hardDeleteProcess(process.id)

      const deleted = await getProcessById(process.id)
      expect(deleted).toBeNull()
    })
  })

  describe('List Processes', () => {
    it('should get all active processes', async () => {
      const processes = await getAllProcesses({ isActive: true })

      expect(Array.isArray(processes)).toBe(true)
      processes.forEach((p) => {
        expect(p.isActive).toBe(true)
      })
    })

    it('should return processes ordered by seq', async () => {
      const processes = await getAllProcesses()

      for (let i = 1; i < processes.length; i++) {
        expect(processes[i].seq).toBeGreaterThanOrEqual(processes[i - 1].seq)
      }
    })
  })
})
