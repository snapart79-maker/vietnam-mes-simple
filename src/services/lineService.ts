/**
 * Line Service
 *
 * 생산 라인 관리 서비스
 */
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface CreateLineInput {
  code: string
  name: string
  processCode: string
}

export interface UpdateLineInput {
  name?: string
  processCode?: string
  isActive?: boolean
}

export interface LineWithStats {
  id: number
  code: string
  name: string
  processCode: string
  isActive: boolean
  todayLots: number
  todayCompleted: number
}

// ============================================
// CRUD Operations
// ============================================

/**
 * 라인 생성
 */
export async function createLine(input: CreateLineInput) {
  return prisma.line.create({
    data: {
      code: input.code,
      name: input.name,
      processCode: input.processCode.toUpperCase(),
    },
  })
}

/**
 * 라인 조회 (ID)
 */
export async function getLineById(id: number) {
  return prisma.line.findUnique({
    where: { id },
  })
}

/**
 * 라인 조회 (코드)
 */
export async function getLineByCode(code: string) {
  return prisma.line.findUnique({
    where: { code },
  })
}

/**
 * 라인 수정
 */
export async function updateLine(id: number, input: UpdateLineInput) {
  return prisma.line.update({
    where: { id },
    data: {
      ...input,
      processCode: input.processCode?.toUpperCase(),
    },
  })
}

/**
 * 라인 삭제 (소프트 삭제)
 */
export async function deleteLine(id: number): Promise<void> {
  await prisma.line.update({
    where: { id },
    data: { isActive: false },
  })
}

// ============================================
// Query Operations
// ============================================

/**
 * 전체 라인 목록 조회
 */
export async function getAllLines(options?: {
  processCode?: string
  isActive?: boolean
}) {
  const { processCode, isActive = true } = options || {}

  const where: Prisma.LineWhereInput = {}

  if (isActive !== undefined) {
    where.isActive = isActive
  }

  if (processCode) {
    where.processCode = processCode.toUpperCase()
  }

  return prisma.line.findMany({
    where,
    orderBy: [
      { processCode: 'asc' },
      { code: 'asc' },
    ],
  })
}

/**
 * 공정별 라인 조회
 */
export async function getLinesByProcess(processCode: string) {
  return getAllLines({ processCode })
}

/**
 * 라인별 통계 조회
 */
export async function getLinesWithStats(): Promise<LineWithStats[]> {
  const lines = await prisma.line.findMany({
    where: { isActive: true },
    orderBy: [
      { processCode: 'asc' },
      { code: 'asc' },
    ],
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const result: LineWithStats[] = []

  for (const line of lines) {
    const lots = await prisma.productionLot.findMany({
      where: {
        lineCode: line.code,
        startedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        status: true,
      },
    })

    result.push({
      id: line.id,
      code: line.code,
      name: line.name,
      processCode: line.processCode,
      isActive: line.isActive,
      todayLots: lots.length,
      todayCompleted: lots.filter((l) => l.status === 'COMPLETED').length,
    })
  }

  return result
}

/**
 * 공정 코드 목록 조회
 */
export async function getProcessCodes(): Promise<string[]> {
  const result = await prisma.line.findMany({
    where: { isActive: true },
    select: { processCode: true },
    distinct: ['processCode'],
    orderBy: { processCode: 'asc' },
  })

  return result.map((r) => r.processCode)
}

/**
 * 라인별 일일 생산 현황
 */
export async function getLineDailyStats(lineCode: string, date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const lots = await prisma.productionLot.findMany({
    where: {
      lineCode,
      startedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: {
      status: true,
      completedQty: true,
      defectQty: true,
      plannedQty: true,
    },
  })

  return {
    lineCode,
    date: startOfDay,
    totalLots: lots.length,
    completedLots: lots.filter((l) => l.status === 'COMPLETED').length,
    inProgressLots: lots.filter((l) => l.status === 'IN_PROGRESS').length,
    totalPlanned: lots.reduce((sum, l) => sum + l.plannedQty, 0),
    totalCompleted: lots.reduce((sum, l) => sum + l.completedQty, 0),
    totalDefects: lots.reduce((sum, l) => sum + l.defectQty, 0),
  }
}
