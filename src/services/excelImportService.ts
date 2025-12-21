/**
 * Excel Import Service
 *
 * xlsx 라이브러리를 사용한 Excel 파일 Import
 * - 제품, 자재, BOM, 재고 일괄 등록
 * - 데이터 유효성 검사
 * - 중복 처리 (덮어쓰기/스킵)
 */
import * as XLSX from 'xlsx'
import prisma from '@/lib/prisma'
import type { Product, Material, BOM, MaterialStock } from '@prisma/client'

// ============================================
// Types
// ============================================

export interface ImportResult {
  success: boolean
  totalRows: number
  importedRows: number
  skippedRows: number
  errors: ImportError[]
  data?: unknown[]
}

export interface ImportError {
  row: number
  column?: string
  message: string
  value?: unknown
}

export interface ImportOptions {
  skipDuplicates?: boolean      // true: 중복 스킵, false: 덮어쓰기
  skipFirstRow?: boolean        // 첫 행 헤더 스킵
  sheetIndex?: number           // 시트 인덱스 (기본 0)
  sheetName?: string            // 시트 이름 (우선순위)
  columnMapping?: ColumnMapping // 컬럼 매핑
}

export interface ColumnMapping {
  [targetField: string]: string | number  // 대상 필드 -> 엑셀 컬럼(문자 또는 인덱스)
}

export interface SheetInfo {
  name: string
  index: number
  rowCount: number
  columns: string[]
}

// ============================================
// File Parsing
// ============================================

/**
 * Excel 파일 파싱
 */
export function parseExcelFile(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        resolve(workbook)
      } catch (error) {
        reject(new Error('Excel 파일을 읽을 수 없습니다.'))
      }
    }

    reader.onerror = () => reject(new Error('파일 읽기 오류'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 시트 정보 조회
 */
export function getSheetInfo(workbook: XLSX.WorkBook): SheetInfo[] {
  return workbook.SheetNames.map((name, index) => {
    const sheet = workbook.Sheets[name]
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    const rowCount = range.e.r - range.s.r + 1

    // 첫 행에서 컬럼명 추출
    const columns: string[] = []
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      const cell = sheet[cellAddress]
      columns.push(cell ? String(cell.v) : `Column ${col + 1}`)
    }

    return { name, index, rowCount, columns }
  })
}

/**
 * 시트 데이터를 JSON으로 변환
 */
export function sheetToJson<T = Record<string, unknown>>(
  workbook: XLSX.WorkBook,
  options: ImportOptions = {}
): T[] {
  const sheetName = options.sheetName || workbook.SheetNames[options.sheetIndex || 0]
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) {
    throw new Error(`시트를 찾을 수 없습니다: ${sheetName}`)
  }

  const jsonData = XLSX.utils.sheet_to_json<T>(sheet, {
    header: options.skipFirstRow === false ? 1 : undefined,
    defval: null,
  })

  return jsonData
}

/**
 * 컬럼 매핑 적용
 */
export function applyColumnMapping<T>(
  data: Record<string, unknown>[],
  mapping: ColumnMapping
): T[] {
  return data.map((row) => {
    const mappedRow: Record<string, unknown> = {}

    for (const [targetField, sourceColumn] of Object.entries(mapping)) {
      if (typeof sourceColumn === 'string') {
        mappedRow[targetField] = row[sourceColumn]
      } else if (typeof sourceColumn === 'number') {
        const keys = Object.keys(row)
        mappedRow[targetField] = row[keys[sourceColumn]]
      }
    }

    return mappedRow as T
  })
}

// ============================================
// Product Import
// ============================================

export interface ProductImportRow {
  code: string
  name: string
  spec?: string
  type?: 'FINISHED' | 'SEMI_CA' | 'SEMI_MC'
  processCode?: string
  crimpCode?: string
  description?: string
}

/**
 * 제품 일괄 등록
 */
export async function importProducts(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    errors: [],
  }

  try {
    const workbook = await parseExcelFile(file)
    let data = sheetToJson<ProductImportRow>(workbook, options)

    // 컬럼 매핑 적용
    if (options.columnMapping) {
      data = applyColumnMapping<ProductImportRow>(
        data as unknown as Record<string, unknown>[],
        options.columnMapping
      )
    }

    result.totalRows = data.length

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // Excel 행 번호 (1-based + 헤더)

      // 필수 필드 검사
      if (!row.code || !row.name) {
        result.errors.push({
          row: rowNum,
          message: '품번(code)과 품명(name)은 필수입니다.',
        })
        result.skippedRows++
        continue
      }

      try {
        // 중복 체크
        const existing = await prisma.product.findUnique({
          where: { code: String(row.code) },
        })

        if (existing) {
          if (options.skipDuplicates) {
            result.skippedRows++
            continue
          }

          // 덮어쓰기
          await prisma.product.update({
            where: { code: String(row.code) },
            data: {
              name: String(row.name),
              spec: row.spec ? String(row.spec) : null,
              type: row.type || 'FINISHED',
              processCode: row.processCode ? String(row.processCode) : null,
              crimpCode: row.crimpCode ? String(row.crimpCode) : null,
              description: row.description ? String(row.description) : null,
            },
          })
        } else {
          // 신규 등록
          await prisma.product.create({
            data: {
              code: String(row.code),
              name: String(row.name),
              spec: row.spec ? String(row.spec) : null,
              type: row.type || 'FINISHED',
              processCode: row.processCode ? String(row.processCode) : null,
              crimpCode: row.crimpCode ? String(row.crimpCode) : null,
              description: row.description ? String(row.description) : null,
            },
          })
        }

        result.importedRows++
      } catch (error) {
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : '등록 실패',
          value: row,
        })
        result.skippedRows++
      }
    }

    result.success = result.errors.length === 0
  } catch (error) {
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : '파일 처리 오류',
    })
  }

  return result
}

// ============================================
// Material Import
// ============================================

export interface MaterialImportRow {
  code: string
  name: string
  spec?: string
  category: string
  unit: string
  safeStock?: number
  description?: string
}

/**
 * 자재 일괄 등록
 */
export async function importMaterials(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    errors: [],
  }

  try {
    const workbook = await parseExcelFile(file)
    let data = sheetToJson<MaterialImportRow>(workbook, options)

    if (options.columnMapping) {
      data = applyColumnMapping<MaterialImportRow>(
        data as unknown as Record<string, unknown>[],
        options.columnMapping
      )
    }

    result.totalRows = data.length

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2

      // 필수 필드 검사
      if (!row.code || !row.name || !row.category || !row.unit) {
        result.errors.push({
          row: rowNum,
          message: '품번, 품명, 분류, 단위는 필수입니다.',
        })
        result.skippedRows++
        continue
      }

      try {
        const existing = await prisma.material.findUnique({
          where: { code: String(row.code) },
        })

        const materialData = {
          name: String(row.name),
          spec: row.spec ? String(row.spec) : null,
          category: String(row.category),
          unit: String(row.unit),
          safeStock: row.safeStock ? Number(row.safeStock) : 0,
          description: row.description ? String(row.description) : null,
        }

        if (existing) {
          if (options.skipDuplicates) {
            result.skippedRows++
            continue
          }

          await prisma.material.update({
            where: { code: String(row.code) },
            data: materialData,
          })
        } else {
          await prisma.material.create({
            data: {
              code: String(row.code),
              ...materialData,
            },
          })
        }

        result.importedRows++
      } catch (error) {
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : '등록 실패',
          value: row,
        })
        result.skippedRows++
      }
    }

    result.success = result.errors.length === 0
  } catch (error) {
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : '파일 처리 오류',
    })
  }

  return result
}

// ============================================
// BOM Import
// ============================================

export interface BOMImportRow {
  productCode: string
  itemType: 'MATERIAL' | 'PRODUCT'
  itemCode: string           // materialCode 또는 childProductCode
  quantity: number
  unit?: string
  processCode?: string
}

/**
 * BOM 일괄 등록
 */
export async function importBOM(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    errors: [],
  }

  try {
    const workbook = await parseExcelFile(file)
    let data = sheetToJson<BOMImportRow>(workbook, options)

    if (options.columnMapping) {
      data = applyColumnMapping<BOMImportRow>(
        data as unknown as Record<string, unknown>[],
        options.columnMapping
      )
    }

    result.totalRows = data.length

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2

      // 필수 필드 검사
      if (!row.productCode || !row.itemType || !row.itemCode || !row.quantity) {
        result.errors.push({
          row: rowNum,
          message: '제품코드, 아이템유형, 아이템코드, 수량은 필수입니다.',
        })
        result.skippedRows++
        continue
      }

      try {
        // 제품 조회
        const product = await prisma.product.findUnique({
          where: { code: String(row.productCode) },
        })

        if (!product) {
          result.errors.push({
            row: rowNum,
            message: `제품을 찾을 수 없습니다: ${row.productCode}`,
          })
          result.skippedRows++
          continue
        }

        const bomData: {
          productId: number
          itemType: 'MATERIAL' | 'PRODUCT'
          quantity: number
          unit?: string
          processCode?: string
          materialId?: number
          childProductId?: number
        } = {
          productId: product.id,
          itemType: row.itemType,
          quantity: Number(row.quantity),
          unit: row.unit ? String(row.unit) : undefined,
          processCode: row.processCode ? String(row.processCode) : undefined,
        }

        // 아이템 조회
        if (row.itemType === 'MATERIAL') {
          const material = await prisma.material.findUnique({
            where: { code: String(row.itemCode) },
          })

          if (!material) {
            result.errors.push({
              row: rowNum,
              message: `자재를 찾을 수 없습니다: ${row.itemCode}`,
            })
            result.skippedRows++
            continue
          }

          bomData.materialId = material.id
        } else {
          const childProduct = await prisma.product.findUnique({
            where: { code: String(row.itemCode) },
          })

          if (!childProduct) {
            result.errors.push({
              row: rowNum,
              message: `반제품을 찾을 수 없습니다: ${row.itemCode}`,
            })
            result.skippedRows++
            continue
          }

          bomData.childProductId = childProduct.id
        }

        // BOM 등록 (중복 시 업데이트)
        const existingBOM = await prisma.bOM.findFirst({
          where: {
            productId: product.id,
            materialId: bomData.materialId,
            childProductId: bomData.childProductId,
          },
        })

        if (existingBOM) {
          if (options.skipDuplicates) {
            result.skippedRows++
            continue
          }

          await prisma.bOM.update({
            where: { id: existingBOM.id },
            data: bomData,
          })
        } else {
          await prisma.bOM.create({
            data: bomData,
          })
        }

        result.importedRows++
      } catch (error) {
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : '등록 실패',
          value: row,
        })
        result.skippedRows++
      }
    }

    result.success = result.errors.length === 0
  } catch (error) {
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : '파일 처리 오류',
    })
  }

  return result
}

// ============================================
// Stock Import
// ============================================

export interface StockImportRow {
  materialCode: string
  lotNumber: string
  quantity: number
  location?: string
}

/**
 * 재고 일괄 등록
 */
export async function importStock(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    errors: [],
  }

  try {
    const workbook = await parseExcelFile(file)
    let data = sheetToJson<StockImportRow>(workbook, options)

    if (options.columnMapping) {
      data = applyColumnMapping<StockImportRow>(
        data as unknown as Record<string, unknown>[],
        options.columnMapping
      )
    }

    result.totalRows = data.length

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2

      // 필수 필드 검사
      if (!row.materialCode || !row.lotNumber || row.quantity === undefined) {
        result.errors.push({
          row: rowNum,
          message: '자재코드, LOT번호, 수량은 필수입니다.',
        })
        result.skippedRows++
        continue
      }

      try {
        // 자재 조회
        const material = await prisma.material.findUnique({
          where: { code: String(row.materialCode) },
        })

        if (!material) {
          result.errors.push({
            row: rowNum,
            message: `자재를 찾을 수 없습니다: ${row.materialCode}`,
          })
          result.skippedRows++
          continue
        }

        // 기존 재고 확인
        const existingStock = await prisma.materialStock.findFirst({
          where: {
            materialId: material.id,
            lotNumber: String(row.lotNumber),
          },
        })

        const stockData = {
          quantity: Number(row.quantity),
          location: row.location ? String(row.location) : null,
        }

        if (existingStock) {
          if (options.skipDuplicates) {
            result.skippedRows++
            continue
          }

          await prisma.materialStock.update({
            where: { id: existingStock.id },
            data: stockData,
          })
        } else {
          await prisma.materialStock.create({
            data: {
              materialId: material.id,
              lotNumber: String(row.lotNumber),
              ...stockData,
            },
          })
        }

        result.importedRows++
      } catch (error) {
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : '등록 실패',
          value: row,
        })
        result.skippedRows++
      }
    }

    result.success = result.errors.length === 0
  } catch (error) {
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : '파일 처리 오류',
    })
  }

  return result
}

// ============================================
// Material Receiving Import (자재 입고)
// ============================================

export interface MaterialReceivingImportRow {
  receivedAt?: string      // 입고일자
  materialCode: string     // 품번
  materialName?: string    // 품명 (참조용)
  lotNumber: string        // 바코드No
  quantity: number         // 수량
  description?: string     // 비고
}

/**
 * 자재 입고 일괄 등록 (Mock)
 */
export async function importMaterialReceiving(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    errors: [],
    data: [],
  }

  try {
    const workbook = await parseExcelFile(file)

    // 한글 헤더 시트 우선 검색 (Python 템플릿 호환)
    const sheetName = workbook.SheetNames.find(
      (name) => name === '자재 입고' || name === 'Sheet1'
    ) || workbook.SheetNames[0]

    let data = sheetToJson<Record<string, unknown>>(workbook, {
      ...options,
      sheetName,
    })

    // 한글 헤더 매핑 적용
    data = applyKoreanHeaderMapping<MaterialReceivingImportRow>(
      data as Record<string, unknown>[],
      'receiving'
    ) as unknown as Record<string, unknown>[]

    result.totalRows = data.length

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as unknown as MaterialReceivingImportRow
      const rowNum = i + 2

      // 필수 필드 검사
      if (!row.materialCode || !row.lotNumber || row.quantity === undefined) {
        result.errors.push({
          row: rowNum,
          message: '품번, 바코드No, 수량은 필수입니다.',
        })
        result.skippedRows++
        continue
      }

      try {
        // 브라우저 환경에서는 Prisma 사용 불가
        // Mock 데이터로 결과 추가
        result.data?.push({
          materialCode: String(row.materialCode),
          lotNumber: String(row.lotNumber),
          quantity: Number(row.quantity),
          receivedAt: row.receivedAt || new Date().toISOString().split('T')[0],
          description: row.description || '',
        })

        result.importedRows++
      } catch (error) {
        result.errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : '등록 실패',
          value: row,
        })
        result.skippedRows++
      }
    }

    result.success = result.errors.length === 0
  } catch (error) {
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : '파일 처리 오류',
    })
  }

  return result
}

// ============================================
// Template Download (Python 형식 호환)
// ============================================

interface TemplateConfig {
  sheetName: string
  headers: string[]
  examples: Record<string, unknown>[]
  guide: string[]
}

/**
 * 한글 헤더 → 영문 필드 매핑
 */
export const KOREAN_TO_ENGLISH_MAPPING: Record<string, Record<string, string>> = {
  product: {
    '품번*': 'code',
    '품명*': 'name',
    '설명': 'description',
  },
  material: {
    '자재코드*': 'code',
    '자재명*': 'name',
    '분류': 'category',
    '단위': 'unit',
    '설명': 'description',
  },
  bom: {
    '완제품 품번*': 'productCode',
    '절압착품번': 'crimpCode',
    '자재코드*': 'itemCode',
    '공정': 'processCode',
    '소요량*': 'quantity',
    '단위': 'unit',
    '비고': 'description',
  },
  receiving: {
    '입고일자*': 'receivedAt',
    '품번*': 'materialCode',
    '품명*': 'materialName',
    '바코드No*': 'lotNumber',
    '수량*': 'quantity',
    '비고': 'description',
  },
  stock: {
    '자재코드': 'materialCode',
    'LOT번호': 'lotNumber',
    '수량': 'quantity',
    '위치': 'location',
  },
}

/**
 * Import 템플릿 다운로드 (Python 형식 호환)
 */
export function downloadImportTemplate(
  type: 'product' | 'material' | 'bom' | 'stock' | 'receiving'
): void {
  const templates: Record<string, TemplateConfig> = {
    product: {
      sheetName: '완제품 마스터',
      headers: ['품번*', '품명*', '설명'],
      examples: [
        { '품번*': 'WH-001', '품명*': '와이어링 하네스 A타입', '설명': '자동차용 와이어링 하네스' },
        { '품번*': 'WH-002', '품명*': '와이어링 하네스 B타입', '설명': '산업용 와이어링 하네스' },
        { '품번*': 'CN-001', '품명*': '커넥터 어셈블리', '설명': '12핀 방수 커넥터' },
      ],
      guide: [
        '[ 완제품 마스터 등록 안내 ]',
        '',
        '1. \'완제품 마스터\' 시트에 데이터를 입력하세요.',
        '2. *표시된 항목은 필수 입력입니다.',
        '3. 품번은 중복될 수 없습니다.',
        '4. 샘플 데이터(2~4행)는 삭제 후 사용하세요.',
      ],
    },
    material: {
      sheetName: '자재 마스터',
      headers: ['자재코드*', '자재명*', '분류', '단위', '설명'],
      examples: [
        { '자재코드*': 'T-001', '자재명*': '단자 110타입', '분류': '단자', '단위': 'EA', '설명': '110 시리즈 단자' },
        { '자재코드*': 'T-002', '자재명*': '단자 250타입', '분류': '단자', '단위': 'EA', '설명': '250 시리즈 단자' },
        { '자재코드*': 'W-001', '자재명*': '전선 AVS 0.5sq', '분류': '전선', '단위': 'M', '설명': '자동차용 전선 0.5sq' },
        { '자재코드*': 'W-002', '자재명*': '전선 AVS 0.85sq', '분류': '전선', '단위': 'M', '설명': '자동차용 전선 0.85sq' },
        { '자재코드*': 'S-001', '자재명*': '방수씰 소형', '분류': '씰', '단위': 'EA', '설명': '소형 방수씰' },
        { '자재코드*': 'C-001', '자재명*': '커넥터 하우징 6P', '분류': '커넥터', '단위': 'EA', '설명': '6핀 커넥터 하우징' },
        { '자재코드*': 'T-003', '자재명*': '튜브 6mm', '분류': '튜브', '단위': 'M', '설명': '열수축 튜브 6mm' },
      ],
      guide: [
        '[ 자재 마스터 등록 안내 ]',
        '',
        '1. \'자재 마스터\' 시트에 데이터를 입력하세요.',
        '2. *표시된 항목은 필수 입력입니다.',
        '3. 자재코드는 중복될 수 없습니다.',
        '4. 샘플 데이터는 삭제 후 사용하세요.',
        '',
        '[ 분류 목록 ]',
        '- 단자: 터미널, 단자류',
        '- 전선: 와이어, 케이블',
        '- 씰: 방수씰, 그로멧',
        '- 커넥터: 하우징, 커넥터',
        '- 튜브: 열수축튜브, 보호튜브',
        '- 테이프: 절연테이프, 마킹테이프',
        '- 기타: 클립, 밴드 등',
        '',
        '[ 단위 목록 ]',
        '- EA: 개',
        '- M: 미터',
        '- SET: 세트',
        '- ROLL: 롤',
        '- BOX: 박스',
      ],
    },
    bom: {
      sheetName: 'BOM 마스터',
      headers: ['완제품 품번*', '절압착품번', '자재코드*', '공정', '소요량*', '단위', '비고'],
      examples: [
        { '완제품 품번*': 'WH-001', '절압착품번': 'WH-001-CA01', '자재코드*': 'T-001', '공정': 'CA', '소요량*': 2, '단위': 'EA', '비고': '110타입 단자' },
        { '완제품 품번*': 'WH-001', '절압착품번': 'WH-001-CA01', '자재코드*': 'W-001', '공정': 'CA', '소요량*': 0.5, '단위': 'M', '비고': '0.5sq 전선' },
        { '완제품 품번*': 'WH-001', '절압착품번': 'WH-001-CA01', '자재코드*': 'S-001', '공정': 'CA', '소요량*': 2, '단위': 'EA', '비고': '방수씰' },
        { '완제품 품번*': 'WH-002', '절압착품번': '', '자재코드*': 'T-002', '공정': 'MC', '소요량*': 4, '단위': 'EA', '비고': '250타입 단자' },
        { '완제품 품번*': 'WH-002', '절압착품번': '', '자재코드*': 'W-002', '공정': '', '소요량*': 1.2, '단위': 'M', '비고': '0.85sq 전선' },
      ],
      guide: [
        '[ BOM 마스터 등록 안내 ]',
        '',
        '1. \'BOM 마스터\' 시트에 데이터를 입력하세요.',
        '2. *표시된 항목은 필수 입력입니다.',
        '3. 완제품 품번과 자재코드는 미리 등록되어 있어야 합니다.',
        '4. 동일한 완제품-자재-공정 조합은 중복 등록할 수 없습니다.',
        '5. 절압착품번은 CA 공정 자재에 사용되며, 선택 입력입니다.',
        '6. 샘플 데이터는 삭제 후 사용하세요.',
        '',
        '[ 공정 코드 ]',
        '- CA: 자동절단압착 (Cutting & Auto-crimp)',
        '- MC: 수동압착 (Manual Crimp)',
        '- MS: 중간스트립 (Mid Splice)',
        '- SB: 서브조립 (Sub-assembly)',
        '- HS: 열수축 (Heat Shrink)',
        '- SP: 제품조립제공부품 (Sub Parts)',
        '- PA: 제품조립 (Product Assembly)',
        '',
        '[ 컬럼 설명 ]',
        '- 완제품 품번*: 완제품 코드 (예: WH-001)',
        '- 절압착품번: CA 공정 반제품 코드 (선택)',
        '- 자재코드*: 소요 자재 코드 (예: T-001)',
        '- 공정: 해당 자재가 사용되는 공정',
        '- 소요량*: 완제품 1개당 필요 수량',
        '- 단위: 수량 단위',
        '- 비고: 추가 설명',
      ],
    },
    receiving: {
      sheetName: '자재 입고',
      headers: ['입고일자*', '품번*', '품명*', '바코드No*', '수량*', '비고'],
      examples: [
        { '입고일자*': '2025-01-15', '품번*': 'T-001', '품명*': '단자 110타입', '바코드No*': 'P210-8624Q1500S2025100201180', '수량*': 1500, '비고': '본사 입고' },
        { '입고일자*': '2025-01-15', '품번*': 'W-001', '품명*': '전선 AVS 0.5sq', '바코드No*': 'KH1200030-22:12000:50603KDR20701B021', '수량*': 12000, '비고': '' },
        { '입고일자*': '2025-01-14', '품번*': 'S-001', '품명*': '방수씰 소형', '바코드No*': '100188305110201171101', '수량*': 5000, '비고': '긴급 입고' },
      ],
      guide: [
        '[ 자재 입고 등록 안내 ]',
        '',
        '1. \'자재 입고\' 시트에 데이터를 입력하세요.',
        '2. *표시된 항목은 필수 입력입니다.',
        '3. 바코드No는 중복될 수 없습니다.',
        '4. 입고일자 형식: YYYY-MM-DD (예: 2025-01-15)',
        '5. 샘플 데이터는 삭제 후 사용하세요.',
        '',
        '[ 컬럼 설명 ]',
        '- 입고일자*: 입고 날짜 (YYYY-MM-DD 형식)',
        '- 품번*: 자재 코드 (예: T-001)',
        '- 품명*: 자재 명칭 (참조용)',
        '- 바코드No*: 본사 바코드 또는 LOT 번호',
        '- 수량*: 입고 수량',
        '- 비고: 추가 설명 (선택)',
      ],
    },
    stock: {
      sheetName: '재고 등록',
      headers: ['자재코드', 'LOT번호', '수량', '위치'],
      examples: [
        { '자재코드': 'T-001', 'LOT번호': 'LOT-2025-0001', '수량': 1000, '위치': 'A-01' },
        { '자재코드': 'W-001', 'LOT번호': 'LOT-2025-0002', '수량': 5000, '위치': 'B-02' },
      ],
      guide: [
        '[ 재고 등록 안내 ]',
        '',
        '1. \'재고 등록\' 시트에 데이터를 입력하세요.',
        '2. 자재코드는 미리 등록되어 있어야 합니다.',
        '3. 샘플 데이터는 삭제 후 사용하세요.',
        '',
        '[ 컬럼 설명 ]',
        '- 자재코드: 자재 코드 (예: T-001)',
        '- LOT번호: LOT 번호',
        '- 수량: 재고 수량',
        '- 위치: 보관 위치 (선택)',
      ],
    },
  }

  const template = templates[type]
  if (!template) return

  const wb = XLSX.utils.book_new()

  // 1. 데이터 시트 생성
  const dataSheet = XLSX.utils.json_to_sheet(template.examples, { header: template.headers })

  // 컬럼 너비 설정
  dataSheet['!cols'] = template.headers.map((h) => ({
    wch: Math.max(h.length * 2, 15),
  }))

  XLSX.utils.book_append_sheet(wb, dataSheet, template.sheetName)

  // 2. 안내 시트 생성
  const guideData = template.guide.map((line) => [line])
  const guideSheet = XLSX.utils.aoa_to_sheet(guideData)
  guideSheet['!cols'] = [{ wch: 60 }]
  XLSX.utils.book_append_sheet(wb, guideSheet, '안내')

  // 파일 다운로드 (한글 파일명)
  const fileNames: Record<string, string> = {
    product: '완제품관리.xlsx',
    material: '자재관리.xlsx',
    bom: 'BOM관리.xlsx',
    receiving: '자재입고.xlsx',
    stock: '재고등록.xlsx',
  }

  XLSX.writeFile(wb, fileNames[type])
}

/**
 * 한글 헤더를 영문으로 매핑 적용
 */
export function applyKoreanHeaderMapping<T>(
  data: Record<string, unknown>[],
  type: 'product' | 'material' | 'bom' | 'receiving' | 'stock'
): T[] {
  const mapping = KOREAN_TO_ENGLISH_MAPPING[type]
  if (!mapping) return data as T[]

  return data.map((row) => {
    const mappedRow: Record<string, unknown> = {}

    for (const [koreanKey, value] of Object.entries(row)) {
      const englishKey = mapping[koreanKey] || koreanKey
      mappedRow[englishKey] = value
    }

    return mappedRow as T
  })
}

// ============================================
// Validation Utils
// ============================================

/**
 * 필수 컬럼 검사
 */
export function validateRequiredColumns(
  columns: string[],
  requiredColumns: string[]
): string[] {
  const missing: string[] = []

  for (const col of requiredColumns) {
    if (!columns.includes(col)) {
      missing.push(col)
    }
  }

  return missing
}

/**
 * 데이터 프리뷰 (처음 N행)
 */
export function previewData<T>(
  workbook: XLSX.WorkBook,
  options: ImportOptions = {},
  limit: number = 5
): T[] {
  const data = sheetToJson<T>(workbook, options)
  return data.slice(0, limit)
}
