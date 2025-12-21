/**
 * Material Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 */

export interface Material {
  id: number
  code: string
  name: string
  spec: string | null
  category: string
  unit: string
  safeStock: number
  isActive: boolean
}

// Mock 자재 데이터 (초기 데이터 없음 - 공장초기화 상태)
const MOCK_MATERIALS: Material[] = []

/**
 * 자재 코드로 조회
 */
export async function getMaterialByCode(code: string): Promise<Material | null> {
  await new Promise((r) => setTimeout(r, 100))
  return MOCK_MATERIALS.find((m) => m.code === code) || null
}

/**
 * 전체 자재 목록 조회
 */
export async function getMaterials(options?: {
  category?: string
  isActive?: boolean
}): Promise<Material[]> {
  await new Promise((r) => setTimeout(r, 100))

  let filtered = [...MOCK_MATERIALS]

  if (options?.category) {
    filtered = filtered.filter((m) => m.category === options.category)
  }

  if (options?.isActive !== undefined) {
    filtered = filtered.filter((m) => m.isActive === options.isActive)
  }

  return filtered
}

/**
 * 자재 생성
 */
export async function createMaterial(data: Omit<Material, 'id'>): Promise<Material> {
  await new Promise((r) => setTimeout(r, 200))

  const newMaterial: Material = {
    id: MOCK_MATERIALS.length + 1,
    ...data,
  }

  MOCK_MATERIALS.push(newMaterial)
  return newMaterial
}

/**
 * 자재 수정
 */
export async function updateMaterial(id: number, data: Partial<Material>): Promise<Material> {
  await new Promise((r) => setTimeout(r, 200))

  const index = MOCK_MATERIALS.findIndex((m) => m.id === id)
  if (index === -1) throw new Error('Material not found')

  MOCK_MATERIALS[index] = { ...MOCK_MATERIALS[index], ...data }
  return MOCK_MATERIALS[index]
}

/**
 * 자재 마스터 데이터 초기화
 */
export function resetMaterialData(): number {
  const count = MOCK_MATERIALS.length
  MOCK_MATERIALS.length = 0
  return count
}
