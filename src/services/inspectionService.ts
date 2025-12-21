/**
 * Inspection Service
 *
 * 품질 검사 관리 서비스
 * - 검사 기록 생성/조회
 * - 불량 정보 관리
 * - 검사 통계
 */
import { prisma } from '../lib/prisma'
import { InspectionType, InspectionResult, Prisma } from '@prisma/client'
import { parseBarcode } from './barcodeService'

// ============================================
// Types
// ============================================

export interface CreateInspectionInput {
  lotId: number
  type: InspectionType
  result: InspectionResult
  defectReason?: string
  defectQty?: number
  inspectorId?: number
}

export interface UpdateDefectInput {
  inspectionId: number
  defectReason: string
  defectQty: number
}

export interface InspectionWithRelations {
  id: number
  type: InspectionType
  result: InspectionResult
  defectReason: string | null
  defectQty: number
  inspectedAt: Date
  productionLot: {
    id: number
    lotNumber: string
    processCode: string
    product: {
      code: string
      name: string
    } | null
  }
  inspector: {
    id: number
    name: string
  } | null
}

export interface InspectionStats {
  period: {
    start: Date
    end: Date
  }
  byType: {
    [key in InspectionType]: {
      total: number
      pass: number
      fail: number
      passRate: number
    }
  }
  byProcess: Array<{
    processCode: string
    total: number
    pass: number
    fail: number
    passRate: number
  }>
  overall: {
    total: number
    pass: number
    fail: number
    passRate: number
    totalDefects: number
  }
}

// ============================================
// CRUD Operations
// ============================================

/**
 * 검사 기록 생성
 */
export async function createInspection(
  input: CreateInspectionInput
): Promise<InspectionWithRelations> {
  const { lotId, type, result, defectReason, defectQty = 0, inspectorId } = input

  const inspection = await prisma.inspection.create({
    data: {
      productionLotId: lotId,
      type,
      result,
      defectReason,
      defectQty,
      inspectorId,
      inspectedAt: new Date(),
    },
    include: {
      productionLot: {
        select: {
          id: true,
          lotNumber: true,
          processCode: true,
          product: {
            select: { code: true, name: true },
          },
        },
      },
      inspector: {
        select: { id: true, name: true },
      },
    },
  })

  // 검사 결과가 FAIL이면 LOT의 불량 수량 업데이트
  if (result === 'FAIL' && defectQty > 0) {
    await prisma.productionLot.update({
      where: { id: lotId },
      data: {
        defectQty: {
          increment: defectQty,
        },
      },
    })
  }

  return inspection
}

/**
 * 불량 정보 업데이트
 */
export async function updateDefectInfo(
  input: UpdateDefectInput
): Promise<InspectionWithRelations> {
  const { inspectionId, defectReason, defectQty } = input

  // 기존 검사 조회
  const existing = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { defectQty: true, productionLotId: true },
  })

  if (!existing) {
    throw new Error('검사 기록을 찾을 수 없습니다.')
  }

  // 불량 수량 차이 계산
  const qtyDiff = defectQty - existing.defectQty

  // 검사 기록 업데이트
  const inspection = await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      defectReason,
      defectQty,
    },
    include: {
      productionLot: {
        select: {
          id: true,
          lotNumber: true,
          processCode: true,
          product: {
            select: { code: true, name: true },
          },
        },
      },
      inspector: {
        select: { id: true, name: true },
      },
    },
  })

  // LOT 불량 수량 조정
  if (qtyDiff !== 0) {
    await prisma.productionLot.update({
      where: { id: existing.productionLotId },
      data: {
        defectQty: {
          increment: qtyDiff,
        },
      },
    })
  }

  return inspection
}

/**
 * 검사 기록 삭제
 */
export async function deleteInspection(inspectionId: number): Promise<void> {
  const existing = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { defectQty: true, productionLotId: true, result: true },
  })

  if (!existing) {
    throw new Error('검사 기록을 찾을 수 없습니다.')
  }

  // 검사 삭제
  await prisma.inspection.delete({
    where: { id: inspectionId },
  })

  // FAIL 결과였으면 LOT 불량 수량 감소
  if (existing.result === 'FAIL' && existing.defectQty > 0) {
    await prisma.productionLot.update({
      where: { id: existing.productionLotId },
      data: {
        defectQty: {
          decrement: existing.defectQty,
        },
      },
    })
  }
}

// ============================================
// Query Operations
// ============================================

/**
 * 검사 ID로 조회
 */
export async function getInspectionById(
  inspectionId: number
): Promise<InspectionWithRelations | null> {
  return prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      productionLot: {
        select: {
          id: true,
          lotNumber: true,
          processCode: true,
          product: {
            select: { code: true, name: true },
          },
        },
      },
      inspector: {
        select: { id: true, name: true },
      },
    },
  })
}

/**
 * LOT별 검사 이력 조회
 */
export async function getInspectionsByLot(
  lotId: number
): Promise<InspectionWithRelations[]> {
  return prisma.inspection.findMany({
    where: { productionLotId: lotId },
    include: {
      productionLot: {
        select: {
          id: true,
          lotNumber: true,
          processCode: true,
          product: {
            select: { code: true, name: true },
          },
        },
      },
      inspector: {
        select: { id: true, name: true },
      },
    },
    orderBy: { inspectedAt: 'desc' },
  })
}

/**
 * LOT 번호로 검사 이력 조회
 */
export async function getInspectionsByLotNumber(
  lotNumber: string
): Promise<InspectionWithRelations[]> {
  const lot = await prisma.productionLot.findUnique({
    where: { lotNumber },
    select: { id: true },
  })

  if (!lot) return []

  return getInspectionsByLot(lot.id)
}

/**
 * 검사 유형별 조회
 */
export async function getInspectionsByType(
  type: InspectionType,
  options?: {
    startDate?: Date
    endDate?: Date
    result?: InspectionResult
    limit?: number
  }
): Promise<InspectionWithRelations[]> {
  const { startDate, endDate, result, limit = 100 } = options || {}

  const where: Prisma.InspectionWhereInput = { type }

  if (result) {
    where.result = result
  }

  if (startDate || endDate) {
    where.inspectedAt = {}
    if (startDate) where.inspectedAt.gte = startDate
    if (endDate) where.inspectedAt.lte = endDate
  }

  return prisma.inspection.findMany({
    where,
    include: {
      productionLot: {
        select: {
          id: true,
          lotNumber: true,
          processCode: true,
          product: {
            select: { code: true, name: true },
          },
        },
      },
      inspector: {
        select: { id: true, name: true },
      },
    },
    orderBy: { inspectedAt: 'desc' },
    take: limit,
  })
}

/**
 * 불량 검사만 조회
 */
export async function getFailedInspections(options?: {
  startDate?: Date
  endDate?: Date
  processCode?: string
  limit?: number
}): Promise<InspectionWithRelations[]> {
  const { startDate, endDate, processCode, limit = 100 } = options || {}

  const where: Prisma.InspectionWhereInput = {
    result: 'FAIL',
  }

  if (startDate || endDate) {
    where.inspectedAt = {}
    if (startDate) where.inspectedAt.gte = startDate
    if (endDate) where.inspectedAt.lte = endDate
  }

  if (processCode) {
    where.productionLot = {
      processCode: processCode.toUpperCase(),
    }
  }

  return prisma.inspection.findMany({
    where,
    include: {
      productionLot: {
        select: {
          id: true,
          lotNumber: true,
          processCode: true,
          product: {
            select: { code: true, name: true },
          },
        },
      },
      inspector: {
        select: { id: true, name: true },
      },
    },
    orderBy: { inspectedAt: 'desc' },
    take: limit,
  })
}

// ============================================
// Statistics
// ============================================

/**
 * 기간별 검사 통계
 */
export async function getInspectionStats(
  startDate: Date,
  endDate: Date
): Promise<InspectionStats> {
  // 전체 검사 데이터 조회
  const inspections = await prisma.inspection.findMany({
    where: {
      inspectedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      productionLot: {
        select: { processCode: true },
      },
    },
  })

  // 유형별 통계 초기화
  const byType: InspectionStats['byType'] = {
    CRIMP: { total: 0, pass: 0, fail: 0, passRate: 0 },
    CIRCUIT: { total: 0, pass: 0, fail: 0, passRate: 0 },
    VISUAL: { total: 0, pass: 0, fail: 0, passRate: 0 },
  }

  // 공정별 통계
  const byProcessMap = new Map<string, { total: number; pass: number; fail: number }>()

  // 전체 통계
  let totalDefects = 0

  for (const insp of inspections) {
    // 유형별 집계
    byType[insp.type].total++
    if (insp.result === 'PASS') {
      byType[insp.type].pass++
    } else {
      byType[insp.type].fail++
      totalDefects += insp.defectQty
    }

    // 공정별 집계
    const processCode = insp.productionLot.processCode
    const current = byProcessMap.get(processCode) || { total: 0, pass: 0, fail: 0 }
    current.total++
    if (insp.result === 'PASS') {
      current.pass++
    } else {
      current.fail++
    }
    byProcessMap.set(processCode, current)
  }

  // 통과율 계산
  for (const type of Object.keys(byType) as InspectionType[]) {
    if (byType[type].total > 0) {
      byType[type].passRate = (byType[type].pass / byType[type].total) * 100
    }
  }

  const byProcess = Array.from(byProcessMap.entries()).map(([processCode, stats]) => ({
    processCode,
    ...stats,
    passRate: stats.total > 0 ? (stats.pass / stats.total) * 100 : 0,
  }))

  const overall = {
    total: inspections.length,
    pass: inspections.filter((i) => i.result === 'PASS').length,
    fail: inspections.filter((i) => i.result === 'FAIL').length,
    passRate: 0,
    totalDefects,
  }

  if (overall.total > 0) {
    overall.passRate = (overall.pass / overall.total) * 100
  }

  return {
    period: { start: startDate, end: endDate },
    byType,
    byProcess,
    overall,
  }
}

/**
 * 오늘의 검사 현황
 */
export async function getTodayInspectionSummary() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return getInspectionStats(today, tomorrow)
}

/**
 * 불량 사유별 통계
 */
export async function getDefectReasonStats(
  startDate: Date,
  endDate: Date
): Promise<Array<{ reason: string; count: number; totalQty: number }>> {
  const inspections = await prisma.inspection.findMany({
    where: {
      result: 'FAIL',
      defectReason: { not: null },
      inspectedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      defectReason: true,
      defectQty: true,
    },
  })

  const reasonMap = new Map<string, { count: number; totalQty: number }>()

  for (const insp of inspections) {
    const reason = insp.defectReason || '미분류'
    const current = reasonMap.get(reason) || { count: 0, totalQty: 0 }
    current.count++
    current.totalQty += insp.defectQty
    reasonMap.set(reason, current)
  }

  return Array.from(reasonMap.entries())
    .map(([reason, stats]) => ({
      reason,
      ...stats,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * 검사원별 실적
 */
export async function getInspectorPerformance(
  startDate: Date,
  endDate: Date
): Promise<Array<{
  inspectorId: number
  inspectorName: string
  total: number
  pass: number
  fail: number
  passRate: number
}>> {
  const inspections = await prisma.inspection.findMany({
    where: {
      inspectedAt: {
        gte: startDate,
        lte: endDate,
      },
      inspectorId: { not: null },
    },
    include: {
      inspector: {
        select: { id: true, name: true },
      },
    },
  })

  const performanceMap = new Map<number, {
    name: string
    total: number
    pass: number
    fail: number
  }>()

  for (const insp of inspections) {
    if (!insp.inspector) continue

    const current = performanceMap.get(insp.inspector.id) || {
      name: insp.inspector.name,
      total: 0,
      pass: 0,
      fail: 0,
    }

    current.total++
    if (insp.result === 'PASS') {
      current.pass++
    } else {
      current.fail++
    }

    performanceMap.set(insp.inspector.id, current)
  }

  return Array.from(performanceMap.entries())
    .map(([inspectorId, stats]) => ({
      inspectorId,
      inspectorName: stats.name,
      total: stats.total,
      pass: stats.pass,
      fail: stats.fail,
      passRate: stats.total > 0 ? (stats.pass / stats.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

// ============================================
// Phase 5: 검사 워크플로우 강화
// ============================================

/**
 * 검사 공정 코드 타입 (inspectionService 전용)
 */
export type InspectionProcessCode = 'MO' | 'CA' | 'MC' | 'MS' | 'SB' | 'HS' | 'SP' | 'PA' | 'CI' | 'VI'

/**
 * 검사 유형별 허용 공정 규칙
 *
 * Python Barcord 기준:
 * - CRIMP: CA, MC만 대상 (압착 검사)
 * - CIRCUIT: PA만 대상 (회로 검사)
 * - VISUAL: CI만 대상 (육안 검사)
 */
export const INSPECTION_TARGET_PROCESS: Record<InspectionType, InspectionProcessCode[]> = {
  CRIMP: ['CA', 'MC'],
  CIRCUIT: ['PA'],
  VISUAL: ['CI'],
}

/**
 * 검사 유형별 한글명
 */
export const INSPECTION_TYPE_NAMES: Record<InspectionType, string> = {
  CRIMP: '압착검사',
  CIRCUIT: '회로검사',
  VISUAL: '육안검사',
}

/**
 * 검사 유형별 베트남어명
 */
export const INSPECTION_TYPE_NAMES_VI: Record<InspectionType, string> = {
  CRIMP: 'Kiểm tra ép',
  CIRCUIT: 'Kiểm tra mạch',
  VISUAL: 'Kiểm tra ngoại quan',
}

/**
 * 검사 공정별 한글명 (inspectionService 전용)
 */
export const INSPECTION_PROCESS_NAMES: Record<InspectionProcessCode, string> = {
  MO: '자재출고',
  CA: '자동절압착',
  MC: '수동압착',
  MS: '미드스플라이스',
  SB: '서브조립',
  HS: '열수축',
  SP: '제품조립제공부품',
  PA: '제품조립',
  CI: '회로검사',
  VI: '육안검사',
}

/**
 * 검사 대상 검증 결과
 */
export interface InspectionTargetValidation {
  valid: boolean
  inspectionType: InspectionType
  lotNumber: string
  processCode: string | null
  allowedProcesses: InspectionProcessCode[]
  error?: string
}

/**
 * 중복 검사 확인 결과
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean
  lotNumber: string
  inspectionType: InspectionType
  existingInspection?: {
    id: number
    result: InspectionResult
    inspectedAt: Date
  }
}

/**
 * 검사 대상 공정 검증
 *
 * LOT의 공정 코드가 해당 검사 유형의 대상 공정인지 확인
 *
 * @param inspectionType 검사 유형
 * @param lotNumber LOT 번호
 * @returns 검증 결과
 */
export async function validateInspectionTarget(
  inspectionType: InspectionType,
  lotNumber: string
): Promise<InspectionTargetValidation> {
  const allowedProcesses = INSPECTION_TARGET_PROCESS[inspectionType]

  // 바코드 파싱으로 공정 코드 추출
  const parsed = parseBarcode(lotNumber)
  let processCode: string | null = null

  if (parsed.isValid) {
    processCode = parsed.processCode.toUpperCase()
  } else {
    // DB에서 LOT 조회
    const lot = await prisma.productionLot.findUnique({
      where: { lotNumber },
      select: { processCode: true },
    })

    if (lot) {
      processCode = lot.processCode
    }
  }

  // 공정 코드를 찾을 수 없는 경우
  if (!processCode) {
    return {
      valid: false,
      inspectionType,
      lotNumber,
      processCode: null,
      allowedProcesses,
      error: `LOT을 찾을 수 없거나 공정 코드를 확인할 수 없습니다: ${lotNumber}`,
    }
  }

  // 허용 공정 확인
  const isAllowed = allowedProcesses.includes(processCode as InspectionProcessCode)

  if (!isAllowed) {
    const allowedNames = allowedProcesses.map(p => INSPECTION_PROCESS_NAMES[p]).join(', ')
    return {
      valid: false,
      inspectionType,
      lotNumber,
      processCode,
      allowedProcesses,
      error: `${INSPECTION_TYPE_NAMES[inspectionType]}는 ${allowedNames} 공정만 대상입니다. 현재 공정: ${INSPECTION_PROCESS_NAMES[processCode as InspectionProcessCode] || processCode}`,
    }
  }

  return {
    valid: true,
    inspectionType,
    lotNumber,
    processCode,
    allowedProcesses,
  }
}

/**
 * 중복 검사 확인
 *
 * 동일 LOT에 동일 유형의 검사가 이미 존재하는지 확인
 *
 * @param lotNumber LOT 번호
 * @param inspectionType 검사 유형
 * @returns 중복 여부
 */
export async function checkDuplicateInspection(
  lotNumber: string,
  inspectionType: InspectionType
): Promise<DuplicateCheckResult> {
  // LOT 조회
  const lot = await prisma.productionLot.findUnique({
    where: { lotNumber },
    select: { id: true },
  })

  if (!lot) {
    return {
      isDuplicate: false,
      lotNumber,
      inspectionType,
    }
  }

  // 기존 검사 조회
  const existingInspection = await prisma.inspection.findFirst({
    where: {
      productionLotId: lot.id,
      type: inspectionType,
    },
    select: {
      id: true,
      result: true,
      inspectedAt: true,
    },
    orderBy: { inspectedAt: 'desc' },
  })

  if (existingInspection) {
    return {
      isDuplicate: true,
      lotNumber,
      inspectionType,
      existingInspection,
    }
  }

  return {
    isDuplicate: false,
    lotNumber,
    inspectionType,
  }
}

/**
 * 검사 가능 여부 통합 확인
 *
 * 대상 공정 검증 + 중복 검사 확인을 한번에 수행
 *
 * @param inspectionType 검사 유형
 * @param lotNumber LOT 번호
 * @param allowDuplicate 중복 허용 여부 (기본값: false)
 * @returns 검사 가능 여부 및 상세 정보
 */
export async function canPerformInspection(
  inspectionType: InspectionType,
  lotNumber: string,
  allowDuplicate: boolean = false
): Promise<{
  canInspect: boolean
  targetValidation: InspectionTargetValidation
  duplicateCheck: DuplicateCheckResult
  errors: string[]
}> {
  const errors: string[] = []

  // 1. 대상 공정 검증
  const targetValidation = await validateInspectionTarget(inspectionType, lotNumber)
  if (!targetValidation.valid && targetValidation.error) {
    errors.push(targetValidation.error)
  }

  // 2. 중복 검사 확인
  const duplicateCheck = await checkDuplicateInspection(lotNumber, inspectionType)
  if (duplicateCheck.isDuplicate && !allowDuplicate) {
    const existingDate = duplicateCheck.existingInspection?.inspectedAt
      ? new Date(duplicateCheck.existingInspection.inspectedAt).toLocaleDateString('ko-KR')
      : '알 수 없음'
    const existingResult = duplicateCheck.existingInspection?.result || '알 수 없음'
    errors.push(
      `이미 ${INSPECTION_TYPE_NAMES[inspectionType]}가 수행되었습니다. ` +
      `(${existingDate}, 결과: ${existingResult === 'PASS' ? '합격' : '불합격'})`
    )
  }

  return {
    canInspect: errors.length === 0,
    targetValidation,
    duplicateCheck,
    errors,
  }
}

/**
 * 검사 기록 생성 (검증 포함)
 *
 * 대상 공정 검증 및 중복 확인 후 검사 기록 생성
 *
 * @param input 검사 기록 입력
 * @param options 옵션 (중복 허용, 검증 건너뛰기)
 * @returns 검사 기록
 */
export async function createInspectionWithValidation(
  input: CreateInspectionInput & { lotNumber?: string },
  options: {
    allowDuplicate?: boolean
    skipValidation?: boolean
  } = {}
): Promise<{
  inspection: InspectionWithRelations | null
  validation: {
    canInspect: boolean
    targetValidation: InspectionTargetValidation | null
    duplicateCheck: DuplicateCheckResult | null
    errors: string[]
  }
}> {
  const { allowDuplicate = false, skipValidation = false } = options

  // LOT 번호 조회
  let lotNumber = input.lotNumber
  if (!lotNumber) {
    const lot = await prisma.productionLot.findUnique({
      where: { id: input.lotId },
      select: { lotNumber: true },
    })
    lotNumber = lot?.lotNumber
  }

  if (!lotNumber) {
    return {
      inspection: null,
      validation: {
        canInspect: false,
        targetValidation: null,
        duplicateCheck: null,
        errors: ['LOT을 찾을 수 없습니다.'],
      },
    }
  }

  // 검증 수행 (skipValidation이 false인 경우)
  let canInspect = true
  let targetValidation: InspectionTargetValidation | null = null
  let duplicateCheck: DuplicateCheckResult | null = null
  const errors: string[] = []

  if (!skipValidation) {
    const validationResult = await canPerformInspection(input.type, lotNumber, allowDuplicate)
    canInspect = validationResult.canInspect
    targetValidation = validationResult.targetValidation
    duplicateCheck = validationResult.duplicateCheck
    errors.push(...validationResult.errors)

    if (!canInspect) {
      return {
        inspection: null,
        validation: {
          canInspect,
          targetValidation,
          duplicateCheck,
          errors,
        },
      }
    }
  }

  // 검사 기록 생성
  const inspection = await createInspection(input)

  return {
    inspection,
    validation: {
      canInspect: true,
      targetValidation,
      duplicateCheck,
      errors: [],
    },
  }
}

/**
 * 검사 유형에 허용되는 공정 목록 조회
 *
 * @param inspectionType 검사 유형
 * @returns 허용 공정 목록
 */
export function getAllowedProcessesForInspection(inspectionType: InspectionType): InspectionProcessCode[] {
  return INSPECTION_TARGET_PROCESS[inspectionType]
}

/**
 * 공정에 적용 가능한 검사 유형 조회
 *
 * @param processCode 공정 코드
 * @returns 적용 가능한 검사 유형 목록
 */
export function getApplicableInspectionTypes(processCode: string): InspectionType[] {
  const normalized = processCode.toUpperCase() as InspectionProcessCode
  const types: InspectionType[] = []

  for (const [type, processes] of Object.entries(INSPECTION_TARGET_PROCESS)) {
    if (processes.includes(normalized)) {
      types.push(type as InspectionType)
    }
  }

  return types
}

/**
 * LOT의 검사 상태 조회
 *
 * @param lotNumber LOT 번호
 * @returns 각 검사 유형별 상태
 */
export async function getLotInspectionStatus(
  lotNumber: string
): Promise<{
  lotNumber: string
  processCode: string | null
  applicableTypes: InspectionType[]
  completedInspections: Array<{
    type: InspectionType
    result: InspectionResult
    inspectedAt: Date
  }>
  pendingTypes: InspectionType[]
}> {
  // LOT 조회
  const lot = await prisma.productionLot.findUnique({
    where: { lotNumber },
    select: {
      id: true,
      processCode: true,
      inspections: {
        select: {
          type: true,
          result: true,
          inspectedAt: true,
        },
        orderBy: { inspectedAt: 'desc' },
      },
    },
  })

  if (!lot) {
    return {
      lotNumber,
      processCode: null,
      applicableTypes: [],
      completedInspections: [],
      pendingTypes: [],
    }
  }

  // 적용 가능한 검사 유형
  const applicableTypes = getApplicableInspectionTypes(lot.processCode)

  // 완료된 검사
  const completedInspections = lot.inspections.map((i) => ({
    type: i.type,
    result: i.result,
    inspectedAt: i.inspectedAt,
  }))

  // 완료된 검사 유형
  const completedTypes = new Set(completedInspections.map((i) => i.type))

  // 미완료 검사 유형
  const pendingTypes = applicableTypes.filter((t) => !completedTypes.has(t))

  return {
    lotNumber,
    processCode: lot.processCode,
    applicableTypes,
    completedInspections,
    pendingTypes,
  }
}
