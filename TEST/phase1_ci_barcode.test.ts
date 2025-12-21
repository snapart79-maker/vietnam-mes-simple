/**
 * Phase 1: CI 바코드 확장 테스트
 *
 * 테스트 대상:
 * 1. CI 바코드 생성 (generateCIBarcode)
 * 2. CI 바코드 파싱 (parseCIBarcode)
 * 3. CI 바코드 검증 (validateCIBarcode)
 * 4. CI 바코드 감지 (isCIBarcode)
 * 5. CI 시퀀스 서비스 (getNextCISequence)
 *
 * CI 바코드 형식: CA-{완제품품번}-{수량}-{MarkingLOT 3자리}-{4자리시퀀스}
 * 예시: CA-P00123-100-5MT-0001
 */

import {
  generateCIBarcode,
  parseCIBarcode,
  validateCIBarcode,
  isCIBarcode,
  formatCIBarcodeInfo,
  CI_BARCODE_PATTERN,
  type CIBarcodeData,
} from '../src/services/barcodeService'

import {
  getNextCISequence,
  getCurrentCISequence,
  resetCISequence,
  resetAllSequences,
} from '../src/services/mock/sequenceService.mock'

// ============================================
// Test Utilities
// ============================================

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr !== expectedStr) {
    throw new Error(`FAIL: ${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`)
  }
  console.log(`PASS: ${message}`)
}

function assertThrows(fn: () => void, expectedError: string, message: string): void {
  try {
    fn()
    throw new Error(`FAIL: ${message} - Expected to throw "${expectedError}" but did not throw`)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes(expectedError)) {
      console.log(`PASS: ${message}`)
    } else {
      throw new Error(`FAIL: ${message} - Unexpected error: ${error}`)
    }
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`)
  }
  console.log(`PASS: ${message}`)
}

function assertFalse(condition: boolean, message: string): void {
  if (condition) {
    throw new Error(`FAIL: ${message}`)
  }
  console.log(`PASS: ${message}`)
}

function assertNull(value: unknown, message: string): void {
  if (value !== null) {
    throw new Error(`FAIL: ${message}\n  Expected: null\n  Actual: ${JSON.stringify(value)}`)
  }
  console.log(`PASS: ${message}`)
}

function assertNotNull<T>(value: T | null, message: string): asserts value is T {
  if (value === null) {
    throw new Error(`FAIL: ${message}\n  Expected: not null\n  Actual: null`)
  }
  console.log(`PASS: ${message}`)
}

// ============================================
// Test Suite: CI Barcode Generation
// ============================================

console.log('\n=== Test Suite: CI 바코드 생성 ===\n')

// Test 1: 정상 생성
function testGenerateCIBarcode_Normal(): void {
  const barcode = generateCIBarcode('P00123', 100, '5MT', 1)
  assertEqual(barcode, 'CA-P00123-100-5MT-0001', '정상 바코드 생성')
}

// Test 2: 시퀀스 패딩
function testGenerateCIBarcode_SequencePadding(): void {
  assertEqual(
    generateCIBarcode('P001', 50, 'ABC', 1),
    'CA-P001-50-ABC-0001',
    '시퀀스 4자리 패딩 (0001)'
  )
  assertEqual(
    generateCIBarcode('P001', 50, 'ABC', 99),
    'CA-P001-50-ABC-0099',
    '시퀀스 4자리 패딩 (0099)'
  )
  assertEqual(
    generateCIBarcode('P001', 50, 'ABC', 999),
    'CA-P001-50-ABC-0999',
    '시퀀스 4자리 패딩 (0999)'
  )
  assertEqual(
    generateCIBarcode('P001', 50, 'ABC', 9999),
    'CA-P001-50-ABC-9999',
    '시퀀스 최대값 (9999)'
  )
}

// Test 3: 대소문자 정규화
function testGenerateCIBarcode_CaseNormalization(): void {
  assertEqual(
    generateCIBarcode('p00123', 100, '5mt', 1),
    'CA-P00123-100-5MT-0001',
    '소문자 입력 → 대문자 출력'
  )
}

// Test 4: 유효성 검사 - 빈 품번
function testGenerateCIBarcode_EmptyProductCode(): void {
  assertThrows(
    () => generateCIBarcode('', 100, '5MT', 1),
    '완제품품번이 필요합니다',
    '빈 품번 에러'
  )
}

// Test 5: 유효성 검사 - 잘못된 수량
function testGenerateCIBarcode_InvalidQuantity(): void {
  assertThrows(
    () => generateCIBarcode('P001', 0, '5MT', 1),
    '수량은 양의 정수',
    '수량 0 에러'
  )
  assertThrows(
    () => generateCIBarcode('P001', -1, '5MT', 1),
    '수량은 양의 정수',
    '음수 수량 에러'
  )
  assertThrows(
    () => generateCIBarcode('P001', 1.5, '5MT', 1),
    '수량은 양의 정수',
    '소수 수량 에러'
  )
}

// Test 6: 유효성 검사 - 잘못된 MarkingLOT
function testGenerateCIBarcode_InvalidMarkingLot(): void {
  assertThrows(
    () => generateCIBarcode('P001', 100, 'AB', 1),
    'MarkingLOT은 3자리 영숫자',
    '2자리 MarkingLOT 에러'
  )
  assertThrows(
    () => generateCIBarcode('P001', 100, 'ABCD', 1),
    'MarkingLOT은 3자리 영숫자',
    '4자리 MarkingLOT 에러'
  )
  assertThrows(
    () => generateCIBarcode('P001', 100, 'A-B', 1),
    'MarkingLOT은 3자리 영숫자',
    '특수문자 MarkingLOT 에러'
  )
}

// Test 7: 유효성 검사 - 잘못된 시퀀스
function testGenerateCIBarcode_InvalidSequence(): void {
  assertThrows(
    () => generateCIBarcode('P001', 100, '5MT', 0),
    '시퀀스는 1-9999',
    '시퀀스 0 에러'
  )
  assertThrows(
    () => generateCIBarcode('P001', 100, '5MT', 10000),
    '시퀀스는 1-9999',
    '시퀀스 10000 에러'
  )
  assertThrows(
    () => generateCIBarcode('P001', 100, '5MT', -1),
    '시퀀스는 1-9999',
    '음수 시퀀스 에러'
  )
}

// ============================================
// Test Suite: CI Barcode Parsing
// ============================================

console.log('\n=== Test Suite: CI 바코드 파싱 ===\n')

// Test 8: 정상 파싱
function testParseCIBarcode_Normal(): void {
  const result = parseCIBarcode('CA-P00123-100-5MT-0001')
  assertNotNull(result, '정상 바코드 파싱 결과 not null')
  assertEqual(result.productCode, 'P00123', '파싱 - productCode')
  assertEqual(result.quantity, 100, '파싱 - quantity')
  assertEqual(result.markingLot, '5MT', '파싱 - markingLot')
  assertEqual(result.sequence, '0001', '파싱 - sequence')
}

// Test 9: 소문자 입력 파싱
function testParseCIBarcode_LowerCase(): void {
  const result = parseCIBarcode('ca-p00123-100-5mt-0001')
  assertNotNull(result, '소문자 바코드 파싱')
  assertEqual(result.productCode, 'P00123', '소문자 → 대문자 변환')
}

// Test 10: 공백 포함 파싱
function testParseCIBarcode_WithSpaces(): void {
  const result = parseCIBarcode('  CA-P00123-100-5MT-0001  ')
  assertNotNull(result, '공백 포함 바코드 파싱')
}

// Test 11: 잘못된 형식 파싱
function testParseCIBarcode_Invalid(): void {
  assertNull(parseCIBarcode(''), '빈 문자열 → null')
  assertNull(parseCIBarcode('CA-P001-100-5M-0001'), 'MarkingLOT 2자리 → null')
  assertNull(parseCIBarcode('CA-P001-100-5MTT-0001'), 'MarkingLOT 4자리 → null')
  assertNull(parseCIBarcode('CA-P001-100-5MT-001'), '시퀀스 3자리 → null')
  assertNull(parseCIBarcode('CB-P001-100-5MT-0001'), '접두어 CB → null')
  assertNull(parseCIBarcode('P001-100-5MT-0001'), 'CA- 없음 → null')
}

// ============================================
// Test Suite: CI Barcode Validation
// ============================================

console.log('\n=== Test Suite: CI 바코드 검증 ===\n')

// Test 12: 유효 바코드 검증
function testValidateCIBarcode_Valid(): void {
  assertTrue(validateCIBarcode('CA-P00123-100-5MT-0001'), '유효 바코드 true')
  assertTrue(validateCIBarcode('CA-ABC123-999-XYZ-9999'), '최대값 바코드 true')
}

// Test 13: 무효 바코드 검증
function testValidateCIBarcode_Invalid(): void {
  assertFalse(validateCIBarcode(''), '빈 문자열 false')
  assertFalse(validateCIBarcode('CA-P001'), '불완전 바코드 false')
  assertFalse(validateCIBarcode('invalid'), '잘못된 형식 false')
}

// ============================================
// Test Suite: CI Barcode Detection
// ============================================

console.log('\n=== Test Suite: CI 바코드 감지 ===\n')

// Test 14: CI 바코드 감지
function testIsCIBarcode(): void {
  assertTrue(isCIBarcode('CA-P00123-100-5MT-0001'), 'CI 바코드 true')
  assertFalse(isCIBarcode('CA-241220-0001'), 'V1 바코드 false')
  assertFalse(isCIBarcode('CAP001Q100-C241220-0001'), 'V2 바코드 false')
  assertFalse(isCIBarcode(''), '빈 문자열 false')
}

// ============================================
// Test Suite: CI Barcode Formatting
// ============================================

console.log('\n=== Test Suite: CI 바코드 포맷팅 ===\n')

// Test 15: 정보 포맷팅
function testFormatCIBarcodeInfo(): void {
  const info = formatCIBarcodeInfo('CA-P00123-100-5MT-0001')
  assertTrue(info.includes('회로검사'), '포맷 - 회로검사 포함')
  assertTrue(info.includes('P00123'), '포맷 - 품번 포함')
  assertTrue(info.includes('100'), '포맷 - 수량 포함')
  assertTrue(info.includes('5MT'), '포맷 - MarkingLOT 포함')
}

// Test 16: 잘못된 바코드 포맷팅
function testFormatCIBarcodeInfo_Invalid(): void {
  const info = formatCIBarcodeInfo('invalid')
  assertTrue(info.includes('잘못된'), '잘못된 바코드 메시지')
}

// ============================================
// Test Suite: CI Barcode Pattern
// ============================================

console.log('\n=== Test Suite: CI 바코드 정규식 패턴 ===\n')

// Test 17: 정규식 패턴 테스트
function testCIBarcodePattern(): void {
  assertTrue(CI_BARCODE_PATTERN.test('CA-P00123-100-5MT-0001'), '정규식 정상 매칭')
  assertTrue(CI_BARCODE_PATTERN.test('CA-ABC-1-XYZ-0001'), '최소 품번/수량 매칭')
  assertFalse(CI_BARCODE_PATTERN.test('ca-p00123-100-5mt-0001'), '소문자 직접 매칭 실패')
  assertFalse(CI_BARCODE_PATTERN.test('CB-P00123-100-5MT-0001'), '접두어 CB 매칭 실패')
}

// ============================================
// Test Suite: Round-trip (생성 → 파싱)
// ============================================

console.log('\n=== Test Suite: 왕복 테스트 (생성 → 파싱) ===\n')

// Test 18: 왕복 테스트
function testRoundTrip(): void {
  const testCases = [
    { productCode: 'P00123', quantity: 100, markingLot: '5MT', sequence: 1 },
    { productCode: 'ABC999', quantity: 1, markingLot: 'XYZ', sequence: 9999 },
    { productCode: 'TEST', quantity: 500, markingLot: '12A', sequence: 42 },
  ]

  for (const tc of testCases) {
    const barcode = generateCIBarcode(tc.productCode, tc.quantity, tc.markingLot, tc.sequence)
    const parsed = parseCIBarcode(barcode)
    assertNotNull(parsed, `왕복 - ${barcode} 파싱 성공`)
    assertEqual(parsed.productCode, tc.productCode.toUpperCase(), `왕복 - productCode 일치`)
    assertEqual(parsed.quantity, tc.quantity, `왕복 - quantity 일치`)
    assertEqual(parsed.markingLot, tc.markingLot.toUpperCase(), `왕복 - markingLot 일치`)
    assertEqual(parsed.sequence, String(tc.sequence).padStart(4, '0'), `왕복 - sequence 일치`)
  }
}

// ============================================
// Test Suite: CI Sequence Service (Mock)
// ============================================

console.log('\n=== Test Suite: CI 시퀀스 서비스 (Mock) ===\n')

// Test 19: 시퀀스 생성
async function testCISequence_Generate(): Promise<void> {
  resetAllSequences()

  const seq1 = await getNextCISequence('P001', '5MT')
  assertEqual(seq1.sequence, 1, '첫 번째 시퀀스 = 1')
  assertEqual(seq1.formatted, '0001', '첫 번째 포맷 = 0001')
  assertEqual(seq1.productCode, 'P001', '품번 대문자 정규화')
  assertEqual(seq1.markingLot, '5MT', 'MarkingLOT 대문자 정규화')

  const seq2 = await getNextCISequence('P001', '5MT')
  assertEqual(seq2.sequence, 2, '두 번째 시퀀스 = 2')

  const seq3 = await getNextCISequence('P001', '5MT')
  assertEqual(seq3.sequence, 3, '세 번째 시퀀스 = 3')
}

// Test 20: 다른 품번/MarkingLOT 조합
async function testCISequence_DifferentCombinations(): Promise<void> {
  resetAllSequences()

  const seq1 = await getNextCISequence('P001', '5MT')
  const seq2 = await getNextCISequence('P001', 'ABC')  // 다른 MarkingLOT
  const seq3 = await getNextCISequence('P002', '5MT')  // 다른 품번

  assertEqual(seq1.sequence, 1, '조합1 첫 번째')
  assertEqual(seq2.sequence, 1, '조합2 첫 번째 (별도 카운터)')
  assertEqual(seq3.sequence, 1, '조합3 첫 번째 (별도 카운터)')
}

// Test 21: 현재 시퀀스 조회
async function testCISequence_GetCurrent(): Promise<void> {
  resetAllSequences()

  let current = await getCurrentCISequence('P001', '5MT')
  assertEqual(current, 0, '초기 시퀀스 = 0')

  await getNextCISequence('P001', '5MT')
  await getNextCISequence('P001', '5MT')

  current = await getCurrentCISequence('P001', '5MT')
  assertEqual(current, 2, '2회 생성 후 = 2')
}

// Test 22: 시퀀스 리셋
async function testCISequence_Reset(): Promise<void> {
  resetAllSequences()

  await getNextCISequence('P001', '5MT')
  await getNextCISequence('P001', '5MT')
  await getNextCISequence('P001', 'ABC')

  await resetCISequence('P001', '5MT')

  const current5MT = await getCurrentCISequence('P001', '5MT')
  const currentABC = await getCurrentCISequence('P001', 'ABC')

  assertEqual(current5MT, 0, '5MT 시퀀스 리셋됨')
  assertEqual(currentABC, 1, 'ABC 시퀀스 유지됨')
}

// ============================================
// Test Suite: Integration (생성 + 시퀀스)
// ============================================

console.log('\n=== Test Suite: 통합 테스트 (생성 + 시퀀스) ===\n')

// Test 23: 바코드 생성 + 시퀀스 통합
async function testIntegration(): Promise<void> {
  resetAllSequences()

  const productCode = 'INTEG001'
  const quantity = 100
  const markingLot = 'TST'

  // 시퀀스 생성
  const seq1 = await getNextCISequence(productCode, markingLot)
  const seq2 = await getNextCISequence(productCode, markingLot)

  // 바코드 생성
  const barcode1 = generateCIBarcode(productCode, quantity, markingLot, seq1.sequence)
  const barcode2 = generateCIBarcode(productCode, quantity, markingLot, seq2.sequence)

  assertEqual(barcode1, 'CA-INTEG001-100-TST-0001', '통합 - 첫 번째 바코드')
  assertEqual(barcode2, 'CA-INTEG001-100-TST-0002', '통합 - 두 번째 바코드')

  // 파싱 검증
  const parsed1 = parseCIBarcode(barcode1)
  const parsed2 = parseCIBarcode(barcode2)

  assertNotNull(parsed1, '통합 - 첫 번째 파싱')
  assertNotNull(parsed2, '통합 - 두 번째 파싱')
  assertEqual(parsed1.sequence, '0001', '통합 - 첫 번째 시퀀스')
  assertEqual(parsed2.sequence, '0002', '통합 - 두 번째 시퀀스')
}

// ============================================
// Run All Tests
// ============================================

async function runAllTests(): Promise<void> {
  console.log('=====================================')
  console.log('Phase 1: CI 바코드 확장 테스트 시작')
  console.log('=====================================')

  let passed = 0
  let failed = 0

  const tests: Array<(() => void) | (() => Promise<void>)> = [
    // Generation
    testGenerateCIBarcode_Normal,
    testGenerateCIBarcode_SequencePadding,
    testGenerateCIBarcode_CaseNormalization,
    testGenerateCIBarcode_EmptyProductCode,
    testGenerateCIBarcode_InvalidQuantity,
    testGenerateCIBarcode_InvalidMarkingLot,
    testGenerateCIBarcode_InvalidSequence,
    // Parsing
    testParseCIBarcode_Normal,
    testParseCIBarcode_LowerCase,
    testParseCIBarcode_WithSpaces,
    testParseCIBarcode_Invalid,
    // Validation
    testValidateCIBarcode_Valid,
    testValidateCIBarcode_Invalid,
    // Detection
    testIsCIBarcode,
    // Formatting
    testFormatCIBarcodeInfo,
    testFormatCIBarcodeInfo_Invalid,
    // Pattern
    testCIBarcodePattern,
    // Round-trip
    testRoundTrip,
    // Sequence (async)
    testCISequence_Generate,
    testCISequence_DifferentCombinations,
    testCISequence_GetCurrent,
    testCISequence_Reset,
    // Integration (async)
    testIntegration,
  ]

  for (const test of tests) {
    try {
      const result = test()
      if (result instanceof Promise) {
        await result
      }
      passed++
    } catch (error) {
      failed++
      console.error(error)
    }
  }

  console.log('\n=====================================')
  console.log(`테스트 결과: ${passed} 성공, ${failed} 실패`)
  console.log('=====================================')

  if (failed > 0) {
    process.exit(1)
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('테스트 실행 중 오류:', error)
  process.exit(1)
})
