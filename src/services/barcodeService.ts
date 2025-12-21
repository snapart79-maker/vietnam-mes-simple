/**
 * Barcode Service
 *
 * 바코드 생성 및 파싱 서비스
 * - V1: 레거시 포맷 (XX-YYMMDD-XXXX)
 * - V2: 신규 포맷 ([Process][ProductCode]Q[Qty]-[ShortCode][YYMMDD]-[LOT])
 * - Bundle: 번들 바코드 (B 접두어)
 */

// ============================================
// Types
// ============================================

export interface BarcodeV1 {
  version: 1
  processCode: string      // 공정 코드 (CA, MC, PA 등)
  date: string             // YYMMDD
  sequence: string         // 일련번호 (0001-9999)
}

export interface BarcodeV2 {
  version: 2
  processCode: string      // 공정 코드
  productCode: string      // 품번
  quantity: number         // 수량
  shortCode: string        // 공정 단축코드
  date: string             // YYMMDD
  sequence: string         // 일련번호
  isBundle: boolean        // 번들 여부
}

export interface ParsedBarcode {
  raw: string
  version: 1 | 2
  processCode: string
  productCode?: string
  quantity?: number
  date: string
  sequence: string
  isBundle: boolean
  isValid: boolean
  errorMessage?: string
}

/**
 * CI 바코드 데이터 타입
 * 형식: CA-{완제품품번}-{수량}-{MarkingLOT 3자리}-{4자리시퀀스}
 * 예시: CA-P00123-100-5MT-0001
 */
export interface CIBarcodeData {
  productCode: string     // 완제품품번
  quantity: number        // 수량
  markingLot: string      // MarkingLOT (3자리 영숫자)
  sequence: string        // 시퀀스 (4자리)
}

export interface ParsedHQBarcode {
  raw: string
  materialCode: string
  lotNumber: string
  quantity?: number
  isValid: boolean
}

// ============================================
// Constants
// ============================================

// 공정 코드 → 단축 코드 매핑
export const PROCESS_SHORT_CODES: Record<string, string> = {
  'MO': 'O',  // 자재출고
  'CA': 'C',  // 자동절압착
  'MC': 'M',  // 수동압착
  'MS': 'S',  // 미드스플라이스
  'SB': 'B',  // 서브조립
  'HS': 'H',  // 열수축
  'SP': 'P',  // 제품조립제공부품
  'PA': 'A',  // 제품조립
  'CI': 'I',  // 회로검사
  'VI': 'V',  // 육안검사
}

// 단축 코드 → 공정 코드 역매핑
export const SHORT_TO_PROCESS: Record<string, string> = Object.fromEntries(
  Object.entries(PROCESS_SHORT_CODES).map(([k, v]) => [v, k])
)

// 바코드 구분자
const SEPARATORS = ['-', '_', '/']

// ============================================
// Date Utilities
// ============================================

/**
 * 현재 날짜를 YYMMDD 포맷으로 반환
 */
export function getDateString(date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

/**
 * YYMMDD 문자열을 Date 객체로 변환
 */
export function parseDateString(dateStr: string): Date | null {
  if (dateStr.length !== 6) return null

  const yy = parseInt(dateStr.slice(0, 2), 10)
  const mm = parseInt(dateStr.slice(2, 4), 10) - 1
  const dd = parseInt(dateStr.slice(4, 6), 10)

  // 20XX년대 가정
  const year = 2000 + yy
  const date = new Date(year, mm, dd)

  // 유효성 검사
  if (date.getFullYear() !== year || date.getMonth() !== mm || date.getDate() !== dd) {
    return null
  }

  return date
}

// ============================================
// V1 Barcode (Legacy)
// ============================================

/**
 * V1 바코드 생성 (레거시 포맷)
 * 형식: XX-YYMMDD-XXXX
 * 예: CA-241220-0001
 *
 * @param processCode 공정 코드 (CA, MC, PA 등)
 * @param sequence 일련번호 (1-9999)
 * @param date 날짜 (기본값: 오늘)
 */
export function generateBarcodeV1(
  processCode: string,
  sequence: number,
  date: Date = new Date()
): string {
  const dateStr = getDateString(date)
  const seqStr = String(sequence).padStart(4, '0')

  return `${processCode.toUpperCase()}-${dateStr}-${seqStr}`
}

/**
 * V1 바코드 파싱
 */
export function parseBarcodeV1(barcode: string): BarcodeV1 | null {
  // 구분자 정규화
  const normalized = normalizeSeparator(barcode)
  const parts = normalized.split('-')

  if (parts.length !== 3) return null

  const [processCode, date, sequence] = parts

  // 유효성 검사
  if (processCode.length !== 2) return null
  if (date.length !== 6 || !/^\d{6}$/.test(date)) return null
  if (sequence.length !== 4 || !/^\d{4}$/.test(sequence)) return null

  return {
    version: 1,
    processCode: processCode.toUpperCase(),
    date,
    sequence,
  }
}

// ============================================
// V2 Barcode (New Format)
// ============================================

/**
 * V2 바코드 생성 (신규 포맷)
 * 형식: [Process][ProductCode]Q[Qty]-[ShortCode][YYMMDD]-[LOT]
 * 예: CAP001Q100-C241220-0001
 *
 * @param processCode 공정 코드
 * @param productCode 품번
 * @param quantity 수량
 * @param sequence 일련번호
 * @param date 날짜 (기본값: 오늘)
 */
export function generateBarcodeV2(
  processCode: string,
  productCode: string,
  quantity: number,
  sequence: number,
  date: Date = new Date()
): string {
  const shortCode = PROCESS_SHORT_CODES[processCode.toUpperCase()] || processCode[0]
  const dateStr = getDateString(date)
  const seqStr = String(sequence).padStart(4, '0')

  return `${processCode.toUpperCase()}${productCode}Q${quantity}-${shortCode}${dateStr}-${seqStr}`
}

/**
 * 번들 바코드 생성
 * 형식: [Process][ProductCode]Q[SetQty]-[ShortCode][YYMMDD]-B[LOT]
 * 예: CAP001Q4-C241220-B001
 *
 * @param processCode 공정 코드
 * @param productCode 품번
 * @param setQuantity 묶음 개수
 * @param sequence 일련번호
 * @param date 날짜 (기본값: 오늘)
 */
export function generateBundleBarcode(
  processCode: string,
  productCode: string,
  setQuantity: number,
  sequence: number,
  date: Date = new Date()
): string {
  const shortCode = PROCESS_SHORT_CODES[processCode.toUpperCase()] || processCode[0]
  const dateStr = getDateString(date)
  const seqStr = String(sequence).padStart(3, '0')

  return `${processCode.toUpperCase()}${productCode}Q${setQuantity}-${shortCode}${dateStr}-B${seqStr}`
}

/**
 * V2 바코드 파싱
 */
export function parseBarcodeV2(barcode: string): BarcodeV2 | null {
  // 구분자 정규화
  const normalized = normalizeSeparator(barcode)
  const parts = normalized.split('-')

  if (parts.length !== 3) return null

  const [productPart, datePart, seqPart] = parts

  // 품번 부분 파싱: [Process][ProductCode]Q[Qty]
  const qIndex = productPart.indexOf('Q')
  if (qIndex === -1) return null

  const processAndProduct = productPart.slice(0, qIndex)
  const quantityStr = productPart.slice(qIndex + 1)

  // 공정 코드 추출 (앞 2글자)
  if (processAndProduct.length < 3) return null
  const processCode = processAndProduct.slice(0, 2)
  const productCode = processAndProduct.slice(2)

  // 수량 파싱
  const quantity = parseInt(quantityStr, 10)
  if (isNaN(quantity)) return null

  // 날짜 부분 파싱: [ShortCode][YYMMDD]
  if (datePart.length !== 7) return null
  const shortCode = datePart[0]
  const date = datePart.slice(1)

  // 일련번호 부분 파싱 (번들 확인)
  const isBundle = seqPart.startsWith('B')
  const sequence = isBundle ? seqPart.slice(1) : seqPart

  return {
    version: 2,
    processCode: processCode.toUpperCase(),
    productCode,
    quantity,
    shortCode,
    date,
    sequence,
    isBundle,
  }
}

// ============================================
// Universal Parser
// ============================================

/**
 * 구분자 정규화 (-, _, / → -)
 */
function normalizeSeparator(barcode: string): string {
  let result = barcode
  for (const sep of SEPARATORS) {
    result = result.split(sep).join('-')
  }
  return result
}

/**
 * 바코드 버전 감지
 */
export function detectBarcodeVersion(barcode: string): 1 | 2 | null {
  const normalized = normalizeSeparator(barcode)

  // V2: Q가 포함되어 있음
  if (normalized.includes('Q')) {
    return 2
  }

  // V1: XX-YYMMDD-XXXX 패턴
  const parts = normalized.split('-')
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 6 && parts[2].length === 4) {
    return 1
  }

  return null
}

/**
 * 범용 바코드 파싱
 * V1/V2 자동 감지
 */
export function parseBarcode(barcode: string): ParsedBarcode {
  const raw = barcode.trim()

  if (!raw) {
    return {
      raw,
      version: 1,
      processCode: '',
      date: '',
      sequence: '',
      isBundle: false,
      isValid: false,
      errorMessage: '빈 바코드입니다.',
    }
  }

  const version = detectBarcodeVersion(raw)

  if (version === 2) {
    const parsed = parseBarcodeV2(raw)
    if (parsed) {
      return {
        raw,
        version: 2,
        processCode: parsed.processCode,
        productCode: parsed.productCode,
        quantity: parsed.quantity,
        date: parsed.date,
        sequence: parsed.sequence,
        isBundle: parsed.isBundle,
        isValid: true,
      }
    }
  } else if (version === 1) {
    const parsed = parseBarcodeV1(raw)
    if (parsed) {
      return {
        raw,
        version: 1,
        processCode: parsed.processCode,
        date: parsed.date,
        sequence: parsed.sequence,
        isBundle: false,
        isValid: true,
      }
    }
  }

  return {
    raw,
    version: 1,
    processCode: '',
    date: '',
    sequence: '',
    isBundle: false,
    isValid: false,
    errorMessage: '바코드 형식을 인식할 수 없습니다.',
  }
}

// ============================================
// HQ (본사) Barcode Parser
// ============================================

/**
 * 본사 바코드 파싱
 * 다양한 형식 지원
 *
 * 형식 예시:
 * - M-WIRE-001-L20241220-0001
 * - WIRE001/LOT20241220/100
 */
export function parseHQBarcode(barcode: string): ParsedHQBarcode {
  const raw = barcode.trim()

  if (!raw) {
    return {
      raw,
      materialCode: '',
      lotNumber: '',
      isValid: false,
    }
  }

  // 구분자로 분리
  const normalized = normalizeSeparator(raw)
  const parts = normalized.split('-').filter(Boolean)

  if (parts.length < 2) {
    return {
      raw,
      materialCode: raw,
      lotNumber: raw,
      isValid: true,  // 단순 문자열도 허용
    }
  }

  // 첫 번째 파트가 자재 코드
  // LOT 관련 파트 찾기
  let materialCode = parts[0]
  let lotNumber = raw
  let quantity: number | undefined

  // L 또는 LOT로 시작하는 파트 찾기
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (part.startsWith('L') || part.startsWith('LOT')) {
      lotNumber = part
    } else if (/^\d+$/.test(part)) {
      // 숫자만 있으면 수량으로 간주
      quantity = parseInt(part, 10)
    }
  }

  // 자재 코드가 M-로 시작하면 결합
  if (materialCode === 'M' && parts.length > 1) {
    materialCode = `${parts[0]}-${parts[1]}`
    if (parts.length > 2) {
      materialCode += `-${parts[2]}`
    }
  }

  return {
    raw,
    materialCode,
    lotNumber,
    quantity,
    isValid: true,
  }
}

// ============================================
// Validation
// ============================================

/**
 * 바코드 유효성 검사
 */
export function validateBarcode(barcode: string): {
  isValid: boolean
  version?: 1 | 2
  errorMessage?: string
} {
  const parsed = parseBarcode(barcode)

  if (!parsed.isValid) {
    return {
      isValid: false,
      errorMessage: parsed.errorMessage,
    }
  }

  // 날짜 유효성
  const date = parseDateString(parsed.date)
  if (!date) {
    return {
      isValid: false,
      version: parsed.version,
      errorMessage: '날짜 형식이 올바르지 않습니다.',
    }
  }

  // 미래 날짜 체크 (7일 후까지 허용)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 7)
  if (date > maxDate) {
    return {
      isValid: false,
      version: parsed.version,
      errorMessage: '미래 날짜의 바코드입니다.',
    }
  }

  // 공정 코드 유효성
  const validProcessCodes = Object.keys(PROCESS_SHORT_CODES)
  if (!validProcessCodes.includes(parsed.processCode)) {
    return {
      isValid: false,
      version: parsed.version,
      errorMessage: `알 수 없는 공정 코드입니다: ${parsed.processCode}`,
    }
  }

  return {
    isValid: true,
    version: parsed.version,
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * 공정 코드로 공정명 반환
 */
export function getProcessName(processCode: string): string {
  const names: Record<string, string> = {
    'MO': '자재출고',
    'CA': '자동절압착',
    'MC': '수동압착',
    'MS': '미드스플라이스',
    'SB': '서브조립',
    'HS': '열수축',
    'SP': '제품조립제공부품',
    'PA': '제품조립',
    'CI': '회로검사',
    'VI': '육안검사',
  }
  return names[processCode.toUpperCase()] || processCode
}

/**
 * 바코드에서 공정 흐름 순서 반환
 */
export function getProcessOrder(processCode: string): number {
  const order: Record<string, number> = {
    'MO': 1,
    'CA': 2,
    'MC': 3,
    'MS': 4,
    'SB': 5,
    'SP': 6,
    'PA': 7,
    'HS': 8,
    'CI': 9,
    'VI': 10,
  }
  return order[processCode.toUpperCase()] || 99
}

/**
 * 바코드 정보를 사람이 읽을 수 있는 형태로 변환
 */
export function formatBarcodeInfo(barcode: string): string {
  const parsed = parseBarcode(barcode)

  if (!parsed.isValid) {
    return `잘못된 바코드: ${parsed.errorMessage}`
  }

  const processName = getProcessName(parsed.processCode)
  const dateObj = parseDateString(parsed.date)
  const dateStr = dateObj
    ? `${dateObj.getFullYear()}.${dateObj.getMonth() + 1}.${dateObj.getDate()}`
    : parsed.date

  if (parsed.version === 2) {
    const bundleStr = parsed.isBundle ? ' (번들)' : ''
    return `[${processName}] ${parsed.productCode} - ${parsed.quantity}개 | ${dateStr} #${parsed.sequence}${bundleStr}`
  }

  return `[${processName}] ${dateStr} #${parsed.sequence}`
}

// ============================================
// CI Barcode (Circuit Inspection)
// ============================================

/**
 * CI 바코드 정규식 패턴
 * 형식: CA-{완제품품번}-{수량}-{MarkingLOT 3자리}-{4자리시퀀스}
 * 예시: CA-P00123-100-5MT-0001
 */
export const CI_BARCODE_PATTERN = /^CA-([A-Z0-9]+)-(\d+)-([A-Z0-9]{3})-(\d{4})$/

/**
 * CI 바코드 생성
 * 형식: CA-{완제품품번}-{수량}-{MarkingLOT}-{4자리시퀀스}
 * 예: CA-P00123-100-5MT-0001
 *
 * @param productCode 완제품품번
 * @param quantity 수량
 * @param markingLot MarkingLOT (3자리 영숫자)
 * @param sequence 시퀀스 번호 (1-9999)
 */
export function generateCIBarcode(
  productCode: string,
  quantity: number,
  markingLot: string,
  sequence: number
): string {
  // 유효성 검사
  if (!productCode || productCode.trim().length === 0) {
    throw new Error('완제품품번이 필요합니다.')
  }

  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('수량은 양의 정수여야 합니다.')
  }

  if (!markingLot || markingLot.length !== 3 || !/^[A-Z0-9]{3}$/.test(markingLot.toUpperCase())) {
    throw new Error('MarkingLOT은 3자리 영숫자여야 합니다.')
  }

  if (sequence < 1 || sequence > 9999 || !Number.isInteger(sequence)) {
    throw new Error('시퀀스는 1-9999 사이의 정수여야 합니다.')
  }

  const seqStr = String(sequence).padStart(4, '0')

  return `CA-${productCode.toUpperCase()}-${quantity}-${markingLot.toUpperCase()}-${seqStr}`
}

/**
 * CI 바코드 파싱
 * @param barcode CI 바코드 문자열
 * @returns 파싱된 CI 바코드 데이터 또는 null (유효하지 않은 경우)
 */
export function parseCIBarcode(barcode: string): CIBarcodeData | null {
  if (!barcode || typeof barcode !== 'string') {
    return null
  }

  const trimmed = barcode.trim().toUpperCase()
  const match = CI_BARCODE_PATTERN.exec(trimmed)

  if (!match) {
    return null
  }

  const [, productCode, quantityStr, markingLot, sequence] = match
  const quantity = parseInt(quantityStr, 10)

  if (isNaN(quantity) || quantity <= 0) {
    return null
  }

  return {
    productCode,
    quantity,
    markingLot,
    sequence,
  }
}

/**
 * CI 바코드 유효성 검사
 * @param barcode 검사할 바코드 문자열
 * @returns 유효 여부
 */
export function validateCIBarcode(barcode: string): boolean {
  return parseCIBarcode(barcode) !== null
}

/**
 * CI 바코드 여부 감지
 * @param barcode 바코드 문자열
 * @returns CI 바코드 여부
 */
export function isCIBarcode(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') {
    return false
  }
  return CI_BARCODE_PATTERN.test(barcode.trim().toUpperCase())
}

/**
 * CI 바코드 정보를 사람이 읽을 수 있는 형태로 변환
 * @param barcode CI 바코드 문자열
 * @returns 포맷된 정보 문자열
 */
export function formatCIBarcodeInfo(barcode: string): string {
  const parsed = parseCIBarcode(barcode)

  if (!parsed) {
    return `잘못된 CI 바코드: ${barcode}`
  }

  return `[회로검사] ${parsed.productCode} - ${parsed.quantity}개 | Marking: ${parsed.markingLot} #${parsed.sequence}`
}
