/**
 * Line Service (Mock)
 *
 * Phase 5: 라인 관리
 * - 라인 동적 추가/수정/삭제 CRUD
 * - 공정별 라인 배정
 * - 설정 localStorage 저장
 *
 * 브라우저 개발용 Mock 데이터 (localStorage 영속화)
 */

// ============================================
// 타입 정의
// ============================================

export interface Line {
  id: number
  code: string           // 라인 코드 (예: CA-01)
  name: string           // 라인명 (예: CA 1호기)
  processCode: string    // 공정 코드 (예: CA)
  isActive: boolean      // 활성화 여부
  description?: string   // 설명 (선택)
  createdAt: string      // 생성일시 (ISO)
  updatedAt: string      // 수정일시 (ISO)
}

export interface LineCreateInput {
  code: string
  name: string
  processCode: string
  description?: string
}

export interface LineUpdateInput {
  code?: string
  name?: string
  processCode?: string
  description?: string
  isActive?: boolean
}

export interface ProcessLineAssignment {
  processCode: string
  processName: string
  lines: Line[]
  activeCount: number
  totalCount: number
}

// ============================================
// 상수 정의
// ============================================

const STORAGE_KEY = 'vietnam_mes_lines'

// 공정 코드 및 이름
export const PROCESS_CODES = [
  'CA', 'MC', 'MS', 'SB', 'HS', 'CQ', 'SP', 'PA', 'CI', 'VI', 'MO'
] as const

export const PROCESS_NAMES: Record<string, string> = {
  CA: '자동절단압착',
  MC: '수동압착',
  MS: '중간스트립',
  SB: '서브조립',
  HS: '열수축',
  CQ: '압착검사',
  SP: '제품조립제공부품',
  PA: '제품조립',
  CI: '회로검사',
  VI: '육안검사',
  MO: '자재출고',
}

// 기본 라인 데이터 (초기화용)
const DEFAULT_LINES: Omit<Line, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // CA - 자동절단압착 라인
  { code: 'CA-01', name: 'CA 1호기', processCode: 'CA', isActive: true },
  { code: 'CA-02', name: 'CA 2호기', processCode: 'CA', isActive: true },
  { code: 'CA-03', name: 'CA 3호기', processCode: 'CA', isActive: true },
  // MC - 수동압착 라인
  { code: 'MC-01', name: 'MC 1호기', processCode: 'MC', isActive: true },
  { code: 'MC-02', name: 'MC 2호기', processCode: 'MC', isActive: true },
  // MS - 중간스트립 라인
  { code: 'MS-01', name: 'MS 1호기', processCode: 'MS', isActive: true },
  // SB - 서브조립 라인
  { code: 'SB-01', name: 'SB 1호기', processCode: 'SB', isActive: true },
  { code: 'SB-02', name: 'SB 2호기', processCode: 'SB', isActive: true },
  // PA - 제품조립 라인
  { code: 'PA-01', name: 'PA 1호기', processCode: 'PA', isActive: true },
  { code: 'PA-02', name: 'PA 2호기', processCode: 'PA', isActive: true },
  { code: 'PA-03', name: 'PA 3호기', processCode: 'PA', isActive: true },
  // CI - 회로검사 라인
  { code: 'CI-01', name: 'CI 1호기', processCode: 'CI', isActive: true },
  { code: 'CI-02', name: 'CI 2호기', processCode: 'CI', isActive: true },
  // VI - 육안검사 라인
  { code: 'VI-01', name: 'VI 1호기', processCode: 'VI', isActive: true },
  { code: 'VI-02', name: 'VI 2호기', processCode: 'VI', isActive: true },
  // HS - 열수축 라인
  { code: 'HS-01', name: 'HS 1호기', processCode: 'HS', isActive: true },
  // CQ - 압착검사 라인
  { code: 'CQ-01', name: 'CQ 1호기', processCode: 'CQ', isActive: true },
  // SP - 제품조립제공부품 라인
  { code: 'SP-01', name: 'SP 1호기', processCode: 'SP', isActive: true },
  // MO - 자재출고 라인
  { code: 'MO-01', name: 'MO 1호기', processCode: 'MO', isActive: true },
]

// ============================================
// 데이터 저장소 (localStorage 영속화)
// ============================================

let mockLines: Line[] = []
let nextId = 1

/**
 * localStorage에서 라인 데이터 로드
 */
function loadLines(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      mockLines = parsed.map((line: Line) => ({
        ...line,
        // Date 필드는 문자열로 저장되므로 그대로 유지 (ISO string)
      }))
      nextId = mockLines.length > 0 ? Math.max(...mockLines.map(l => l.id)) + 1 : 1
    } else {
      // 기본 라인 데이터 초기화
      initializeDefaultLines()
    }
  } catch (error) {
    console.error('Failed to load lines from localStorage:', error)
    initializeDefaultLines()
  }
}

/**
 * 기본 라인 데이터로 초기화
 */
function initializeDefaultLines(): void {
  const now = new Date().toISOString()
  mockLines = DEFAULT_LINES.map((line, index) => ({
    ...line,
    id: index + 1,
    createdAt: now,
    updatedAt: now,
  }))
  nextId = mockLines.length + 1
  saveLines()
}

/**
 * localStorage에 라인 데이터 저장
 */
function saveLines(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockLines))
  } catch (error) {
    console.error('Failed to save lines to localStorage:', error)
  }
}

// 모듈 로드 시 초기화
loadLines()

// ============================================
// CRUD 함수
// ============================================

/**
 * 전체 라인 목록 조회
 */
export async function getLines(): Promise<Line[]> {
  await new Promise((r) => setTimeout(r, 50))
  return [...mockLines]
}

/**
 * 라인 ID로 단일 조회
 */
export async function getLineById(lineId: number): Promise<Line | null> {
  await new Promise((r) => setTimeout(r, 50))
  return mockLines.find((l) => l.id === lineId) || null
}

/**
 * 라인 코드로 단일 조회
 */
export async function getLineByCode(code: string): Promise<Line | null> {
  await new Promise((r) => setTimeout(r, 50))
  return mockLines.find((l) => l.code === code.toUpperCase()) || null
}

/**
 * 공정별 라인 목록 조회
 */
export async function getLinesByProcess(processCode: string): Promise<Line[]> {
  await new Promise((r) => setTimeout(r, 50))
  return mockLines.filter((l) => l.processCode === processCode.toUpperCase())
}

/**
 * 활성 라인만 조회
 */
export async function getActiveLines(): Promise<Line[]> {
  await new Promise((r) => setTimeout(r, 50))
  return mockLines.filter((l) => l.isActive)
}

/**
 * 공정별 활성 라인 조회
 */
export async function getActiveLinesByProcess(processCode: string): Promise<Line[]> {
  await new Promise((r) => setTimeout(r, 50))
  return mockLines.filter((l) => l.processCode === processCode.toUpperCase() && l.isActive)
}

/**
 * 라인 생성
 */
export async function createLine(data: LineCreateInput): Promise<{
  success: boolean
  line?: Line
  error?: string
}> {
  await new Promise((r) => setTimeout(r, 100))

  // 입력 검증
  if (!data.code || !data.name || !data.processCode) {
    return {
      success: false,
      error: '라인 코드, 이름, 공정 코드는 필수입니다.',
    }
  }

  // 코드 중복 확인
  const existingCode = mockLines.find((l) => l.code.toUpperCase() === data.code.toUpperCase())
  if (existingCode) {
    return {
      success: false,
      error: `라인 코드 '${data.code}'가 이미 존재합니다.`,
    }
  }

  // 공정 코드 유효성 확인
  const normalizedProcessCode = data.processCode.toUpperCase()
  if (!PROCESS_CODES.includes(normalizedProcessCode as typeof PROCESS_CODES[number])) {
    return {
      success: false,
      error: `유효하지 않은 공정 코드입니다: ${data.processCode}`,
    }
  }

  const now = new Date().toISOString()
  const newLine: Line = {
    id: nextId++,
    code: data.code.toUpperCase(),
    name: data.name,
    processCode: normalizedProcessCode,
    description: data.description,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }

  mockLines.push(newLine)
  saveLines()

  return {
    success: true,
    line: newLine,
  }
}

/**
 * 라인 수정
 */
export async function updateLine(
  lineId: number,
  data: LineUpdateInput
): Promise<{
  success: boolean
  line?: Line
  error?: string
}> {
  await new Promise((r) => setTimeout(r, 100))

  const line = mockLines.find((l) => l.id === lineId)
  if (!line) {
    return {
      success: false,
      error: `라인을 찾을 수 없습니다: ID ${lineId}`,
    }
  }

  // 코드 변경 시 중복 확인
  if (data.code && data.code.toUpperCase() !== line.code) {
    const existingCode = mockLines.find(
      (l) => l.id !== lineId && l.code.toUpperCase() === data.code!.toUpperCase()
    )
    if (existingCode) {
      return {
        success: false,
        error: `라인 코드 '${data.code}'가 이미 존재합니다.`,
      }
    }
  }

  // 공정 코드 변경 시 유효성 확인
  if (data.processCode) {
    const normalizedProcessCode = data.processCode.toUpperCase()
    if (!PROCESS_CODES.includes(normalizedProcessCode as typeof PROCESS_CODES[number])) {
      return {
        success: false,
        error: `유효하지 않은 공정 코드입니다: ${data.processCode}`,
      }
    }
    data.processCode = normalizedProcessCode
  }

  // 업데이트 적용
  if (data.code) line.code = data.code.toUpperCase()
  if (data.name) line.name = data.name
  if (data.processCode) line.processCode = data.processCode
  if (data.description !== undefined) line.description = data.description
  if (data.isActive !== undefined) line.isActive = data.isActive
  line.updatedAt = new Date().toISOString()

  saveLines()

  return {
    success: true,
    line: { ...line },
  }
}

/**
 * 라인 활성화/비활성화
 */
export async function setLineActive(
  lineId: number,
  isActive: boolean
): Promise<{
  success: boolean
  line?: Line
  error?: string
}> {
  await new Promise((r) => setTimeout(r, 50))

  const line = mockLines.find((l) => l.id === lineId)
  if (!line) {
    return {
      success: false,
      error: `라인을 찾을 수 없습니다: ID ${lineId}`,
    }
  }

  line.isActive = isActive
  line.updatedAt = new Date().toISOString()
  saveLines()

  return {
    success: true,
    line: { ...line },
  }
}

/**
 * 라인 삭제
 */
export async function deleteLine(lineId: number): Promise<{
  success: boolean
  error?: string
}> {
  await new Promise((r) => setTimeout(r, 100))

  const index = mockLines.findIndex((l) => l.id === lineId)
  if (index === -1) {
    return {
      success: false,
      error: `라인을 찾을 수 없습니다: ID ${lineId}`,
    }
  }

  mockLines.splice(index, 1)
  saveLines()

  return {
    success: true,
  }
}

/**
 * 여러 라인 삭제
 */
export async function deleteLines(lineIds: number[]): Promise<{
  success: boolean
  deletedCount: number
  errors: string[]
}> {
  await new Promise((r) => setTimeout(r, 100))

  const errors: string[] = []
  let deletedCount = 0

  for (const lineId of lineIds) {
    const index = mockLines.findIndex((l) => l.id === lineId)
    if (index === -1) {
      errors.push(`라인을 찾을 수 없습니다: ID ${lineId}`)
    } else {
      mockLines.splice(index, 1)
      deletedCount++
    }
  }

  saveLines()

  return {
    success: errors.length === 0,
    deletedCount,
    errors,
  }
}

// ============================================
// 공정별 라인 배정 함수
// ============================================

/**
 * 공정별 라인 배정 현황 조회
 */
export async function getProcessLineAssignments(): Promise<ProcessLineAssignment[]> {
  await new Promise((r) => setTimeout(r, 100))

  const assignments: ProcessLineAssignment[] = []

  for (const processCode of PROCESS_CODES) {
    const lines = mockLines.filter((l) => l.processCode === processCode)
    const activeLines = lines.filter((l) => l.isActive)

    assignments.push({
      processCode,
      processName: PROCESS_NAMES[processCode] || processCode,
      lines,
      activeCount: activeLines.length,
      totalCount: lines.length,
    })
  }

  return assignments
}

/**
 * 특정 공정의 라인 배정 현황 조회
 */
export async function getProcessLineAssignment(processCode: string): Promise<ProcessLineAssignment | null> {
  await new Promise((r) => setTimeout(r, 50))

  const normalizedCode = processCode.toUpperCase()
  if (!PROCESS_CODES.includes(normalizedCode as typeof PROCESS_CODES[number])) {
    return null
  }

  const lines = mockLines.filter((l) => l.processCode === normalizedCode)
  const activeLines = lines.filter((l) => l.isActive)

  return {
    processCode: normalizedCode,
    processName: PROCESS_NAMES[normalizedCode] || normalizedCode,
    lines,
    activeCount: activeLines.length,
    totalCount: lines.length,
  }
}

/**
 * 라인을 다른 공정으로 이동
 */
export async function reassignLineToProcess(
  lineId: number,
  newProcessCode: string
): Promise<{
  success: boolean
  line?: Line
  error?: string
}> {
  await new Promise((r) => setTimeout(r, 100))

  const normalizedCode = newProcessCode.toUpperCase()
  if (!PROCESS_CODES.includes(normalizedCode as typeof PROCESS_CODES[number])) {
    return {
      success: false,
      error: `유효하지 않은 공정 코드입니다: ${newProcessCode}`,
    }
  }

  const line = mockLines.find((l) => l.id === lineId)
  if (!line) {
    return {
      success: false,
      error: `라인을 찾을 수 없습니다: ID ${lineId}`,
    }
  }

  const oldProcessCode = line.processCode
  line.processCode = normalizedCode
  line.updatedAt = new Date().toISOString()
  saveLines()

  return {
    success: true,
    line: { ...line },
  }
}

/**
 * 공정에 라인 일괄 배정
 */
export async function assignLinesToProcess(
  lineIds: number[],
  processCode: string
): Promise<{
  success: boolean
  assignedCount: number
  errors: string[]
}> {
  await new Promise((r) => setTimeout(r, 100))

  const normalizedCode = processCode.toUpperCase()
  if (!PROCESS_CODES.includes(normalizedCode as typeof PROCESS_CODES[number])) {
    return {
      success: false,
      assignedCount: 0,
      errors: [`유효하지 않은 공정 코드입니다: ${processCode}`],
    }
  }

  const errors: string[] = []
  let assignedCount = 0
  const now = new Date().toISOString()

  for (const lineId of lineIds) {
    const line = mockLines.find((l) => l.id === lineId)
    if (!line) {
      errors.push(`라인을 찾을 수 없습니다: ID ${lineId}`)
    } else {
      line.processCode = normalizedCode
      line.updatedAt = now
      assignedCount++
    }
  }

  saveLines()

  return {
    success: errors.length === 0,
    assignedCount,
    errors,
  }
}

// ============================================
// 통계 및 유틸리티 함수
// ============================================

/**
 * 라인 통계 조회
 */
export async function getLineStatistics(): Promise<{
  totalLines: number
  activeLines: number
  inactiveLines: number
  byProcess: Record<string, { total: number; active: number }>
}> {
  await new Promise((r) => setTimeout(r, 50))

  const byProcess: Record<string, { total: number; active: number }> = {}

  for (const processCode of PROCESS_CODES) {
    const lines = mockLines.filter((l) => l.processCode === processCode)
    byProcess[processCode] = {
      total: lines.length,
      active: lines.filter((l) => l.isActive).length,
    }
  }

  return {
    totalLines: mockLines.length,
    activeLines: mockLines.filter((l) => l.isActive).length,
    inactiveLines: mockLines.filter((l) => !l.isActive).length,
    byProcess,
  }
}

/**
 * 라인 코드 자동 생성
 * 해당 공정의 마지막 라인 번호 + 1
 */
export async function generateLineCode(processCode: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 50))

  const normalizedCode = processCode.toUpperCase()
  const processLines = mockLines.filter((l) => l.processCode === normalizedCode)

  // 기존 라인 번호 추출 (예: CA-01 → 1)
  const numbers = processLines
    .map((l) => {
      const match = l.code.match(/-(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter((n) => !isNaN(n))

  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  return `${normalizedCode}-${String(nextNumber).padStart(2, '0')}`
}

/**
 * 라인 이름 자동 생성
 */
export async function generateLineName(processCode: string): Promise<string> {
  const code = await generateLineCode(processCode)
  const match = code.match(/-(\d+)$/)
  const number = match ? parseInt(match[1], 10) : 1
  return `${processCode.toUpperCase()} ${number}호기`
}

// ============================================
// 데이터 관리 함수
// ============================================

/**
 * 라인 데이터 초기화 (모든 라인 삭제)
 */
export function resetLineData(): number {
  const count = mockLines.length
  mockLines = []
  nextId = 1
  localStorage.removeItem(STORAGE_KEY)
  return count
}

/**
 * 기본 라인 데이터로 복원
 */
export function restoreDefaultLines(): number {
  initializeDefaultLines()
  return mockLines.length
}

/**
 * 라인 데이터 내보내기
 */
export function exportLineData(): Line[] {
  return [...mockLines]
}

/**
 * 라인 데이터 가져오기
 */
export function importLineData(lines: Line[]): {
  success: boolean
  importedCount: number
  errors: string[]
} {
  const errors: string[] = []
  let importedCount = 0

  for (const line of lines) {
    // 기본 검증
    if (!line.code || !line.name || !line.processCode) {
      errors.push(`필수 필드가 누락되었습니다: ${JSON.stringify(line)}`)
      continue
    }

    // 코드 중복 확인
    const existingIndex = mockLines.findIndex((l) => l.code.toUpperCase() === line.code.toUpperCase())

    if (existingIndex !== -1) {
      // 기존 라인 업데이트
      mockLines[existingIndex] = {
        ...mockLines[existingIndex],
        name: line.name,
        processCode: line.processCode.toUpperCase(),
        description: line.description,
        isActive: line.isActive ?? true,
        updatedAt: new Date().toISOString(),
      }
    } else {
      // 새 라인 추가
      const now = new Date().toISOString()
      mockLines.push({
        id: nextId++,
        code: line.code.toUpperCase(),
        name: line.name,
        processCode: line.processCode.toUpperCase(),
        description: line.description,
        isActive: line.isActive ?? true,
        createdAt: line.createdAt || now,
        updatedAt: now,
      })
    }
    importedCount++
  }

  saveLines()

  return {
    success: errors.length === 0,
    importedCount,
    errors,
  }
}

/**
 * 라인 검색
 */
export async function searchLines(query: string): Promise<Line[]> {
  await new Promise((r) => setTimeout(r, 50))

  const normalizedQuery = query.toLowerCase()
  return mockLines.filter(
    (l) =>
      l.code.toLowerCase().includes(normalizedQuery) ||
      l.name.toLowerCase().includes(normalizedQuery) ||
      l.processCode.toLowerCase().includes(normalizedQuery) ||
      (l.description && l.description.toLowerCase().includes(normalizedQuery))
  )
}
