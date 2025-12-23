/**
 * Phase 5: 라인 관리 테스트
 *
 * 목표: lineService.mock의 라인 CRUD, 공정별 배정, localStorage 영속화 검증
 * - 라인 CRUD: 추가, 조회, 수정, 삭제
 * - 공정별 라인 배정: 배정, 재배정
 * - localStorage 영속화: 데이터 저장/로드
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

describe('Phase 5: 라인 CRUD 기능', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('라인 생성 (createLine)', () => {
    it('새 라인을 생성하고 localStorage에 저장해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const result = await module.createLine({
        code: 'CA-TEST',
        name: 'CA 테스트 라인',
        processCode: 'CA',
      })

      expect(result.success).toBe(true)
      expect(result.line).toBeDefined()
      expect(result.line!.id).toBeGreaterThan(0)
      expect(result.line!.code).toBe('CA-TEST')
      expect(result.line!.name).toBe('CA 테스트 라인')
      expect(result.line!.processCode).toBe('CA')
      expect(result.line!.isActive).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vietnam_mes_lines',
        expect.any(String)
      )
    })

    it('중복 코드로 라인 생성 시 success: false 반환해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      await module.createLine({
        code: 'DUP-01',
        name: '중복 테스트',
        processCode: 'CA',
      })

      const result = await module.createLine({
        code: 'DUP-01',
        name: '중복 테스트 2',
        processCode: 'MC',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('이미 존재합니다')
    })

    it('유효하지 않은 공정코드로 생성 시 success: false 반환해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const result = await module.createLine({
        code: 'INVALID-01',
        name: '유효하지 않은 공정',
        processCode: 'INVALID',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('유효하지 않은 공정 코드')
    })
  })

  describe('라인 조회', () => {
    it('모든 라인을 조회해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const lines = await module.getLines()

      expect(Array.isArray(lines)).toBe(true)
      expect(lines.length).toBeGreaterThan(0)
    })

    it('ID로 라인을 조회해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const createResult = await module.createLine({
        code: 'ID-TEST',
        name: 'ID 테스트',
        processCode: 'MC',
      })

      expect(createResult.success).toBe(true)
      const lineId = createResult.line!.id

      const found = await module.getLineById(lineId)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(lineId)
      expect(found?.code).toBe('ID-TEST')
    })

    it('코드로 라인을 조회해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      await module.createLine({
        code: 'CODE-TEST',
        name: '코드 테스트',
        processCode: 'MS',
      })

      const found = await module.getLineByCode('CODE-TEST')

      expect(found).not.toBeNull()
      expect(found?.code).toBe('CODE-TEST')
    })

    it('존재하지 않는 ID 조회 시 null 반환해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const found = await module.getLineById(99999)

      expect(found).toBeNull()
    })

    it('공정별 라인 조회가 정상 동작해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      await module.createLine({
        code: 'SP-NEW-01',
        name: 'SP 신규 라인',
        processCode: 'SP',
      })

      const spLines = await module.getLinesByProcess('SP')

      expect(spLines.length).toBeGreaterThan(0)
      expect(spLines.every((l) => l.processCode === 'SP')).toBe(true)
    })

    it('활성 라인만 조회할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      // 활성 라인 생성
      await module.createLine({
        code: 'ACTIVE-01',
        name: '활성 라인',
        processCode: 'PA',
      })

      // 비활성 라인 생성 (생성 후 비활성화)
      const inactiveResult = await module.createLine({
        code: 'INACTIVE-01',
        name: '비활성 라인',
        processCode: 'PA',
      })

      if (inactiveResult.success && inactiveResult.line) {
        await module.setLineActive(inactiveResult.line.id, false)
      }

      const activeLines = await module.getActiveLines()

      expect(activeLines.every((l) => l.isActive === true)).toBe(true)
    })
  })

  describe('라인 수정 (updateLine)', () => {
    it('라인 정보를 수정할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const created = await module.createLine({
        code: 'UPDATE-01',
        name: '수정 전',
        processCode: 'CA',
      })

      expect(created.success).toBe(true)
      const lineId = created.line!.id

      const result = await module.updateLine(lineId, {
        name: '수정 후',
        description: '설명 추가',
      })

      expect(result.success).toBe(true)
      expect(result.line!.name).toBe('수정 후')
      expect(result.line!.description).toBe('설명 추가')
      expect(result.line!.code).toBe('UPDATE-01') // 변경하지 않은 필드 유지
    })

    it('존재하지 않는 라인 수정 시 success: false 반환해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const result = await module.updateLine(99999, { name: '수정 시도' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('라인을 찾을 수 없습니다')
    })

    it('수정 시 updatedAt이 갱신되어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const created = await module.createLine({
        code: 'TIMESTAMP-01',
        name: '타임스탬프 테스트',
        processCode: 'CI',
      })

      expect(created.success).toBe(true)
      const originalUpdatedAt = created.line!.updatedAt

      // 약간의 시간 차이를 위해 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await module.updateLine(created.line!.id, {
        name: '수정됨',
      })

      expect(updated.success).toBe(true)
      expect(new Date(updated.line!.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      )
    })
  })

  describe('라인 삭제 (deleteLine)', () => {
    it('단일 라인을 삭제할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const created = await module.createLine({
        code: 'DELETE-01',
        name: '삭제 테스트',
        processCode: 'VI',
      })

      expect(created.success).toBe(true)
      const lineId = created.line!.id

      const result = await module.deleteLine(lineId)

      expect(result.success).toBe(true)

      const found = await module.getLineById(lineId)
      expect(found).toBeNull()
    })

    it('여러 라인을 일괄 삭제할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const line1 = await module.createLine({
        code: 'BULK-01',
        name: '일괄 삭제 1',
        processCode: 'MO',
      })

      const line2 = await module.createLine({
        code: 'BULK-02',
        name: '일괄 삭제 2',
        processCode: 'MO',
      })

      expect(line1.success).toBe(true)
      expect(line2.success).toBe(true)

      const result = await module.deleteLines([line1.line!.id, line2.line!.id])

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(2)
    })

    it('존재하지 않는 라인 삭제 시 success: false 반환해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const result = await module.deleteLine(99999)

      expect(result.success).toBe(false)
      expect(result.error).toContain('라인을 찾을 수 없습니다')
    })
  })
})

describe('Phase 5: 공정별 라인 배정', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('공정별 라인 배정 조회', () => {
    it('모든 공정의 라인 배정 현황을 조회해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const assignments = await module.getProcessLineAssignments()

      expect(Array.isArray(assignments)).toBe(true)
      expect(assignments.length).toBe(11) // 11개 공정

      // 모든 공정이 포함되어 있는지 확인
      const processCodes = assignments.map((a) => a.processCode)
      expect(processCodes).toContain('CA')
      expect(processCodes).toContain('MC')
      expect(processCodes).toContain('SP')
    })

    it('특정 공정의 라인 배정 현황을 조회해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const assignment = await module.getProcessLineAssignment('CA')

      expect(assignment).not.toBeNull()
      expect(assignment?.processCode).toBe('CA')
      expect(assignment?.processName).toBe('자동절단압착')
      expect(Array.isArray(assignment?.lines)).toBe(true)
      expect(typeof assignment?.activeCount).toBe('number')
      expect(typeof assignment?.totalCount).toBe('number')
    })
  })

  describe('라인 재배정', () => {
    it('라인을 다른 공정으로 재배정할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const createResult = await module.createLine({
        code: 'REASSIGN-01',
        name: '재배정 테스트',
        processCode: 'CA',
      })

      expect(createResult.success).toBe(true)
      const lineId = createResult.line!.id

      const result = await module.reassignLineToProcess(lineId, 'MC')

      expect(result.success).toBe(true)
      expect(result.line!.processCode).toBe('MC')
      expect(result.line!.id).toBe(lineId)
    })

    it('여러 라인을 특정 공정에 일괄 배정할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const line1 = await module.createLine({
        code: 'BATCH-ASSIGN-01',
        name: '일괄 배정 1',
        processCode: 'MS',
      })

      const line2 = await module.createLine({
        code: 'BATCH-ASSIGN-02',
        name: '일괄 배정 2',
        processCode: 'SB',
      })

      expect(line1.success).toBe(true)
      expect(line2.success).toBe(true)

      const result = await module.assignLinesToProcess(
        [line1.line!.id, line2.line!.id],
        'HS'
      )

      expect(result.success).toBe(true)
      expect(result.assignedCount).toBe(2)

      // 배정 결과 확인
      const hsLines = await module.getLinesByProcess('HS')
      const assignedIds = [line1.line!.id, line2.line!.id]
      expect(hsLines.filter((l) => assignedIds.includes(l.id)).length).toBe(2)
    })
  })
})

describe('Phase 5: 유틸리티 함수', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('라인 코드/이름 자동 생성', () => {
    it('공정별 다음 라인 코드를 생성해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const code = await module.generateLineCode('CQ')

      expect(code).toMatch(/^CQ-\d+$/)
    })

    it('공정별 다음 라인 이름을 생성해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const name = await module.generateLineName('CQ')

      expect(name).toMatch(/^CQ \d+호기$/)
    })
  })

  describe('라인 검색', () => {
    it('키워드로 라인을 검색할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      await module.createLine({
        code: 'SEARCH-01',
        name: '검색용 특별 라인',
        processCode: 'PA',
      })

      const results = await module.searchLines('특별')

      expect(results.length).toBeGreaterThan(0)
      expect(results.some((l) => l.name.includes('특별'))).toBe(true)
    })

    it('코드와 이름 모두에서 검색해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      await module.createLine({
        code: 'UNIQUE-XYZ',
        name: '일반 라인',
        processCode: 'CI',
      })

      const results = await module.searchLines('XYZ')

      expect(results.length).toBeGreaterThan(0)
      expect(results.some((l) => l.code.includes('XYZ'))).toBe(true)
    })
  })

  describe('라인 통계', () => {
    it('라인 통계를 조회할 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const stats = await module.getLineStatistics()

      // 반환 필드명 확인 (totalLines, activeLines, inactiveLines)
      expect(typeof stats.totalLines).toBe('number')
      expect(typeof stats.activeLines).toBe('number')
      expect(typeof stats.inactiveLines).toBe('number')
      expect(typeof stats.byProcess).toBe('object')

      // total = active + inactive
      expect(stats.totalLines).toBe(stats.activeLines + stats.inactiveLines)
    })
  })
})

describe('Phase 5: localStorage 영속화', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('데이터 저장 및 로드', () => {
    it('라인 생성 시 localStorage에 저장되어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      await module.createLine({
        code: 'PERSIST-01',
        name: '영속화 테스트',
        processCode: 'CA',
      })

      const saved = localStorageMock.getItem('vietnam_mes_lines')
      expect(saved).not.toBeNull()

      const parsed = JSON.parse(saved!)
      expect(parsed.some((l: any) => l.code === 'PERSIST-01')).toBe(true)
    })

    it('모듈 리로드 시 localStorage에서 데이터를 로드해야 함', async () => {
      // 첫 번째 모듈 로드 및 데이터 생성
      const module1 = await import('../src/services/mock/lineService.mock')

      await module1.createLine({
        code: 'RELOAD-01',
        name: '리로드 테스트',
        processCode: 'MC',
      })

      // 모듈 리셋 (리로드 시뮬레이션)
      vi.resetModules()

      // 두 번째 모듈 로드
      const module2 = await import('../src/services/mock/lineService.mock')
      const lines = await module2.getLines()

      expect(lines.some((l) => l.code === 'RELOAD-01')).toBe(true)
    })
  })

  describe('데이터 초기화 및 복원', () => {
    it('resetLineData 호출 시 모든 데이터가 삭제되어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      await module.createLine({
        code: 'RESET-01',
        name: '리셋 테스트',
        processCode: 'SP',
      })

      const count = module.resetLineData()

      expect(count).toBeGreaterThan(0)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'vietnam_mes_lines'
      )
    })

    it('restoreDefaultLines 호출 시 기본 라인이 복원되어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      // 모든 라인 삭제
      module.resetLineData()
      vi.resetModules()

      const module2 = await import('../src/services/mock/lineService.mock')
      const count = module2.restoreDefaultLines()

      expect(count).toBeGreaterThan(0)

      const lines = await module2.getLines()
      expect(lines.length).toBeGreaterThan(0)
    })
  })

  describe('데이터 내보내기/가져오기', () => {
    it('라인 데이터를 내보낼 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      await module.createLine({
        code: 'EXPORT-01',
        name: '내보내기 테스트',
        processCode: 'PA',
      })

      const exported = module.exportLineData()

      expect(Array.isArray(exported)).toBe(true)
      expect(exported.some((l) => l.code === 'EXPORT-01')).toBe(true)
    })

    it('라인 데이터를 가져올 수 있어야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      const importData = [
        {
          id: 9001,
          code: 'IMPORT-01',
          name: '가져오기 테스트',
          processCode: 'CI',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      const result = module.importLineData(importData)

      expect(result.success).toBe(true)
      expect(result.importedCount).toBe(1)

      const lines = await module.getLines()
      expect(lines.some((l) => l.code === 'IMPORT-01')).toBe(true)
    })

    it('중복 코드 가져오기 시 기존 라인을 업데이트해야 함', async () => {
      const module = await import('../src/services/mock/lineService.mock')

      // 기존 데이터 생성
      await module.createLine({
        code: 'MERGE-EXISTING',
        name: '기존 라인',
        processCode: 'VI',
      })

      const linesBefore = await module.getLines()
      const countBefore = linesBefore.length

      // 같은 코드로 가져오기 (업데이트)
      const importData = [
        {
          id: 9002,
          code: 'MERGE-EXISTING',
          name: '업데이트된 라인',
          processCode: 'MO',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      const result = module.importLineData(importData)

      expect(result.importedCount).toBe(1)

      const linesAfter = await module.getLines()
      // 중복된 코드는 업데이트되므로 개수는 동일
      expect(linesAfter.length).toBe(countBefore)

      const updatedLine = linesAfter.find((l) => l.code === 'MERGE-EXISTING')
      expect(updatedLine?.name).toBe('업데이트된 라인')
      expect(updatedLine?.processCode).toBe('MO')
    })
  })
})

describe('Phase 5: 통합 테스트', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  it('전체 라인 관리 워크플로우가 정상 동작해야 함', async () => {
    const module = await import('../src/services/mock/lineService.mock')

    // 1. 초기 라인 확인
    const initialLines = await module.getLines()
    expect(initialLines.length).toBeGreaterThan(0)

    // 2. 새 라인 생성
    const createResult = await module.createLine({
      code: 'WORKFLOW-01',
      name: '워크플로우 테스트 라인',
      processCode: 'CA',
      description: '통합 테스트용 라인',
    })
    expect(createResult.success).toBe(true)
    const newLineId = createResult.line!.id

    // 3. 라인 수정
    const updateResult = await module.updateLine(newLineId, {
      name: '워크플로우 테스트 라인 (수정됨)',
    })
    expect(updateResult.success).toBe(true)
    expect(updateResult.line!.name).toContain('수정됨')

    // 4. 공정 재배정
    const reassignResult = await module.reassignLineToProcess(newLineId, 'MC')
    expect(reassignResult.success).toBe(true)
    expect(reassignResult.line!.processCode).toBe('MC')

    // 5. 공정별 배정 현황 확인
    const mcAssignment = await module.getProcessLineAssignment('MC')
    expect(mcAssignment?.lines.some((l) => l.id === newLineId)).toBe(true)

    // 6. 라인 검색
    const searchResults = await module.searchLines('워크플로우')
    expect(searchResults.length).toBeGreaterThan(0)

    // 7. 통계 확인
    const stats = await module.getLineStatistics()
    expect(stats.totalLines).toBeGreaterThan(0)
    expect(stats.byProcess['MC'].total).toBeGreaterThan(0)

    // 8. 모듈 리로드 후 데이터 유지 확인
    vi.resetModules()
    const module2 = await import('../src/services/mock/lineService.mock')
    const reloadedLine = await module2.getLineById(newLineId)
    expect(reloadedLine).not.toBeNull()
    expect(reloadedLine?.processCode).toBe('MC')

    // 9. 라인 삭제
    const deleteResult = await module2.deleteLine(newLineId)
    expect(deleteResult.success).toBe(true)

    // 10. 삭제 확인
    const deletedLine = await module2.getLineById(newLineId)
    expect(deletedLine).toBeNull()
  })

  it('앱 재시작 시나리오: 모든 라인 데이터가 유지되어야 함', async () => {
    // 세션 1: 데이터 생성
    const session1 = await import('../src/services/mock/lineService.mock')

    const line1Result = await session1.createLine({
      code: 'SESSION-01',
      name: '세션 1 라인',
      processCode: 'SP',
    })
    expect(line1Result.success).toBe(true)

    const line2Result = await session1.createLine({
      code: 'SESSION-02',
      name: '세션 2 라인',
      processCode: 'PA',
    })
    expect(line2Result.success).toBe(true)

    // line2 비활성화
    await session1.setLineActive(line2Result.line!.id, false)

    // 앱 재시작 시뮬레이션
    vi.resetModules()

    // 세션 2: 데이터 확인
    const session2 = await import('../src/services/mock/lineService.mock')

    const lines = await session2.getLines()
    expect(lines.some((l) => l.code === 'SESSION-01')).toBe(true)
    expect(lines.some((l) => l.code === 'SESSION-02')).toBe(true)

    const line1 = await session2.getLineByCode('SESSION-01')
    expect(line1?.isActive).toBe(true)

    const line2 = await session2.getLineByCode('SESSION-02')
    expect(line2?.isActive).toBe(false)

    const stats = await session2.getLineStatistics()
    expect(stats.byProcess['SP'].total).toBeGreaterThan(0)
    expect(stats.byProcess['PA'].total).toBeGreaterThan(0)
  })
})
