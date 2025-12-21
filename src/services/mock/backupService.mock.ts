/**
 * Backup Service (Mock)
 *
 * 브라우저 개발용 Mock 데이터
 */

import { resetStockData } from './stockService.mock'
import { resetProductionData } from './productionService.mock'
import { resetInspectionData } from './inspectionService.mock'
import { resetMaterialData } from './materialService.mock'
import { resetDashboardData } from './dashboardService.mock'
import { resetLineData } from './lineService.mock'
import { resetUserData } from './authService.mock'

export interface BackupData {
  version: string
  timestamp: string
  data: Record<string, unknown[]>
}

/**
 * 백업 생성
 */
export async function createBackup(_options?: {
  includeSystemTables?: boolean
}): Promise<BackupData> {
  await new Promise((r) => setTimeout(r, 500))

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    data: {
      users: [{ id: 1, username: 'admin', name: '관리자' }],
      products: [{ id: 1, code: 'P001', name: '테스트 제품' }],
      materials: [{ id: 1, code: 'MAT-001', name: '테스트 자재' }],
    },
  }
}

/**
 * 백업 다운로드
 */
export function downloadBackup(backup: BackupData): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `mes_backup_${backup.timestamp.replace(/[:.]/g, '-')}.json`
  a.click()

  URL.revokeObjectURL(url)
}

/**
 * 백업 복원 (Mock)
 */
export async function restoreBackup(_backup: BackupData): Promise<void> {
  await new Promise((r) => setTimeout(r, 1000))
  // Mock: 실제로는 아무것도 하지 않음
}

export interface ResetDatabaseResult {
  success: boolean
  message: string
  deletedCounts?: {
    productionLots: number
    lotMaterials: number
    inspections: number
    materialStocks: number
    materials: number
    lines: number
    users: number
    bundleLots: number
    bundleItems: number
    carryOvers: number
    sequenceCounters: number
  }
}

/**
 * 데이터베이스 초기화 (모든 사용자 입력 데이터 삭제)
 * - 생산/재고/검사/자재/라인/사용자(admin제외) 등 모든 데이터 삭제
 * - admin 사용자만 유지
 */
export async function resetDatabase(): Promise<ResetDatabaseResult> {
  await new Promise((r) => setTimeout(r, 500))

  // 실제로 각 Mock 서비스의 데이터를 초기화
  const stockCount = resetStockData()
  const productionCount = resetProductionData()
  const inspectionCount = resetInspectionData()
  const materialCount = resetMaterialData()
  const lineCount = resetLineData()
  const userCount = resetUserData() // admin 제외

  // 대시보드 초기화 상태 설정
  resetDashboardData()

  const deletedCounts = {
    productionLots: productionCount,
    lotMaterials: 0, // LOT와 함께 삭제됨
    inspections: inspectionCount,
    materialStocks: stockCount,
    materials: materialCount,
    lines: lineCount,
    users: userCount,
    bundleLots: 0,
    bundleItems: 0,
    carryOvers: 0,
    sequenceCounters: 0,
  }

  console.log('🗑️ 데이터 초기화 완료:', deletedCounts)

  return {
    success: true,
    message: '데이터베이스가 초기화되었습니다. (admin 계정만 유지)',
    deletedCounts,
  }
}
