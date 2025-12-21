/**
 * Product Service
 *
 * 제품 마스터 관리 서비스
 */
import { prisma } from '../lib/prisma'
import { ProductType, Prisma } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface CreateProductInput {
  code: string
  name: string
  spec?: string
  type?: ProductType
  processCode?: string
  crimpCode?: string
  description?: string
}

export interface UpdateProductInput {
  name?: string
  spec?: string
  type?: ProductType
  processCode?: string
  crimpCode?: string
  description?: string
  isActive?: boolean
}

export interface ProductWithRelations {
  id: number
  code: string
  name: string
  spec: string | null
  type: ProductType
  processCode: string | null
  crimpCode: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  _count?: {
    boms: number
    productionLots: number
  }
}

// ============================================
// CRUD Operations
// ============================================

/**
 * 제품 생성
 */
export async function createProduct(input: CreateProductInput): Promise<ProductWithRelations> {
  return prisma.product.create({
    data: {
      code: input.code,
      name: input.name,
      spec: input.spec,
      type: input.type || 'FINISHED',
      processCode: input.processCode,
      crimpCode: input.crimpCode,
      description: input.description,
    },
  })
}

/**
 * 제품 조회 (ID)
 */
export async function getProductById(id: number): Promise<ProductWithRelations | null> {
  return prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          boms: true,
          productionLots: true,
        },
      },
    },
  })
}

/**
 * 제품 조회 (코드)
 */
export async function getProductByCode(code: string): Promise<ProductWithRelations | null> {
  return prisma.product.findUnique({
    where: { code },
    include: {
      _count: {
        select: {
          boms: true,
          productionLots: true,
        },
      },
    },
  })
}

/**
 * 제품 수정
 */
export async function updateProduct(
  id: number,
  input: UpdateProductInput
): Promise<ProductWithRelations> {
  return prisma.product.update({
    where: { id },
    data: input,
  })
}

/**
 * 제품 삭제 (소프트 삭제)
 */
export async function deleteProduct(id: number): Promise<void> {
  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  })
}

/**
 * 제품 완전 삭제
 */
export async function hardDeleteProduct(id: number): Promise<void> {
  await prisma.product.delete({
    where: { id },
  })
}

// ============================================
// Query Operations
// ============================================

/**
 * 전체 제품 목록 조회
 */
export async function getAllProducts(options?: {
  type?: ProductType
  isActive?: boolean
  search?: string
}): Promise<ProductWithRelations[]> {
  const { type, isActive = true, search } = options || {}

  const where: Prisma.ProductWhereInput = {}

  if (isActive !== undefined) {
    where.isActive = isActive
  }

  if (type) {
    where.type = type
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ]
  }

  return prisma.product.findMany({
    where,
    include: {
      _count: {
        select: {
          boms: true,
          productionLots: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  })
}

/**
 * 타입별 제품 조회
 */
export async function getProductsByType(type: ProductType): Promise<ProductWithRelations[]> {
  return getAllProducts({ type })
}

/**
 * 완제품 목록
 */
export async function getFinishedProducts(): Promise<ProductWithRelations[]> {
  return getProductsByType('FINISHED')
}

/**
 * 반제품 목록 (CA)
 */
export async function getSemiCAProducts(): Promise<ProductWithRelations[]> {
  return getProductsByType('SEMI_CA')
}

/**
 * 반제품 목록 (MC)
 */
export async function getSemiMCProducts(): Promise<ProductWithRelations[]> {
  return getProductsByType('SEMI_MC')
}

/**
 * 공정별 제품 조회
 */
export async function getProductsByProcess(processCode: string): Promise<ProductWithRelations[]> {
  return prisma.product.findMany({
    where: {
      processCode: processCode.toUpperCase(),
      isActive: true,
    },
    orderBy: { code: 'asc' },
  })
}

/**
 * 제품 검색
 */
export async function searchProducts(query: string): Promise<ProductWithRelations[]> {
  return getAllProducts({ search: query })
}

/**
 * 제품 수 조회
 */
export async function countProducts(options?: {
  type?: ProductType
  isActive?: boolean
}): Promise<number> {
  const { type, isActive = true } = options || {}

  return prisma.product.count({
    where: {
      ...(type && { type }),
      ...(isActive !== undefined && { isActive }),
    },
  })
}
