/**
 * Semi-Product Service
 *
 * 반제품 품번 체계 관리 서비스
 * - 품번 생성 규칙
 * - 절압품 생성
 * - MS/MC/SB/HS 반제품 코드 생성
 * - 제품 계층 구조 생성
 */
import { prisma } from '../lib/prisma'
import { Product, ProductType } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface ProductHierarchy {
  finished: Product
  crimpProducts: Product[]
  semiProducts: {
    ms: Product[]
    mc: Product | null
    sb: Product | null
    hs: Product | null
  }
}

export interface CreateSemiProductInput {
  finishedProductCode: string
  processCode: 'MS' | 'MC' | 'SB' | 'HS'
  name?: string
  spec?: string
  crimpProductCode?: string  // MS용 (절압품번 필요)
}

// ============================================
// 품번 생성 규칙
// ============================================

/**
 * 품번 체계 규칙
 *
 * | 유형 | 품번 형식 | 예시 |
 * |------|----------|------|
 * | 완제품 | [품번] | 00315452 |
 * | 절압품(CA) | [품번]-[회로번호] | 00315452-001 |
 * | MS 반제품 | MS[절압품번] | MS00315452-001 |
 * | MC 반제품 | MC[품번] | MC00315452 |
 * | SB 반제품 | SB[품번] | SB00315452 |
 * | HS 반제품 | HS[품번] | HS00315452 |
 */

/**
 * 절압품 코드 생성
 * @param finishedProductCode 완제품 품번
 * @param circuitNo 회로번호 (1-999)
 * @returns 절압품 코드 (예: 00315452-001)
 */
export function generateCrimpCode(finishedProductCode: string, circuitNo: number): string {
  const paddedCircuit = String(circuitNo).padStart(3, '0')
  return `${finishedProductCode}-${paddedCircuit}`
}

/**
 * MS 반제품 코드 생성 (중간스트립)
 * @param crimpProductCode 절압품 코드 (예: 00315452-001)
 * @returns MS 반제품 코드 (예: MS00315452-001)
 */
export function generateMSCode(crimpProductCode: string): string {
  return `MS${crimpProductCode}`
}

/**
 * MC/SB/HS 반제품 코드 생성
 * @param processCode 공정 코드 (MC, SB, HS)
 * @param finishedProductCode 완제품 품번
 * @returns 반제품 코드 (예: MC00315452, SB00315452, HS00315452)
 */
export function generateSemiCode(
  processCode: 'MC' | 'SB' | 'HS',
  finishedProductCode: string
): string {
  return `${processCode}${finishedProductCode}`
}

/**
 * 품번으로 제품 타입 추론
 * @param code 제품 코드
 * @returns 제품 타입
 */
export function inferProductType(code: string): ProductType {
  // MS로 시작하면 SEMI_MS
  if (code.startsWith('MS')) {
    return 'SEMI_MS'
  }
  // MC로 시작하면 SEMI_MC
  if (code.startsWith('MC')) {
    return 'SEMI_MC'
  }
  // SB로 시작하면 SEMI_SB
  if (code.startsWith('SB')) {
    return 'SEMI_SB'
  }
  // HS로 시작하면 SEMI_HS
  if (code.startsWith('HS')) {
    return 'SEMI_HS'
  }
  // 하이픈이 있으면 절압품 (CA)
  if (code.includes('-')) {
    return 'SEMI_CA'
  }
  // 그 외는 완제품
  return 'FINISHED'
}

/**
 * 품번에서 완제품 코드 추출
 * @param code 제품 코드
 * @returns 완제품 코드
 */
export function extractFinishedCode(code: string): string {
  // MS00315452-001 → 00315452
  if (code.startsWith('MS')) {
    const withoutPrefix = code.substring(2)
    return withoutPrefix.split('-')[0]
  }
  // MC00315452, SB00315452, HS00315452 → 00315452
  if (code.startsWith('MC') || code.startsWith('SB') || code.startsWith('HS')) {
    return code.substring(2)
  }
  // 00315452-001 → 00315452
  if (code.includes('-')) {
    return code.split('-')[0]
  }
  // 완제품은 그대로
  return code
}

/**
 * 절압품 코드에서 회로번호 추출
 * @param crimpCode 절압품 코드 (예: 00315452-001)
 * @returns 회로번호 또는 null
 */
export function extractCircuitNo(crimpCode: string): number | null {
  // MS00315452-001 → 001 → 1
  let code = crimpCode
  if (code.startsWith('MS')) {
    code = code.substring(2)
  }

  const parts = code.split('-')
  if (parts.length !== 2) return null

  const circuitNo = parseInt(parts[1], 10)
  return isNaN(circuitNo) ? null : circuitNo
}

// ============================================
// 제품 생성 함수
// ============================================

/**
 * 절압품 일괄 생성
 * @param finishedProductCode 완제품 품번
 * @param circuitCount 회로 수
 * @param options 추가 옵션
 * @returns 생성된 절압품 목록
 */
export async function generateCrimpProducts(
  finishedProductCode: string,
  circuitCount: number,
  options?: {
    namePrefix?: string
    bundleQty?: number
  }
): Promise<Product[]> {
  const { namePrefix = '절압품', bundleQty = 100 } = options || {}

  // 완제품 존재 확인
  const finishedProduct = await prisma.product.findUnique({
    where: { code: finishedProductCode },
  })

  if (!finishedProduct) {
    throw new Error(`완제품을 찾을 수 없습니다: ${finishedProductCode}`)
  }

  if (finishedProduct.type !== 'FINISHED') {
    throw new Error(`완제품이 아닙니다: ${finishedProductCode}`)
  }

  const createdProducts: Product[] = []

  for (let i = 1; i <= circuitCount; i++) {
    const crimpCode = generateCrimpCode(finishedProductCode, i)

    // 이미 존재하는지 확인
    const existing = await prisma.product.findUnique({
      where: { code: crimpCode },
    })

    if (existing) {
      createdProducts.push(existing)
      continue
    }

    const product = await prisma.product.create({
      data: {
        code: crimpCode,
        name: `${namePrefix} ${finishedProduct.name} #${i}`,
        spec: finishedProduct.spec,
        type: 'SEMI_CA',
        processCode: 'CA',
        parentCode: finishedProductCode,
        circuitNo: i,
        bundleQty,
      },
    })

    createdProducts.push(product)
  }

  return createdProducts
}

/**
 * MS 반제품 생성 (절압품 기준)
 * @param crimpProductCode 절압품 코드
 * @param options 추가 옵션
 * @returns 생성된 MS 반제품
 */
export async function createMSProduct(
  crimpProductCode: string,
  options?: {
    name?: string
    bundleQty?: number
  }
): Promise<Product> {
  const { name, bundleQty = 100 } = options || {}

  // 절압품 존재 확인
  const crimpProduct = await prisma.product.findUnique({
    where: { code: crimpProductCode },
  })

  if (!crimpProduct) {
    throw new Error(`절압품을 찾을 수 없습니다: ${crimpProductCode}`)
  }

  if (crimpProduct.type !== 'SEMI_CA') {
    throw new Error(`절압품이 아닙니다: ${crimpProductCode}`)
  }

  const msCode = generateMSCode(crimpProductCode)

  // 이미 존재하는지 확인
  const existing = await prisma.product.findUnique({
    where: { code: msCode },
  })

  if (existing) {
    return existing
  }

  return prisma.product.create({
    data: {
      code: msCode,
      name: name || `MS ${crimpProduct.name}`,
      spec: crimpProduct.spec,
      type: 'SEMI_MS',
      processCode: 'MS',
      parentCode: crimpProduct.parentCode,  // 완제품 코드
      crimpCode: crimpProductCode,          // 원본 절압품 코드
      circuitNo: crimpProduct.circuitNo,
      bundleQty,
    },
  })
}

/**
 * MC/SB/HS 반제품 생성 (완제품 기준)
 * @param processCode 공정 코드
 * @param finishedProductCode 완제품 품번
 * @param options 추가 옵션
 * @returns 생성된 반제품
 */
export async function createSemiProduct(
  processCode: 'MC' | 'SB' | 'HS',
  finishedProductCode: string,
  options?: {
    name?: string
    bundleQty?: number
  }
): Promise<Product> {
  const { name, bundleQty = 100 } = options || {}

  // 완제품 존재 확인
  const finishedProduct = await prisma.product.findUnique({
    where: { code: finishedProductCode },
  })

  if (!finishedProduct) {
    throw new Error(`완제품을 찾을 수 없습니다: ${finishedProductCode}`)
  }

  if (finishedProduct.type !== 'FINISHED') {
    throw new Error(`완제품이 아닙니다: ${finishedProductCode}`)
  }

  const semiCode = generateSemiCode(processCode, finishedProductCode)

  // 이미 존재하는지 확인
  const existing = await prisma.product.findUnique({
    where: { code: semiCode },
  })

  if (existing) {
    return existing
  }

  const typeMap: Record<string, ProductType> = {
    MC: 'SEMI_MC',
    SB: 'SEMI_SB',
    HS: 'SEMI_HS',
  }

  const processNameMap: Record<string, string> = {
    MC: '수동압착',
    SB: '서브조립',
    HS: '열수축',
  }

  return prisma.product.create({
    data: {
      code: semiCode,
      name: name || `${processNameMap[processCode]} ${finishedProduct.name}`,
      spec: finishedProduct.spec,
      type: typeMap[processCode],
      processCode,
      parentCode: finishedProductCode,
      bundleQty,
    },
  })
}

/**
 * 완제품에서 전체 반제품 구조 생성
 * @param finishedProductCode 완제품 품번
 * @param circuitCount 회로 수
 * @param processPattern 공정 패턴 (예: ['CA', 'MS', 'MC', 'SB', 'HS'])
 * @returns 생성된 제품 계층 구조
 */
export async function createProductHierarchy(
  finishedProductCode: string,
  circuitCount: number,
  processPattern: string[] = ['CA']
): Promise<ProductHierarchy> {
  // 완제품 조회
  const finished = await prisma.product.findUnique({
    where: { code: finishedProductCode },
  })

  if (!finished) {
    throw new Error(`완제품을 찾을 수 없습니다: ${finishedProductCode}`)
  }

  // 절압품 생성
  const crimpProducts = await generateCrimpProducts(finishedProductCode, circuitCount)

  // 반제품 초기화
  const semiProducts: ProductHierarchy['semiProducts'] = {
    ms: [],
    mc: null,
    sb: null,
    hs: null,
  }

  // 공정 패턴에 따라 반제품 생성
  for (const process of processPattern) {
    switch (process.toUpperCase()) {
      case 'MS':
        // MS는 각 절압품별로 생성
        for (const crimp of crimpProducts) {
          const msProduct = await createMSProduct(crimp.code)
          semiProducts.ms.push(msProduct)
        }
        break

      case 'MC':
        semiProducts.mc = await createSemiProduct('MC', finishedProductCode)
        break

      case 'SB':
        semiProducts.sb = await createSemiProduct('SB', finishedProductCode)
        break

      case 'HS':
        semiProducts.hs = await createSemiProduct('HS', finishedProductCode)
        break
    }
  }

  return {
    finished,
    crimpProducts,
    semiProducts,
  }
}

// ============================================
// 조회 함수
// ============================================

/**
 * 완제품의 절압품 목록 조회
 */
export async function getCrimpProductsByFinished(finishedProductCode: string): Promise<Product[]> {
  return prisma.product.findMany({
    where: {
      type: 'SEMI_CA',
      parentCode: finishedProductCode,
      isActive: true,
    },
    orderBy: { circuitNo: 'asc' },
  })
}

/**
 * 완제품의 모든 반제품 조회
 */
export async function getSemiProductsByFinished(finishedProductCode: string): Promise<Product[]> {
  return prisma.product.findMany({
    where: {
      parentCode: finishedProductCode,
      isActive: true,
    },
    orderBy: [{ type: 'asc' }, { circuitNo: 'asc' }],
  })
}

/**
 * 완제품의 반제품 수 조회
 */
export async function countSemiProducts(finishedProductCode: string): Promise<{
  total: number
  byType: Record<string, number>
}> {
  const products = await prisma.product.findMany({
    where: {
      parentCode: finishedProductCode,
      isActive: true,
    },
    select: { type: true },
  })

  const byType: Record<string, number> = {}
  for (const p of products) {
    byType[p.type] = (byType[p.type] || 0) + 1
  }

  return {
    total: products.length,
    byType,
  }
}

/**
 * 품번 유효성 검증
 */
export function isValidProductCode(code: string): boolean {
  // 빈 문자열 체크
  if (!code || code.trim() === '') return false

  // 기본 형식 검증
  const type = inferProductType(code)

  switch (type) {
    case 'SEMI_CA':
      // 00315452-001 형식
      return /^.+-\d{3}$/.test(code)

    case 'SEMI_MS':
      // MS00315452-001 형식
      return /^MS.+-\d{3}$/.test(code)

    case 'SEMI_MC':
    case 'SEMI_SB':
    case 'SEMI_HS':
      // MC00315452, SB00315452, HS00315452 형식
      return /^(MC|SB|HS).+$/.test(code)

    case 'FINISHED':
      // 완제품은 하이픈 없음
      return !code.includes('-') && !code.startsWith('MS') && !code.startsWith('MC') && !code.startsWith('SB') && !code.startsWith('HS')

    default:
      return false
  }
}

/**
 * 절압품 회로번호 범위 검증
 */
export function isValidCircuitRange(circuitNo: number): boolean {
  return circuitNo >= 1 && circuitNo <= 999
}
