/**
 * Phase 2: 2단계 생산 워크플로우 테스트
 *
 * 테스트 대상:
 * 1. startNewProduction() - 생산 시작 (Step 1)
 * 2. completeProductionV2() - 생산 완료 (Step 2)
 * 3. deleteInProgressProduction() - 진행 중 삭제
 * 4. getInProgressLots() - 진행 중 LOT 조회
 * 5. 이월(CarryOver) 처리
 *
 * 적용 공정: MO, CA, MC, MS, SB, HS, SP, PA, CI, VI (10개 전체)
 */

import {
  startNewProduction,
  completeProductionV2,
  deleteInProgressProduction,
  getInProgressLots,
  isLotInProgress,
  isLotCompleted,
  resetProductionData,
  type LotWithRelations,
  type StartProductionInput,
  type CompleteProductionInput,
} from '../src/services/mock/productionService.mock'

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

function assertThrows(fn: () => Promise<unknown>, expectedError: string, message: string): Promise<void> {
  return fn()
    .then(() => {
      throw new Error(`FAIL: ${message} - Expected to throw "${expectedError}" but did not throw`)
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message.includes(expectedError)) {
        console.log(`PASS: ${message}`)
      } else {
        throw new Error(`FAIL: ${message} - Unexpected error: ${error}`)
      }
    })
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`)
  }
  console.log(`PASS: ${message}`)
}

function assertNotNull<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`FAIL: ${message}\n  Expected: not null/undefined\n  Actual: ${value}`)
  }
  console.log(`PASS: ${message}`)
}

// ============================================
// Test Suite: startNewProduction()
// ============================================

console.log('\n=== Test Suite: startNewProduction() ===\n')

// Test 1: 기본 생산 시작
async function testStartNewProduction_Basic(): Promise<void> {
  resetProductionData()

  const input: StartProductionInput = {
    processCode: 'CA',
    productId: 1,
    productCode: 'P001',
    productName: '테스트 제품',
    lineCode: 'LINE-01',
    plannedQty: 100,
    workerId: 1,
  }

  const lot = await startNewProduction(input)

  assertNotNull(lot, '생산 LOT 생성됨')
  assertEqual(lot.status, 'IN_PROGRESS', 'status = IN_PROGRESS')
  assertEqual(lot.processCode, 'CA', 'processCode = CA')
  assertEqual(lot.plannedQty, 100, 'plannedQty = 100')
  assertEqual(lot.completedQty, 0, 'completedQty = 0')
  assertEqual(lot.carryOverIn, 0, 'carryOverIn = 0')
  assertTrue(lot.lotNumber.includes('CA'), '바코드에 CA 포함')
  assertTrue(lot.lotNumber.includes('P001'), '바코드에 품번 포함')
}

// Test 2: 모든 공정 테스트
async function testStartNewProduction_AllProcesses(): Promise<void> {
  resetProductionData()

  const processes = ['MO', 'CA', 'MC', 'MS', 'SB', 'HS', 'SP', 'PA', 'CI', 'VI']

  for (const processCode of processes) {
    const lot = await startNewProduction({
      processCode,
      productCode: 'P001',
      plannedQty: 50,
    })

    assertEqual(lot.processCode, processCode, `${processCode} 공정 생성`)
    assertEqual(lot.status, 'IN_PROGRESS', `${processCode} status = IN_PROGRESS`)
  }

  const inProgress = await getInProgressLots()
  assertEqual(inProgress.length, 10, '10개 공정 모두 IN_PROGRESS')
}

// Test 3: 이월 수량 사용
async function testStartNewProduction_WithCarryOver(): Promise<void> {
  resetProductionData()

  // 이월 없이 시작
  const lot = await startNewProduction({
    processCode: 'CA',
    productCode: 'P001',
    plannedQty: 100,
    carryOverId: 1,
    carryOverQty: 20,
  })

  assertEqual(lot.carryOverIn, 20, 'carryOverIn = 20')
}

// ============================================
// Test Suite: completeProductionV2()
// ============================================

console.log('\n=== Test Suite: completeProductionV2() ===\n')

// Test 4: 기본 생산 완료
async function testCompleteProductionV2_Basic(): Promise<void> {
  resetProductionData()

  // 시작
  const lot = await startNewProduction({
    processCode: 'CA',
    productId: 1,
    productCode: 'P001',
    plannedQty: 100,
  })

  // 완료
  const completed = await completeProductionV2({
    lotId: lot.id,
    completedQty: 95,
    defectQty: 5,
  })

  assertEqual(completed.status, 'COMPLETED', 'status = COMPLETED')
  assertEqual(completed.completedQty, 95, 'completedQty = 95')
  assertEqual(completed.defectQty, 5, 'defectQty = 5')
  assertNotNull(completed.completedAt, 'completedAt 설정됨')
}

// Test 5: 이월 생성과 함께 완료
async function testCompleteProductionV2_WithCarryOver(): Promise<void> {
  resetProductionData()

  const lot = await startNewProduction({
    processCode: 'CA',
    productId: 1,
    productCode: 'P001',
    plannedQty: 100,
  })

  const completed = await completeProductionV2({
    lotId: lot.id,
    completedQty: 80,
    defectQty: 0,
    createCarryOver: true,
    carryOverQty: 20,
  })

  assertEqual(completed.carryOverOut, 20, 'carryOverOut = 20')
}

// Test 6: 이미 완료된 LOT 완료 시도 에러
async function testCompleteProductionV2_AlreadyCompleted(): Promise<void> {
  resetProductionData()

  const lot = await startNewProduction({
    processCode: 'CA',
    productCode: 'P001',
    plannedQty: 100,
  })

  await completeProductionV2({
    lotId: lot.id,
    completedQty: 100,
  })

  await assertThrows(
    () => completeProductionV2({ lotId: lot.id, completedQty: 100 }),
    '진행 중인 LOT만 완료',
    '이미 완료된 LOT 완료 시도 에러'
  )
}

// Test 7: 존재하지 않는 LOT 완료 시도 에러
async function testCompleteProductionV2_NotFound(): Promise<void> {
  resetProductionData()

  await assertThrows(
    () => completeProductionV2({ lotId: 9999, completedQty: 100 }),
    'LOT을 찾을 수 없습니다',
    '존재하지 않는 LOT 완료 시도 에러'
  )
}

// ============================================
// Test Suite: deleteInProgressProduction()
// ============================================

console.log('\n=== Test Suite: deleteInProgressProduction() ===\n')

// Test 8: 소프트 삭제 (CANCELLED 상태로 변경)
async function testDeleteInProgress_SoftDelete(): Promise<void> {
  resetProductionData()

  const lot = await startNewProduction({
    processCode: 'CA',
    productCode: 'P001',
    plannedQty: 100,
  })

  await deleteInProgressProduction(lot.id, { hardDelete: false })

  const inProgress = await getInProgressLots()
  assertEqual(inProgress.length, 0, '진행 중 LOT 없음')
}

// Test 9: 하드 삭제 (완전 삭제)
async function testDeleteInProgress_HardDelete(): Promise<void> {
  resetProductionData()

  const lot = await startNewProduction({
    processCode: 'CA',
    productCode: 'P001',
    plannedQty: 100,
  })

  await deleteInProgressProduction(lot.id, { hardDelete: true })

  const inProgress = await getInProgressLots()
  assertEqual(inProgress.length, 0, '진행 중 LOT 없음 (하드 삭제)')
}

// Test 10: 완료된 LOT 삭제 시도 에러
async function testDeleteInProgress_Completed(): Promise<void> {
  resetProductionData()

  const lot = await startNewProduction({
    processCode: 'CA',
    productCode: 'P001',
    plannedQty: 100,
  })

  await completeProductionV2({ lotId: lot.id, completedQty: 100 })

  await assertThrows(
    () => deleteInProgressProduction(lot.id),
    '진행 중인 LOT만 삭제',
    '완료된 LOT 삭제 시도 에러'
  )
}

// Test 11: 존재하지 않는 LOT 삭제 시도 에러
async function testDeleteInProgress_NotFound(): Promise<void> {
  resetProductionData()

  await assertThrows(
    () => deleteInProgressProduction(9999),
    'LOT을 찾을 수 없습니다',
    '존재하지 않는 LOT 삭제 시도 에러'
  )
}

// ============================================
// Test Suite: getInProgressLots()
// ============================================

console.log('\n=== Test Suite: getInProgressLots() ===\n')

// Test 12: 공정별 필터링
async function testGetInProgressLots_ByProcess(): Promise<void> {
  resetProductionData()

  await startNewProduction({ processCode: 'CA', productCode: 'P001', plannedQty: 100 })
  await startNewProduction({ processCode: 'CA', productCode: 'P002', plannedQty: 200 })
  await startNewProduction({ processCode: 'MC', productCode: 'P003', plannedQty: 150 })

  const caLots = await getInProgressLots({ processCode: 'CA' })
  const mcLots = await getInProgressLots({ processCode: 'MC' })

  assertEqual(caLots.length, 2, 'CA 공정 2개')
  assertEqual(mcLots.length, 1, 'MC 공정 1개')
}

// Test 13: 라인별 필터링
async function testGetInProgressLots_ByLine(): Promise<void> {
  resetProductionData()

  await startNewProduction({ processCode: 'CA', productCode: 'P001', plannedQty: 100, lineCode: 'LINE-01' })
  await startNewProduction({ processCode: 'CA', productCode: 'P002', plannedQty: 200, lineCode: 'LINE-02' })

  const line1Lots = await getInProgressLots({ lineCode: 'LINE-01' })
  const line2Lots = await getInProgressLots({ lineCode: 'LINE-02' })

  assertEqual(line1Lots.length, 1, 'LINE-01 1개')
  assertEqual(line2Lots.length, 1, 'LINE-02 1개')
}

// Test 14: 작업자별 필터링
async function testGetInProgressLots_ByWorker(): Promise<void> {
  resetProductionData()

  await startNewProduction({ processCode: 'CA', productCode: 'P001', plannedQty: 100, workerId: 1 })
  await startNewProduction({ processCode: 'CA', productCode: 'P002', plannedQty: 200, workerId: 2 })

  const worker1Lots = await getInProgressLots({ workerId: 1 })
  const worker2Lots = await getInProgressLots({ workerId: 2 })

  assertEqual(worker1Lots.length, 1, '작업자1 1개')
  assertEqual(worker2Lots.length, 1, '작업자2 1개')
}

// ============================================
// Test Suite: 2단계 워크플로우 시나리오
// ============================================

console.log('\n=== Test Suite: 2단계 워크플로우 시나리오 ===\n')

// Test 15: 전체 워크플로우 (시작 → 완료)
async function testWorkflow_StartToComplete(): Promise<void> {
  resetProductionData()

  // Step 1: 생산 시작
  const lot = await startNewProduction({
    processCode: 'CA',
    productId: 1,
    productCode: 'P001',
    productName: '테스트 제품',
    lineCode: 'LINE-01',
    plannedQty: 100,
    workerId: 1,
  })

  assertTrue(isLotInProgress(lot), 'Step 1: IN_PROGRESS')

  // Step 2: 생산 완료
  const completed = await completeProductionV2({
    lotId: lot.id,
    completedQty: 95,
    defectQty: 5,
  })

  assertTrue(isLotCompleted(completed), 'Step 2: COMPLETED')
  assertEqual(completed.completedQty, 95, '완료 수량 95')
  assertEqual(completed.defectQty, 5, '불량 수량 5')
}

// Test 16: 워크플로우 (시작 → 취소)
async function testWorkflow_StartToCancel(): Promise<void> {
  resetProductionData()

  // Step 1: 생산 시작
  const lot = await startNewProduction({
    processCode: 'MC',
    productCode: 'P002',
    plannedQty: 50,
  })

  assertTrue(isLotInProgress(lot), 'Step 1: IN_PROGRESS')

  // 취소
  await deleteInProgressProduction(lot.id)

  const inProgress = await getInProgressLots({ processCode: 'MC' })
  assertEqual(inProgress.length, 0, '취소 후 진행 중 없음')
}

// Test 17: 이월 처리 워크플로우
async function testWorkflow_WithCarryOver(): Promise<void> {
  resetProductionData()

  // 첫 번째 LOT: 이월 생성
  const lot1 = await startNewProduction({
    processCode: 'CA',
    productId: 1,
    productCode: 'P001',
    plannedQty: 100,
  })

  await completeProductionV2({
    lotId: lot1.id,
    completedQty: 80,
    createCarryOver: true,
    carryOverQty: 20,
  })

  // 두 번째 LOT: 이월 사용 (carryOverId는 Mock에서 관리)
  const lot2 = await startNewProduction({
    processCode: 'CA',
    productId: 1,
    productCode: 'P001',
    plannedQty: 100,
    carryOverQty: 20,
  })

  assertEqual(lot2.carryOverIn, 20, '두 번째 LOT 이월 입고 20')
}

// Test 18: 다중 공정 병렬 처리
async function testWorkflow_MultiProcess(): Promise<void> {
  resetProductionData()

  // 여러 공정 동시 시작
  const caLot = await startNewProduction({ processCode: 'CA', productCode: 'P001', plannedQty: 100 })
  const mcLot = await startNewProduction({ processCode: 'MC', productCode: 'P001', plannedQty: 100 })
  const paLot = await startNewProduction({ processCode: 'PA', productCode: 'P001', plannedQty: 100 })

  // 모두 진행 중
  const inProgress = await getInProgressLots()
  assertEqual(inProgress.length, 3, '3개 공정 동시 진행')

  // CA만 완료
  await completeProductionV2({ lotId: caLot.id, completedQty: 100 })

  const inProgressAfter = await getInProgressLots()
  assertEqual(inProgressAfter.length, 2, 'CA 완료 후 2개 진행 중')
}

// ============================================
// Test Suite: LOT 상태 유틸리티
// ============================================

console.log('\n=== Test Suite: LOT 상태 유틸리티 ===\n')

// Test 19: isLotInProgress / isLotCompleted
async function testLotStatusUtils(): Promise<void> {
  resetProductionData()

  const lot = await startNewProduction({
    processCode: 'CA',
    productCode: 'P001',
    plannedQty: 100,
  })

  assertTrue(isLotInProgress(lot), 'IN_PROGRESS 상태 확인')
  assertTrue(!isLotCompleted(lot), 'NOT COMPLETED 상태 확인')

  const completed = await completeProductionV2({
    lotId: lot.id,
    completedQty: 100,
  })

  assertTrue(!isLotInProgress(completed), 'NOT IN_PROGRESS 상태 확인')
  assertTrue(isLotCompleted(completed), 'COMPLETED 상태 확인')
}

// ============================================
// Run All Tests
// ============================================

async function runAllTests(): Promise<void> {
  console.log('=====================================')
  console.log('Phase 2: 2단계 생산 워크플로우 테스트 시작')
  console.log('=====================================')

  let passed = 0
  let failed = 0

  const tests: Array<() => Promise<void>> = [
    // startNewProduction
    testStartNewProduction_Basic,
    testStartNewProduction_AllProcesses,
    testStartNewProduction_WithCarryOver,
    // completeProductionV2
    testCompleteProductionV2_Basic,
    testCompleteProductionV2_WithCarryOver,
    testCompleteProductionV2_AlreadyCompleted,
    testCompleteProductionV2_NotFound,
    // deleteInProgressProduction
    testDeleteInProgress_SoftDelete,
    testDeleteInProgress_HardDelete,
    testDeleteInProgress_Completed,
    testDeleteInProgress_NotFound,
    // getInProgressLots
    testGetInProgressLots_ByProcess,
    testGetInProgressLots_ByLine,
    testGetInProgressLots_ByWorker,
    // Workflow scenarios
    testWorkflow_StartToComplete,
    testWorkflow_StartToCancel,
    testWorkflow_WithCarryOver,
    testWorkflow_MultiProcess,
    // Utilities
    testLotStatusUtils,
  ]

  for (const test of tests) {
    try {
      await test()
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
