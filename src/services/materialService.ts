/**
 * Material Service
 *
 * 자재 마스터 관리 서비스
 */
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface CreateMaterialInput {
  code: string
  name: string
  spec?: string
  category: string
  unit: string
  safeStock?: number
  description?: string
}

export interface UpdateMaterialInput {
  name?: string
  spec?: string
  category?: string
  unit?: string
  safeStock?: number
  description?: string
  isActive?: boolean
}

export interface MaterialWithStock {
  id: number
  code: string
  name: string
  spec: string | null
  category: string
  unit: string
  safeStock: number
  description: string | null
  isActive: boolean
  totalStock: number
  stockStatus: 'good' | 'warning' | 'danger' | 'exhausted'
}

// ============================================
// CRUD Operations
// ============================================

/**
 * 자재 생성
 */
export async function createMaterial(input: CreateMaterialInput) {
  return prisma.material.create({
    data: {
      code: input.code,
      name: input.name,
      spec: input.spec,
      category: input.category,
      unit: input.unit,
      safeStock: input.safeStock || 0,
      description: input.description,
    },
  })
}

/**
 * 자재 조회 (ID)
 */
export async function getMaterialById(id: number) {
  return prisma.material.findUnique({
    where: { id },
    include: {
      stocks: true,
      _count: {
        select: {
          lotMaterials: true,
          bomItems: true,
        },
      },
    },
  })
}

/**
 * 자재 조회 (코드)
 */
export async function getMaterialByCode(code: string) {
  return prisma.material.findUnique({
    where: { code },
    include: {
      stocks: true,
    },
  })
}

/**
 * 자재 수정
 */
export async function updateMaterial(id: number, input: UpdateMaterialInput) {
  return prisma.material.update({
    where: { id },
    data: input,
  })
}

/**
 * 자재 삭제 (소프트 삭제)
 */
export async function deleteMaterial(id: number): Promise<void> {
  await prisma.material.update({
    where: { id },
    data: { isActive: false },
  })
}

// ============================================
// Query Operations
// ============================================

/**
 * 전체 자재 목록 조회
 */
export async function getAllMaterials(options?: {
  category?: string
  isActive?: boolean
  search?: string
}) {
  const { category, isActive = true, search } = options || {}

  const where: Prisma.MaterialWhereInput = {}

  if (isActive !== undefined) {
    where.isActive = isActive
  }

  if (category) {
    where.category = category
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ]
  }

  return prisma.material.findMany({
    where,
    include: {
      _count: {
        select: {
          stocks: true,
          lotMaterials: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  })
}

/**
 * 자재 + 재고 정보 조회
 */
export async function getMaterialsWithStock(): Promise<MaterialWithStock[]> {
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
    const totalStock = mat.stocks.reduce(
      (sum, s) => sum + (s.quantity - s.usedQty),
      0
    )

    let stockStatus: MaterialWithStock['stockStatus'] = 'good'
    if (totalStock === 0) {
      stockStatus = 'exhausted'
    } else if (totalStock < mat.safeStock * 0.3) {
      stockStatus = 'danger'
    } else if (totalStock < mat.safeStock) {
      stockStatus = 'warning'
    }

    return {
      id: mat.id,
      code: mat.code,
      name: mat.name,
      spec: mat.spec,
      category: mat.category,
      unit: mat.unit,
      safeStock: mat.safeStock,
      description: mat.description,
      isActive: mat.isActive,
      totalStock,
      stockStatus,
    }
  })
}

/**
 * 카테고리별 자재 조회
 */
export async function getMaterialsByCategory(category: string) {
  return getAllMaterials({ category })
}

/**
 * 재고 부족 자재 조회
 */
export async function getLowStockMaterials(): Promise<MaterialWithStock[]> {
  const materialsWithStock = await getMaterialsWithStock()
  return materialsWithStock.filter(
    (m) => m.stockStatus === 'warning' || m.stockStatus === 'danger'
  )
}

/**
 * 재고 소진 자재 조회
 */
export async function getExhaustedMaterials(): Promise<MaterialWithStock[]> {
  const materialsWithStock = await getMaterialsWithStock()
  return materialsWithStock.filter((m) => m.stockStatus === 'exhausted')
}

/**
 * 자재 검색
 */
export async function searchMaterials(query: string) {
  return getAllMaterials({ search: query })
}

/**
 * 카테고리 목록 조회
 */
export async function getCategories(): Promise<string[]> {
  const result = await prisma.material.findMany({
    where: { isActive: true },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })

  return result.map((r) => r.category)
}
