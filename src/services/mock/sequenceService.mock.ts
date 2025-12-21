/**
 * Sequence Service (Mock)
 *
 * 브라우저 개발용 Mock 시퀀스 서비스
 * - 공정별/날짜별 일련번호 관리
 * - CI 바코드 전용 시퀀스 관리
 */

// ============================================
// Types
// ============================================

export interface SequenceResult {
  prefix: string
  dateKey: string
  sequence: number
  formatted: string
}

export interface SequenceInfo {
  prefix: string
  dateKey: string
  lastNumber: number
  createdAt: Date
  updatedAt: Date
}

export interface CISequenceResult {
  productCode: string
  markingLot: string
  sequence: number
  formatted: string
}

// ============================================
// Mock Data Storage
// ============================================

// 시퀀스 카운터 저장소: { prefix_dateKey: lastNumber }
const MOCK_SEQUENCES: Record<string, { lastNumber: number; createdAt: Date; updatedAt: Date }> = {}

// ============================================
// Helper Functions
// ============================================

function getDateString(date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

function makeKey(prefix: string, dateKey: string): string {
  return `${prefix}_${dateKey}`
}

// ============================================
// Core Functions
// ============================================

/**
 * 다음 일련번호 생성 (Mock)
 */
export async function getNextSequence(
  prefix: string,
  date: Date = new Date(),
  padding: number = 4
): Promise<SequenceResult> {
  await new Promise((r) => setTimeout(r, 50))

  const dateKey = getDateString(date)
  const key = makeKey(prefix, dateKey)

  if (!MOCK_SEQUENCES[key]) {
    MOCK_SEQUENCES[key] = {
      lastNumber: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  MOCK_SEQUENCES[key].lastNumber++
  MOCK_SEQUENCES[key].updatedAt = new Date()

  const sequence = MOCK_SEQUENCES[key].lastNumber

  if (sequence > 9999) {
    throw new Error(`시퀀스 한계 초과: ${prefix}-${dateKey} (max: 9999)`)
  }

  return {
    prefix,
    dateKey,
    sequence,
    formatted: String(sequence).padStart(padding, '0'),
  }
}

/**
 * 번들 전용 일련번호 생성 (Mock)
 */
export async function getNextBundleSequence(
  processCode: string,
  date: Date = new Date()
): Promise<SequenceResult> {
  const prefix = `${processCode.toUpperCase()}_BUNDLE`
  return getNextSequence(prefix, date, 3)
}

/**
 * 현재 시퀀스 값 조회 (Mock)
 */
export async function getCurrentSequence(
  prefix: string,
  date: Date = new Date()
): Promise<number> {
  await new Promise((r) => setTimeout(r, 30))

  const dateKey = getDateString(date)
  const key = makeKey(prefix, dateKey)

  return MOCK_SEQUENCES[key]?.lastNumber ?? 0
}

/**
 * 시퀀스 리셋 (Mock)
 */
export async function resetSequence(
  prefix: string,
  date?: Date
): Promise<void> {
  await new Promise((r) => setTimeout(r, 30))

  if (date) {
    const dateKey = getDateString(date)
    const key = makeKey(prefix, dateKey)
    if (MOCK_SEQUENCES[key]) {
      MOCK_SEQUENCES[key].lastNumber = 0
      MOCK_SEQUENCES[key].updatedAt = new Date()
    }
  } else {
    // 해당 prefix의 모든 날짜 시퀀스 리셋
    for (const key of Object.keys(MOCK_SEQUENCES)) {
      if (key.startsWith(`${prefix}_`)) {
        MOCK_SEQUENCES[key].lastNumber = 0
        MOCK_SEQUENCES[key].updatedAt = new Date()
      }
    }
  }
}

/**
 * 모든 시퀀스 정보 조회 (Mock)
 */
export async function getAllSequences(date?: Date): Promise<SequenceInfo[]> {
  await new Promise((r) => setTimeout(r, 50))

  const targetDateKey = date ? getDateString(date) : null

  const results: SequenceInfo[] = []

  for (const [key, data] of Object.entries(MOCK_SEQUENCES)) {
    const [prefix, dateKey] = key.split('_')

    if (targetDateKey && dateKey !== targetDateKey) {
      continue
    }

    results.push({
      prefix,
      dateKey,
      lastNumber: data.lastNumber,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    })
  }

  return results.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

// ============================================
// CI Barcode Sequence (Mock)
// ============================================

/**
 * CI 바코드 전용 일련번호 생성 (Mock)
 * 품번 + MarkingLOT 조합으로 고유 시퀀스 관리
 */
export async function getNextCISequence(
  productCode: string,
  markingLot: string
): Promise<CISequenceResult> {
  await new Promise((r) => setTimeout(r, 50))

  const prefix = `CI_${productCode.toUpperCase()}_${markingLot.toUpperCase()}`
  const dateKey = 'CI' // CI는 날짜 기반이 아님
  const key = makeKey(prefix, dateKey)

  if (!MOCK_SEQUENCES[key]) {
    MOCK_SEQUENCES[key] = {
      lastNumber: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  MOCK_SEQUENCES[key].lastNumber++
  MOCK_SEQUENCES[key].updatedAt = new Date()

  const sequence = MOCK_SEQUENCES[key].lastNumber

  if (sequence > 9999) {
    throw new Error(`CI 시퀀스 한계 초과: ${productCode}-${markingLot} (max: 9999)`)
  }

  return {
    productCode: productCode.toUpperCase(),
    markingLot: markingLot.toUpperCase(),
    sequence,
    formatted: String(sequence).padStart(4, '0'),
  }
}

/**
 * CI 시퀀스 현재값 조회 (Mock)
 */
export async function getCurrentCISequence(
  productCode: string,
  markingLot: string
): Promise<number> {
  await new Promise((r) => setTimeout(r, 30))

  const prefix = `CI_${productCode.toUpperCase()}_${markingLot.toUpperCase()}`
  const key = makeKey(prefix, 'CI')

  return MOCK_SEQUENCES[key]?.lastNumber ?? 0
}

/**
 * CI 시퀀스 리셋 (Mock)
 */
export async function resetCISequence(
  productCode: string,
  markingLot?: string
): Promise<void> {
  await new Promise((r) => setTimeout(r, 30))

  if (markingLot) {
    const prefix = `CI_${productCode.toUpperCase()}_${markingLot.toUpperCase()}`
    const key = makeKey(prefix, 'CI')
    if (MOCK_SEQUENCES[key]) {
      MOCK_SEQUENCES[key].lastNumber = 0
      MOCK_SEQUENCES[key].updatedAt = new Date()
    }
  } else {
    // 해당 품번의 모든 MarkingLOT 시퀀스 리셋
    const prefixPattern = `CI_${productCode.toUpperCase()}_`
    for (const key of Object.keys(MOCK_SEQUENCES)) {
      if (key.startsWith(prefixPattern)) {
        MOCK_SEQUENCES[key].lastNumber = 0
        MOCK_SEQUENCES[key].updatedAt = new Date()
      }
    }
  }
}

// ============================================
// Batch Operations (Mock)
// ============================================

/**
 * 여러 시퀀스를 한 번에 생성 (Mock)
 */
export async function getNextSequenceBatch(
  requests: Array<{ prefix: string; date?: Date; padding?: number }>
): Promise<SequenceResult[]> {
  const results: SequenceResult[] = []

  for (const req of requests) {
    const result = await getNextSequence(
      req.prefix,
      req.date ?? new Date(),
      req.padding ?? 4
    )
    results.push(result)
  }

  return results
}

// ============================================
// Data Reset
// ============================================

/**
 * 모든 시퀀스 데이터 초기화
 */
export function resetAllSequences(): number {
  const count = Object.keys(MOCK_SEQUENCES).length
  for (const key of Object.keys(MOCK_SEQUENCES)) {
    delete MOCK_SEQUENCES[key]
  }
  return count
}
