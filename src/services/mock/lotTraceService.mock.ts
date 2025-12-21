/**
 * LOT Trace Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 */

export type NodeType = 'PRODUCTION_LOT' | 'MATERIAL_LOT' | 'BUNDLE_LOT'
export type NodeStatus = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_FOUND'

export interface TraceNode {
  id: number
  lotNumber: string
  processCode: string
  productCode?: string
  productName?: string
  materialCode?: string
  materialName?: string
  quantity: number
  date: string
  type: NodeType
  status: NodeStatus
  depth: number
  children: TraceNode[]
}

export interface TraceResult {
  rootNode: TraceNode
  totalNodes: number
  maxDepth: number
  direction: 'BACKWARD' | 'FORWARD'
  found: boolean
  path: string[]
}

/**
 * 역방향 추적 (하위 → 상위)
 */
export async function traceBackward(lotNumber: string): Promise<TraceResult> {
  await new Promise((r) => setTimeout(r, 300))

  // Mock 추적 결과
  const mockNode: TraceNode = {
    id: 1,
    lotNumber,
    processCode: 'PA',
    productCode: 'P001',
    productName: '와이어하네스 A',
    quantity: 100,
    date: '241220',
    type: 'PRODUCTION_LOT',
    status: 'COMPLETED',
    depth: 0,
    children: [
      {
        id: 2,
        lotNumber: 'CAP001Q50-C241220-0001',
        processCode: 'CA',
        productCode: 'P001',
        productName: '와이어 서브',
        quantity: 50,
        date: '241220',
        type: 'PRODUCTION_LOT',
        status: 'COMPLETED',
        depth: 1,
        children: [
          {
            id: 3,
            lotNumber: 'MO-MAT-001-L001',
            processCode: 'MO',
            materialCode: 'MAT-001',
            materialName: '전선 2.5mm',
            quantity: 100,
            date: '241219',
            type: 'MATERIAL_LOT',
            status: 'COMPLETED',
            depth: 2,
            children: [],
          },
        ],
      },
      {
        id: 4,
        lotNumber: 'CAP001Q50-C241220-0002',
        processCode: 'CA',
        productCode: 'P001',
        productName: '와이어 서브',
        quantity: 50,
        date: '241220',
        type: 'PRODUCTION_LOT',
        status: 'COMPLETED',
        depth: 1,
        children: [],
      },
    ],
  }

  return {
    rootNode: mockNode,
    totalNodes: 4,
    maxDepth: 2,
    direction: 'BACKWARD',
    found: true,
    path: [lotNumber, 'CAP001Q50-C241220-0001', 'MO-MAT-001-L001'],
  }
}

/**
 * 정방향 추적 (상위 → 하위)
 */
export async function traceForward(lotNumber: string): Promise<TraceResult> {
  await new Promise((r) => setTimeout(r, 300))

  const mockNode: TraceNode = {
    id: 1,
    lotNumber,
    processCode: 'MO',
    materialCode: 'MAT-001',
    materialName: '전선 2.5mm',
    quantity: 200,
    date: '241219',
    type: 'MATERIAL_LOT',
    status: 'COMPLETED',
    depth: 0,
    children: [
      {
        id: 2,
        lotNumber: 'CAP001Q100-C241220-0001',
        processCode: 'CA',
        productCode: 'P001',
        productName: '와이어 서브',
        quantity: 100,
        date: '241220',
        type: 'PRODUCTION_LOT',
        status: 'COMPLETED',
        depth: 1,
        children: [
          {
            id: 3,
            lotNumber: 'PAP001Q100-A241220-0001',
            processCode: 'PA',
            productCode: 'P001-F',
            productName: '와이어하네스 A (완제품)',
            quantity: 100,
            date: '241220',
            type: 'PRODUCTION_LOT',
            status: 'COMPLETED',
            depth: 2,
            children: [],
          },
        ],
      },
    ],
  }

  return {
    rootNode: mockNode,
    totalNodes: 3,
    maxDepth: 2,
    direction: 'FORWARD',
    found: true,
    path: [lotNumber, 'CAP001Q100-C241220-0001', 'PAP001Q100-A241220-0001'],
  }
}

/**
 * 트리를 평탄화 (TraceResult 또는 TraceNode 받기)
 */
export function flattenTraceTree(input: TraceResult | TraceNode | null): TraceNode[] {
  if (!input) return []

  // TraceResult인 경우 rootNode 사용
  const node: TraceNode = 'rootNode' in input ? input.rootNode : input

  const result: TraceNode[] = [node]
  for (const child of node.children) {
    result.push(...flattenTraceTree(child))
  }
  return result
}

/**
 * LOT별 투입 자재 조회 (Mock)
 */
export async function getLotInputMaterials(lotNumber: string): Promise<Array<{
  materialCode: string
  materialName: string
  materialLotNo: string
  quantity: number
  inputTime: Date
}>> {
  await new Promise((r) => setTimeout(r, 200))

  return [
    {
      materialCode: 'MAT-001',
      materialName: '전선 2.5mm',
      materialLotNo: 'MAT-001-L20241220-001',
      quantity: 50,
      inputTime: new Date(Date.now() - 3600000),
    },
    {
      materialCode: 'MAT-002',
      materialName: '터미널 Ring',
      materialLotNo: 'MAT-002-L20241220-001',
      quantity: 100,
      inputTime: new Date(Date.now() - 3000000),
    },
  ]
}
