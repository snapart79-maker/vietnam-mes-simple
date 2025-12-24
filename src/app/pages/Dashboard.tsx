/**
 * Dashboard Page
 *
 * 실시간 DB 연동 대시보드
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Package,
  CheckCircle2,
  Pin,
  Factory,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { hasBusinessAPI, getAPI } from '@/lib/electronBridge'
import { useAuth } from '../context/AuthContext'

// ===== 타입 정의 =====
export interface DashboardStats {
  totalProduction: number
  todayProduction: number
  totalDefects: number
  passRate: number
  defectRate: number
  achievementRate: number
  completedLots: number
  inProgressLots: number
  lowStockCount: number
  activeLines: number
  totalLines: number
}

export interface ProcessAchievement {
  processCode: string
  processName: string
  target: number
  actual: number
  rate: number
}

export interface LowStockItem {
  materialId: number
  materialCode: string
  materialName: string
  currentStock: number
  safeStock: number
  unit: string
}

// ===== 로컬 스텁 함수 =====

// 대시보드 통계 조회 (스텁 - API 미구현)
async function getDashboardStats(): Promise<DashboardStats> {
  // TODO: Electron API 구현 필요
  console.warn('[Dashboard] getDashboardStats: API not implemented')
  return {
    totalProduction: 0,
    todayProduction: 0,
    totalDefects: 0,
    passRate: 100,
    defectRate: 0,
    achievementRate: 0,
    completedLots: 0,
    inProgressLots: 0,
    lowStockCount: 0,
    activeLines: 0,
    totalLines: 5,
  }
}

// 공정별 달성률 조회 (스텁 - API 미구현)
async function getProcessAchievement(): Promise<ProcessAchievement[]> {
  // TODO: Electron API 구현 필요
  console.warn('[Dashboard] getProcessAchievement: API not implemented')
  return [
    { processCode: 'CA', processName: '자동절단압착', target: 100, actual: 0, rate: 0 },
    { processCode: 'MC', processName: '수동압착', target: 100, actual: 0, rate: 0 },
    { processCode: 'PA', processName: '제품조립', target: 100, actual: 0, rate: 0 },
    { processCode: 'VI', processName: '육안검사', target: 100, actual: 0, rate: 0 },
  ]
}

// 저재고 품목 조회 (Electron API 사용)
async function getLowStockItems(): Promise<LowStockItem[]> {
  if (!hasBusinessAPI()) {
    console.warn('[Dashboard] getLowStockItems: Electron API not available')
    return []
  }
  try {
    const api = getAPI()
    const result = await api!.stock.getLowStock()
    if (!result.success || !result.data) {
      return []
    }
    // API 결과를 LowStockItem 형식으로 변환
    return (result.data as LowStockItem[]) || []
  } catch (err) {
    console.error('[Dashboard] getLowStockItems error:', err)
    return []
  }
}

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [processData, setProcessData] = useState<ProcessAchievement[]>([])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // 데이터 로드
  const loadDashboardData = async () => {
    try {
      setIsLoading(true)

      const [statsData, processAchievement, lowStock] = await Promise.all([
        getDashboardStats(),
        getProcessAchievement(),
        getLowStockItems(),
      ])

      setStats(statsData)
      setProcessData(processAchievement)
      setLowStockItems(lowStock)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Dashboard data load error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()

    // 5분마다 자동 새로고침
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const pinnedProcesses = [
    {
      id: 'material/receiving',
      label: '자재 입고',
      desc: '바코드 스캔 및 입고 처리',
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      id: 'process/ca',
      label: '자동절단압착 (CA)',
      desc: '전선 절단 및 압착 공정',
      icon: Factory,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      id: 'process/pa',
      label: '제품 조립 (PA)',
      desc: '최종 제품 조립 및 라벨링',
      icon: Factory,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ]

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-500">데이터 로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
          {user && (
            <p className="text-sm text-slate-500">
              환영합니다, {user.name}님 ({user.role})
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-slate-400">
              마지막 업데이트: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={isLoading}
          >
            <RefreshCw
              size={14}
              className={`mr-1 ${isLoading ? 'animate-spin' : ''}`}
            />
            새로고침
          </Button>
        </div>
      </div>

      {/* 1. Quick Links Section */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Pin size={18} className="text-slate-500" />
          자주 찾는 공정
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {pinnedProcesses.map((proc) => (
            <Card
              key={proc.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-slate-200"
              onClick={() => navigate(`/${proc.id}`)}
            >
              <CardContent className="p-6 flex items-start justify-between">
                <div className="space-y-2">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${proc.bg} ${proc.color}`}
                  >
                    <proc.icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{proc.label}</h3>
                    <p className="text-sm text-slate-500">{proc.desc}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400">
                  <ArrowRight size={18} />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 2. Key Metrics Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              금일 총 생산량
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.todayProduction.toLocaleString() || 0}{' '}
              <span className="text-sm font-normal text-slate-500">EA</span>
            </div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              목표 달성률 {stats?.achievementRate || 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              평균 불량률
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${
                (stats?.defectRate || 0) > 1 ? 'text-red-600' : 'text-green-600'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.defectRate || 0}%</div>
            <p className="text-xs text-slate-500 mt-1">
              관리 기준(1.0%){' '}
              {(stats?.defectRate || 0) <= 1 ? '이내' : '초과'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              가동 라인
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeLines || 0}{' '}
              <span className="text-sm font-normal text-slate-500">
                / {stats?.totalLines || 5}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.totalLines
                ? Math.round((stats.activeLines / stats.totalLines) * 100)
                : 0}
              % 가동률
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-sm ${
            (stats?.lowStockCount || 0) > 0
              ? 'bg-orange-50 border-orange-100'
              : ''
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle
              className={`text-sm font-medium ${
                (stats?.lowStockCount || 0) > 0
                  ? 'text-orange-800'
                  : 'text-slate-500'
              }`}
            >
              재고 경고
            </CardTitle>
            <Package
              className={`h-4 w-4 ${
                (stats?.lowStockCount || 0) > 0
                  ? 'text-orange-600'
                  : 'text-slate-400'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (stats?.lowStockCount || 0) > 0 ? 'text-orange-900' : ''
              }`}
            >
              {stats?.lowStockCount || 0}{' '}
              <span
                className={`text-sm font-normal ${
                  (stats?.lowStockCount || 0) > 0
                    ? 'text-orange-700'
                    : 'text-slate-500'
                }`}
              >
                건
              </span>
            </div>
            <Button
              variant="link"
              className={`px-0 h-auto text-xs ${
                (stats?.lowStockCount || 0) > 0
                  ? 'text-orange-700 underline decoration-orange-700'
                  : 'text-slate-500'
              }`}
              onClick={() => navigate('/material/stock')}
            >
              확인하기
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 3. Charts & Alerts Row */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Process Achievement Chart */}
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>공정별 달성률</CardTitle>
            <CardDescription>일일 생산 목표 대비 실적</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={processData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    type="number"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString()} EA`,
                      name === 'current' ? '현재 실적' : '목표 수량',
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="current"
                    name="현재 실적"
                    fill="#2563eb"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="target"
                    name="목표 수량"
                    fill="#e2e8f0"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="col-span-3 shadow-sm border-orange-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertTriangle size={18} />
                재고 부족 알림
              </CardTitle>
              <Badge
                variant="outline"
                className="text-orange-600 border-orange-200 bg-orange-50"
              >
                Safety Stock 미만
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockItems.map((item) => (
                <div
                  key={item.materialId}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.materialName}
                    </p>
                    <p className="text-xs text-slate-500">{item.materialCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">
                      {item.currentStock.toLocaleString()} {item.unit}
                    </p>
                    <p className="text-xs text-slate-400">
                      최소 {item.safeStock.toLocaleString()} {item.unit}
                    </p>
                  </div>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  재고 부족 항목이 없습니다.
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full text-slate-600"
              onClick={() => navigate('/material/stock')}
            >
              재고 현황 전체보기
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
