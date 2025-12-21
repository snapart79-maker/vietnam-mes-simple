/**
 * Backup Service
 *
 * PostgreSQL 데이터 백업 및 복원
 * - JSON 형식 백업/복원
 * - 테이블별 선택적 백업
 * - 자동 백업 스케줄링
 */
import prisma from '@/lib/prisma'

// ============================================
// Types
// ============================================

export interface BackupData {
  version: string
  createdAt: string
  tables: {
    users?: unknown[]
    products?: unknown[]
    materials?: unknown[]
    materialStocks?: unknown[]
    productionLots?: unknown[]
    lotMaterials?: unknown[]
    inspections?: unknown[]
    sequenceCounters?: unknown[]
    boms?: unknown[]
    lines?: unknown[]
    carryOvers?: unknown[]
    bundleLots?: unknown[]
    bundleItems?: unknown[]
    appSettings?: unknown[]
    tableUserSettings?: unknown[]
  }
  metadata: {
    totalRecords: number
    tableCount: number
    dbName: string
  }
}

export interface BackupOptions {
  tables?: string[]          // 특정 테이블만 백업 (기본: 전체)
  excludeTables?: string[]   // 제외할 테이블
  includeSystemTables?: boolean  // 시스템 테이블 포함 여부
}

export interface RestoreOptions {
  skipExisting?: boolean     // 기존 데이터 스킵
  clearBeforeRestore?: boolean  // 복원 전 데이터 삭제
  tables?: string[]          // 특정 테이블만 복원
}

export interface RestoreResult {
  success: boolean
  restoredTables: string[]
  errors: { table: string; message: string }[]
  totalRecords: number
}

// ============================================
// Constants
// ============================================

const BACKUP_VERSION = '1.0.0'

const ALL_TABLES = [
  'users',
  'products',
  'materials',
  'materialStocks',
  'productionLots',
  'lotMaterials',
  'inspections',
  'sequenceCounters',
  'boms',
  'lines',
  'carryOvers',
  'bundleLots',
  'bundleItems',
  'appSettings',
  'tableUserSettings',
]

const SYSTEM_TABLES = ['users', 'appSettings', 'tableUserSettings']

// ============================================
// Backup Functions
// ============================================

/**
 * 전체 데이터베이스 백업
 */
export async function createBackup(
  options: BackupOptions = {}
): Promise<BackupData> {
  const tables = options.tables || ALL_TABLES
  const excludeTables = options.excludeTables || []
  const includeSystem = options.includeSystemTables ?? false

  const targetTables = tables.filter((table) => {
    if (excludeTables.includes(table)) return false
    if (!includeSystem && SYSTEM_TABLES.includes(table)) return false
    return true
  })

  const backup: BackupData = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables: {},
    metadata: {
      totalRecords: 0,
      tableCount: 0,
      dbName: 'vietnam_mes',
    },
  }

  // 각 테이블 데이터 백업
  for (const table of targetTables) {
    try {
      const data = await backupTable(table)
      if (data.length > 0) {
        backup.tables[table as keyof typeof backup.tables] = data
        backup.metadata.totalRecords += data.length
        backup.metadata.tableCount++
      }
    } catch (error) {
      console.error(`테이블 백업 실패: ${table}`, error)
    }
  }

  return backup
}

/**
 * 개별 테이블 백업
 */
async function backupTable(tableName: string): Promise<unknown[]> {
  switch (tableName) {
    case 'users':
      return prisma.user.findMany()
    case 'products':
      return prisma.product.findMany()
    case 'materials':
      return prisma.material.findMany()
    case 'materialStocks':
      return prisma.materialStock.findMany()
    case 'productionLots':
      return prisma.productionLot.findMany()
    case 'lotMaterials':
      return prisma.lotMaterial.findMany()
    case 'inspections':
      return prisma.inspection.findMany()
    case 'sequenceCounters':
      return prisma.sequenceCounter.findMany()
    case 'boms':
      return prisma.bOM.findMany()
    case 'lines':
      return prisma.line.findMany()
    case 'carryOvers':
      return prisma.carryOver.findMany()
    case 'bundleLots':
      return prisma.bundleLot.findMany()
    case 'bundleItems':
      return prisma.bundleItem.findMany()
    case 'appSettings':
      return prisma.appSettings.findMany()
    case 'tableUserSettings':
      return prisma.tableUserSettings.findMany()
    default:
      return []
  }
}

/**
 * 백업 파일 다운로드
 */
export function downloadBackup(backup: BackupData, filename?: string): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const defaultFilename = `vietnam_mes_backup_${date}.json`

  const link = document.createElement('a')
  link.href = url
  link.download = filename || defaultFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============================================
// Restore Functions
// ============================================

/**
 * 백업 파일 업로드 및 파싱
 */
export function uploadBackup(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const backup = JSON.parse(content) as BackupData

        // 버전 체크
        if (!backup.version || !backup.tables) {
          throw new Error('유효하지 않은 백업 파일입니다.')
        }

        resolve(backup)
      } catch (error) {
        reject(new Error('백업 파일을 읽을 수 없습니다.'))
      }
    }

    reader.onerror = () => reject(new Error('파일 읽기 오류'))
    reader.readAsText(file)
  })
}

/**
 * 데이터 복원
 */
export async function restoreBackup(
  backup: BackupData,
  options: RestoreOptions = {}
): Promise<RestoreResult> {
  const result: RestoreResult = {
    success: false,
    restoredTables: [],
    errors: [],
    totalRecords: 0,
  }

  const targetTables = options.tables || Object.keys(backup.tables)

  // 복원 순서 (외래키 의존성 고려)
  const restoreOrder = [
    'users',
    'products',
    'materials',
    'lines',
    'appSettings',
    'tableUserSettings',
    'materialStocks',
    'boms',
    'productionLots',
    'sequenceCounters',
    'carryOvers',
    'bundleLots',
    'lotMaterials',
    'inspections',
    'bundleItems',
  ]

  const orderedTables = restoreOrder.filter((t) => targetTables.includes(t))

  for (const tableName of orderedTables) {
    const tableData = backup.tables[tableName as keyof typeof backup.tables]
    if (!tableData || tableData.length === 0) continue

    try {
      // 기존 데이터 삭제 (옵션)
      if (options.clearBeforeRestore) {
        await clearTable(tableName)
      }

      // 데이터 복원
      const count = await restoreTable(tableName, tableData, options.skipExisting)
      result.restoredTables.push(tableName)
      result.totalRecords += count
    } catch (error) {
      result.errors.push({
        table: tableName,
        message: error instanceof Error ? error.message : '복원 실패',
      })
    }
  }

  result.success = result.errors.length === 0
  return result
}

/**
 * 테이블 데이터 삭제
 */
async function clearTable(tableName: string): Promise<void> {
  switch (tableName) {
    case 'bundleItems':
      await prisma.bundleItem.deleteMany()
      break
    case 'inspections':
      await prisma.inspection.deleteMany()
      break
    case 'lotMaterials':
      await prisma.lotMaterial.deleteMany()
      break
    case 'bundleLots':
      await prisma.bundleLot.deleteMany()
      break
    case 'carryOvers':
      await prisma.carryOver.deleteMany()
      break
    case 'productionLots':
      await prisma.productionLot.deleteMany()
      break
    case 'boms':
      await prisma.bOM.deleteMany()
      break
    case 'materialStocks':
      await prisma.materialStock.deleteMany()
      break
    case 'sequenceCounters':
      await prisma.sequenceCounter.deleteMany()
      break
    case 'lines':
      await prisma.line.deleteMany()
      break
    case 'materials':
      await prisma.material.deleteMany()
      break
    case 'products':
      await prisma.product.deleteMany()
      break
    case 'users':
      // 사용자는 삭제하지 않음
      break
    case 'appSettings':
      await prisma.appSettings.deleteMany()
      break
    case 'tableUserSettings':
      await prisma.tableUserSettings.deleteMany()
      break
  }
}

/**
 * 개별 테이블 복원
 */
async function restoreTable(
  tableName: string,
  data: unknown[],
  skipExisting?: boolean
): Promise<number> {
  let count = 0

  for (const record of data) {
    try {
      await restoreRecord(tableName, record as Record<string, unknown>, skipExisting)
      count++
    } catch (error) {
      if (!skipExisting) throw error
    }
  }

  return count
}

/**
 * 개별 레코드 복원
 */
async function restoreRecord(
  tableName: string,
  record: Record<string, unknown>,
  skipExisting?: boolean
): Promise<void> {
  // ID 제거 (자동 생성)
  const { id, createdAt, updatedAt, ...data } = record

  // 날짜 필드 변환
  const processedData = processDateFields(data)

  switch (tableName) {
    case 'users':
      if (skipExisting) {
        const existing = await prisma.user.findUnique({
          where: { username: processedData.username as string },
        })
        if (existing) return
      }
      await prisma.user.create({ data: processedData as any })
      break

    case 'products':
      if (skipExisting) {
        const existing = await prisma.product.findUnique({
          where: { code: processedData.code as string },
        })
        if (existing) return
      }
      await prisma.product.create({ data: processedData as any })
      break

    case 'materials':
      if (skipExisting) {
        const existing = await prisma.material.findUnique({
          where: { code: processedData.code as string },
        })
        if (existing) return
      }
      await prisma.material.create({ data: processedData as any })
      break

    case 'materialStocks':
      await prisma.materialStock.create({ data: processedData as any })
      break

    case 'productionLots':
      if (skipExisting) {
        const existing = await prisma.productionLot.findUnique({
          where: { lotNumber: processedData.lotNumber as string },
        })
        if (existing) return
      }
      await prisma.productionLot.create({ data: processedData as any })
      break

    case 'lotMaterials':
      await prisma.lotMaterial.create({ data: processedData as any })
      break

    case 'inspections':
      await prisma.inspection.create({ data: processedData as any })
      break

    case 'sequenceCounters':
      await prisma.sequenceCounter.create({ data: processedData as any })
      break

    case 'boms':
      await prisma.bOM.create({ data: processedData as any })
      break

    case 'lines':
      if (skipExisting) {
        const existing = await prisma.line.findUnique({
          where: { code: processedData.code as string },
        })
        if (existing) return
      }
      await prisma.line.create({ data: processedData as any })
      break

    case 'carryOvers':
      await prisma.carryOver.create({ data: processedData as any })
      break

    case 'bundleLots':
      if (skipExisting) {
        const existing = await prisma.bundleLot.findUnique({
          where: { bundleNo: processedData.bundleNo as string },
        })
        if (existing) return
      }
      await prisma.bundleLot.create({ data: processedData as any })
      break

    case 'bundleItems':
      await prisma.bundleItem.create({ data: processedData as any })
      break

    case 'appSettings':
      if (skipExisting) {
        const existing = await prisma.appSettings.findUnique({
          where: { key: processedData.key as string },
        })
        if (existing) return
      }
      await prisma.appSettings.create({ data: processedData as any })
      break

    case 'tableUserSettings':
      await prisma.tableUserSettings.create({ data: processedData as any })
      break
  }
}

/**
 * 날짜 필드 처리
 */
function processDateFields(data: Record<string, unknown>): Record<string, unknown> {
  const dateFields = [
    'createdAt',
    'updatedAt',
    'startedAt',
    'completedAt',
    'receivedAt',
    'inspectedAt',
    'sourceDate',
  ]

  const processed = { ...data }

  for (const field of dateFields) {
    if (processed[field] && typeof processed[field] === 'string') {
      processed[field] = new Date(processed[field] as string)
    }
  }

  return processed
}

// ============================================
// Auto Backup
// ============================================

let autoBackupInterval: NodeJS.Timeout | null = null

/**
 * 자동 백업 스케줄 설정
 */
export function scheduleBackup(
  intervalHours: number,
  callback?: (backup: BackupData) => void
): void {
  // 기존 스케줄 취소
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval)
  }

  const intervalMs = intervalHours * 60 * 60 * 1000

  autoBackupInterval = setInterval(async () => {
    try {
      const backup = await createBackup({ includeSystemTables: false })
      downloadBackup(backup)
      callback?.(backup)
    } catch (error) {
      console.error('자동 백업 실패:', error)
    }
  }, intervalMs)
}

/**
 * 자동 백업 취소
 */
export function cancelScheduledBackup(): void {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval)
    autoBackupInterval = null
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * 백업 정보 조회
 */
export function getBackupInfo(backup: BackupData): {
  version: string
  createdAt: string
  tables: { name: string; count: number }[]
  totalRecords: number
} {
  const tables = Object.entries(backup.tables).map(([name, data]) => ({
    name,
    count: Array.isArray(data) ? data.length : 0,
  }))

  return {
    version: backup.version,
    createdAt: backup.createdAt,
    tables,
    totalRecords: backup.metadata.totalRecords,
  }
}

/**
 * 백업 유효성 검사
 */
export function validateBackup(backup: unknown): backup is BackupData {
  if (!backup || typeof backup !== 'object') return false

  const b = backup as Record<string, unknown>

  return (
    typeof b.version === 'string' &&
    typeof b.createdAt === 'string' &&
    typeof b.tables === 'object' &&
    b.tables !== null
  )
}
