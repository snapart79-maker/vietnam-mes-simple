/**
 * Dashboard Service
 *
 * 대시보드 통계 데이터 조회
 */
import prisma from '@/lib/prisma'

// ============================================
// Types
// ============================================

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

export interface HourlyProduction {
  time: string
  amount: number
}

export interface RecentActivity {
  id: number
  type: 'production' | 'inspection' | 'material'
  description: string
  timestamp: Date
  status: 'success' | 'warning' | 'error'
}

// ============================================
// Dashboard Statistics
// ============================================

/**
 * 대시보드 핵심 통계 조회
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 금일 생산량 (완료된 LOT)
  const todayLots = await prisma.productionLot.aggregate({
    where: {
      startedAt: { gte: today },
      status: { in: ['COMPLETED', 'IN_PROGRESS'] },
    },
    _sum: { completedQty: true },
  })

  const todayProduction = todayLots._sum.completedQty || 0

  // 금일 불량 수량
  const defectSum = await prisma.productionLot.aggregate({
    where: {
      startedAt: { gte: today },
    },
    _sum: { defectQty: true },
  })

  const defectQty = defectSum._sum.defectQty || 0
  const totalQty = todayProduction + defectQty
  const defectRate = totalQty > 0 ? (defectQty / totalQty) * 100 : 0

  // 가동 라인 수
  const activeLines = await prisma.line.count({
    where: { isActive: true },
  })

  const totalLines = await prisma.line.count()

  // 재고 부족 항목 수
  const lowStockItems = await getLowStockItems()
  const lowStockCount = lowStockItems.length

  // 목표 생산량 (설정에서 가져오거나 기본값)
  const targetSetting = await prisma.appSettings.findUnique({
    where: { key: 'daily_production_target' },
  })
  const targetProduction = targetSetting ? parseInt(targetSetting.value, 10) : 2000

  const achievementRate = targetProduction > 0
    ? Math.round((todayProduction / targetProduction) * 100)
    : 0

  return {
    todayProduction,
    targetProduction,
    achievementRate,
    defectRate: Math.round(defectRate * 10) / 10,
    activeLines,
    totalLines: totalLines || 5,
    lowStockCount,
  }
}

/**
 * 공정별 달성률 조회
 */
export async function getProcessAchievement(): Promise<ProcessAchievement[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const processes = [
    { code: 'MO', name: '자재입고', target: 1000 },
    { code: 'CA', name: 'CA공정', target: 2000 },
    { code: 'PA', name: 'PA조립', target: 1500 },
    { code: 'VI', name: '최종검사', target: 1500 },
  ]

  const achievements: ProcessAchievement[] = []

  for (const proc of processes) {
    const result = await prisma.productionLot.aggregate({
      where: {
        processCode: proc.code,
        startedAt: { gte: today },
        status: { in: ['COMPLETED', 'IN_PROGRESS'] },
      },
      _sum: { completedQty: true },
    })

    const current = result._sum.completedQty || 0
    const rate = proc.target > 0 ? Math.round((current / proc.target) * 100) : 0

    achievements.push({
      name: proc.name,
      processCode: proc.code,
      target: proc.target,
      current,
      rate,
    })
  }

  return achievements
}

/**
 * 재고 부족 항목 조회
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {
  // 자재별 총 재고 계산
  const materials = await prisma.material.findMany({
    where: { isActive: true },
    include: {
      stocks: {
        select: {
          quantity: true,
          usedQty: true,
        },
      },
    },
  })

  const lowStockItems: LowStockItem[] = []

  for (const material of materials) {
    const totalStock = material.stocks.reduce(
      (sum, s) => sum + (s.quantity - s.usedQty),
      0
    )

    if (totalStock < material.safeStock) {
      lowStockItems.push({
        id: material.id,
        code: material.code,
        name: material.name,
        stock: totalStock,
        safeStock: material.safeStock,
        unit: material.unit,
      })
    }
  }

  return lowStockItems.slice(0, 10) // 최대 10개
}

/**
 * 시간대별 생산량 조회
 */
export async function getHourlyProduction(): Promise<HourlyProduction[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const hourlyData: HourlyProduction[] = []

  for (let hour = 8; hour <= 17; hour++) {
    const startHour = new Date(today)
    startHour.setHours(hour, 0, 0, 0)

    const endHour = new Date(today)
    endHour.setHours(hour + 1, 0, 0, 0)

    const result = await prisma.productionLot.aggregate({
      where: {
        startedAt: {
          gte: startHour,
          lt: endHour,
        },
      },
      _sum: { completedQty: true },
    })

    hourlyData.push({
      time: `${hour.toString().padStart(2, '0')}:00`,
      amount: result._sum.completedQty || 0,
    })
  }

  // 누적으로 변환
  let cumulative = 0
  return hourlyData.map((h) => {
    cumulative += h.amount
    return { ...h, amount: cumulative }
  })
}

/**
 * 최근 활동 조회
 */
export async function getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
  const activities: RecentActivity[] = []

  // 최근 생산 LOT
  const recentLots = await prisma.productionLot.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      lotNumber: true,
      processCode: true,
      status: true,
      createdAt: true,
    },
  })

  for (const lot of recentLots) {
    activities.push({
      id: lot.id,
      type: 'production',
      description: `[${lot.processCode}] ${lot.lotNumber} ${
        lot.status === 'COMPLETED' ? '완료' : '진행중'
      }`,
      timestamp: lot.createdAt,
      status: lot.status === 'COMPLETED' ? 'success' : 'warning',
    })
  }

  // 최근 검사
  const recentInspections = await prisma.inspection.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      productionLot: { select: { lotNumber: true } },
    },
  })

  for (const insp of recentInspections) {
    activities.push({
      id: insp.id,
      type: 'inspection',
      description: `[${insp.type}] ${insp.productionLot.lotNumber} ${
        insp.result === 'PASS' ? '합격' : '불합격'
      }`,
      timestamp: insp.createdAt,
      status: insp.result === 'PASS' ? 'success' : 'error',
    })
  }

  // 시간순 정렬
  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}
