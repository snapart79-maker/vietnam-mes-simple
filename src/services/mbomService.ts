/**
 * MBOM Service (Manufacturing BOM)
 *
 * 공정 기반 BOM 관리 서비스
 * - 공정별 자재 투입 관리
 * - MBOM 트리 구조 조회
 * - 공정별 자재 소요량 계산
 * - 전공정 반제품 소요량 계산
 */
import { prisma } from '../lib/prisma'
import { BOMItemType, Prisma, Product, Material, Process } from '@prisma/client'

// ============================================
// Types
// ============================================

/**
 * MBOM 항목 입력
 */
export interface CreateMBOMInput {
  productId: number           // 완제품 ID
  semiProductId?: number      // 반제품 ID (절압품 등, 선택)
  processCode: string         // 투입 공정
  itemType: 'MATERIAL' | 'SEMI_PRODUCT'
  materialId?: number         // 자재 ID
  inputSemiId?: number        // 투입 반제품 ID (전공정품)
  quantity: number
  unit?: string
  description?: string
}

/**
 * MBOM 항목 상세 정보
 */
export interface MBOMEntry {
  id: number
  productId: number
  semiProductId: number | null
  processCode: string
  itemType: BOMItemType
  quantity: number
  unit: string | null
  material?: {
    id: number
    code: string
    name: string
    unit: string
    category: string
  }
  childProduct?: {
    id: number
    code: string
    name: string
    type: string
  }
}

/**
 * 공정별 MBOM 트리 노드
 */
export interface MBOMTreeNode {
  processCode: string
  processName: string
  seq: number
  hasMaterialInput: boolean
  isInspection: boolean
  materials: Array<{
    id: number
    code: string
    name: string
    quantity: number
    unit: string
  }>
  semiProducts: Array<{
    id: number
    code: string
    name: string
    quantity: number
    type: string
  }>
  children: MBOMTreeNode[]
}

/**
 * 자재 소요량
 */
export interface MaterialRequirement {
  materialId: number
  materialCode: string
  materialName: string
  category: string
  unit: string
  quantityPerUnit: number
  requiredQty: number
  processCode: string
}

/**
 * 반제품 소요량
 */
export interface SemiProductRequirement {
  productId: number
  productCode: string
  productName: string
  type: string
  quantityPerUnit: number
  requiredQty: number
  fromProcess: string
}

// ============================================
// CRUD Operations
// ============================================

/**
 * MBOM 항목 생성 (공정별 자재/반제품 투입)
 */
export async function createMBOMEntry(input: CreateMBOMInput) {
  // 유효성 검사
  if (input.itemType === 'MATERIAL' && !input.materialId) {
    throw new Error('자재 항목은 materialId가 필요합니다.')
  }
  if (input.itemType === 'SEMI_PRODUCT' && !input.inputSemiId) {
    throw new Error('반제품 항목은 inputSemiId가 필요합니다.')
  }

  // 공정 존재 확인
  const process = await prisma.process.findUnique({
    where: { code: input.processCode.toUpperCase() },
  })
  if (!process) {
    throw new Error(`유효하지 않은 공정 코드: ${input.processCode}`)
  }

  return prisma.bOM.create({
    data: {
      productId: input.productId,
      itemType: input.itemType === 'MATERIAL' ? 'MATERIAL' : 'PRODUCT',
      materialId: input.materialId,
      childProductId: input.inputSemiId,
      quantity: input.quantity,
      unit: input.unit,
      processCode: input.processCode.toUpperCase(),
    },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true, category: true },
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  })
}

/**
 * MBOM 항목 수정
 */
export async function updateMBOMEntry(
  id: number,
  input: {
    quantity?: number
    unit?: string
    processCode?: string
  }
) {
  return prisma.bOM.update({
    where: { id },
    data: {
      quantity: input.quantity,
      unit: input.unit,
      processCode: input.processCode?.toUpperCase(),
    },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true, category: true },
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  })
}

/**
 * MBOM 항목 삭제
 */
export async function deleteMBOMEntry(id: number): Promise<void> {
  await prisma.bOM.delete({
    where: { id },
  })
}

// ============================================
// Query Operations
// ============================================

/**
 * 완제품의 MBOM 전체 조회
 */
export async function getMBOMByProduct(productId: number): Promise<MBOMEntry[]> {
  const items = await prisma.bOM.findMany({
    where: { productId },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true, category: true },
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
    orderBy: [
      { processCode: 'asc' },
      { itemType: 'asc' },
      { id: 'asc' },
    ],
  })

  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    semiProductId: item.childProductId,
    processCode: item.processCode || '',
    itemType: item.itemType,
    quantity: item.quantity,
    unit: item.unit,
    material: item.material || undefined,
    childProduct: item.childProduct || undefined,
  }))
}

/**
 * 공정별 자재/반제품 조회
 */
export async function getMBOMByProcess(
  productId: number,
  processCode: string
): Promise<MBOMEntry[]> {
  const items = await prisma.bOM.findMany({
    where: {
      productId,
      processCode: processCode.toUpperCase(),
    },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true, category: true },
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
    orderBy: [
      { itemType: 'asc' },
      { id: 'asc' },
    ],
  })

  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    semiProductId: item.childProductId,
    processCode: item.processCode || '',
    itemType: item.itemType,
    quantity: item.quantity,
    unit: item.unit,
    material: item.material || undefined,
    childProduct: item.childProduct || undefined,
  }))
}

/**
 * MBOM 트리 구조 조회 (공정 순서대로)
 */
export async function getMBOMTree(productId: number): Promise<MBOMTreeNode[]> {
  // 제품의 모든 BOM 항목 조회
  const bomItems = await prisma.bOM.findMany({
    where: { productId },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true },
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  })

  // 모든 공정 조회 (순서대로)
  const processes = await prisma.process.findMany({
    where: { isActive: true },
    orderBy: { seq: 'asc' },
  })

  // 공정별로 BOM 항목 그룹화
  const processMap = new Map<string, MBOMTreeNode>()

  for (const process of processes) {
    processMap.set(process.code, {
      processCode: process.code,
      processName: process.name,
      seq: process.seq,
      hasMaterialInput: process.hasMaterialInput,
      isInspection: process.isInspection,
      materials: [],
      semiProducts: [],
      children: [],
    })
  }

  // BOM 항목을 공정별로 분류
  for (const item of bomItems) {
    const processCode = item.processCode || ''
    const node = processMap.get(processCode)

    if (!node) continue

    if (item.itemType === 'MATERIAL' && item.material) {
      node.materials.push({
        id: item.material.id,
        code: item.material.code,
        name: item.material.name,
        quantity: item.quantity,
        unit: item.unit || item.material.unit,
      })
    } else if (item.itemType === 'PRODUCT' && item.childProduct) {
      node.semiProducts.push({
        id: item.childProduct.id,
        code: item.childProduct.code,
        name: item.childProduct.name,
        quantity: item.quantity,
        type: item.childProduct.type,
      })
    }
  }

  // 자재나 반제품이 있는 공정만 반환
  const result: MBOMTreeNode[] = []
  for (const process of processes) {
    const node = processMap.get(process.code)
    if (node && (node.materials.length > 0 || node.semiProducts.length > 0)) {
      result.push(node)
    }
  }

  return result
}

/**
 * 공정별 자재 소요량 계산
 */
export async function calculateProcessMaterialRequirements(
  productId: number,
  processCode: string,
  productionQty: number
): Promise<MaterialRequirement[]> {
  const items = await prisma.bOM.findMany({
    where: {
      productId,
      processCode: processCode.toUpperCase(),
      itemType: 'MATERIAL',
      materialId: { not: null },
    },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true, category: true },
      },
    },
  })

  return items
    .filter((item) => item.material !== null)
    .map((item) => ({
      materialId: item.material!.id,
      materialCode: item.material!.code,
      materialName: item.material!.name,
      category: item.material!.category,
      unit: item.material!.unit,
      quantityPerUnit: item.quantity,
      requiredQty: item.quantity * productionQty,
      processCode: item.processCode || '',
    }))
}

/**
 * 전공정 반제품 소요량 계산
 */
export async function calculateSemiProductRequirements(
  productId: number,
  processCode: string,
  productionQty: number
): Promise<SemiProductRequirement[]> {
  const items = await prisma.bOM.findMany({
    where: {
      productId,
      processCode: processCode.toUpperCase(),
      itemType: 'PRODUCT',
      childProductId: { not: null },
    },
    include: {
      childProduct: {
        select: { id: true, code: true, name: true, type: true, processCode: true },
      },
    },
  })

  return items
    .filter((item) => item.childProduct !== null)
    .map((item) => ({
      productId: item.childProduct!.id,
      productCode: item.childProduct!.code,
      productName: item.childProduct!.name,
      type: item.childProduct!.type,
      quantityPerUnit: item.quantity,
      requiredQty: item.quantity * productionQty,
      fromProcess: item.childProduct!.processCode || '',
    }))
}

/**
 * 전체 자재 소요량 계산 (모든 공정)
 */
export async function calculateTotalMaterialRequirements(
  productId: number,
  productionQty: number
): Promise<MaterialRequirement[]> {
  const items = await prisma.bOM.findMany({
    where: {
      productId,
      itemType: 'MATERIAL',
      materialId: { not: null },
    },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true, category: true },
      },
    },
  })

  // 자재별로 합산
  const materialMap = new Map<number, MaterialRequirement>()

  for (const item of items) {
    if (!item.material) continue

    const existing = materialMap.get(item.material.id)
    const requiredQty = item.quantity * productionQty

    if (existing) {
      existing.requiredQty += requiredQty
      existing.quantityPerUnit += item.quantity
    } else {
      materialMap.set(item.material.id, {
        materialId: item.material.id,
        materialCode: item.material.code,
        materialName: item.material.name,
        category: item.material.category,
        unit: item.material.unit,
        quantityPerUnit: item.quantity,
        requiredQty,
        processCode: item.processCode || '',
      })
    }
  }

  return Array.from(materialMap.values())
}

/**
 * MBOM 공정별 요약 조회
 */
export async function getMBOMSummaryByProcess(productId: number): Promise<{
  processCode: string
  processName: string
  materialCount: number
  semiProductCount: number
}[]> {
  const bomItems = await prisma.bOM.findMany({
    where: { productId },
    select: {
      processCode: true,
      itemType: true,
    },
  })

  const processes = await prisma.process.findMany({
    where: { isActive: true },
    orderBy: { seq: 'asc' },
  })

  const summaryMap = new Map<string, { materialCount: number; semiProductCount: number }>()

  for (const item of bomItems) {
    const processCode = item.processCode || ''
    const existing = summaryMap.get(processCode) || { materialCount: 0, semiProductCount: 0 }

    if (item.itemType === 'MATERIAL') {
      existing.materialCount++
    } else {
      existing.semiProductCount++
    }

    summaryMap.set(processCode, existing)
  }

  return processes
    .filter((p) => summaryMap.has(p.code))
    .map((p) => ({
      processCode: p.code,
      processName: p.name,
      ...summaryMap.get(p.code)!,
    }))
}

// ============================================
// Bulk Operations
// ============================================

/**
 * 공정에 자재 일괄 등록
 */
export async function addMaterialsToProcess(
  productId: number,
  processCode: string,
  materials: Array<{ materialId: number; quantity: number; unit?: string }>
): Promise<number> {
  const data = materials.map((m) => ({
    productId,
    processCode: processCode.toUpperCase(),
    itemType: 'MATERIAL' as const,
    materialId: m.materialId,
    quantity: m.quantity,
    unit: m.unit,
  }))

  const result = await prisma.bOM.createMany({
    data,
  })

  return result.count
}

/**
 * 공정의 모든 자재 삭제
 */
export async function clearProcessMaterials(
  productId: number,
  processCode: string
): Promise<number> {
  const result = await prisma.bOM.deleteMany({
    where: {
      productId,
      processCode: processCode.toUpperCase(),
      itemType: 'MATERIAL',
    },
  })

  return result.count
}

/**
 * 제품의 모든 MBOM 삭제
 */
export async function clearProductMBOM(productId: number): Promise<number> {
  const result = await prisma.bOM.deleteMany({
    where: { productId },
  })

  return result.count
}

// ============================================
// Validation
// ============================================

/**
 * 공정에 자재 투입 가능 여부 확인
 */
export async function canAddMaterialToProcess(processCode: string): Promise<boolean> {
  const process = await prisma.process.findUnique({
    where: { code: processCode.toUpperCase() },
    select: { hasMaterialInput: true, isActive: true },
  })

  return process?.isActive === true && process?.hasMaterialInput === true
}

/**
 * MBOM 항목 존재 여부 확인
 */
export async function hasMBOM(
  productId: number,
  processCode?: string
): Promise<boolean> {
  const where: Prisma.BOMWhereInput = { productId }

  if (processCode) {
    where.processCode = processCode.toUpperCase()
  }

  const count = await prisma.bOM.count({ where })
  return count > 0
}

/**
 * 공정별 MBOM 항목 수 조회
 */
export async function getMBOMCountByProcess(
  productId: number
): Promise<Record<string, { materials: number; semiProducts: number }>> {
  const items = await prisma.bOM.groupBy({
    by: ['processCode', 'itemType'],
    where: { productId },
    _count: true,
  })

  const result: Record<string, { materials: number; semiProducts: number }> = {}

  for (const item of items) {
    const processCode = item.processCode || 'NONE'
    if (!result[processCode]) {
      result[processCode] = { materials: 0, semiProducts: 0 }
    }

    if (item.itemType === 'MATERIAL') {
      result[processCode].materials = item._count
    } else {
      result[processCode].semiProducts = item._count
    }
  }

  return result
}

// ============================================
// Copy Operations
// ============================================

/**
 * MBOM 복사 (제품 복제 시 사용)
 */
export async function copyMBOM(
  sourceProductId: number,
  targetProductId: number
): Promise<number> {
  const sourceItems = await prisma.bOM.findMany({
    where: { productId: sourceProductId },
  })

  const data = sourceItems.map((item) => ({
    productId: targetProductId,
    itemType: item.itemType,
    materialId: item.materialId,
    childProductId: item.childProductId,
    quantity: item.quantity,
    unit: item.unit,
    processCode: item.processCode,
  }))

  const result = await prisma.bOM.createMany({ data })

  return result.count
}
