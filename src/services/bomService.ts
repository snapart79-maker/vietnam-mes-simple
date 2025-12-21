/**
 * BOM Service
 *
 * Bill of Materials 관리 서비스
 * - BOM CRUD
 * - 다단계 BOM 조회
 * - BOM 트리 시각화
 */
import { prisma } from '../lib/prisma'
import { BOMItemType, Prisma } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface CreateBOMInput {
  productId: number
  itemType: BOMItemType
  materialId?: number
  childProductId?: number
  quantity: number
  unit?: string
  processCode?: string
}

export interface UpdateBOMInput {
  quantity?: number
  unit?: string
  processCode?: string
}

export interface BOMItem {
  id: number
  itemType: BOMItemType
  quantity: number
  unit: string | null
  processCode: string | null
  material?: {
    id: number
    code: string
    name: string
    unit: string
  }
  childProduct?: {
    id: number
    code: string
    name: string
    type: string
  }
}

export interface BOMTreeNode {
  id: number
  code: string
  name: string
  type: 'PRODUCT' | 'MATERIAL'
  quantity: number
  unit: string
  depth: number
  children: BOMTreeNode[]
}

export interface BOMWithProduct {
  id: number
  productId: number
  product: {
    code: string
    name: string
    type: string
  }
  items: BOMItem[]
}

// ============================================
// CRUD Operations
// ============================================

/**
 * BOM 항목 생성
 */
export async function createBOMItem(input: CreateBOMInput) {
  // 유효성 검사
  if (input.itemType === 'MATERIAL' && !input.materialId) {
    throw new Error('자재 BOM은 materialId가 필요합니다.')
  }
  if (input.itemType === 'PRODUCT' && !input.childProductId) {
    throw new Error('반제품 BOM은 childProductId가 필요합니다.')
  }

  return prisma.bOM.create({
    data: {
      productId: input.productId,
      itemType: input.itemType,
      materialId: input.materialId,
      childProductId: input.childProductId,
      quantity: input.quantity,
      unit: input.unit,
      processCode: input.processCode,
    },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true },
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  })
}

/**
 * BOM 항목 수정
 */
export async function updateBOMItem(id: number, input: UpdateBOMInput) {
  return prisma.bOM.update({
    where: { id },
    data: input,
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true },
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  })
}

/**
 * BOM 항목 삭제
 */
export async function deleteBOMItem(id: number): Promise<void> {
  await prisma.bOM.delete({
    where: { id },
  })
}

/**
 * 제품의 모든 BOM 삭제
 */
export async function deleteProductBOM(productId: number): Promise<void> {
  await prisma.bOM.deleteMany({
    where: { productId },
  })
}

// ============================================
// Query Operations
// ============================================

/**
 * 제품별 BOM 조회
 */
export async function getBOMByProduct(productId: number): Promise<BOMItem[]> {
  const items = await prisma.bOM.findMany({
    where: { productId },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true },
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
    itemType: item.itemType,
    quantity: item.quantity,
    unit: item.unit,
    processCode: item.processCode,
    material: item.material || undefined,
    childProduct: item.childProduct || undefined,
  }))
}

/**
 * 제품 코드로 BOM 조회
 */
export async function getBOMByProductCode(productCode: string): Promise<BOMItem[]> {
  const product = await prisma.product.findUnique({
    where: { code: productCode },
    select: { id: true },
  })

  if (!product) return []

  return getBOMByProduct(product.id)
}

/**
 * BOM 트리 조회 (다단계, 재귀)
 */
export async function getBOMTree(
  productId: number,
  maxDepth: number = 10
): Promise<BOMTreeNode | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, code: true, name: true },
  })

  if (!product) return null

  const rootNode: BOMTreeNode = {
    id: product.id,
    code: product.code,
    name: product.name,
    type: 'PRODUCT',
    quantity: 1,
    unit: 'EA',
    depth: 0,
    children: [],
  }

  await buildBOMTree(rootNode, 1, maxDepth)

  return rootNode
}

/**
 * BOM 트리 재귀 구축
 */
async function buildBOMTree(
  node: BOMTreeNode,
  currentDepth: number,
  maxDepth: number
): Promise<void> {
  if (currentDepth > maxDepth) return
  if (node.type !== 'PRODUCT') return

  const bomItems = await prisma.bOM.findMany({
    where: { productId: node.id },
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true },
      },
      childProduct: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  })

  for (const item of bomItems) {
    if (item.itemType === 'MATERIAL' && item.material) {
      node.children.push({
        id: item.material.id,
        code: item.material.code,
        name: item.material.name,
        type: 'MATERIAL',
        quantity: item.quantity,
        unit: item.unit || item.material.unit,
        depth: currentDepth,
        children: [],
      })
    } else if (item.itemType === 'PRODUCT' && item.childProduct) {
      const childNode: BOMTreeNode = {
        id: item.childProduct.id,
        code: item.childProduct.code,
        name: item.childProduct.name,
        type: 'PRODUCT',
        quantity: item.quantity,
        unit: item.unit || 'EA',
        depth: currentDepth,
        children: [],
      }

      // 재귀적으로 하위 BOM 구축
      await buildBOMTree(childNode, currentDepth + 1, maxDepth)
      node.children.push(childNode)
    }
  }
}

/**
 * BOM 트리를 플랫 배열로 변환
 */
export function flattenBOMTree(tree: BOMTreeNode): Array<{
  code: string
  name: string
  type: string
  quantity: number
  unit: string
  depth: number
  path: string
}> {
  const result: ReturnType<typeof flattenBOMTree> = []

  function traverse(node: BOMTreeNode, path: string) {
    const currentPath = path ? `${path} > ${node.code}` : node.code

    result.push({
      code: node.code,
      name: node.name,
      type: node.type,
      quantity: node.quantity,
      unit: node.unit,
      depth: node.depth,
      path: currentPath,
    })

    for (const child of node.children) {
      traverse(child, currentPath)
    }
  }

  traverse(tree, '')

  return result
}

/**
 * 특정 자재가 사용된 제품 조회 (Where-Used)
 */
export async function getWhereUsed(
  materialId: number
): Promise<Array<{ product: { id: number; code: string; name: string }; quantity: number }>> {
  const items = await prisma.bOM.findMany({
    where: {
      materialId,
      itemType: 'MATERIAL',
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
    },
  })

  return items.map((item) => ({
    product: item.product,
    quantity: item.quantity,
  }))
}

/**
 * 특정 반제품이 사용된 제품 조회
 */
export async function getProductWhereUsed(
  childProductId: number
): Promise<Array<{ product: { id: number; code: string; name: string }; quantity: number }>> {
  const items = await prisma.bOM.findMany({
    where: {
      childProductId,
      itemType: 'PRODUCT',
    },
    include: {
      product: {
        select: { id: true, code: true, name: true },
      },
    },
  })

  return items.map((item) => ({
    product: item.product,
    quantity: item.quantity,
  }))
}

/**
 * BOM 복사 (제품 복제 시 사용)
 */
export async function copyBOM(
  sourceProductId: number,
  targetProductId: number
): Promise<void> {
  const sourceItems = await prisma.bOM.findMany({
    where: { productId: sourceProductId },
  })

  for (const item of sourceItems) {
    await prisma.bOM.create({
      data: {
        productId: targetProductId,
        itemType: item.itemType,
        materialId: item.materialId,
        childProductId: item.childProductId,
        quantity: item.quantity,
        unit: item.unit,
        processCode: item.processCode,
      },
    })
  }
}

/**
 * BOM 유효성 검사 (순환 참조 체크)
 */
export async function validateBOM(
  productId: number,
  childProductId: number
): Promise<{ valid: boolean; error?: string }> {
  // 자기 자신 참조 체크
  if (productId === childProductId) {
    return { valid: false, error: '자기 자신을 BOM에 추가할 수 없습니다.' }
  }

  // 순환 참조 체크
  const visited = new Set<number>()

  async function checkCircular(currentId: number): Promise<boolean> {
    if (currentId === productId) return true
    if (visited.has(currentId)) return false

    visited.add(currentId)

    const items = await prisma.bOM.findMany({
      where: {
        productId: currentId,
        itemType: 'PRODUCT',
      },
      select: { childProductId: true },
    })

    for (const item of items) {
      if (item.childProductId && await checkCircular(item.childProductId)) {
        return true
      }
    }

    return false
  }

  const hasCircular = await checkCircular(childProductId)

  if (hasCircular) {
    return { valid: false, error: '순환 참조가 발생합니다.' }
  }

  return { valid: true }
}

// ============================================
// Phase 4: BOM 기반 자재 소요량 조회
// ============================================

/**
 * BOM 소요량 정보
 */
export interface BOMRequirement {
  materialId: number
  materialCode: string
  materialName: string
  unit: string
  quantityPerUnit: number
  processCode: string | null
}

/**
 * 계산된 자재 소요량
 */
export interface CalculatedRequirement {
  materialId: number
  materialCode: string
  materialName: string
  unit: string
  quantityPerUnit: number
  requiredQty: number
  processCode: string | null
}

/**
 * 제품/공정별 BOM 소요량 조회
 *
 * @param productId 제품 ID
 * @param processCode 공정 코드 (옵션, 없으면 전체 조회)
 * @returns 필요 자재 목록
 */
export async function getBOMRequirements(
  productId: number,
  processCode?: string
): Promise<BOMRequirement[]> {
  const where: Prisma.BOMWhereInput = {
    productId,
    itemType: 'MATERIAL',
    materialId: { not: null },
  }

  if (processCode) {
    where.processCode = processCode.toUpperCase()
  }

  const items = await prisma.bOM.findMany({
    where,
    include: {
      material: {
        select: { id: true, code: true, name: true, unit: true },
      },
    },
  })

  return items
    .filter((item) => item.material !== null)
    .map((item) => ({
      materialId: item.material!.id,
      materialCode: item.material!.code,
      materialName: item.material!.name,
      unit: item.material!.unit,
      quantityPerUnit: item.quantity,
      processCode: item.processCode,
    }))
}

/**
 * BOM 기반 필요 자재 수량 계산
 *
 * @param productId 제품 ID
 * @param processCode 공정 코드
 * @param productionQty 생산 수량
 * @returns 필요 자재 및 수량 목록
 */
export async function calculateRequiredMaterials(
  productId: number,
  processCode: string,
  productionQty: number
): Promise<CalculatedRequirement[]> {
  const requirements = await getBOMRequirements(productId, processCode)

  return requirements.map((req) => ({
    ...req,
    requiredQty: req.quantityPerUnit * productionQty,
  }))
}

/**
 * 다단계 BOM 전개 (모든 자재 수집)
 *
 * 하위 반제품의 BOM까지 재귀적으로 전개하여
 * 최종적으로 필요한 모든 원자재 목록 반환
 *
 * @param productId 제품 ID
 * @param productionQty 생산 수량
 * @param maxDepth 최대 전개 깊이
 * @returns 전개된 자재 목록 (materialId 기준 합산)
 */
export async function explodeBOM(
  productId: number,
  productionQty: number,
  maxDepth: number = 10
): Promise<Map<number, CalculatedRequirement>> {
  const materialMap = new Map<number, CalculatedRequirement>()

  async function explode(currentProductId: number, qty: number, depth: number) {
    if (depth > maxDepth) return

    const items = await prisma.bOM.findMany({
      where: { productId: currentProductId },
      include: {
        material: {
          select: { id: true, code: true, name: true, unit: true },
        },
        childProduct: {
          select: { id: true, code: true, name: true },
        },
      },
    })

    for (const item of items) {
      if (item.itemType === 'MATERIAL' && item.material) {
        const materialId = item.material.id
        const requiredQty = item.quantity * qty

        const existing = materialMap.get(materialId)
        if (existing) {
          existing.requiredQty += requiredQty
        } else {
          materialMap.set(materialId, {
            materialId,
            materialCode: item.material.code,
            materialName: item.material.name,
            unit: item.material.unit,
            quantityPerUnit: item.quantity,
            requiredQty,
            processCode: item.processCode,
          })
        }
      } else if (item.itemType === 'PRODUCT' && item.childProduct) {
        // 하위 반제품 재귀 전개
        await explode(item.childProduct.id, item.quantity * qty, depth + 1)
      }
    }
  }

  await explode(productId, productionQty, 1)

  return materialMap
}

/**
 * BOM 존재 여부 확인
 *
 * @param productId 제품 ID
 * @param processCode 공정 코드 (옵션)
 * @returns BOM 존재 여부
 */
export async function hasBOM(
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
 * 공정별 BOM 항목 수 조회
 *
 * @param productId 제품 ID
 * @returns 공정별 항목 수
 */
export async function getBOMCountByProcess(
  productId: number
): Promise<Record<string, number>> {
  const items = await prisma.bOM.groupBy({
    by: ['processCode'],
    where: { productId },
    _count: true,
  })

  const result: Record<string, number> = {}
  for (const item of items) {
    const processCode = item.processCode || 'NONE'
    result[processCode] = item._count
  }

  return result
}
