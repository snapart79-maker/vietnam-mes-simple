/**
 * BOM Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * Phase 4: BOM 기반 자재 소요량 조회
 */

// ============================================
// Types
// ============================================

export type BOMItemType = 'MATERIAL' | 'PRODUCT'

export interface BOMRequirement {
  materialId: number
  materialCode: string
  materialName: string
  unit: string
  quantityPerUnit: number
  processCode: string | null
}

export interface CalculatedRequirement extends BOMRequirement {
  requiredQty: number
}

export interface BOMItem {
  id: number
  productId: number
  itemType: BOMItemType
  materialId?: number
  childProductId?: number
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
  }
}

// ============================================
// Mock Data
// ============================================

// Mock BOM 데이터 (초기 샘플)
const MOCK_BOMS: BOMItem[] = [
  // 제품 1 (ID: 1) - CA 공정용 BOM
  {
    id: 1,
    productId: 1,
    itemType: 'MATERIAL',
    materialId: 1,
    quantity: 2.5,
    unit: 'M',
    processCode: 'CA',
    material: { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' },
  },
  {
    id: 2,
    productId: 1,
    itemType: 'MATERIAL',
    materialId: 2,
    quantity: 2,
    unit: 'EA',
    processCode: 'CA',
    material: { id: 2, code: 'TERMINAL-001', name: '터미널', unit: 'EA' },
  },
  {
    id: 3,
    productId: 1,
    itemType: 'MATERIAL',
    materialId: 3,
    quantity: 1,
    unit: 'EA',
    processCode: 'CA',
    material: { id: 3, code: 'SEAL-001', name: '실', unit: 'EA' },
  },
  // 제품 2 (ID: 2) - MC 공정용 BOM
  {
    id: 4,
    productId: 2,
    itemType: 'MATERIAL',
    materialId: 4,
    quantity: 1,
    unit: 'EA',
    processCode: 'MC',
    material: { id: 4, code: 'CONNECTOR-001', name: '커넥터', unit: 'EA' },
  },
]

// Mock 자재 데이터
const MOCK_MATERIALS: Map<number, { id: number; code: string; name: string; unit: string }> = new Map([
  [1, { id: 1, code: 'WIRE-001', name: '전선', unit: 'M' }],
  [2, { id: 2, code: 'TERMINAL-001', name: '터미널', unit: 'EA' }],
  [3, { id: 3, code: 'SEAL-001', name: '실', unit: 'EA' }],
  [4, { id: 4, code: 'CONNECTOR-001', name: '커넥터', unit: 'EA' }],
])

// ============================================
// BOM CRUD (Mock)
// ============================================

/**
 * 제품별 BOM 조회 (Mock)
 */
export async function getBOMByProduct(productId: number): Promise<BOMItem[]> {
  await new Promise((r) => setTimeout(r, 100))
  return MOCK_BOMS.filter((bom) => bom.productId === productId)
}

/**
 * BOM 항목 추가 (Mock)
 */
export async function createBOMItem(input: {
  productId: number
  itemType: BOMItemType
  materialId?: number
  childProductId?: number
  quantity: number
  unit?: string
  processCode?: string
}): Promise<BOMItem> {
  await new Promise((r) => setTimeout(r, 200))

  const newId = MOCK_BOMS.length + 1
  const material = input.materialId ? MOCK_MATERIALS.get(input.materialId) : undefined

  const newItem: BOMItem = {
    id: newId,
    productId: input.productId,
    itemType: input.itemType,
    materialId: input.materialId,
    childProductId: input.childProductId,
    quantity: input.quantity,
    unit: input.unit || null,
    processCode: input.processCode || null,
    material,
  }

  MOCK_BOMS.push(newItem)
  return newItem
}

/**
 * BOM 항목 삭제 (Mock)
 */
export async function deleteBOMItem(id: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 100))
  const index = MOCK_BOMS.findIndex((bom) => bom.id === id)
  if (index !== -1) {
    MOCK_BOMS.splice(index, 1)
  }
}

// ============================================
// Phase 4: BOM 기반 자재 소요량 조회 (Mock)
// ============================================

/**
 * 제품/공정별 BOM 소요량 조회 (Mock)
 */
export async function getBOMRequirements(
  productId: number,
  processCode?: string
): Promise<BOMRequirement[]> {
  await new Promise((r) => setTimeout(r, 100))

  let items = MOCK_BOMS.filter(
    (bom) => bom.productId === productId && bom.itemType === 'MATERIAL' && bom.material
  )

  if (processCode) {
    items = items.filter((bom) => bom.processCode === processCode.toUpperCase())
  }

  return items.map((bom) => ({
    materialId: bom.materialId!,
    materialCode: bom.material!.code,
    materialName: bom.material!.name,
    unit: bom.material!.unit,
    quantityPerUnit: bom.quantity,
    processCode: bom.processCode,
  }))
}

/**
 * BOM 기반 필요 자재 수량 계산 (Mock)
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
 * BOM 존재 여부 확인 (Mock)
 */
export async function hasBOM(productId: number, processCode?: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 50))

  let items = MOCK_BOMS.filter((bom) => bom.productId === productId)

  if (processCode) {
    items = items.filter((bom) => bom.processCode === processCode.toUpperCase())
  }

  return items.length > 0
}

/**
 * 공정별 BOM 항목 수 조회 (Mock)
 */
export async function getBOMCountByProcess(productId: number): Promise<Record<string, number>> {
  await new Promise((r) => setTimeout(r, 50))

  const items = MOCK_BOMS.filter((bom) => bom.productId === productId)
  const result: Record<string, number> = {}

  for (const item of items) {
    const processCode = item.processCode || 'NONE'
    result[processCode] = (result[processCode] || 0) + 1
  }

  return result
}

/**
 * Mock BOM 데이터 초기화
 */
export function resetBOMData(): number {
  const count = MOCK_BOMS.length
  MOCK_BOMS.length = 0
  return count
}

/**
 * Mock BOM 데이터 추가 (테스트용)
 */
export function addMockBOM(bom: BOMItem): void {
  MOCK_BOMS.push(bom)
}

/**
 * Mock 자재 데이터 추가 (테스트용)
 */
export function addMockMaterial(material: { id: number; code: string; name: string; unit: string }): void {
  MOCK_MATERIALS.set(material.id, material)
}
