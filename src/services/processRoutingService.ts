/**
 * Process Routing Service
 *
 * 제품별 공정 순서 관리 서비스
 * - 공정 라우팅 CRUD
 * - 패턴 기반 라우팅 생성
 * - 공정 네비게이션 (다음/이전)
 * - 공정 순서 검증
 */
import { prisma } from '../lib/prisma'
import { ProcessRouting, Process, Prisma } from '@prisma/client'
import { isValidProcessCode } from './processService'

// ============================================
// Types
// ============================================

export interface ProcessRoutingWithProcess extends ProcessRouting {
  process: Process
}

export interface CreateRoutingInput {
  productId: number
  processCode: string
  seq: number
  isRequired?: boolean
}

export interface UpdateRoutingInput {
  seq?: number
  isRequired?: boolean
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

// ============================================
// Process Patterns (공정 패턴 템플릿)
// ============================================

export const PROCESS_PATTERNS = {
  /**
   * 단순 공정: 절압 → 조립부품 → 조립 → 검사
   */
  simple: ['CA', 'SP', 'PA', 'CI', 'VI'],

  /**
   * 중간 공정: 절압 → 서브조립 → 수동압착 → 검사 → 조립
   */
  medium: ['CA', 'SB', 'MC', 'CQ', 'SP', 'PA', 'CI', 'VI'],

  /**
   * 복잡 공정: 전체 공정 포함
   */
  complex: ['CA', 'MS', 'MC', 'SB', 'HS', 'CQ', 'SP', 'PA', 'CI', 'VI'],
} as const

export type ProcessPatternName = keyof typeof PROCESS_PATTERNS

// ============================================
// CRUD Operations
// ============================================

/**
 * 단일 공정 라우팅 생성
 */
export async function createRoutingEntry(
  input: CreateRoutingInput
): Promise<ProcessRoutingWithProcess> {
  const processCode = input.processCode.toUpperCase()

  // 공정 코드 유효성 검증
  const isValid = await isValidProcessCode(processCode)
  if (!isValid) {
    throw new Error(`유효하지 않은 공정 코드: ${processCode}`)
  }

  return prisma.processRouting.create({
    data: {
      productId: input.productId,
      processCode,
      seq: input.seq,
      isRequired: input.isRequired ?? true,
    },
    include: {
      process: true,
    },
  })
}

/**
 * 제품별 공정 라우팅 일괄 생성
 */
export async function createProcessRouting(
  productId: number,
  processCodes: string[]
): Promise<ProcessRoutingWithProcess[]> {
  if (processCodes.length === 0) {
    throw new Error('공정 코드 목록이 비어있습니다')
  }

  // 공정 코드 유효성 검증
  const upperCodes = processCodes.map((c) => c.toUpperCase())
  for (const code of upperCodes) {
    const isValid = await isValidProcessCode(code)
    if (!isValid) {
      throw new Error(`유효하지 않은 공정 코드: ${code}`)
    }
  }

  // 기존 라우팅 삭제
  await prisma.processRouting.deleteMany({
    where: { productId },
  })

  // 새 라우팅 생성
  const routings: ProcessRoutingWithProcess[] = []
  for (let i = 0; i < upperCodes.length; i++) {
    const routing = await prisma.processRouting.create({
      data: {
        productId,
        processCode: upperCodes[i],
        seq: (i + 1) * 10, // 10, 20, 30, ...
        isRequired: true,
      },
      include: {
        process: true,
      },
    })
    routings.push(routing)
  }

  return routings
}

/**
 * 패턴 기반 공정 라우팅 생성
 */
export async function createRoutingFromPattern(
  productId: number,
  patternName: ProcessPatternName
): Promise<ProcessRoutingWithProcess[]> {
  const pattern = PROCESS_PATTERNS[patternName]
  if (!pattern) {
    throw new Error(`유효하지 않은 패턴명: ${patternName}`)
  }

  return createProcessRouting(productId, [...pattern])
}

/**
 * 공정 라우팅 조회
 */
export async function getProcessRouting(
  productId: number
): Promise<ProcessRoutingWithProcess[]> {
  return prisma.processRouting.findMany({
    where: { productId },
    include: {
      process: true,
    },
    orderBy: { seq: 'asc' },
  })
}

/**
 * 공정 라우팅 존재 여부 확인
 */
export async function hasProcessRouting(productId: number): Promise<boolean> {
  const count = await prisma.processRouting.count({
    where: { productId },
  })
  return count > 0
}

/**
 * 공정 라우팅 업데이트
 */
export async function updateProcessRouting(
  productId: number,
  newProcessCodes: string[]
): Promise<ProcessRoutingWithProcess[]> {
  return createProcessRouting(productId, newProcessCodes)
}

/**
 * 단일 라우팅 엔트리 수정
 */
export async function updateRoutingEntry(
  id: number,
  input: UpdateRoutingInput
): Promise<ProcessRoutingWithProcess> {
  return prisma.processRouting.update({
    where: { id },
    data: input,
    include: {
      process: true,
    },
  })
}

/**
 * 단일 라우팅 엔트리 삭제
 */
export async function deleteRoutingEntry(id: number): Promise<void> {
  await prisma.processRouting.delete({
    where: { id },
  })
}

/**
 * 제품의 전체 공정 라우팅 삭제
 */
export async function clearProcessRouting(productId: number): Promise<number> {
  const result = await prisma.processRouting.deleteMany({
    where: { productId },
  })
  return result.count
}

// ============================================
// Navigation Operations
// ============================================

/**
 * 다음 공정 조회 (제품별 라우팅 기준)
 */
export async function getNextProcess(
  productId: number,
  currentProcessCode: string
): Promise<string | null> {
  const code = currentProcessCode.toUpperCase()

  // 현재 공정의 seq 찾기
  const currentRouting = await prisma.processRouting.findUnique({
    where: {
      productId_processCode: {
        productId,
        processCode: code,
      },
    },
    select: { seq: true },
  })

  if (!currentRouting) {
    return null
  }

  // 다음 공정 찾기
  const nextRouting = await prisma.processRouting.findFirst({
    where: {
      productId,
      seq: { gt: currentRouting.seq },
    },
    orderBy: { seq: 'asc' },
    select: { processCode: true },
  })

  return nextRouting?.processCode ?? null
}

/**
 * 이전 공정 조회 (제품별 라우팅 기준)
 */
export async function getPreviousProcess(
  productId: number,
  currentProcessCode: string
): Promise<string | null> {
  const code = currentProcessCode.toUpperCase()

  // 현재 공정의 seq 찾기
  const currentRouting = await prisma.processRouting.findUnique({
    where: {
      productId_processCode: {
        productId,
        processCode: code,
      },
    },
    select: { seq: true },
  })

  if (!currentRouting) {
    return null
  }

  // 이전 공정 찾기
  const prevRouting = await prisma.processRouting.findFirst({
    where: {
      productId,
      seq: { lt: currentRouting.seq },
    },
    orderBy: { seq: 'desc' },
    select: { processCode: true },
  })

  return prevRouting?.processCode ?? null
}

/**
 * 첫 번째 공정 조회
 */
export async function getFirstProcess(productId: number): Promise<string | null> {
  const routing = await prisma.processRouting.findFirst({
    where: { productId },
    orderBy: { seq: 'asc' },
    select: { processCode: true },
  })

  return routing?.processCode ?? null
}

/**
 * 마지막 공정 조회
 */
export async function getLastProcess(productId: number): Promise<string | null> {
  const routing = await prisma.processRouting.findFirst({
    where: { productId },
    orderBy: { seq: 'desc' },
    select: { processCode: true },
  })

  return routing?.processCode ?? null
}

/**
 * 공정이 라우팅에 포함되어 있는지 확인
 */
export async function isProcessInRouting(
  productId: number,
  processCode: string
): Promise<boolean> {
  const routing = await prisma.processRouting.findUnique({
    where: {
      productId_processCode: {
        productId,
        processCode: processCode.toUpperCase(),
      },
    },
  })

  return routing !== null
}

/**
 * 공정 순서(seq) 조회
 */
export async function getProcessSeqInRouting(
  productId: number,
  processCode: string
): Promise<number | null> {
  const routing = await prisma.processRouting.findUnique({
    where: {
      productId_processCode: {
        productId,
        processCode: processCode.toUpperCase(),
      },
    },
    select: { seq: true },
  })

  return routing?.seq ?? null
}

// ============================================
// Validation Operations
// ============================================

/**
 * 공정 순서 유효성 검증
 * fromProcess → toProcess 로의 진행이 올바른지 확인
 */
export async function validateProcessOrder(
  productId: number,
  fromProcess: string,
  toProcess: string
): Promise<ValidationResult> {
  const from = fromProcess.toUpperCase()
  const to = toProcess.toUpperCase()

  // 동일 공정 검사
  if (from === to) {
    return { valid: false, error: '동일한 공정으로 이동할 수 없습니다' }
  }

  // 라우팅에서 두 공정의 seq 조회
  const [fromRouting, toRouting] = await Promise.all([
    prisma.processRouting.findUnique({
      where: {
        productId_processCode: { productId, processCode: from },
      },
      select: { seq: true },
    }),
    prisma.processRouting.findUnique({
      where: {
        productId_processCode: { productId, processCode: to },
      },
      select: { seq: true },
    }),
  ])

  // 라우팅에 공정이 없는 경우
  if (!fromRouting) {
    return { valid: false, error: `공정 ${from}이(가) 라우팅에 없습니다` }
  }
  if (!toRouting) {
    return { valid: false, error: `공정 ${to}이(가) 라우팅에 없습니다` }
  }

  // 순서 검증 (to가 from 뒤에 와야 함)
  if (toRouting.seq <= fromRouting.seq) {
    return {
      valid: false,
      error: `공정 ${to}은(는) ${from} 이후 공정이어야 합니다`,
    }
  }

  return { valid: true }
}

/**
 * 공정 라우팅 전체 유효성 검증
 */
export async function validateRouting(
  productId: number
): Promise<ValidationResult> {
  const routings = await getProcessRouting(productId)

  if (routings.length === 0) {
    return { valid: false, error: '공정 라우팅이 없습니다' }
  }

  // seq 중복 검사
  const seqs = routings.map((r) => r.seq)
  const uniqueSeqs = new Set(seqs)
  if (seqs.length !== uniqueSeqs.size) {
    return { valid: false, error: '공정 순서(seq)가 중복되었습니다' }
  }

  // 공정 코드 중복 검사 (이미 DB unique 제약이 있지만 추가 검증)
  const codes = routings.map((r) => r.processCode)
  const uniqueCodes = new Set(codes)
  if (codes.length !== uniqueCodes.size) {
    return { valid: false, error: '동일한 공정이 중복 등록되었습니다' }
  }

  // 필수 공정 존재 검사 (최소 CA 또는 시작 공정 필요)
  const hasStartProcess = codes.some((c) => ['CA', 'MC'].includes(c))
  if (!hasStartProcess) {
    return { valid: false, error: '시작 공정(CA 또는 MC)이 필요합니다' }
  }

  // 마지막 공정은 검사 공정이어야 함
  const lastRouting = routings[routings.length - 1]
  if (!lastRouting.process.isInspection) {
    return { valid: false, error: '마지막 공정은 검사 공정이어야 합니다' }
  }

  return { valid: true }
}

/**
 * 공정 코드 배열이 유효한 라우팅인지 검증
 */
export async function validateProcessCodes(
  processCodes: string[]
): Promise<ValidationResult> {
  if (processCodes.length === 0) {
    return { valid: false, error: '공정 코드 목록이 비어있습니다' }
  }

  // 공정 코드 유효성 검증
  const upperCodes = processCodes.map((c) => c.toUpperCase())
  for (const code of upperCodes) {
    const isValid = await isValidProcessCode(code)
    if (!isValid) {
      return { valid: false, error: `유효하지 않은 공정 코드: ${code}` }
    }
  }

  // 중복 검사
  const uniqueCodes = new Set(upperCodes)
  if (upperCodes.length !== uniqueCodes.size) {
    return { valid: false, error: '동일한 공정이 중복되었습니다' }
  }

  return { valid: true }
}

// ============================================
// Query Operations
// ============================================

/**
 * 공정 코드 목록 조회
 */
export async function getProcessCodes(productId: number): Promise<string[]> {
  const routings = await prisma.processRouting.findMany({
    where: { productId },
    orderBy: { seq: 'asc' },
    select: { processCode: true },
  })

  return routings.map((r) => r.processCode)
}

/**
 * 필수 공정만 조회
 */
export async function getRequiredProcesses(
  productId: number
): Promise<ProcessRoutingWithProcess[]> {
  return prisma.processRouting.findMany({
    where: {
      productId,
      isRequired: true,
    },
    include: {
      process: true,
    },
    orderBy: { seq: 'asc' },
  })
}

/**
 * 자재 투입 가능 공정만 조회
 */
export async function getMaterialInputRoutings(
  productId: number
): Promise<ProcessRoutingWithProcess[]> {
  return prisma.processRouting.findMany({
    where: {
      productId,
      process: {
        hasMaterialInput: true,
      },
    },
    include: {
      process: true,
    },
    orderBy: { seq: 'asc' },
  })
}

/**
 * 검사 공정만 조회
 */
export async function getInspectionRoutings(
  productId: number
): Promise<ProcessRoutingWithProcess[]> {
  return prisma.processRouting.findMany({
    where: {
      productId,
      process: {
        isInspection: true,
      },
    },
    include: {
      process: true,
    },
    orderBy: { seq: 'asc' },
  })
}

/**
 * 공정 라우팅 수 조회
 */
export async function countRoutings(productId: number): Promise<number> {
  return prisma.processRouting.count({
    where: { productId },
  })
}

// ============================================
// Utility Functions
// ============================================

/**
 * 패턴명 조회
 */
export function getPatternName(processCodes: string[]): ProcessPatternName | null {
  const upper = processCodes.map((c) => c.toUpperCase())
  const joined = upper.join(',')

  for (const [name, pattern] of Object.entries(PROCESS_PATTERNS)) {
    if (pattern.join(',') === joined) {
      return name as ProcessPatternName
    }
  }

  return null
}

/**
 * 사용 가능한 패턴 목록
 */
export function getAvailablePatterns(): Array<{
  name: ProcessPatternName
  processes: readonly string[]
  description: string
}> {
  return [
    {
      name: 'simple',
      processes: PROCESS_PATTERNS.simple,
      description: '단순 공정 (5공정)',
    },
    {
      name: 'medium',
      processes: PROCESS_PATTERNS.medium,
      description: '중간 공정 (8공정)',
    },
    {
      name: 'complex',
      processes: PROCESS_PATTERNS.complex,
      description: '복잡 공정 (10공정)',
    },
  ]
}

/**
 * 라우팅 복사
 */
export async function copyRouting(
  sourceProductId: number,
  targetProductId: number
): Promise<ProcessRoutingWithProcess[]> {
  const sourceRoutings = await getProcessRouting(sourceProductId)

  if (sourceRoutings.length === 0) {
    throw new Error('복사할 라우팅이 없습니다')
  }

  // 대상 제품의 기존 라우팅 삭제
  await clearProcessRouting(targetProductId)

  // 복사
  const newRoutings: ProcessRoutingWithProcess[] = []
  for (const routing of sourceRoutings) {
    const newRouting = await prisma.processRouting.create({
      data: {
        productId: targetProductId,
        processCode: routing.processCode,
        seq: routing.seq,
        isRequired: routing.isRequired,
      },
      include: {
        process: true,
      },
    })
    newRoutings.push(newRouting)
  }

  return newRoutings
}
