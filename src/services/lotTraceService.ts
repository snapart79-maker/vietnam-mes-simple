/**
 * LOT Trace Service
 *
 * 생산 LOT 추적 서비스
 * - 정방향 추적: 자재 → 완제품
 * - 역방향 추적: 완제품 → 자재
 * - 트리 구조 시각화
 */
import { prisma } from '../lib/prisma'
import type { ProductionLot, LotMaterial, Material, Product } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface TraceNode {
  id: number
  lotNumber: string
  processCode: string
  type: 'PRODUCTION_LOT' | 'MATERIAL_LOT'
  productCode?: string
  productName?: string
  materialCode?: string
  materialName?: string
  quantity: number
  status: string
  date: Date
  depth: number
  children: TraceNode[]
}

export interface TraceResult {
  rootNode: TraceNode
  totalNodes: number
  maxDepth: number
  direction: 'FORWARD' | 'BACKWARD'
  tracedAt: Date
}

export interface TraceSummary {
  lotNumber: string
  direction: 'FORWARD' | 'BACKWARD'
  productionLots: Array<{
    lotNumber: string
    processCode: string
    productCode: string
    quantity: number
  }>
  materialLots: Array<{
    lotNumber: string
    materialCode: string
    materialName: string
    quantity: number
  }>
  totalProductionLots: number
  totalMaterialLots: number
}

// Prisma types with relations
type ProductionLotWithRelations = ProductionLot & {
  product: Product | null
  lotMaterials: (LotMaterial & { material: Material })[]
  childLots: ProductionLotWithRelations[]
  parentLot: ProductionLotWithRelations | null
}

// ============================================
// Forward Tracing (Material → Products)
// ============================================

/**
 * 정방향 추적: 특정 자재 LOT가 투입된 모든 생산 LOT 추적
 *
 * @param materialLotNo 자재 LOT 번호
 * @param maxDepth 최대 추적 깊이 (기본: 10)
 */
export async function traceForward(
  materialLotNo: string,
  maxDepth: number = 10
): Promise<TraceResult> {
  // 1. 해당 자재가 투입된 직접 LOT들 조회
  const directLots = await prisma.lotMaterial.findMany({
    where: { materialLotNo },
    include: {
      productionLot: {
        include: {
          product: true,
          childLots: {
            include: {
              product: true,
            },
          },
        },
      },
      material: true,
    },
  })

  if (directLots.length === 0) {
    // 자재 정보 조회 시도
    const material = await prisma.material.findFirst({
      where: {
        OR: [
          { code: materialLotNo },
          { stocks: { some: { lotNumber: materialLotNo } } },
        ],
      },
    })

    const rootNode: TraceNode = {
      id: 0,
      lotNumber: materialLotNo,
      processCode: 'MATERIAL',
      type: 'MATERIAL_LOT',
      materialCode: material?.code,
      materialName: material?.name,
      quantity: 0,
      status: 'NOT_FOUND',
      date: new Date(),
      depth: 0,
      children: [],
    }

    return {
      rootNode,
      totalNodes: 1,
      maxDepth: 0,
      direction: 'FORWARD',
      tracedAt: new Date(),
    }
  }

  // 2. 루트 노드 생성 (자재 LOT)
  const firstLot = directLots[0]
  const rootNode: TraceNode = {
    id: 0,
    lotNumber: materialLotNo,
    processCode: 'MATERIAL',
    type: 'MATERIAL_LOT',
    materialCode: firstLot.material.code,
    materialName: firstLot.material.name,
    quantity: directLots.reduce((sum, l) => sum + l.quantity, 0),
    status: 'TRACED',
    date: firstLot.createdAt,
    depth: 0,
    children: [],
  }

  // 3. 직접 생산 LOT들을 자식으로 추가
  let nodeCount = 1
  let actualMaxDepth = 0

  for (const lotMaterial of directLots) {
    const prodLot = lotMaterial.productionLot
    const childNode = await buildForwardTree(prodLot as ProductionLotWithRelations, 1, maxDepth)
    rootNode.children.push(childNode.node)
    nodeCount += childNode.count
    actualMaxDepth = Math.max(actualMaxDepth, childNode.depth)
  }

  return {
    rootNode,
    totalNodes: nodeCount,
    maxDepth: actualMaxDepth,
    direction: 'FORWARD',
    tracedAt: new Date(),
  }
}

/**
 * 정방향 트리 재귀 구축
 */
async function buildForwardTree(
  lot: ProductionLotWithRelations,
  currentDepth: number,
  maxDepth: number
): Promise<{ node: TraceNode; count: number; depth: number }> {
  const node: TraceNode = {
    id: lot.id,
    lotNumber: lot.lotNumber,
    processCode: lot.processCode,
    type: 'PRODUCTION_LOT',
    productCode: lot.product?.code,
    productName: lot.product?.name,
    quantity: lot.completedQty,
    status: lot.status,
    date: lot.startedAt,
    depth: currentDepth,
    children: [],
  }

  let count = 1
  let depth = currentDepth

  // 깊이 제한 확인
  if (currentDepth >= maxDepth) {
    return { node, count, depth }
  }

  // 자식 LOT들 조회 (이 LOT를 자재로 사용한 LOT들)
  // parentLotId를 통해 연결된 하위 LOT들
  const childLots = await prisma.productionLot.findMany({
    where: { parentLotId: lot.id },
    include: {
      product: true,
      childLots: true,
    },
  })

  for (const childLot of childLots) {
    const result = await buildForwardTree(
      childLot as ProductionLotWithRelations,
      currentDepth + 1,
      maxDepth
    )
    node.children.push(result.node)
    count += result.count
    depth = Math.max(depth, result.depth)
  }

  return { node, count, depth }
}

// ============================================
// Backward Tracing (Products → Materials)
// ============================================

/**
 * 역방향 추적: 특정 생산 LOT에 투입된 모든 자재/반제품 추적
 *
 * @param lotNumber 생산 LOT 번호
 * @param maxDepth 최대 추적 깊이 (기본: 10)
 */
export async function traceBackward(
  lotNumber: string,
  maxDepth: number = 10
): Promise<TraceResult> {
  // 1. 생산 LOT 조회
  const productionLot = await prisma.productionLot.findUnique({
    where: { lotNumber },
    include: {
      product: true,
      lotMaterials: {
        include: { material: true },
      },
      parentLot: {
        include: {
          product: true,
          lotMaterials: {
            include: { material: true },
          },
        },
      },
    },
  })

  if (!productionLot) {
    const rootNode: TraceNode = {
      id: 0,
      lotNumber,
      processCode: 'UNKNOWN',
      type: 'PRODUCTION_LOT',
      quantity: 0,
      status: 'NOT_FOUND',
      date: new Date(),
      depth: 0,
      children: [],
    }

    return {
      rootNode,
      totalNodes: 1,
      maxDepth: 0,
      direction: 'BACKWARD',
      tracedAt: new Date(),
    }
  }

  // 2. 루트 노드 생성
  const rootNode: TraceNode = {
    id: productionLot.id,
    lotNumber: productionLot.lotNumber,
    processCode: productionLot.processCode,
    type: 'PRODUCTION_LOT',
    productCode: productionLot.product?.code,
    productName: productionLot.product?.name,
    quantity: productionLot.completedQty,
    status: productionLot.status,
    date: productionLot.startedAt,
    depth: 0,
    children: [],
  }

  // 3. 역방향 트리 구축
  const result = await buildBackwardTree(
    productionLot as ProductionLotWithRelations,
    rootNode,
    1,
    maxDepth
  )

  return {
    rootNode,
    totalNodes: result.count + 1,
    maxDepth: result.depth,
    direction: 'BACKWARD',
    tracedAt: new Date(),
  }
}

/**
 * 역방향 트리 재귀 구축
 */
async function buildBackwardTree(
  lot: ProductionLotWithRelations,
  node: TraceNode,
  currentDepth: number,
  maxDepth: number
): Promise<{ count: number; depth: number }> {
  let count = 0
  let depth = currentDepth

  // 깊이 제한 확인
  if (currentDepth > maxDepth) {
    return { count, depth: currentDepth - 1 }
  }

  // 1. 직접 투입된 자재 LOT들 추가
  for (const lotMaterial of lot.lotMaterials) {
    const materialNode: TraceNode = {
      id: lotMaterial.id,
      lotNumber: lotMaterial.materialLotNo,
      processCode: 'MATERIAL',
      type: 'MATERIAL_LOT',
      materialCode: lotMaterial.material.code,
      materialName: lotMaterial.material.name,
      quantity: lotMaterial.quantity,
      status: 'USED',
      date: lotMaterial.createdAt,
      depth: currentDepth,
      children: [],
    }
    node.children.push(materialNode)
    count++
  }

  // 2. 부모 LOT 추적 (반제품으로 사용된 경우)
  if (lot.parentLotId) {
    const parentLot = await prisma.productionLot.findUnique({
      where: { id: lot.parentLotId },
      include: {
        product: true,
        lotMaterials: {
          include: { material: true },
        },
      },
    })

    if (parentLot) {
      const parentNode: TraceNode = {
        id: parentLot.id,
        lotNumber: parentLot.lotNumber,
        processCode: parentLot.processCode,
        type: 'PRODUCTION_LOT',
        productCode: parentLot.product?.code,
        productName: parentLot.product?.name,
        quantity: parentLot.completedQty,
        status: parentLot.status,
        date: parentLot.startedAt,
        depth: currentDepth,
        children: [],
      }

      node.children.push(parentNode)
      count++

      // 부모 LOT도 재귀적으로 추적
      const result = await buildBackwardTree(
        parentLot as ProductionLotWithRelations,
        parentNode,
        currentDepth + 1,
        maxDepth
      )
      count += result.count
      depth = Math.max(depth, result.depth)
    }
  }

  return { count, depth }
}

// ============================================
// Combined Trace
// ============================================

/**
 * 양방향 추적 트리 생성
 */
export async function buildTraceTree(
  lotNumber: string,
  direction: 'FORWARD' | 'BACKWARD' | 'BOTH',
  maxDepth: number = 10
): Promise<TraceResult | { forward: TraceResult; backward: TraceResult }> {
  if (direction === 'BOTH') {
    const [forward, backward] = await Promise.all([
      traceForward(lotNumber, maxDepth),
      traceBackward(lotNumber, maxDepth),
    ])
    return { forward, backward }
  }

  if (direction === 'FORWARD') {
    return traceForward(lotNumber, maxDepth)
  }

  return traceBackward(lotNumber, maxDepth)
}

// ============================================
// Summary Functions
// ============================================

/**
 * 추적 결과 요약
 */
export function getTraceSummary(result: TraceResult): TraceSummary {
  const productionLots: TraceSummary['productionLots'] = []
  const materialLots: TraceSummary['materialLots'] = []

  function traverse(node: TraceNode) {
    if (node.type === 'PRODUCTION_LOT' && node.status !== 'NOT_FOUND') {
      productionLots.push({
        lotNumber: node.lotNumber,
        processCode: node.processCode,
        productCode: node.productCode || '',
        quantity: node.quantity,
      })
    } else if (node.type === 'MATERIAL_LOT') {
      materialLots.push({
        lotNumber: node.lotNumber,
        materialCode: node.materialCode || '',
        materialName: node.materialName || '',
        quantity: node.quantity,
      })
    }

    for (const child of node.children) {
      traverse(child)
    }
  }

  traverse(result.rootNode)

  return {
    lotNumber: result.rootNode.lotNumber,
    direction: result.direction,
    productionLots,
    materialLots,
    totalProductionLots: productionLots.length,
    totalMaterialLots: materialLots.length,
  }
}

/**
 * 특정 자재가 사용된 모든 완제품 LOT 조회 (간단한 버전)
 */
export async function findProductsByMaterial(materialLotNo: string): Promise<Array<{
  lotNumber: string
  processCode: string
  productCode: string | null
  productName: string | null
  quantity: number
  date: Date
}>> {
  const lotMaterials = await prisma.lotMaterial.findMany({
    where: { materialLotNo },
    include: {
      productionLot: {
        include: {
          product: true,
        },
      },
    },
  })

  return lotMaterials.map((lm) => ({
    lotNumber: lm.productionLot.lotNumber,
    processCode: lm.productionLot.processCode,
    productCode: lm.productionLot.product?.code ?? null,
    productName: lm.productionLot.product?.name ?? null,
    quantity: lm.quantity,
    date: lm.productionLot.startedAt,
  }))
}

/**
 * 특정 완제품 LOT에 사용된 모든 자재 조회 (간단한 버전)
 */
export async function findMaterialsByProduct(lotNumber: string): Promise<Array<{
  materialLotNo: string
  materialCode: string
  materialName: string
  quantity: number
  date: Date
}>> {
  const lot = await prisma.productionLot.findUnique({
    where: { lotNumber },
    include: {
      lotMaterials: {
        include: {
          material: true,
        },
      },
    },
  })

  if (!lot) return []

  return lot.lotMaterials.map((lm) => ({
    materialLotNo: lm.materialLotNo,
    materialCode: lm.material.code,
    materialName: lm.material.name,
    quantity: lm.quantity,
    date: lm.createdAt,
  }))
}

// ============================================
// Visualization Helpers
// ============================================

/**
 * 트리 노드를 D3/React-Flow 호환 형식으로 변환
 */
export function toVisualizationData(result: TraceResult): {
  nodes: Array<{
    id: string
    data: {
      label: string
      type: string
      processCode: string
      quantity: number
      status: string
    }
    position: { x: number; y: number }
  }>
  edges: Array<{
    id: string
    source: string
    target: string
  }>
} {
  const nodes: ReturnType<typeof toVisualizationData>['nodes'] = []
  const edges: ReturnType<typeof toVisualizationData>['edges'] = []

  function traverse(node: TraceNode, x: number, y: number) {
    const nodeId = `${node.type}-${node.id}-${node.lotNumber}`

    nodes.push({
      id: nodeId,
      data: {
        label: node.lotNumber,
        type: node.type,
        processCode: node.processCode,
        quantity: node.quantity,
        status: node.status,
      },
      position: { x, y },
    })

    const childWidth = 200
    let childX = x - ((node.children.length - 1) * childWidth) / 2

    for (const child of node.children) {
      const childId = `${child.type}-${child.id}-${child.lotNumber}`
      edges.push({
        id: `edge-${nodeId}-${childId}`,
        source: nodeId,
        target: childId,
      })

      traverse(child, childX, y + 100)
      childX += childWidth
    }
  }

  traverse(result.rootNode, 400, 50)

  return { nodes, edges }
}

/**
 * 트리를 플랫 배열로 변환
 */
export function flattenTraceTree(result: TraceResult): TraceNode[] {
  const flatList: TraceNode[] = []

  function traverse(node: TraceNode) {
    flatList.push({ ...node, children: [] })
    for (const child of node.children) {
      traverse(child)
    }
  }

  traverse(result.rootNode)

  return flatList
}
