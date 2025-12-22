/**
 * Excel Import Service
 *
 * xlsx 라이브러리를 사용한 Excel 파일 Import
 * - 제품, 자재, BOM, 재고 일괄 등록 (브라우저 호환)
 * - 데이터 유효성 검사
 * - 파싱된 데이터를 result.data에 반환 (DB 저장은 별도 처리)
 */
import * as XLSX from 'xlsx'

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
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,  // Excel 날짜를 JS Date로 변환
          dateNF: 'yyyy-mm-dd',  // 날짜 형식
        })
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
    raw: false,  // 날짜를 문자열로 변환
    dateNF: 'yyyy-mm-dd',  // 날짜 형식
  })

  return jsonData
}

/**
 * Excel 직렬 날짜를 yyyy-mm-dd 형식으로 변환
 * Excel에서 날짜는 1900-01-01부터의 일수로 저장됨
 */
export function excelDateToString(excelDate: number | string | Date | null | undefined): string {
  if (!excelDate) return ''

  // 이미 문자열인 경우 그대로 반환
  if (typeof excelDate === 'string') {
    // yyyy-mm-dd 형식인지 확인
    if (/^\d{4}-\d{2}-\d{2}/.test(excelDate)) {
      return excelDate.split('T')[0]  // ISO 형식에서 날짜 부분만 추출
    }
    return excelDate
  }

  // Date 객체인 경우
  if (excelDate instanceof Date) {
    return excelDate.toISOString().split('T')[0]
  }

  // 숫자인 경우 Excel 직렬 날짜로 간주
  if (typeof excelDate === 'number') {
    // Excel의 날짜 직렬 번호를 JavaScript Date로 변환
    // Excel은 1900-01-01을 1로 시작 (1900년 윤년 버그 포함)
    const excelEpoch = new Date(1899, 11, 30)  // 1899-12-30
    const date = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000)
    return date.toISOString().split('T')[0]
  }

  return String(excelDate)
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
    data: [],
  }

  try {
    const workbook = await parseExcelFile(file)
    let data = sheetToJson<Record<string, unknown>>(workbook, options)

    // 한글 헤더 매핑 적용
    data = applyKoreanHeaderMapping<ProductImportRow>(data, 'product') as unknown as Record<string, unknown>[]

    // 컬럼 매핑 적용
    if (options.columnMapping) {
      data = applyColumnMapping<ProductImportRow>(
        data,
        options.columnMapping
      ) as unknown as Record<string, unknown>[]
    }

    const typedData = data as unknown as ProductImportRow[]
    result.totalRows = typedData.length

    for (let i = 0; i < typedData.length; i++) {
      const row = typedData[i]
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

      // 브라우저 환경에서는 Prisma 사용 불가
      // 파싱된 데이터를 결과에 추가
      result.data?.push({
        code: String(row.code),
        name: String(row.name),
        spec: row.spec ? String(row.spec) : null,
        type: row.type || 'FINISHED',
        processCode: row.processCode ? String(row.processCode) : null,
        crimpCode: row.crimpCode ? String(row.crimpCode) : null,
        description: row.description ? String(row.description) : null,
      })

      result.importedRows++
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

// 품목마스터 관리 양식 기반 자재 Import 타입
export interface MaterialImportRow {
  // === 핵심 필드 ===
  code: string              // 경림품번
  name: string              // 품명
  // === 바코드 매칭용 ===
  supplierCode?: string     // 원자재 공급사 품번
  pdaCode?: string          // PDA 확인 품번
  hqCode?: string           // 본사 코드 (레거시)
  // === 공급처 ===
  supplier?: string         // 원자재-공급처
  customerCode?: string     // 출하 고객품번
  // === 규격 ===
  spec?: string             // 규격1
  spec2?: string            // 규격2
  spec3?: string            // 규격3
  // === 전선 정보 ===
  wireMaterial?: string     // 전선재질
  wireGauge?: string        // 전선 굵기
  color?: string            // 색상
  // === 분류 ===
  projectCode?: string      // 프로젝트코드
  category: string          // 품목유형
  // === 단위 ===
  unit: string              // 단위
  unitWeight?: number       // 단위중량
  weightUnit?: string       // 중량단위
  // === 기타 ===
  safeStock?: number
  description?: string
}

/**
 * 자재 일괄 등록 (브라우저 호환)
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
    data: [],
  }

  try {
    const workbook = await parseExcelFile(file)
    let data = sheetToJson<Record<string, unknown>>(workbook, options)

    // 한글 헤더 매핑 적용
    data = applyKoreanHeaderMapping<MaterialImportRow>(data, 'material') as unknown as Record<string, unknown>[]

    if (options.columnMapping) {
      data = applyColumnMapping<MaterialImportRow>(
        data,
        options.columnMapping
      ) as unknown as Record<string, unknown>[]
    }

    const typedData = data as unknown as MaterialImportRow[]
    result.totalRows = typedData.length

    for (let i = 0; i < typedData.length; i++) {
      const row = typedData[i]
      const rowNum = i + 2

      // 필수 필드 검사 (경림품번, 품명만 필수)
      if (!row.code || !row.name) {
        result.errors.push({
          row: rowNum,
          message: '경림품번(code)과 품명(name)은 필수입니다.',
        })
        result.skippedRows++
        continue
      }

      // 브라우저 환경에서는 Prisma 사용 불가
      // 파싱된 데이터를 결과에 추가 (품목마스터 양식 전체 필드)
      result.data?.push({
        // 핵심 필드
        code: String(row.code),
        name: String(row.name),
        // 바코드 매칭용
        supplierCode: row.supplierCode ? String(row.supplierCode) : undefined,
        pdaCode: row.pdaCode ? String(row.pdaCode) : undefined,
        hqCode: row.hqCode ? String(row.hqCode) : undefined,
        // 공급처
        supplier: row.supplier ? String(row.supplier) : undefined,
        customerCode: row.customerCode ? String(row.customerCode) : undefined,
        // 규격
        spec: row.spec ? String(row.spec) : '',
        spec2: row.spec2 ? String(row.spec2) : undefined,
        spec3: row.spec3 ? String(row.spec3) : undefined,
        // 전선 정보
        wireMaterial: row.wireMaterial ? String(row.wireMaterial) : undefined,
        wireGauge: row.wireGauge ? String(row.wireGauge) : undefined,
        color: row.color ? String(row.color) : undefined,
        // 분류
        projectCode: row.projectCode ? String(row.projectCode) : undefined,
        category: row.category ? String(row.category) : '원재료',
        // 단위
        unit: row.unit ? String(row.unit) : 'EA',
        unitWeight: row.unitWeight ? Number(row.unitWeight) : undefined,
        weightUnit: row.weightUnit ? String(row.weightUnit) : undefined,
        // 기타
        safeStock: row.safeStock ? Number(row.safeStock) : 0,
        description: row.description ? String(row.description) : '',
      })

      result.importedRows++
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
  processCode?: string       // 공정 코드 (PA/MC/SB/MS/CA) - level 자동 산출용
  crimpCode?: string         // 절압착 품번 (CA 자재용)
}

/**
 * BOM 일괄 등록 (브라우저 호환)
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
    data: [],
  }

  try {
    const workbook = await parseExcelFile(file)
    let data = sheetToJson<Record<string, unknown>>(workbook, options)

    // 한글 헤더 매핑 적용
    data = applyKoreanHeaderMapping<BOMImportRow>(data, 'bom') as unknown as Record<string, unknown>[]

    if (options.columnMapping) {
      data = applyColumnMapping<BOMImportRow>(
        data,
        options.columnMapping
      ) as unknown as Record<string, unknown>[]
    }

    const typedData = data as unknown as BOMImportRow[]
    result.totalRows = typedData.length

    for (let i = 0; i < typedData.length; i++) {
      const row = typedData[i]
      const rowNum = i + 2

      // 필수 필드 검사
      if (!row.productCode || !row.itemCode || !row.quantity) {
        result.errors.push({
          row: rowNum,
          message: '완제품 품번, 자재코드, 소요량은 필수입니다.',
        })
        result.skippedRows++
        continue
      }

      // 브라우저 환경에서는 Prisma 사용 불가
      // 파싱된 데이터를 결과에 추가
      // processCode와 crimpCode를 포함하여 BOMContext에서 level 자동 산출
      result.data?.push({
        productCode: String(row.productCode),
        itemType: row.itemType || 'MATERIAL',
        itemCode: String(row.itemCode),
        quantity: Number(row.quantity),
        unit: row.unit ? String(row.unit) : null,
        processCode: row.processCode ? String(row.processCode).toUpperCase() : null,
        crimpCode: row.crimpCode ? String(row.crimpCode) : null,
      })

      result.importedRows++
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
 * 재고 일괄 등록 (브라우저 호환)
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
    data: [],
  }

  try {
    const workbook = await parseExcelFile(file)
    let data = sheetToJson<Record<string, unknown>>(workbook, options)

    // 한글 헤더 매핑 적용
    data = applyKoreanHeaderMapping<StockImportRow>(data, 'stock') as unknown as Record<string, unknown>[]

    if (options.columnMapping) {
      data = applyColumnMapping<StockImportRow>(
        data,
        options.columnMapping
      ) as unknown as Record<string, unknown>[]
    }

    const typedData = data as unknown as StockImportRow[]
    result.totalRows = typedData.length

    for (let i = 0; i < typedData.length; i++) {
      const row = typedData[i]
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

      // 브라우저 환경에서는 Prisma 사용 불가
      // 파싱된 데이터를 결과에 추가
      result.data?.push({
        materialCode: String(row.materialCode),
        lotNumber: String(row.lotNumber),
        quantity: Number(row.quantity),
        location: row.location ? String(row.location) : null,
      })

      result.importedRows++
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
        // 날짜 형식 변환 (Excel 직렬 날짜 → yyyy-mm-dd)
        const receivedAtValue = excelDateToString(row.receivedAt as string | number | Date) ||
          new Date().toISOString().split('T')[0]

        result.data?.push({
          materialCode: String(row.materialCode),
          materialName: row.materialName ? String(row.materialName) : undefined, // 품명 (본사코드)
          lotNumber: String(row.lotNumber),
          quantity: Number(row.quantity),
          receivedAt: receivedAtValue,
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
    // 품목마스터 관리 양식 (20개 컬럼)
    '선택': '_select',           // 무시
    '프로젝트코드': 'projectCode',
    '경림품번': 'code',
    '품명': 'name',
    '출하 고객품번': 'customerCode',
    '원자재 공급사 품번': 'supplierCode',
    '원자재 공급사 품명': '_supplierName',  // 참조용 (무시)
    'PDA 확인 품번': 'pdaCode',
    '원자재-공급처': 'supplier',
    '도면 SL원자재 품번': '_drawingCode',   // 무시
    '규격1': 'spec',
    '규격2': 'spec2',
    '규격3': 'spec3',
    '전선재질': 'wireMaterial',
    '전선 굵기': 'wireGauge',
    '색상': 'color',
    '품목유형': 'category',
    '단위중량': 'unitWeight',
    '단위': 'unit',
    '중량단위': 'weightUnit',
    // 레거시 호환
    '자재코드*': 'code',
    '품번*': 'code',
    '자재명*': 'name',
    '본사코드': 'hqCode',
    '분류': 'category',
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
      sheetName: '품목마스터',
      headers: [
        '프로젝트코드', '경림품번', '품명', '출하 고객품번',
        '원자재 공급사 품번', 'PDA 확인 품번', '원자재-공급처',
        '규격1', '규격2', '규격3',
        '전선재질', '전선 굵기', '색상',
        '품목유형', '단위', '단위중량', '중량단위'
      ],
      examples: [
        {
          '프로젝트코드': '주자재', '경림품번': '250-351201', '품명': 'PB625-03027',
          '출하 고객품번': '', '원자재 공급사 품번': '', 'PDA 확인 품번': '',
          '원자재-공급처': '한국단자공업', '규격1': '625시리즈', '규격2': '', '규격3': '',
          '전선재질': '', '전선 굵기': '', '색상': '',
          '품목유형': '원재료', '단위': 'EA', '단위중량': '', '중량단위': ''
        },
        {
          '프로젝트코드': '주자재', '경림품번': '210-4917', '품명': 'AVS0.5-BK',
          '출하 고객품번': '', '원자재 공급사 품번': 'C1A1BKR', 'PDA 확인 품번': '',
          '원자재-공급처': '경신전선', '규격1': 'AVS', '규격2': '0.5sq', '규격3': '',
          '전선재질': 'AVS', '전선 굵기': '0.5', '색상': 'BK',
          '품목유형': '원재료', '단위': 'M', '단위중량': 0.0075, '중량단위': 'KG'
        },
        {
          '프로젝트코드': '주자재', '경림품번': '250-8668', '품명': '682028',
          '출하 고객품번': '', '원자재 공급사 품번': '', 'PDA 확인 품번': '682028',
          '원자재-공급처': '우주일렉트로닉스', '규격1': '', '규격2': '', '규격3': '',
          '전선재질': '', '전선 굵기': '', '색상': '',
          '품목유형': '원재료', '단위': 'EA', '단위중량': '', '중량단위': ''
        },
      ],
      guide: [
        '[ 품목마스터 등록 안내 ]',
        '',
        '1. \'품목마스터\' 시트에 데이터를 입력하세요.',
        '2. 경림품번과 품명은 필수 입력입니다.',
        '3. 경림품번은 중복될 수 없습니다.',
        '4. 샘플 데이터(2~4행)는 삭제 후 사용하세요.',
        '',
        '[ 바코드 매칭 필드 - 중요! ]',
        '바코드 스캔 시 아래 필드로 자재를 자동 매칭합니다:',
        '- PDA 확인 품번: PDA 바코드 매칭용 (최우선)',
        '- 원자재 공급사 품번: 공급사 바코드 매칭용',
        '- 품명: 생산처 바코드 매칭용 (품명=바코드코드)',
        '- 경림품번: MES 내부 품번 매칭',
        '',
        '[ 컬럼 설명 ]',
        '- 프로젝트코드: 주자재/부자재 구분',
        '- 경림품번: MES 시스템 내부 품번 (예: 250-351201)',
        '- 품명: 제품명 또는 생산처 품번 (바코드 매칭용)',
        '- 출하 고객품번: 고객사 품번',
        '- 원자재 공급사 품번: 공급사 자체 품번 (바코드 매칭용)',
        '- PDA 확인 품번: PDA 스캔용 품번 (바코드 매칭용)',
        '- 원자재-공급처: 공급사명 (예: 한국단자공업)',
        '- 규격1~3: 제품 규격 정보',
        '- 전선재질: 전선 재질 (AVS, AVSS 등)',
        '- 전선 굵기: 전선 굵기 (0.5, 0.85 등)',
        '- 색상: 제품 색상 (BK, RD, WH 등)',
        '- 품목유형: 원재료/반제품',
        '- 단위: EA, M, SET 등',
        '- 단위중량: 단위당 중량',
        '- 중량단위: KG, G 등',
        '',
        '[ 품목유형 ]',
        '- 원재료: 원자재',
        '- 반제품: 중간 조립품',
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
    material: '품목마스터.xlsx',
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
