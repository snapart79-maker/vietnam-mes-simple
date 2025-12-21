/**
 * Dashboard Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 * - 초기 데이터 없음 (공장초기화 상태)
 * - 실제 데이터 입력 후 동적으로 계산
 */

export interface DashboardStats {
  todayProduction: number
  targetProduction: number
  achievementRate: number
  defectRate: number
  activeLines: number
  totalLines: number
  lowStockCount: number
}

export interface ProcessAchievement {
  name: string
  processCode: string
  target: number
  current: number
  rate: number
}

export interface LowStockItem {
  id: number
  code: string
  name: string
  stock: number
  safeStock: number
  unit: string
}

/**
 * 대시보드 핵심 통계 조회 (Mock)
 * - 초기 상태: 모든 값 0
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  await new Promise((r) => setTimeout(r, 300))

  // 초기 데이터 없음 - 공장초기화 상태
  return {
    todayProduction: 0,
    targetProduction: 0,
    achievementRate: 0,
    defectRate: 0,
    activeLines: 0,
    totalLines: 0,
    lowStockCount: 0,
  }
}

/**
 * 공정별 달성률 조회 (Mock)
 * - 초기 상태: 빈 배열
 */
export async function getProcessAchievement(): Promise<ProcessAchievement[]> {
  await new Promise((r) => setTimeout(r, 200))

  // 초기 데이터 없음 - 공장초기화 상태
  return []
}

/**
 * 재고 부족 항목 조회 (Mock)
 * - 초기 상태: 빈 배열
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {
  await new Promise((r) => setTimeout(r, 100))

  // 초기 데이터 없음 - 공장초기화 상태
  return []
}

/**
 * 대시보드 데이터 초기화 (호환성 유지)
 */
export function resetDashboardData(): void {
  // 이미 빈 상태이므로 아무 작업 없음
}
