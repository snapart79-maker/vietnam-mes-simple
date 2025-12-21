/**
 * Stock Service
 *
 * 자재 재고 관리 서비스
 * - 입고/출고 트랜잭션
 * - 재고 조회
 * - 본사 바코드 연동
 */
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { parseHQBarcode } from './barcodeService'
import { calculateRequiredMaterials, type CalculatedRequirement } from './bomService'

// ============================================
// Types
// ============================================

export interface ReceiveStockInput {
  materialId: number
  lotNumber: string
  quantity: number
  location?: string
}

export interface ConsumeStockInput {
  materialId: number
  lotNumber: string
  quantity: number
  productionLotId?: number
}

export interface StockItem {
  id: number
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  usedQty: number
  availableQty: number
  location: string | null
  receivedAt: Date
}

export interface StockSummary {
  materialId: number
  materialCode: string
  materialName: string
  unit: string
  safeStock: number
  totalStock: number
  availableStock: number
  lotCount: number
  status: 'good' | 'warning' | 'danger' | 'exhausted'
}

export interface StockTransaction {
  type: 'IN' | 'OUT'
  materialId: number
  lotNumber: string
  quantity: number
  productionLotId?: number
  createdAt: Date
}

// ============================================
// Stock Receiving (입고)
// ============================================

export interface ReceiveStockResult {
  success: boolean
  stock?: StockItem
  error?: string
}

/**
 * 자재 입고 (단건) - 결과 객체 반환
 */
export async function receiveStock(input: ReceiveStockInput): Promise<ReceiveStockResult> {
  try {
    const stock = await prisma.materialStock.create({
      data: {
        materialId: input.materialId,
        lotNumber: input.lotNumber,
        quantity: input.quantity,
        usedQty: 0,
        location: input.location,
        receivedAt: new Date(),
      },
      include: {
        material: {
          select: { code: true, name: true },
        },
      },
    })

    return {
      success: true,
      stock: {
        id: stock.id,
        materialId: stock.materialId,
        materialCode: stock.material.code,
        materialName: stock.material.name,
        lotNumber: stock.lotNumber,
        quantity: stock.quantity,
        usedQty: stock.usedQty,
        availableQty: stock.quantity - stock.usedQty,
        location: stock.location,
        receivedAt: stock.receivedAt,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '입고 처리 실패',
    }
  }
}

/**
 * 바코드 스캔 입고
 * 본사 바코드를 파싱하여 자재 정보 자동 매핑
 */
export async function receiveStockByBarcode(
  barcode: string,
  quantity: number,
  location?: string
): Promise<ReceiveStockResult> {
  const parsed = parseHQBarcode(barcode)

  if (!parsed.isValid) {
    return {
      success: false,
      error: '유효하지 않은 바코드입니다.',
    }
  }

  // 자재 코드로 자재 조회
  const material = await prisma.material.findFirst({
    where: {
      OR: [
        { code: parsed.materialCode },
        { code: { contains: parsed.materialCode } },
      ],
    },
  })

  if (!material) {
    return {
      success: false,
      error: `자재를 찾을 수 없습니다: ${parsed.materialCode}`,
    }
  }

  return receiveStock({
    materialId: material.id,
    lotNumber: parsed.lotNumber,
    quantity: parsed.quantity || quantity,
    location,
  })
}

/**
 * 일괄 입고
 */
export async function receiveStockBatch(
  items: ReceiveStockInput[]
): Promise<{ success: number; failed: number; results: ReceiveStockResult[] }> {
  const results: ReceiveStockResult[] = []
  let success = 0
  let failed = 0

  for (const item of items) {
    const result = await receiveStock(item)
    results.push(result)
    if (result.success) {
      success++
    } else {
      failed++
    }
  }

  return { success, failed, results }
}

// ============================================
// Stock Consumption (출고/사용)
// ============================================

/**
 * 자재 사용 (출고)
 */
export async function consumeStock(input: ConsumeStockInput): Promise<void> {
  const { materialId, lotNumber, quantity, productionLotId } = input

  // 해당 LOT의 재고 조회
  const stock = await prisma.materialStock.findFirst({
    where: {
      materialId,
      lotNumber,
    },
  })

  if (!stock) {
    throw new Error(`재고를 찾을 수 없습니다: ${lotNumber}`)
  }

  const availableQty = stock.quantity - stock.usedQty

  if (availableQty < quantity) {
    throw new Error(`재고 부족: 가용 ${availableQty}, 요청 ${quantity}`)
  }

  // 사용량 업데이트
  await prisma.materialStock.update({
    where: { id: stock.id },
    data: {
      usedQty: stock.usedQty + quantity,
    },
  })

  // 생산 LOT에 자재 투입 기록 (옵션)
  if (productionLotId) {
    await prisma.lotMaterial.create({
      data: {
        productionLotId,
        materialId,
        materialLotNo: lotNumber,
        quantity,
      },
    })
  }
}

/**
 * FIFO 방식 자재 사용
 * 가장 오래된 LOT부터 순차적으로 사용
 */
export async function consumeStockFIFO(
  materialId: number,
  quantity: number,
  productionLotId?: number
): Promise<Array<{ lotNumber: string; usedQty: number }>> {
  // 가용 재고 조회 (오래된 순)
  const stocks = await prisma.materialStock.findMany({
    where: {
      materialId,
    },
    orderBy: { receivedAt: 'asc' },
  })

  let remainingQty = quantity
  const usedLots: Array<{ lotNumber: string; usedQty: number }> = []

  for (const stock of stocks) {
    if (remainingQty <= 0) break

    const availableQty = stock.quantity - stock.usedQty
    if (availableQty <= 0) continue

    const useQty = Math.min(availableQty, remainingQty)

    await prisma.materialStock.update({
      where: { id: stock.id },
      data: {
        usedQty: stock.usedQty + useQty,
      },
    })

    if (productionLotId) {
      await prisma.lotMaterial.create({
        data: {
          productionLotId,
          materialId,
          materialLotNo: stock.lotNumber,
          quantity: useQty,
        },
      })
    }

    usedLots.push({ lotNumber: stock.lotNumber, usedQty: useQty })
    remainingQty -= useQty
  }

  if (remainingQty > 0) {
    throw new Error(`재고 부족: 필요 ${quantity}, 가용 ${quantity - remainingQty}`)
  }

  return usedLots
}

/**
 * 재고 조정 (수량 직접 수정)
 */
export async function adjustStock(
  stockId: number,
  newQuantity: number,
  reason?: string
): Promise<void> {
  await prisma.materialStock.update({
    where: { id: stockId },
    data: { quantity: newQuantity },
  })
}

// ============================================
// Stock Queries
// ============================================

/**
 * 자재별 재고 조회
 */
export async function getStockByMaterial(materialId: number): Promise<StockItem[]> {
  const stocks = await prisma.materialStock.findMany({
    where: { materialId },
    include: {
      material: {
        select: { code: true, name: true },
      },
    },
    orderBy: { receivedAt: 'asc' },
  })

  return stocks.map((s) => ({
    id: s.id,
    materialId: s.materialId,
    materialCode: s.material.code,
    materialName: s.material.name,
    lotNumber: s.lotNumber,
    quantity: s.quantity,
    usedQty: s.usedQty,
    availableQty: s.quantity - s.usedQty,
    location: s.location,
    receivedAt: s.receivedAt,
  }))
}

/**
 * LOT 번호로 재고 조회
 */
export async function getStockByLot(lotNumber: string): Promise<StockItem | null> {
  const stock = await prisma.materialStock.findFirst({
    where: { lotNumber },
    include: {
      material: {
        select: { code: true, name: true },
      },
    },
  })

  if (!stock) return null

  return {
    id: stock.id,
    materialId: stock.materialId,
    materialCode: stock.material.code,
    materialName: stock.material.name,
    lotNumber: stock.lotNumber,
    quantity: stock.quantity,
    usedQty: stock.usedQty,
    availableQty: stock.quantity - stock.usedQty,
    location: stock.location,
    receivedAt: stock.receivedAt,
  }
}

/**
 * 전체 재고 현황 (요약)
 */
export async function getStockSummary(): Promise<StockSummary[]> {
  const materials = await prisma.material.findMany({
    where: { isActive: true },
    include: {
      stocks: {
        select: {
          quantity: true,
          usedQty: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  })

  return materials.map((mat) => {
    const totalStock = mat.stocks.reduce((sum, s) => sum + s.quantity, 0)
    const usedStock = mat.stocks.reduce((sum, s) => sum + s.usedQty, 0)
    const availableStock = totalStock - usedStock

    let status: StockSummary['status'] = 'good'
    if (availableStock === 0) {
      status = 'exhausted'
    } else if (availableStock < mat.safeStock * 0.3) {
      status = 'danger'
    } else if (availableStock < mat.safeStock) {
      status = 'warning'
    }

    return {
      materialId: mat.id,
      materialCode: mat.code,
      materialName: mat.name,
      unit: mat.unit,
      safeStock: mat.safeStock,
      totalStock,
      availableStock,
      lotCount: mat.stocks.length,
      status,
    }
  })
}

/**
 * 재고 부족 자재 조회
 */
export async function getLowStock(): Promise<StockSummary[]> {
  const summary = await getStockSummary()
  return summary.filter(
    (s) => s.status === 'warning' || s.status === 'danger' || s.status === 'exhausted'
  )
}

/**
 * 위치별 재고 조회
 */
export async function getStockByLocation(location: string): Promise<StockItem[]> {
  const stocks = await prisma.materialStock.findMany({
    where: { location },
    include: {
      material: {
        select: { code: true, name: true },
      },
    },
    orderBy: [
      { material: { code: 'asc' } },
      { receivedAt: 'asc' },
    ],
  })

  return stocks.map((s) => ({
    id: s.id,
    materialId: s.materialId,
    materialCode: s.material.code,
    materialName: s.material.name,
    lotNumber: s.lotNumber,
    quantity: s.quantity,
    usedQty: s.usedQty,
    availableQty: s.quantity - s.usedQty,
    location: s.location,
    receivedAt: s.receivedAt,
  }))
}

/**
 * 위치 목록 조회
 */
export async function getLocations(): Promise<string[]> {
  const result = await prisma.materialStock.findMany({
    where: {
      location: { not: null },
    },
    select: { location: true },
    distinct: ['location'],
    orderBy: { location: 'asc' },
  })

  return result.map((r) => r.location!).filter(Boolean)
}

/**
 * 자재별 가용 재고 수량 조회
 */
export async function getAvailableQty(materialId: number): Promise<number> {
  const result = await prisma.materialStock.aggregate({
    where: { materialId },
    _sum: {
      quantity: true,
      usedQty: true,
    },
  })

  const total = result._sum.quantity || 0
  const used = result._sum.usedQty || 0

  return total - used
}

/**
 * 가용 재고가 있는 LOT 조회
 */
export async function getAvailableLots(materialId: number): Promise<StockItem[]> {
  const stocks = await getStockByMaterial(materialId)
  return stocks.filter((s) => s.availableQty > 0)
}

// ============================================
// Today's Receivings
// ============================================

interface TodayReceiving {
  id: number
  lotNumber: string
  quantity: number
  location: string | null
  receivedAt: Date
  material: {
    code: string
    name: string
    unit: string
  }
}

/**
 * 금일 입고 내역 조회
 */
export async function getTodayReceivings(): Promise<TodayReceiving[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const receivings = await prisma.materialStock.findMany({
    where: {
      receivedAt: { gte: today },
    },
    include: {
      material: {
        select: {
          code: true,
          name: true,
          unit: true,
        },
      },
    },
    orderBy: { receivedAt: 'desc' },
  })

  return receivings
}

// ============================================
// Phase 4: BOM 기반 자재 차감
// ============================================

/**
 * 자재 투입 정보
 */
export interface MaterialInput {
  materialId: number
  lotNumber?: string
  quantity?: number
}

/**
 * 개별 차감 결과
 */
export interface DeductionItem {
  materialId: number
  materialCode: string
  materialName: string
  requiredQty: number
  deductedQty: number
  remainingQty: number
  lots: Array<{ lotNumber: string; usedQty: number }>
  success: boolean
  allowedNegative: boolean
  error?: string
}

/**
 * 전체 차감 결과
 */
export interface DeductionResult {
  success: boolean
  productId: number
  processCode: string
  productionQty: number
  allowNegative: boolean
  items: DeductionItem[]
  totalRequired: number
  totalDeducted: number
  errors: string[]
}

/**
 * 음수 재고 허용 FIFO 차감
 *
 * 가용 재고가 부족해도 차감 진행 (음수 허용)
 *
 * @param materialId 자재 ID
 * @param quantity 차감 수량
 * @param productionLotId 생산 LOT ID (옵션)
 * @param allowNegative 음수 허용 여부
 * @returns 사용된 LOT 정보
 */
export async function consumeStockFIFOWithNegative(
  materialId: number,
  quantity: number,
  productionLotId?: number,
  allowNegative: boolean = true
): Promise<{
  lots: Array<{ lotNumber: string; usedQty: number }>
  deductedQty: number
  remainingQty: number
}> {
  // 가용 재고 조회 (오래된 순)
  const stocks = await prisma.materialStock.findMany({
    where: { materialId },
    orderBy: { receivedAt: 'asc' },
  })

  let remainingQty = quantity
  const usedLots: Array<{ lotNumber: string; usedQty: number }> = []
  let totalDeducted = 0

  // 먼저 가용 재고에서 차감
  for (const stock of stocks) {
    if (remainingQty <= 0) break

    const availableQty = stock.quantity - stock.usedQty
    if (availableQty <= 0) continue

    const useQty = Math.min(availableQty, remainingQty)

    await prisma.materialStock.update({
      where: { id: stock.id },
      data: { usedQty: stock.usedQty + useQty },
    })

    if (productionLotId) {
      await prisma.lotMaterial.create({
        data: {
          productionLotId,
          materialId,
          materialLotNo: stock.lotNumber,
          quantity: useQty,
        },
      })
    }

    usedLots.push({ lotNumber: stock.lotNumber, usedQty: useQty })
    totalDeducted += useQty
    remainingQty -= useQty
  }

  // 남은 수량이 있고 음수 허용이면, 마지막 LOT에서 추가 차감
  if (remainingQty > 0 && allowNegative) {
    // 가장 최근 LOT 또는 첫 번째 LOT 사용
    const targetStock = stocks.length > 0 ? stocks[stocks.length - 1] : null

    if (targetStock) {
      await prisma.materialStock.update({
        where: { id: targetStock.id },
        data: { usedQty: targetStock.usedQty + remainingQty },
      })

      if (productionLotId) {
        await prisma.lotMaterial.create({
          data: {
            productionLotId,
            materialId,
            materialLotNo: targetStock.lotNumber,
            quantity: remainingQty,
          },
        })
      }

      const existingLot = usedLots.find((l) => l.lotNumber === targetStock.lotNumber)
      if (existingLot) {
        existingLot.usedQty += remainingQty
      } else {
        usedLots.push({ lotNumber: targetStock.lotNumber, usedQty: remainingQty })
      }

      totalDeducted += remainingQty
      remainingQty = 0
    }
  }

  return {
    lots: usedLots,
    deductedQty: totalDeducted,
    remainingQty,
  }
}

/**
 * BOM 기반 자재 차감
 *
 * 생산 시 BOM에 따른 자동 자재 차감
 * 음수 재고 허용 옵션 지원
 *
 * @param productId 제품 ID
 * @param processCode 공정 코드
 * @param productionQty 생산 수량
 * @param inputMaterials 스캔된 자재 정보 (옵션, FIFO 대신 특정 LOT 사용 시)
 * @param allowNegative 음수 재고 허용 (기본값: true)
 * @param productionLotId 생산 LOT ID (옵션)
 * @returns 차감 결과
 */
export async function deductByBOM(
  productId: number,
  processCode: string,
  productionQty: number,
  inputMaterials: MaterialInput[] = [],
  allowNegative: boolean = true,
  productionLotId?: number
): Promise<DeductionResult> {
  // BOM에서 필요 자재 계산
  const requirements = await calculateRequiredMaterials(productId, processCode, productionQty)

  const result: DeductionResult = {
    success: true,
    productId,
    processCode,
    productionQty,
    allowNegative,
    items: [],
    totalRequired: 0,
    totalDeducted: 0,
    errors: [],
  }

  // BOM이 비어있으면 바로 성공 반환
  if (requirements.length === 0) {
    return result
  }

  // 스캔된 자재를 materialId로 그룹화
  const inputMap = new Map<number, MaterialInput[]>()
  for (const input of inputMaterials) {
    const existing = inputMap.get(input.materialId) || []
    existing.push(input)
    inputMap.set(input.materialId, existing)
  }

  // 각 자재별 차감 처리
  for (const req of requirements) {
    result.totalRequired += req.requiredQty

    const item: DeductionItem = {
      materialId: req.materialId,
      materialCode: req.materialCode,
      materialName: req.materialName,
      requiredQty: req.requiredQty,
      deductedQty: 0,
      remainingQty: req.requiredQty,
      lots: [],
      success: false,
      allowedNegative: false,
    }

    try {
      const scannedInputs = inputMap.get(req.materialId)

      if (scannedInputs && scannedInputs.length > 0) {
        // 스캔된 특정 LOT에서 차감
        let remaining = req.requiredQty

        for (const input of scannedInputs) {
          if (remaining <= 0) break

          if (input.lotNumber) {
            const stock = await prisma.materialStock.findFirst({
              where: {
                materialId: req.materialId,
                lotNumber: input.lotNumber,
              },
            })

            if (stock) {
              const availableQty = stock.quantity - stock.usedQty
              const useQty = input.quantity
                ? Math.min(input.quantity, remaining)
                : Math.min(availableQty > 0 ? availableQty : remaining, remaining)

              // 음수 허용 여부에 따라 처리
              if (useQty > availableQty && !allowNegative) {
                item.error = `재고 부족: ${input.lotNumber} (가용: ${availableQty}, 필요: ${useQty})`
                continue
              }

              await prisma.materialStock.update({
                where: { id: stock.id },
                data: { usedQty: stock.usedQty + useQty },
              })

              if (productionLotId) {
                await prisma.lotMaterial.create({
                  data: {
                    productionLotId,
                    materialId: req.materialId,
                    materialLotNo: input.lotNumber,
                    quantity: useQty,
                  },
                })
              }

              item.lots.push({ lotNumber: input.lotNumber, usedQty: useQty })
              item.deductedQty += useQty
              remaining -= useQty

              if (useQty > availableQty) {
                item.allowedNegative = true
              }
            }
          }
        }

        // 남은 수량이 있으면 FIFO로 추가 차감
        if (remaining > 0) {
          const fifoResult = await consumeStockFIFOWithNegative(
            req.materialId,
            remaining,
            productionLotId,
            allowNegative
          )

          item.lots.push(...fifoResult.lots)
          item.deductedQty += fifoResult.deductedQty
          remaining = fifoResult.remainingQty

          if (fifoResult.remainingQty === 0 && fifoResult.deductedQty < remaining) {
            item.allowedNegative = true
          }
        }

        item.remainingQty = remaining
        item.success = remaining === 0
      } else {
        // 스캔된 LOT이 없으면 FIFO로 차감
        const fifoResult = await consumeStockFIFOWithNegative(
          req.materialId,
          req.requiredQty,
          productionLotId,
          allowNegative
        )

        item.lots = fifoResult.lots
        item.deductedQty = fifoResult.deductedQty
        item.remainingQty = fifoResult.remainingQty
        item.success = fifoResult.remainingQty === 0

        // 음수 차감 감지
        const totalAvailable = await getAvailableQty(req.materialId)
        if (totalAvailable < 0) {
          item.allowedNegative = true
        }
      }

      result.totalDeducted += item.deductedQty
    } catch (error) {
      item.error = error instanceof Error ? error.message : '차감 실패'
      item.success = false
    }

    if (!item.success && !allowNegative) {
      result.success = false
      result.errors.push(`${req.materialCode}: ${item.error || '차감 실패'}`)
    }

    result.items.push(item)
  }

  return result
}

/**
 * BOM 기반 차감 롤백
 *
 * 생산 취소 시 차감된 자재 복원
 *
 * @param productionLotId 생산 LOT ID
 * @returns 복원된 자재 수
 */
export async function rollbackBOMDeduction(productionLotId: number): Promise<number> {
  // 해당 LOT에 투입된 자재 조회
  const lotMaterials = await prisma.lotMaterial.findMany({
    where: { productionLotId },
  })

  let restoredCount = 0

  for (const lotMaterial of lotMaterials) {
    // 재고에서 사용량 복원
    const stock = await prisma.materialStock.findFirst({
      where: {
        materialId: lotMaterial.materialId,
        lotNumber: lotMaterial.materialLotNo,
      },
    })

    if (stock) {
      await prisma.materialStock.update({
        where: { id: stock.id },
        data: {
          usedQty: Math.max(0, stock.usedQty - lotMaterial.quantity),
        },
      })
      restoredCount++
    }

    // LotMaterial 삭제
    await prisma.lotMaterial.delete({
      where: { id: lotMaterial.id },
    })
  }

  return restoredCount
}

/**
 * 자재별 가용 재고 확인 (BOM 기준)
 *
 * @param productId 제품 ID
 * @param processCode 공정 코드
 * @param productionQty 생산 수량
 * @returns 자재별 가용 여부
 */
export async function checkBOMAvailability(
  productId: number,
  processCode: string,
  productionQty: number
): Promise<{
  available: boolean
  items: Array<{
    materialId: number
    materialCode: string
    materialName: string
    requiredQty: number
    availableQty: number
    shortage: number
  }>
}> {
  const requirements = await calculateRequiredMaterials(productId, processCode, productionQty)

  const items = await Promise.all(
    requirements.map(async (req) => {
      const availableQty = await getAvailableQty(req.materialId)
      return {
        materialId: req.materialId,
        materialCode: req.materialCode,
        materialName: req.materialName,
        requiredQty: req.requiredQty,
        availableQty,
        shortage: Math.max(0, req.requiredQty - availableQty),
      }
    })
  )

  const available = items.every((item) => item.shortage === 0)

  return { available, items }
}

// Re-export types from bomService for convenience
export type { CalculatedRequirement }
