/**
 * Sequence Service
 *
 * 일련번호 관리 서비스
 * - 공정별/날짜별 고유 일련번호 생성
 * - 트랜잭션을 통한 동시성 제어
 * - 날짜 변경 시 자동 리셋
 */
import { prisma } from '../lib/prisma'
import { getDateString } from './barcodeService'

// ============================================
// Types
// ============================================

export interface SequenceResult {
  prefix: string
  dateKey: string
  sequence: number
  formatted: string  // Zero-padded string
}

export interface SequenceInfo {
  prefix: string
  dateKey: string
  lastNumber: number
  createdAt: Date
  updatedAt: Date
}

// ============================================
// Configuration
// ============================================

const DEFAULT_PADDING = 4  // 기본 4자리 (0001-9999)
const BUNDLE_PADDING = 3   // 번들용 3자리 (001-999)
const MAX_SEQUENCE = 9999

// ============================================
// Core Functions
// ============================================

/**
 * 다음 일련번호 생성
 *
 * @param prefix 접두어 (공정코드 또는 복합키)
 * @param date 날짜 (기본값: 오늘)
 * @param padding 자릿수 (기본값: 4)
 * @returns 일련번호 결과
 *
 * @example
 * // CA 공정 일련번호
 * await getNextSequence('CA')
 * // { prefix: 'CA', dateKey: '241220', sequence: 1, formatted: '0001' }
 *
 * // 번들 일련번호
 * await getNextSequence('CA_BUNDLE', new Date(), 3)
 * // { prefix: 'CA_BUNDLE', dateKey: '241220', sequence: 1, formatted: '001' }
 */
export async function getNextSequence(
  prefix: string,
  date: Date = new Date(),
  padding: number = DEFAULT_PADDING
): Promise<SequenceResult> {
  const dateKey = getDateString(date)

  // 트랜잭션으로 원자적 업데이트
  const result = await prisma.$transaction(async (tx) => {
    // 현재 시퀀스 조회 (잠금)
    const existing = await tx.sequenceCounter.findUnique({
      where: {
        prefix_dateKey: {
          prefix,
          dateKey,
        },
      },
    })

    let nextNumber: number

    if (existing) {
      // 기존 시퀀스 증가
      nextNumber = existing.lastNumber + 1

      if (nextNumber > MAX_SEQUENCE) {
        throw new Error(`시퀀스 한계 초과: ${prefix}-${dateKey} (max: ${MAX_SEQUENCE})`)
      }

      await tx.sequenceCounter.update({
        where: {
          prefix_dateKey: {
            prefix,
            dateKey,
          },
        },
        data: {
          lastNumber: nextNumber,
        },
      })
    } else {
      // 새 시퀀스 생성
      nextNumber = 1

      await tx.sequenceCounter.create({
        data: {
          prefix,
          dateKey,
          lastNumber: nextNumber,
        },
      })
    }

    return nextNumber
  })

  return {
    prefix,
    dateKey,
    sequence: result,
    formatted: String(result).padStart(padding, '0'),
  }
}

/**
 * 번들 전용 일련번호 생성
 * 3자리 포맷 (001-999)
 *
 * @param processCode 공정 코드
 * @param date 날짜
 */
export async function getNextBundleSequence(
  processCode: string,
  date: Date = new Date()
): Promise<SequenceResult> {
  const prefix = `${processCode.toUpperCase()}_BUNDLE`
  return getNextSequence(prefix, date, BUNDLE_PADDING)
}

/**
 * 발주서(PO) 전용 일련번호 생성
 * 3자리 포맷 (001-999)
 *
 * @param orderDate 생산 예정일
 *
 * @example
 * await getNextPOSequence(new Date())
 * // { prefix: 'PO', dateKey: '251225', sequence: 1, formatted: '001' }
 */
export async function getNextPOSequence(
  orderDate: Date = new Date()
): Promise<SequenceResult> {
  const prefix = 'PO'
  return getNextSequence(prefix, orderDate, BUNDLE_PADDING)
}

/**
 * 발주서(PO) 현재 시퀀스 조회 (증가 없이)
 *
 * @param orderDate 생산 예정일
 */
export async function getCurrentPOSequence(
  orderDate: Date = new Date()
): Promise<number> {
  return getCurrentSequence('PO', orderDate)
}

/**
 * 현재 시퀀스 값 조회 (증가 없이)
 *
 * @param prefix 접두어
 * @param date 날짜
 */
export async function getCurrentSequence(
  prefix: string,
  date: Date = new Date()
): Promise<number> {
  const dateKey = getDateString(date)

  const existing = await prisma.sequenceCounter.findUnique({
    where: {
      prefix_dateKey: {
        prefix,
        dateKey,
      },
    },
  })

  return existing?.lastNumber ?? 0
}

/**
 * 시퀀스 리셋
 * 특정 접두어의 시퀀스를 0으로 초기화
 *
 * @param prefix 접두어
 * @param date 날짜 (없으면 모든 날짜)
 */
export async function resetSequence(
  prefix: string,
  date?: Date
): Promise<void> {
  if (date) {
    const dateKey = getDateString(date)

    await prisma.sequenceCounter.updateMany({
      where: {
        prefix,
        dateKey,
      },
      data: {
        lastNumber: 0,
      },
    })
  } else {
    await prisma.sequenceCounter.updateMany({
      where: {
        prefix,
      },
      data: {
        lastNumber: 0,
      },
    })
  }
}

/**
 * 시퀀스 삭제
 * 오래된 시퀀스 데이터 정리
 *
 * @param prefix 접두어 (없으면 전체)
 * @param beforeDate 이 날짜 이전 데이터 삭제
 */
export async function cleanupSequences(
  beforeDate: Date,
  prefix?: string
): Promise<number> {
  const beforeDateKey = getDateString(beforeDate)

  const result = await prisma.sequenceCounter.deleteMany({
    where: {
      ...(prefix && { prefix }),
      dateKey: {
        lt: beforeDateKey,
      },
    },
  })

  return result.count
}

// ============================================
// Information Functions
// ============================================

/**
 * 모든 시퀀스 정보 조회
 *
 * @param date 특정 날짜 (없으면 전체)
 */
export async function getAllSequences(date?: Date): Promise<SequenceInfo[]> {
  const where = date
    ? { dateKey: getDateString(date) }
    : {}

  const sequences = await prisma.sequenceCounter.findMany({
    where,
    orderBy: [
      { dateKey: 'desc' },
      { prefix: 'asc' },
    ],
  })

  return sequences.map((s) => ({
    prefix: s.prefix,
    dateKey: s.dateKey,
    lastNumber: s.lastNumber,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))
}

/**
 * 특정 접두어의 시퀀스 이력 조회
 *
 * @param prefix 접두어
 * @param limit 최대 개수
 */
export async function getSequenceHistory(
  prefix: string,
  limit: number = 30
): Promise<SequenceInfo[]> {
  const sequences = await prisma.sequenceCounter.findMany({
    where: { prefix },
    orderBy: { dateKey: 'desc' },
    take: limit,
  })

  return sequences.map((s) => ({
    prefix: s.prefix,
    dateKey: s.dateKey,
    lastNumber: s.lastNumber,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))
}

// ============================================
// Batch Operations
// ============================================

/**
 * 여러 시퀀스를 한 번에 생성
 * 동일 트랜잭션 내에서 처리
 *
 * @param requests 시퀀스 요청 배열
 */
export async function getNextSequenceBatch(
  requests: Array<{ prefix: string; date?: Date; padding?: number }>
): Promise<SequenceResult[]> {
  const results: SequenceResult[] = []

  await prisma.$transaction(async (tx) => {
    for (const req of requests) {
      const date = req.date ?? new Date()
      const dateKey = getDateString(date)
      const padding = req.padding ?? DEFAULT_PADDING

      const existing = await tx.sequenceCounter.findUnique({
        where: {
          prefix_dateKey: {
            prefix: req.prefix,
            dateKey,
          },
        },
      })

      let nextNumber: number

      if (existing) {
        nextNumber = existing.lastNumber + 1

        await tx.sequenceCounter.update({
          where: {
            prefix_dateKey: {
              prefix: req.prefix,
              dateKey,
            },
          },
          data: {
            lastNumber: nextNumber,
          },
        })
      } else {
        nextNumber = 1

        await tx.sequenceCounter.create({
          data: {
            prefix: req.prefix,
            dateKey,
            lastNumber: nextNumber,
          },
        })
      }

      results.push({
        prefix: req.prefix,
        dateKey,
        sequence: nextNumber,
        formatted: String(nextNumber).padStart(padding, '0'),
      })
    }
  })

  return results
}

// ============================================
// Validation
// ============================================

/**
 * 시퀀스 유효성 검사
 * 중복 또는 건너뛴 시퀀스 감지
 *
 * @param prefix 접두어
 * @param date 날짜
 * @param sequence 검사할 시퀀스 번호
 */
export async function validateSequence(
  prefix: string,
  date: Date,
  sequence: number
): Promise<{
  isValid: boolean
  expected: number
  message?: string
}> {
  const current = await getCurrentSequence(prefix, date)

  if (sequence <= current) {
    return {
      isValid: false,
      expected: current + 1,
      message: `중복 시퀀스: ${sequence}는 이미 사용됨 (현재: ${current})`,
    }
  }

  if (sequence > current + 1) {
    return {
      isValid: false,
      expected: current + 1,
      message: `건너뛴 시퀀스: ${current + 1} ~ ${sequence - 1} 누락`,
    }
  }

  return {
    isValid: true,
    expected: current + 1,
  }
}

// ============================================
// CI Barcode Sequence
// ============================================

/**
 * CI 바코드 시퀀스 결과 타입
 */
export interface CISequenceResult {
  productCode: string
  markingLot: string
  sequence: number
  formatted: string  // 4자리 zero-padded
}

/**
 * CI 바코드 전용 일련번호 생성
 * 품번 + MarkingLOT 조합으로 고유 시퀀스 관리
 *
 * @param productCode 완제품품번
 * @param markingLot MarkingLOT (3자리)
 * @returns CI 시퀀스 결과
 *
 * @example
 * await getNextCISequence('P00123', '5MT')
 * // { productCode: 'P00123', markingLot: '5MT', sequence: 1, formatted: '0001' }
 */
export async function getNextCISequence(
  productCode: string,
  markingLot: string
): Promise<CISequenceResult> {
  // CI 바코드는 날짜 기반이 아닌 품번+MarkingLOT 조합으로 관리
  // prefix 형식: CI_{productCode}_{markingLot}
  const prefix = `CI_${productCode.toUpperCase()}_${markingLot.toUpperCase()}`

  // 날짜 키는 고정값 사용 (CI는 날짜 리셋 없음)
  const dateKey = 'CI'

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.sequenceCounter.findUnique({
      where: {
        prefix_dateKey: {
          prefix,
          dateKey,
        },
      },
    })

    let nextNumber: number

    if (existing) {
      nextNumber = existing.lastNumber + 1

      if (nextNumber > MAX_SEQUENCE) {
        throw new Error(`CI 시퀀스 한계 초과: ${productCode}-${markingLot} (max: ${MAX_SEQUENCE})`)
      }

      await tx.sequenceCounter.update({
        where: {
          prefix_dateKey: {
            prefix,
            dateKey,
          },
        },
        data: {
          lastNumber: nextNumber,
        },
      })
    } else {
      nextNumber = 1

      await tx.sequenceCounter.create({
        data: {
          prefix,
          dateKey,
          lastNumber: nextNumber,
        },
      })
    }

    return nextNumber
  })

  return {
    productCode: productCode.toUpperCase(),
    markingLot: markingLot.toUpperCase(),
    sequence: result,
    formatted: String(result).padStart(4, '0'),
  }
}

/**
 * CI 시퀀스 현재값 조회 (증가 없이)
 *
 * @param productCode 완제품품번
 * @param markingLot MarkingLOT
 */
export async function getCurrentCISequence(
  productCode: string,
  markingLot: string
): Promise<number> {
  const prefix = `CI_${productCode.toUpperCase()}_${markingLot.toUpperCase()}`
  const dateKey = 'CI'

  const existing = await prisma.sequenceCounter.findUnique({
    where: {
      prefix_dateKey: {
        prefix,
        dateKey,
      },
    },
  })

  return existing?.lastNumber ?? 0
}

/**
 * CI 시퀀스 리셋
 * 특정 품번+MarkingLOT 조합의 시퀀스를 0으로 초기화
 *
 * @param productCode 완제품품번
 * @param markingLot MarkingLOT (없으면 해당 품번의 모든 MarkingLOT 리셋)
 */
export async function resetCISequence(
  productCode: string,
  markingLot?: string
): Promise<void> {
  if (markingLot) {
    const prefix = `CI_${productCode.toUpperCase()}_${markingLot.toUpperCase()}`

    await prisma.sequenceCounter.updateMany({
      where: {
        prefix,
        dateKey: 'CI',
      },
      data: {
        lastNumber: 0,
      },
    })
  } else {
    // 해당 품번의 모든 MarkingLOT 시퀀스 리셋
    await prisma.sequenceCounter.updateMany({
      where: {
        prefix: {
          startsWith: `CI_${productCode.toUpperCase()}_`,
        },
        dateKey: 'CI',
      },
      data: {
        lastNumber: 0,
      },
    })
  }
}
