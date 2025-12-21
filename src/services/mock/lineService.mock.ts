/**
 * Line Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 */

export interface Line {
  id: number
  code: string
  name: string
  processCode: string
  isActive: boolean
}

// Mock 라인 데이터 (초기 데이터 없음 - 공장초기화 상태)
const MOCK_LINES: Line[] = []

/**
 * 전체 라인 목록 조회
 */
export async function getLines(): Promise<Line[]> {
  await new Promise((r) => setTimeout(r, 100))
  return MOCK_LINES
}

/**
 * 공정별 라인 목록 조회
 */
export async function getLinesByProcess(processCode: string): Promise<Line[]> {
  await new Promise((r) => setTimeout(r, 100))
  return MOCK_LINES.filter((l) => l.processCode === processCode.toUpperCase())
}

/**
 * 라인 생성
 */
export async function createLine(data: {
  code: string
  name: string
  processCode: string
}): Promise<Line> {
  await new Promise((r) => setTimeout(r, 200))
  const newLine: Line = {
    id: MOCK_LINES.length + 1,
    ...data,
    isActive: true,
  }
  MOCK_LINES.push(newLine)
  return newLine
}

/**
 * 라인 수정
 */
export async function updateLine(lineId: number, data: Partial<Line>): Promise<Line> {
  await new Promise((r) => setTimeout(r, 150))
  const line = MOCK_LINES.find((l) => l.id === lineId)
  if (!line) throw new Error('Line not found')

  Object.assign(line, data)
  return line
}

/**
 * 라인 활성화/비활성화
 */
export async function setLineActive(lineId: number, isActive: boolean): Promise<void> {
  await new Promise((r) => setTimeout(r, 150))
  const line = MOCK_LINES.find((l) => l.id === lineId)
  if (line) {
    line.isActive = isActive
  }
}

/**
 * 라인 삭제
 */
export async function deleteLine(lineId: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 150))
  const index = MOCK_LINES.findIndex((l) => l.id === lineId)
  if (index !== -1) {
    MOCK_LINES.splice(index, 1)
  }
}

/**
 * 라인 데이터 초기화 (모든 라인 삭제)
 */
export function resetLineData(): number {
  const count = MOCK_LINES.length
  MOCK_LINES.length = 0
  return count
}
