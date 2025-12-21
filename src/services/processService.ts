/**
 * Process Service
 *
 * 공정 마스터 관리 서비스
 * - CRUD 기능
 * - 공정 조회 (자재투입, 검사, 순서)
 * - 초기 데이터 Seed
 */
import { prisma } from '../lib/prisma'
import { Process, Prisma } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface CreateProcessInput {
  code: string
  name: string
  seq: number
  hasMaterialInput?: boolean
  isInspection?: boolean
  shortCode?: string
  description?: string
}

export interface UpdateProcessInput {
  name?: string
  seq?: number
  hasMaterialInput?: boolean
  isInspection?: boolean
  shortCode?: string
  description?: string
  isActive?: boolean
}

export interface ProcessWithStats extends Process {
  _count?: {
    processRoutings: number
  }
}

// ============================================
// Seed Data - 10개 공정
// ============================================

export const PROCESS_SEED_DATA: CreateProcessInput[] = [
  { code: 'CA', name: '자동절단압착', seq: 10, hasMaterialInput: true, isInspection: false, shortCode: 'C', description: '전선 절단 및 자동 압착' },
  { code: 'MS', name: '중간스트립', seq: 20, hasMaterialInput: false, isInspection: false, shortCode: 'S', description: '중간 탈피 작업' },
  { code: 'MC', name: '수동압착', seq: 30, hasMaterialInput: true, isInspection: false, shortCode: 'M', description: '수동 압착 및 연결' },
  { code: 'SB', name: '서브조립', seq: 40, hasMaterialInput: true, isInspection: false, shortCode: 'B', description: '그로멧, 씰, 튜브류 조립' },
  { code: 'HS', name: '열수축', seq: 50, hasMaterialInput: false, isInspection: false, shortCode: 'H', description: '열수축 튜브 수축' },
  { code: 'CQ', name: '압착검사', seq: 60, hasMaterialInput: false, isInspection: true, shortCode: 'Q', description: '압착 품질 검사' },
  { code: 'SP', name: '제품조립제공부품', seq: 70, hasMaterialInput: true, isInspection: false, shortCode: 'P', description: '조립 자재 키팅' },
  { code: 'PA', name: '제품조립', seq: 80, hasMaterialInput: true, isInspection: false, shortCode: 'A', description: '커넥터, 하우징 조립' },
  { code: 'CI', name: '회로검사', seq: 90, hasMaterialInput: false, isInspection: true, shortCode: 'I', description: '회로 연결 검사' },
  { code: 'VI', name: '육안검사', seq: 100, hasMaterialInput: false, isInspection: true, shortCode: 'V', description: '외관 육안 검사' },
]

// ============================================
// CRUD Operations
// ============================================

/**
 * 공정 생성
 */
export async function createProcess(input: CreateProcessInput): Promise<Process> {
  return prisma.process.create({
    data: {
      code: input.code.toUpperCase(),
      name: input.name,
      seq: input.seq,
      hasMaterialInput: input.hasMaterialInput ?? false,
      isInspection: input.isInspection ?? false,
      shortCode: input.shortCode,
      description: input.description,
    },
  })
}

/**
 * 공정 조회 (ID)
 */
export async function getProcessById(id: number): Promise<ProcessWithStats | null> {
  return prisma.process.findUnique({
    where: { id },
    include: {
      _count: {
        select: { processRoutings: true },
      },
    },
  })
}

/**
 * 공정 조회 (코드)
 */
export async function getProcessByCode(code: string): Promise<Process | null> {
  return prisma.process.findUnique({
    where: { code: code.toUpperCase() },
  })
}

/**
 * 공정 수정
 */
export async function updateProcess(id: number, input: UpdateProcessInput): Promise<Process> {
  return prisma.process.update({
    where: { id },
    data: input,
  })
}

/**
 * 공정 삭제 (소프트 삭제)
 */
export async function deleteProcess(id: number): Promise<void> {
  await prisma.process.update({
    where: { id },
    data: { isActive: false },
  })
}

/**
 * 공정 완전 삭제
 */
export async function hardDeleteProcess(id: number): Promise<void> {
  await prisma.process.delete({
    where: { id },
  })
}

// ============================================
// Query Operations
// ============================================

/**
 * 전체 공정 목록 조회
 */
export async function getAllProcesses(options?: {
  isActive?: boolean
  includeStats?: boolean
}): Promise<ProcessWithStats[]> {
  const { isActive = true, includeStats = false } = options || {}

  const where: Prisma.ProcessWhereInput = {}

  if (isActive !== undefined) {
    where.isActive = isActive
  }

  return prisma.process.findMany({
    where,
    include: includeStats
      ? {
          _count: {
            select: { processRoutings: true },
          },
        }
      : undefined,
    orderBy: { seq: 'asc' },
  })
}

/**
 * 자재 투입 공정 조회
 */
export async function getMaterialInputProcesses(): Promise<Process[]> {
  return prisma.process.findMany({
    where: {
      hasMaterialInput: true,
      isActive: true,
    },
    orderBy: { seq: 'asc' },
  })
}

/**
 * 검사 공정 조회
 */
export async function getInspectionProcesses(): Promise<Process[]> {
  return prisma.process.findMany({
    where: {
      isInspection: true,
      isActive: true,
    },
    orderBy: { seq: 'asc' },
  })
}

/**
 * 공정 코드 목록을 순서대로 정렬
 */
export async function getProcessSequence(processCodes: string[]): Promise<Process[]> {
  const upperCodes = processCodes.map((c) => c.toUpperCase())

  const processes = await prisma.process.findMany({
    where: {
      code: { in: upperCodes },
      isActive: true,
    },
    orderBy: { seq: 'asc' },
  })

  return processes
}

/**
 * 단축코드로 공정 조회
 */
export async function getProcessByShortCode(shortCode: string): Promise<Process | null> {
  return prisma.process.findFirst({
    where: {
      shortCode: shortCode.toUpperCase(),
      isActive: true,
    },
  })
}

/**
 * 공정 코드 유효성 검증
 */
export async function isValidProcessCode(code: string): Promise<boolean> {
  const process = await prisma.process.findUnique({
    where: { code: code.toUpperCase() },
    select: { isActive: true },
  })

  return process?.isActive ?? false
}

/**
 * 공정 순서 조회 (seq 값 반환)
 */
export async function getProcessSeq(code: string): Promise<number | null> {
  const process = await prisma.process.findUnique({
    where: { code: code.toUpperCase() },
    select: { seq: true },
  })

  return process?.seq ?? null
}

/**
 * 다음 공정 조회 (seq 기준)
 */
export async function getNextProcessBySeq(currentSeq: number): Promise<Process | null> {
  return prisma.process.findFirst({
    where: {
      seq: { gt: currentSeq },
      isActive: true,
    },
    orderBy: { seq: 'asc' },
  })
}

/**
 * 이전 공정 조회 (seq 기준)
 */
export async function getPreviousProcessBySeq(currentSeq: number): Promise<Process | null> {
  return prisma.process.findFirst({
    where: {
      seq: { lt: currentSeq },
      isActive: true,
    },
    orderBy: { seq: 'desc' },
  })
}

// ============================================
// Seed Operations
// ============================================

/**
 * 공정 초기 데이터 Seed
 */
export async function seedProcesses(): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0

  for (const processData of PROCESS_SEED_DATA) {
    const existing = await prisma.process.findUnique({
      where: { code: processData.code },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.process.create({
      data: {
        code: processData.code,
        name: processData.name,
        seq: processData.seq,
        hasMaterialInput: processData.hasMaterialInput ?? false,
        isInspection: processData.isInspection ?? false,
        shortCode: processData.shortCode,
        description: processData.description,
      },
    })
    created++
  }

  return { created, skipped }
}

/**
 * 공정 존재 여부 확인
 */
export async function hasProcesses(): Promise<boolean> {
  const count = await prisma.process.count()
  return count > 0
}

/**
 * 공정 수 조회
 */
export async function countProcesses(options?: { isActive?: boolean }): Promise<number> {
  const { isActive } = options || {}

  return prisma.process.count({
    where: isActive !== undefined ? { isActive } : undefined,
  })
}

// ============================================
// Utility Functions
// ============================================

/**
 * 공정 코드 → 단축코드 변환
 */
export function getShortCodeFromProcess(code: string): string {
  const mapping: Record<string, string> = {
    CA: 'C',
    MS: 'S',
    MC: 'M',
    SB: 'B',
    HS: 'H',
    CQ: 'Q',
    SP: 'P',
    PA: 'A',
    CI: 'I',
    VI: 'V',
  }

  return mapping[code.toUpperCase()] || code.charAt(0)
}

/**
 * 단축코드 → 공정 코드 변환
 */
export function getProcessCodeFromShort(shortCode: string): string | null {
  const mapping: Record<string, string> = {
    C: 'CA',
    S: 'MS',
    M: 'MC',
    B: 'SB',
    H: 'HS',
    Q: 'CQ',
    P: 'SP',
    A: 'PA',
    I: 'CI',
    V: 'VI',
  }

  return mapping[shortCode.toUpperCase()] || null
}
