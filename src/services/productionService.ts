/**
 * Production Service
 *
 * 생산 LOT 관리 서비스
 * - LOT 생성, 시작, 완료
 * - 자재 투입 관리
 * - 상태별/공정별 조회
 */
import { prisma } from '../lib/prisma'
import { LotStatus, Prisma } from '@prisma/client'
import { getNextSequence, getNextBundleSequence } from './sequenceService'
import { generateBarcodeV1, generateBarcodeV2, generateBundleBarcode, parseBarcode } from './barcodeService'
import {
  validateInputs,
  validateBarcodes,
  createInputsFromBarcodes,
  isValidProcessCode,
  PROCESS_INPUT_RULES,
  PROCESS_NAMES,
  type ProcessCode,
  type InputItem,
  type ValidationResult,
  type InputType,
} from '../lib/processValidation'

// ============================================
// Types
// ============================================

export interface CreateLotInput {
  processCode: string
  productId?: number
  productCode?: string
  lineCode?: string
  plannedQty?: number
  workerId?: number
  barcodeVersion?: 1 | 2
}

export interface CompleteLotInput {
  lotId: number
  completedQty: number
  defectQty?: number
}

export interface AddMaterialInput {
  lotId: number
  materialBarcode: string
  materialId: number
  quantity: number
}

/**
 * 2단계 생산 워크플로우 - 시작 입력
 * Python Barcord 호환
 */
export interface StartProductionInput {
  processCode: string
  productId?: number
  productCode?: string
  productName?: string
  lineCode?: string
  plannedQty: number
  workerId?: number
  barcodeVersion?: 1 | 2
  // 이월 수량 사용
  carryOverId?: number
  carryOverQty?: number
}

/**
 * 2단계 생산 워크플로우 - 완료 입력
 * Python Barcord 호환
 */
export interface CompleteProductionInput {
  lotId: number
  completedQty: number
  defectQty?: number
  // 이월 생성
  createCarryOver?: boolean
  carryOverQty?: number
}

export interface LotWithRelations {
  id: number
  lotNumber: string
  processCode: string
  lineCode: string | null
  status: LotStatus
  product: {
    id: number
    code: string
    name: string
  } | null
  worker: {
    id: number
    name: string
  } | null
  plannedQty: number
  completedQty: number
  defectQty: number
  startedAt: Date
  completedAt: Date | null
  lotMaterials: Array<{
    id: number
    materialLotNo: string
    quantity: number
    material: {
      id: number
      code: string
      name: string
    }
  }>
}

/**
 * 입력 자재 검증 옵션
 */
export interface ValidateInputOptions {
  skipValidation?: boolean
  allowWarnings?: boolean
}

/**
 * 자재 투입 검증 결과와 함께 반환
 */
export interface AddMaterialWithValidationResult {
  lotMaterialId: number
  lot: LotWithRelations
  validationResult: ValidationResult
}

// ============================================
// LOT Creation
// ============================================

/**
 * 새로운 생산 LOT 생성
 */
export async function createLot(input: CreateLotInput): Promise<LotWithRelations> {
  const {
    processCode,
    productId,
    productCode,
    lineCode,
    plannedQty = 0,
    workerId,
    barcodeVersion = 2,
  } = input

  // 일련번호 생성
  const sequence = await getNextSequence(processCode)

  // 바코드 생성
  let lotNumber: string
  if (barcodeVersion === 1) {
    lotNumber = generateBarcodeV1(processCode, sequence.sequence)
  } else {
    // V2는 품번과 수량이 필요
    const code = productCode || 'TEMP'
    lotNumber = generateBarcodeV2(processCode, code, plannedQty, sequence.sequence)
  }

  // LOT 생성
  const lot = await prisma.productionLot.create({
    data: {
      lotNumber,
      processCode: processCode.toUpperCase(),
      productId,
      lineCode,
      plannedQty,
      workerId,
      barcodeVersion,
      status: 'IN_PROGRESS',
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })

  return lot
}

/**
 * 번들 LOT 생성 (CA 공정용)
 */
export async function createBundleLot(
  processCode: string,
  productId: number,
  productCode: string,
  setQuantity: number
): Promise<{ bundleNo: string; bundleLotId: number }> {
  const sequence = await getNextBundleSequence(processCode)
  const bundleNo = generateBundleBarcode(processCode, productCode, setQuantity, sequence.sequence)

  const bundleLot = await prisma.bundleLot.create({
    data: {
      bundleNo,
      productId,
      setQuantity,
      totalQty: 0,
      status: 'CREATED',
    },
  })

  return {
    bundleNo,
    bundleLotId: bundleLot.id,
  }
}

// ============================================
// Production Operations
// ============================================

/**
 * 생산 작업 시작
 */
export async function startProduction(
  lotId: number,
  lineCode: string,
  workerId?: number
): Promise<LotWithRelations> {
  const lot = await prisma.productionLot.update({
    where: { id: lotId },
    data: {
      lineCode,
      workerId,
      startedAt: new Date(),
      status: 'IN_PROGRESS',
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })

  return lot
}

/**
 * 생산 작업 완료
 */
export async function completeProduction(input: CompleteLotInput): Promise<LotWithRelations> {
  const { lotId, completedQty, defectQty = 0 } = input

  const lot = await prisma.productionLot.update({
    where: { id: lotId },
    data: {
      completedQty,
      defectQty,
      completedAt: new Date(),
      status: 'COMPLETED',
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })

  return lot
}

/**
 * LOT 수량 업데이트
 */
export async function updateLotQuantity(
  lotId: number,
  updates: {
    plannedQty?: number
    completedQty?: number
    defectQty?: number
    carryOverIn?: number
    carryOverOut?: number
  }
): Promise<LotWithRelations> {
  const lot = await prisma.productionLot.update({
    where: { id: lotId },
    data: updates,
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })

  return lot
}

/**
 * LOT 상태 변경
 */
export async function updateLotStatus(
  lotId: number,
  status: LotStatus
): Promise<LotWithRelations> {
  const data: Prisma.ProductionLotUpdateInput = { status }

  if (status === 'COMPLETED') {
    data.completedAt = new Date()
  }

  const lot = await prisma.productionLot.update({
    where: { id: lotId },
    data,
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })

  return lot
}

// ============================================
// Material Input
// ============================================

/**
 * 자재 투입 등록
 */
export async function addMaterial(input: AddMaterialInput): Promise<{
  lotMaterialId: number
  lot: LotWithRelations
}> {
  const { lotId, materialBarcode, materialId, quantity } = input

  // 자재 투입 기록 생성
  const lotMaterial = await prisma.lotMaterial.create({
    data: {
      productionLotId: lotId,
      materialId,
      materialLotNo: materialBarcode,
      quantity,
    },
  })

  // 업데이트된 LOT 반환
  const lot = await getLotById(lotId)

  return {
    lotMaterialId: lotMaterial.id,
    lot: lot!,
  }
}

/**
 * 자재 투입 취소
 */
export async function removeMaterial(lotMaterialId: number): Promise<void> {
  await prisma.lotMaterial.delete({
    where: { id: lotMaterialId },
  })
}

/**
 * LOT에 투입된 자재 목록 조회
 */
export async function getLotMaterials(lotId: number) {
  return prisma.lotMaterial.findMany({
    where: { productionLotId: lotId },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

// ============================================
// Query Operations
// ============================================

/**
 * LOT ID로 조회
 */
export async function getLotById(lotId: number): Promise<LotWithRelations | null> {
  return prisma.productionLot.findUnique({
    where: { id: lotId },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })
}

/**
 * LOT 번호로 조회
 */
export async function getLotByNumber(lotNumber: string): Promise<LotWithRelations | null> {
  return prisma.productionLot.findUnique({
    where: { lotNumber },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })
}

/**
 * 공정별 LOT 조회
 */
export async function getLotsByProcess(
  processCode: string,
  options?: {
    status?: LotStatus
    startDate?: Date
    endDate?: Date
    limit?: number
  }
): Promise<LotWithRelations[]> {
  const { status, startDate, endDate, limit = 100 } = options || {}

  const where: Prisma.ProductionLotWhereInput = {
    processCode: processCode.toUpperCase(),
  }

  if (status) {
    where.status = status
  }

  if (startDate || endDate) {
    where.startedAt = {}
    if (startDate) where.startedAt.gte = startDate
    if (endDate) where.startedAt.lte = endDate
  }

  return prisma.productionLot.findMany({
    where,
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

/**
 * 상태별 LOT 조회
 */
export async function getLotsByStatus(
  status: LotStatus,
  options?: {
    processCode?: string
    limit?: number
  }
): Promise<LotWithRelations[]> {
  const { processCode, limit = 100 } = options || {}

  const where: Prisma.ProductionLotWhereInput = { status }

  if (processCode) {
    where.processCode = processCode.toUpperCase()
  }

  return prisma.productionLot.findMany({
    where,
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

/**
 * 오늘의 LOT 목록 조회
 */
export async function getTodayLots(processCode?: string): Promise<LotWithRelations[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const where: Prisma.ProductionLotWhereInput = {
    startedAt: {
      gte: today,
      lt: tomorrow,
    },
  }

  if (processCode) {
    where.processCode = processCode.toUpperCase()
  }

  return prisma.productionLot.findMany({
    where,
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  })
}

/**
 * 진행 중인 LOT 조회 (작업자별)
 */
export async function getActiveLotsByWorker(workerId: number): Promise<LotWithRelations[]> {
  return prisma.productionLot.findMany({
    where: {
      workerId,
      status: 'IN_PROGRESS',
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  })
}

// ============================================
// Statistics
// ============================================

/**
 * 공정별 생산 통계
 */
export async function getProductionStats(
  processCode: string,
  startDate: Date,
  endDate: Date
) {
  const lots = await prisma.productionLot.findMany({
    where: {
      processCode: processCode.toUpperCase(),
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      status: true,
      completedQty: true,
      defectQty: true,
      plannedQty: true,
    },
  })

  const stats = {
    totalLots: lots.length,
    completedLots: lots.filter((l) => l.status === 'COMPLETED').length,
    inProgressLots: lots.filter((l) => l.status === 'IN_PROGRESS').length,
    totalPlanned: lots.reduce((sum, l) => sum + l.plannedQty, 0),
    totalCompleted: lots.reduce((sum, l) => sum + l.completedQty, 0),
    totalDefects: lots.reduce((sum, l) => sum + l.defectQty, 0),
    yieldRate: 0,
  }

  if (stats.totalCompleted > 0) {
    stats.yieldRate = ((stats.totalCompleted - stats.totalDefects) / stats.totalCompleted) * 100
  }

  return stats
}

/**
 * 일별 생산 현황
 */
export async function getDailyProductionSummary(date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const lots = await prisma.productionLot.groupBy({
    by: ['processCode', 'status'],
    where: {
      startedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    _count: true,
    _sum: {
      completedQty: true,
      defectQty: true,
    },
  })

  return lots.map((group) => ({
    processCode: group.processCode,
    status: group.status,
    count: group._count,
    completedQty: group._sum.completedQty || 0,
    defectQty: group._sum.defectQty || 0,
  }))
}

// ============================================
// 2단계 생산 워크플로우 (Python Barcord 호환)
// ============================================

/**
 * 2단계 워크플로우 - 생산 시작 (Step 1)
 *
 * 모든 공정에 적용:
 * MO, CA, MC, MS, SB, HS, SP, PA, CI, VI
 *
 * 동작:
 * 1. 바코드 생성
 * 2. LOT 생성 (status=IN_PROGRESS)
 * 3. 이월 수량 사용 (옵션)
 * 4. 자재 차감 (Phase 4에서 구현)
 */
export async function startNewProduction(input: StartProductionInput): Promise<LotWithRelations> {
  const {
    processCode,
    productId,
    productCode,
    lineCode,
    plannedQty,
    workerId,
    barcodeVersion = 2,
    carryOverId,
    carryOverQty = 0,
  } = input

  // 일련번호 생성
  const sequence = await getNextSequence(processCode)

  // 바코드 생성
  let lotNumber: string
  if (barcodeVersion === 1) {
    lotNumber = generateBarcodeV1(processCode, sequence.sequence)
  } else {
    const code = productCode || 'TEMP'
    lotNumber = generateBarcodeV2(processCode, code, plannedQty, sequence.sequence)
  }

  // 이월 수량 사용 시 CarryOver 업데이트
  if (carryOverId && carryOverQty > 0) {
    await prisma.carryOver.update({
      where: { id: carryOverId },
      data: {
        usedQty: { increment: carryOverQty },
        targetLotNo: lotNumber,
        isUsed: true,
      },
    })
  }

  // LOT 생성 (status=IN_PROGRESS)
  const lot = await prisma.productionLot.create({
    data: {
      lotNumber,
      processCode: processCode.toUpperCase(),
      productId,
      lineCode,
      plannedQty,
      workerId,
      barcodeVersion,
      status: 'IN_PROGRESS',
      carryOverIn: carryOverQty,
      startedAt: new Date(),
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })

  return lot
}

/**
 * 2단계 워크플로우 - 생산 완료 (Step 2)
 *
 * 동작:
 * 1. 완료 수량, 불량 수량 기록
 * 2. status=COMPLETED 변경
 * 3. 이월 생성 (옵션)
 */
export async function completeProductionV2(input: CompleteProductionInput): Promise<LotWithRelations> {
  const {
    lotId,
    completedQty,
    defectQty = 0,
    createCarryOver = false,
    carryOverQty = 0,
  } = input

  // LOT 조회
  const existingLot = await prisma.productionLot.findUnique({
    where: { id: lotId },
    include: { product: true },
  })

  if (!existingLot) {
    throw new Error(`LOT을 찾을 수 없습니다: ${lotId}`)
  }

  if (existingLot.status !== 'IN_PROGRESS') {
    throw new Error(`진행 중인 LOT만 완료할 수 있습니다. 현재 상태: ${existingLot.status}`)
  }

  // 이월 생성
  if (createCarryOver && carryOverQty > 0 && existingLot.productId) {
    await prisma.carryOver.create({
      data: {
        processCode: existingLot.processCode,
        productId: existingLot.productId,
        lineCode: existingLot.lineCode || '',
        sourceDate: new Date(),
        sourceLotNo: existingLot.lotNumber,
        quantity: carryOverQty,
        usedQty: 0,
        isUsed: false,
      },
    })
  }

  // LOT 완료 처리
  const lot = await prisma.productionLot.update({
    where: { id: lotId },
    data: {
      completedQty,
      defectQty,
      carryOverOut: carryOverQty,
      completedAt: new Date(),
      status: 'COMPLETED',
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  })

  return lot
}

/**
 * 진행 중인 LOT 삭제 (작업 취소)
 *
 * 동작:
 * 1. IN_PROGRESS 상태 확인
 * 2. 이월 사용 롤백
 * 3. 자재 차감 롤백 (Phase 4에서 구현)
 * 4. LOT 삭제 또는 CANCELLED 상태로 변경
 */
export async function deleteInProgressProduction(
  lotId: number,
  options: { hardDelete?: boolean } = {}
): Promise<void> {
  const { hardDelete = false } = options

  // LOT 조회
  const lot = await prisma.productionLot.findUnique({
    where: { id: lotId },
  })

  if (!lot) {
    throw new Error(`LOT을 찾을 수 없습니다: ${lotId}`)
  }

  if (lot.status !== 'IN_PROGRESS') {
    throw new Error(`진행 중인 LOT만 삭제할 수 있습니다. 현재 상태: ${lot.status}`)
  }

  // 이월 사용 롤백 (CarryOver 복원)
  if (lot.carryOverIn > 0) {
    await prisma.carryOver.updateMany({
      where: {
        targetLotNo: lot.lotNumber,
      },
      data: {
        usedQty: { decrement: lot.carryOverIn },
        targetLotNo: null,
        isUsed: false,
      },
    })
  }

  if (hardDelete) {
    // 완전 삭제 (cascade로 lotMaterials도 삭제됨)
    await prisma.productionLot.delete({
      where: { id: lotId },
    })
  } else {
    // 소프트 삭제 (CANCELLED 상태로 변경)
    await prisma.productionLot.update({
      where: { id: lotId },
      data: {
        status: 'CANCELLED',
      },
    })
  }
}

/**
 * 진행 중인 LOT 목록 조회
 */
export async function getInProgressLots(options?: {
  processCode?: string
  lineCode?: string
  workerId?: number
  limit?: number
}): Promise<LotWithRelations[]> {
  const { processCode, lineCode, workerId, limit = 100 } = options || {}

  const where: Prisma.ProductionLotWhereInput = {
    status: 'IN_PROGRESS',
  }

  if (processCode) {
    where.processCode = processCode.toUpperCase()
  }

  if (lineCode) {
    where.lineCode = lineCode
  }

  if (workerId) {
    where.workerId = workerId
  }

  return prisma.productionLot.findMany({
    where,
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
      worker: {
        select: { id: true, name: true },
      },
      lotMaterials: {
        include: {
          material: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

/**
 * LOT 상태 확인
 */
export function isLotInProgress(lot: LotWithRelations): boolean {
  return lot.status === 'IN_PROGRESS'
}

/**
 * LOT 상태 확인
 */
export function isLotCompleted(lot: LotWithRelations): boolean {
  return lot.status === 'COMPLETED'
}

// ============================================
// 공정별 입력 검증 (Phase 3)
// ============================================

// Re-export validation functions for convenience
export {
  validateInputs,
  validateBarcodes,
  createInputsFromBarcodes,
  isValidProcessCode,
  PROCESS_INPUT_RULES,
  PROCESS_NAMES,
}
export type { ProcessCode, InputItem, ValidationResult, InputType }

/**
 * 공정에서 입력 바코드 검증
 *
 * @param processCode 공정 코드
 * @param barcodes 입력 바코드 배열
 * @returns 검증 결과
 */
export function validateProcessInputs(
  processCode: string,
  barcodes: string[]
): ValidationResult {
  return validateBarcodes(processCode, barcodes)
}

/**
 * 자재 투입 전 검증
 *
 * @param lotId LOT ID
 * @param materialBarcode 자재 바코드
 * @returns 검증 결과
 */
export async function validateMaterialInput(
  lotId: number,
  materialBarcode: string
): Promise<ValidationResult> {
  // LOT 조회
  const lot = await prisma.productionLot.findUnique({
    where: { id: lotId },
    select: { processCode: true },
  })

  if (!lot) {
    return {
      isValid: false,
      errors: [{
        code: 'LOT_NOT_FOUND',
        message: `LOT을 찾을 수 없습니다: ${lotId}`,
      }],
      warnings: [],
      validatedInputs: [],
    }
  }

  // 바코드 검증
  return validateBarcodes(lot.processCode, [materialBarcode])
}

/**
 * 자재 투입 등록 (검증 포함)
 *
 * @param input 자재 투입 정보
 * @param options 검증 옵션
 * @returns 투입 결과와 검증 결과
 */
export async function addMaterialWithValidation(
  input: AddMaterialInput,
  options: ValidateInputOptions = {}
): Promise<AddMaterialWithValidationResult> {
  const { skipValidation = false } = options
  const { lotId, materialBarcode, materialId, quantity } = input

  // LOT 조회
  const lot = await prisma.productionLot.findUnique({
    where: { id: lotId },
    select: { processCode: true },
  })

  if (!lot) {
    throw new Error(`LOT을 찾을 수 없습니다: ${lotId}`)
  }

  // 검증 실행
  const validationResult = validateBarcodes(lot.processCode, [materialBarcode])

  // 검증 실패 시 에러 (skipValidation이 false인 경우)
  if (!skipValidation && !validationResult.isValid) {
    const errorMessage = validationResult.errors.map(e => e.message).join('; ')
    throw new Error(`입력 검증 실패: ${errorMessage}`)
  }

  // 자재 투입 기록 생성
  const lotMaterial = await prisma.lotMaterial.create({
    data: {
      productionLotId: lotId,
      materialId,
      materialLotNo: materialBarcode,
      quantity,
    },
  })

  // 업데이트된 LOT 반환
  const updatedLot = await getLotById(lotId)

  return {
    lotMaterialId: lotMaterial.id,
    lot: updatedLot!,
    validationResult,
  }
}

/**
 * 여러 자재 일괄 투입 (검증 포함)
 *
 * @param lotId LOT ID
 * @param materials 자재 정보 배열
 * @param options 검증 옵션
 * @returns 투입 결과 배열과 검증 결과
 */
export async function addMaterialsBatch(
  lotId: number,
  materials: Array<{
    materialBarcode: string
    materialId: number
    quantity: number
  }>,
  options: ValidateInputOptions = {}
): Promise<{
  results: Array<{ lotMaterialId: number; barcode: string }>
  lot: LotWithRelations
  validationResult: ValidationResult
}> {
  const { skipValidation = false } = options

  // LOT 조회
  const lot = await prisma.productionLot.findUnique({
    where: { id: lotId },
    select: { processCode: true },
  })

  if (!lot) {
    throw new Error(`LOT을 찾을 수 없습니다: ${lotId}`)
  }

  // 전체 바코드 검증
  const barcodes = materials.map(m => m.materialBarcode)
  const validationResult = validateBarcodes(lot.processCode, barcodes)

  // 검증 실패 시 에러 (skipValidation이 false인 경우)
  if (!skipValidation && !validationResult.isValid) {
    const errorMessage = validationResult.errors.map(e => e.message).join('; ')
    throw new Error(`입력 검증 실패: ${errorMessage}`)
  }

  // 자재 일괄 투입
  const results: Array<{ lotMaterialId: number; barcode: string }> = []

  for (const material of materials) {
    const lotMaterial = await prisma.lotMaterial.create({
      data: {
        productionLotId: lotId,
        materialId: material.materialId,
        materialLotNo: material.materialBarcode,
        quantity: material.quantity,
      },
    })

    results.push({
      lotMaterialId: lotMaterial.id,
      barcode: material.materialBarcode,
    })
  }

  // 업데이트된 LOT 반환
  const updatedLot = await getLotById(lotId)

  return {
    results,
    lot: updatedLot!,
    validationResult,
  }
}

/**
 * 공정별 허용 입력 타입 조회
 *
 * @param processCode 공정 코드
 * @returns 허용되는 입력 타입 배열
 */
export function getAllowedInputTypes(processCode: string): InputType[] | null {
  const normalized = processCode.toUpperCase()
  if (!isValidProcessCode(normalized)) {
    return null
  }
  return PROCESS_INPUT_RULES[normalized as ProcessCode]
}

/**
 * 입력 바코드 타입 추론
 *
 * @param barcode 바코드 문자열
 * @returns 추론된 입력 타입
 */
export function inferBarcodeInputType(barcode: string): InputType {
  const parsed = parseBarcode(barcode)

  if (!parsed.isValid) {
    return 'material'
  }

  const processCode = parsed.processCode.toUpperCase()

  if (processCode === 'CI' || processCode === 'VI') {
    return 'production'
  }

  if (isValidProcessCode(processCode)) {
    return 'semi_product'
  }

  return 'material'
}
