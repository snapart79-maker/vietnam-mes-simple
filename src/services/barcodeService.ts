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
 * V2 바코드 생성 (BARCORD 호환)
 * 형식: {품번}Q{수량}-{공정단축코드}{YYMMDD}-{시퀀스3자리}
 * 예: 00299318Q100-C251223-001
 *
 * @param processCode 공정 코드
 * @param productCode 품번
 * @param quantity 수량
 * @param sequence 일련번호 (1-999)
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
  // BARCORD 호환: 3자리 일련번호
  const seqStr = String(sequence).padStart(3, '0')

  // BARCORD 형식: 품번Q수량-공정단축코드날짜-시퀀스
  return `${productCode}Q${quantity}-${shortCode}${dateStr}-${seqStr}`
}

/**
 * 번들 바코드 생성 (Barcord 호환)
 * 형식: BD-{완제품품번}-{YYMMDD}-{일련번호(3자리)}
 * 예: BD-00299318-241211-001
 *
 * Barcord bundle_service.py 참조 (BARCORD_IMPLEMENTATION_GUIDE.md 섹션 5.2):
 * - BD 접두어 사용 (Bundle의 약자)
 * - 일련번호 3자리
 *
 * @param productCode 완제품 품번
 * @param _setQuantity 세트 수량 (포함된 CA 바코드 개수) - 바코드에 포함되지 않음
 * @param sequence 일련번호 (1-999)
 * @param date 날짜 (기본값: 오늘)
 */
export function generateBundleBarcode(
  productCode: string,
  _setQuantity: number,
  sequence: number,
  date: Date = new Date()
): string {
  const dateStr = getDateString(date)
  // Barcord 호환: 3자리 일련번호
  const seqStr = String(sequence).padStart(3, '0')

  // 형식: BD-{완제품품번}-{날짜}-{일련번호}
  return `BD-${productCode}-${dateStr}-${seqStr}`
}

/**
 * 완료 시점 LOT 번호 생성 (V3)
 * 형식: {공정코드}{반제품품번}Q{완료수량}-{YYMMDD}-{일련번호3자리}
 * 예: CA00315452-001Q100-241224-001
 *
 * @param processCode 공정 코드 (CA, MC, SB 등)
 * @param semiProductCode 반제품 품번 (절압착 품번, 예: 00315452-001)
 * @param completedQty 완료 수량 (실제 양품 수량)
 * @param sequence 일련번호 (1-999)
 * @param date 날짜 (기본값: 오늘)
 */
export function generateCompletionLotNumber(
  processCode: string,
  semiProductCode: string,
  completedQty: number,
  sequence: number,
  date: Date = new Date()
): string {
  const dateStr = getDateString(date)
  const seqStr = String(sequence).padStart(3, '0')

  // 형식: {공정코드}{반제품품번}Q{완료수량}-{YYMMDD}-{일련번호}
  return `${processCode}${semiProductCode}Q${completedQty}-${dateStr}-${seqStr}`
}

/**
 * 임시 LOT 번호 생성 (작업 등록 시 사용)
 * 형식: TMP-{공정코드}-{timestamp}
 * 예: TMP-CA-1735012345678
 *
 * @param processCode 공정 코드
 */
export function generateTempLotNumber(processCode: string): string {
  return `TMP-${processCode}-${Date.now()}`
}

/**
 * 임시 LOT 번호인지 확인
 */
export function isTempLotNumber(lotNumber: string): boolean {
  return lotNumber.startsWith('TMP-')
}

/**
 * V2 바코드 파싱 (BARCORD 호환)
 *
 * BARCORD 형식: {품번}Q{수량}-{공정단축코드}{YYMMDD}-{시퀀스3자리}
 * 예: 00299318Q100-C251223-001
 *
 * 레거시 형식도 지원: [Process][ProductCode]Q[Qty]-[ShortCode][YYMMDD]-[LOT]
 */
export function parseBarcodeV2(barcode: string): BarcodeV2 | null {
  // 구분자 정규화
  const normalized = normalizeSeparator(barcode)
  const parts = normalized.split('-')

  if (parts.length !== 3) return null

  const [productPart, datePart, seqPart] = parts

  // 품번 부분 파싱: [ProductCode]Q[Qty] 또는 [Process][ProductCode]Q[Qty]
  const qIndex = productPart.indexOf('Q')
  if (qIndex === -1) return null

  const beforeQ = productPart.slice(0, qIndex)
  const quantityStr = productPart.slice(qIndex + 1)

  // 수량 파싱
  const quantity = parseInt(quantityStr, 10)
  if (isNaN(quantity)) return null

  // 품번 추출 (BARCORD: 공정코드 없음, 레거시: 앞 2글자가 공정코드)
  let productCode: string
  let processCode: string

  // 날짜 부분에서 공정 단축코드 추출
  let shortCode: string
  let date: string
  let isBundle: boolean = false

  if (datePart.length === 7) {
    // 일반 바코드: shortCode(1자리) + 날짜(6자리)
    shortCode = datePart[0]
    date = datePart.slice(1)

    // 단축코드로 공정코드 역산
    processCode = SHORT_TO_PROCESS[shortCode.toUpperCase()] || shortCode

    // BARCORD 형식: beforeQ가 순수 품번
    // 레거시 형식: beforeQ 앞 2글자가 공정코드
    if (beforeQ.length > 2 && beforeQ.slice(0, 2).toUpperCase() === processCode) {
      // 레거시 형식 (CA00299318 형태)
      productCode = beforeQ.slice(2)
    } else {
      // BARCORD 형식 (00299318 형태)
      productCode = beforeQ
    }
  } else if (datePart.length === 6 && /^\d{6}$/.test(datePart)) {
    // 번들 바코드 (레거시): 날짜만 있음
    shortCode = ''
    date = datePart
    productCode = beforeQ.length > 2 ? beforeQ.slice(2) : beforeQ
    processCode = beforeQ.slice(0, 2)
    isBundle = true
  } else {
    return null
  }

  // 일련번호 파싱
  // 레거시 B 접두어 호환성 유지
  const hasBPrefix = seqPart.startsWith('B')
  const sequence = hasBPrefix ? seqPart.slice(1) : seqPart

  // B 접두어가 있으면 번들로 처리 (레거시 호환)
  if (hasBPrefix) {
    isBundle = true
  }

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

/**
 * 번들 바코드 여부 확인
 * Barcord 형식: BD-{productCode}-{YYMMDD}-{seq(3자리)}
 * 예시: BD-00299318-241211-001
 */
export function isBundleBarcode(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') {
    return false
  }
  const normalized = normalizeSeparator(barcode.trim().toUpperCase())
  // BD 접두어로 시작하는지 확인
  return normalized.startsWith('BD-')
}

/**
 * Bundle 바코드 정규식 패턴
 * 형식: BD-{productCode}-{YYMMDD}-{seq(3자리)}
 */
export const BUNDLE_BARCODE_PATTERN = /^BD-([A-Z0-9]+)-(\d{6})-(\d{3})$/i

/**
 * Bundle 바코드 파싱된 데이터 타입
 */
export interface ParsedBundleBarcode {
  productCode: string    // 완제품 품번
  date: string           // YYMMDD
  sequence: string       // 3자리 시퀀스
}

/**
 * Bundle 바코드 파싱
 * 형식: BD-{productCode}-{YYMMDD}-{seq(3자리)}
 * 예시: BD-00299318-241211-001
 */
export function parseBundleBarcode(barcode: string): ParsedBundleBarcode | null {
  if (!barcode || typeof barcode !== 'string') {
    return null
  }

  const trimmed = barcode.trim().toUpperCase()
  const match = BUNDLE_BARCODE_PATTERN.exec(trimmed)

  if (!match) {
    return null
  }

  const [, productCode, date, sequence] = match

  return {
    productCode,
    date,
    sequence,
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
 * 'bundle' 타입 추가 (BD- 접두어)
 * 'po' 타입 추가 (발주서 바코드: -PO 포함)
 */
export function detectBarcodeVersion(barcode: string): 1 | 2 | 'bundle' | 'po' | null {
  const normalized = normalizeSeparator(barcode).toUpperCase()

  // Bundle: BD-로 시작
  if (normalized.startsWith('BD-')) {
    return 'bundle'
  }

  // PO (발주서): -PO 포함
  if (normalized.includes('-PO') && PO_BARCODE_PATTERN.test(normalized)) {
    return 'po'
  }

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
 * V1/V2/Bundle 자동 감지
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

  // Bundle 바코드: BD-{productCode}-{YYMMDD}-{seq}
  if (version === 'bundle') {
    const parsed = parseBundleBarcode(raw)
    if (parsed) {
      return {
        raw,
        version: 2,
        processCode: 'BD',  // Bundle 식별용
        productCode: parsed.productCode,
        quantity: undefined,
        date: parsed.date,
        sequence: parsed.sequence,
        isBundle: true,
        isValid: true,
      }
    }
  }

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
 * 본사 바코드 패턴 정규식
 * 패턴 1: P{hqCode}Q{quantity}S{lotInfo}V{version}
 *   예: P682028Q20000S250922V1
 * 패턴 2: P{hqCode}Q{quantity}S{lotInfo} (버전 없음)
 *   예: P210-8624Q1500S2025100201180
 */
const HQ_BARCODE_PATTERN = /^P([A-Z0-9-]+)Q(\d+)S(.+?)(?:V(\d+))?$/i

/**
 * 본사 바코드 파싱
 * 다양한 형식 지원
 *
 * 형식 예시:
 * - P682028Q20000S250922V1 → hqCode=682028, qty=20000
 * - P210-8624Q1500S2025100201180 → hqCode=210-8624, qty=1500
 * - KH1200030-22:12000:50603KDR20701B021 (기타 형식)
 * - 100188305110201171101 (숫자만)
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

  // 패턴 1: P{hqCode}Q{qty}S{lot}V{ver} 형식
  const pMatch = HQ_BARCODE_PATTERN.exec(raw)
  if (pMatch) {
    const [, hqCode, qtyStr, lotInfo] = pMatch
    return {
      raw,
      materialCode: hqCode,  // 본사 코드 (682028 등)
      lotNumber: raw,        // 전체 바코드를 LOT 번호로 사용
      quantity: parseInt(qtyStr, 10),
      isValid: true,
    }
  }

  // 패턴 2: 콜론(:) 구분자 형식 (KH1200030-22:12000:...)
  if (raw.includes(':')) {
    const colonParts = raw.split(':')
    if (colonParts.length >= 2) {
      // 첫 부분에서 자재 코드 추출
      const firstPart = colonParts[0]
      // 두 번째 부분이 숫자면 수량
      const qty = parseInt(colonParts[1], 10)
      return {
        raw,
        materialCode: firstPart.replace(/^[A-Z]+/, ''), // 접두사 제거
        lotNumber: raw,
        quantity: isNaN(qty) ? undefined : qty,
        isValid: true,
      }
    }
  }

  // 패턴 3: 구분자로 분리
  const normalized = normalizeSeparator(raw)
  const parts = normalized.split('-').filter(Boolean)

  if (parts.length < 2) {
    // 단순 숫자/문자열 - 그대로 사용
    return {
      raw,
      materialCode: raw,
      lotNumber: raw,
      isValid: true,
    }
  }

  // 첫 번째 파트가 자재 코드
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
    'CQ': '압착검사',
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
    const bundleStr = parsed.isBundle ? ' (Bundle)' : ''
    return `[${processName}] ${parsed.productCode} - ${parsed.quantity} | ${dateStr} #${parsed.sequence}${bundleStr}`
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

// ============================================
// BARCORD Compatible CI/VI Barcode
// ============================================

/**
 * BARCORD 호환 CI 바코드 타입
 * 형식: CI-{markingLot}-{4자리시퀀스}
 * 예시: CI-5MT-0001
 */
export interface BarcordCIBarcode {
  type: 'CI'
  markingLot: string   // 3자리 영숫자 (예: 5MT)
  sequence: string     // 4자리 시퀀스 (예: 0001)
}

/**
 * BARCORD 호환 VI 바코드 타입
 * 형식: VI-{markingLot}-{4자리시퀀스}
 * 예시: VI-5MT-0001
 */
export interface BarcordVIBarcode {
  type: 'VI'
  markingLot: string   // 3자리 영숫자 (예: 5MT)
  sequence: string     // 4자리 시퀀스 (예: 0001)
}

/**
 * BARCORD 형식 CI 바코드 정규식 패턴
 * 형식: CI-{markingLot 3자리}-{4자리시퀀스}
 */
export const BARCORD_CI_PATTERN = /^CI-([A-Z0-9]{3})-(\d{4})$/i

/**
 * BARCORD 형식 VI 바코드 정규식 패턴
 * 형식: VI-{markingLot 3자리}-{4자리시퀀스}
 */
export const BARCORD_VI_PATTERN = /^VI-([A-Z0-9]{3})-(\d{4})$/i

/**
 * BARCORD 호환 CI 바코드 생성
 * 형식: CI-{markingLot}-{4자리시퀀스}
 * 예시: CI-5MT-0001
 *
 * @param markingLot 마킹LOT (3자리 영숫자)
 * @param sequence 시퀀스 번호 (1-9999)
 */
export function generateBarcordCIBarcode(
  markingLot: string,
  sequence: number
): string {
  if (!markingLot || markingLot.length !== 3 || !/^[A-Z0-9]{3}$/i.test(markingLot)) {
    throw new Error('마킹LOT은 3자리 영숫자여야 합니다.')
  }

  if (sequence < 1 || sequence > 9999 || !Number.isInteger(sequence)) {
    throw new Error('시퀀스는 1-9999 사이의 정수여야 합니다.')
  }

  const seqStr = String(sequence).padStart(4, '0')
  return `CI-${markingLot.toUpperCase()}-${seqStr}`
}

/**
 * BARCORD 호환 VI 바코드 생성
 * 형식: VI-{markingLot}-{4자리시퀀스}
 * 예시: VI-5MT-0001
 *
 * @param markingLot 마킹LOT (3자리 영숫자)
 * @param sequence 시퀀스 번호 (1-9999)
 */
export function generateBarcordVIBarcode(
  markingLot: string,
  sequence: number
): string {
  if (!markingLot || markingLot.length !== 3 || !/^[A-Z0-9]{3}$/i.test(markingLot)) {
    throw new Error('마킹LOT은 3자리 영숫자여야 합니다.')
  }

  if (sequence < 1 || sequence > 9999 || !Number.isInteger(sequence)) {
    throw new Error('시퀀스는 1-9999 사이의 정수여야 합니다.')
  }

  const seqStr = String(sequence).padStart(4, '0')
  return `VI-${markingLot.toUpperCase()}-${seqStr}`
}

/**
 * BARCORD 형식 CI 바코드 파싱
 */
export function parseBarcordCIBarcode(barcode: string): BarcordCIBarcode | null {
  if (!barcode || typeof barcode !== 'string') {
    return null
  }

  const trimmed = barcode.trim().toUpperCase()
  const match = BARCORD_CI_PATTERN.exec(trimmed)

  if (!match) {
    return null
  }

  const [, markingLot, sequence] = match

  return {
    type: 'CI',
    markingLot,
    sequence,
  }
}

/**
 * BARCORD 형식 VI 바코드 파싱
 */
export function parseBarcordVIBarcode(barcode: string): BarcordVIBarcode | null {
  if (!barcode || typeof barcode !== 'string') {
    return null
  }

  const trimmed = barcode.trim().toUpperCase()
  const match = BARCORD_VI_PATTERN.exec(trimmed)

  if (!match) {
    return null
  }

  const [, markingLot, sequence] = match

  return {
    type: 'VI',
    markingLot,
    sequence,
  }
}

/**
 * BARCORD 형식 CI 바코드 여부 확인
 */
export function isBarcordCIBarcode(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') {
    return false
  }
  return BARCORD_CI_PATTERN.test(barcode.trim().toUpperCase())
}

/**
 * BARCORD 형식 VI 바코드 여부 확인
 */
export function isBarcordVIBarcode(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') {
    return false
  }
  return BARCORD_VI_PATTERN.test(barcode.trim().toUpperCase())
}

/**
 * BARCORD 형식 CI/VI 바코드 여부 확인 (둘 중 하나)
 */
export function isBarcordInspectionBarcode(barcode: string): boolean {
  return isBarcordCIBarcode(barcode) || isBarcordVIBarcode(barcode)
}

/**
 * BARCORD 형식 CI/VI 바코드 정보 포맷
 */
export function formatBarcordInspectionInfo(barcode: string): string {
  const ciParsed = parseBarcordCIBarcode(barcode)
  if (ciParsed) {
    return `[회로검사] 마킹LOT: ${ciParsed.markingLot} #${ciParsed.sequence}`
  }

  const viParsed = parseBarcordVIBarcode(barcode)
  if (viParsed) {
    return `[육안검사] 마킹LOT: ${viParsed.markingLot} #${viParsed.sequence}`
  }

  return `잘못된 검사 바코드: ${barcode}`
}

// ============================================
// PO (Purchase Order) Barcode - 발주서 바코드
// ============================================

/**
 * 발주서 바코드 타입
 * 형식: {품번}Q{수량}-PO{YYMMDD}-{3자리시퀀스}
 * 예시: 00315452Q100-PO251225-001
 */
export interface ParsedPOBarcode {
  type: 'PO'
  productCode: string    // 완제품/절압착 품번
  quantity: number       // 계획 수량
  orderDate: string      // YYMMDD
  sequence: string       // 3자리 시퀀스
}

/**
 * 발주서 바코드 정규식 패턴
 * 형식: {품번}Q{수량}-PO{YYMMDD}-{3자리시퀀스}
 */
export const PO_BARCODE_PATTERN = /^([A-Z0-9-]+)Q(\d+)-PO(\d{6})-(\d{3})$/i

/**
 * 발주서 바코드 생성
 * 형식: {품번}Q{수량}-PO{YYMMDD}-{3자리시퀀스}
 * 예시: 00315452Q100-PO251225-001
 *
 * @param productCode 완제품 또는 절압착 품번
 * @param quantity 계획 수량
 * @param orderDate 생산 예정일
 * @param sequence 일련번호 (1-999)
 */
export function generatePOBarcode(
  productCode: string,
  quantity: number,
  orderDate: Date,
  sequence: number
): string {
  if (!productCode || productCode.trim().length === 0) {
    throw new Error('품번이 필요합니다.')
  }

  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('수량은 양의 정수여야 합니다.')
  }

  if (sequence < 1 || sequence > 999 || !Number.isInteger(sequence)) {
    throw new Error('시퀀스는 1-999 사이의 정수여야 합니다.')
  }

  const dateStr = getDateString(orderDate)
  const seqStr = String(sequence).padStart(3, '0')

  return `${productCode}Q${quantity}-PO${dateStr}-${seqStr}`
}

/**
 * 발주서 바코드 파싱
 * @param barcode 발주서 바코드 문자열
 * @returns 파싱된 발주서 바코드 데이터 또는 null
 */
export function parsePOBarcode(barcode: string): ParsedPOBarcode | null {
  if (!barcode || typeof barcode !== 'string') {
    return null
  }

  const trimmed = barcode.trim().toUpperCase()
  const match = PO_BARCODE_PATTERN.exec(trimmed)

  if (!match) {
    return null
  }

  const [, productCode, quantityStr, orderDate, sequence] = match
  const quantity = parseInt(quantityStr, 10)

  if (isNaN(quantity) || quantity <= 0) {
    return null
  }

  return {
    type: 'PO',
    productCode,
    quantity,
    orderDate,
    sequence,
  }
}

/**
 * 발주서 바코드 여부 확인
 * @param barcode 바코드 문자열
 * @returns 발주서 바코드 여부
 */
export function isPOBarcode(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') {
    return false
  }
  // PO 바코드는 -PO 를 포함함
  const normalized = barcode.trim().toUpperCase()
  return normalized.includes('-PO') && PO_BARCODE_PATTERN.test(normalized)
}

/**
 * 발주서 바코드 유효성 검사
 * @param barcode 검사할 바코드 문자열
 * @returns 유효 여부
 */
export function validatePOBarcode(barcode: string): boolean {
  return parsePOBarcode(barcode) !== null
}

/**
 * 발주서 바코드 정보를 사람이 읽을 수 있는 형태로 변환
 * @param barcode 발주서 바코드 문자열
 * @returns 포맷된 정보 문자열
 */
export function formatPOBarcodeInfo(barcode: string): string {
  const parsed = parsePOBarcode(barcode)

  if (!parsed) {
    return `잘못된 발주서 바코드: ${barcode}`
  }

  const dateObj = parseDateString(parsed.orderDate)
  const dateStr = dateObj
    ? `${dateObj.getFullYear()}.${dateObj.getMonth() + 1}.${dateObj.getDate()}`
    : parsed.orderDate

  return `[발주서] ${parsed.productCode} - ${parsed.quantity}개 | 생산일: ${dateStr} #${parsed.sequence}`
}
