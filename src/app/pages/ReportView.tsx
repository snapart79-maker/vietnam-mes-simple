/**
 * Report View Page
 *
 * 리포트 화면 (DB 연동)
 * - 생산 현황: 일별 공정별 생산 통계
 * - LOT 추적: 정방향/역방향 추적
 * - 투입 이력: LOT별 자재 투입 내역
 */
import React, { useState, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Calendar as CalendarIcon,
  Search,
  Download,
  Filter,
  Loader2,
  ArrowRight,
  ChevronRight,
  Package,
  Factory,
  GitBranch,
} from 'lucide-react'
import { clsx } from 'clsx'
import { downloadExcel } from '@/lib/excelUtils'
import { toast } from 'sonner'
// Mock 서비스 사용 (브라우저에서 Prisma 사용 불가)
import { getDailyProductionSummary } from '@/services/mock/productionService.mock'
import {
  traceBackward,
  traceForward,
  flattenTraceTree,
  type TraceResult,
  type TraceNode,
} from '@/services/mock/lotTraceService.mock'

interface ProductionData {
  processCode: string
  productCode: string
  productName: string
  completedQty: number
  defectQty: number
  passRate: number
}

interface InputHistoryItem {
  timestamp: Date
  lotNumber: string
  processCode: string
  materialCode: string
  materialName: string
  materialLotNo: string
  quantity: number
}

export const ReportView = () => {
  const { reportId } = useParams<{ reportId: string }>()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 생산 현황
  const [productionData, setProductionData] = useState<ProductionData[]>([])

  // LOT 추적
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null)
  const [traceDirection, setTraceDirection] = useState<'FORWARD' | 'BACKWARD'>('BACKWARD')
  const [flatNodes, setFlatNodes] = useState<TraceNode[]>([])

  // 투입 이력
  const [inputHistory, setInputHistory] = useState<InputHistoryItem[]>([])

  const getTitle = () => {
    switch (reportId) {
      case 'production':
        return '생산 현황 (Production Report)'
      case 'trace':
        return 'LOT 추적 (Traceability)'
      case 'input-history':
        return '투입 이력 조회 (Input History)'
      default:
        return '보고서'
    }
  }

  // 생산 현황 로드
  const loadProductionData = useCallback(async () => {
    if (!date || reportId !== 'production') return

    setIsLoading(true)
    try {
      const summary = await getDailyProductionSummary(date)
      const data: ProductionData[] = summary.map((item) => ({
        processCode: item.processCode,
        productCode: '-',
        productName: item.status,
        completedQty: item.completedQty,
        defectQty: item.defectQty,
        passRate:
          item.completedQty > 0
            ? ((item.completedQty - item.defectQty) / item.completedQty) * 100
            : 100,
      }))
      setProductionData(data)
    } catch (error) {
      console.error('Failed to load production data:', error)
      toast.error('생산 현황 조회 실패')
    } finally {
      setIsLoading(false)
    }
  }, [date, reportId])

  useEffect(() => {
    if (reportId === 'production') {
      loadProductionData()
    }
  }, [loadProductionData, reportId])

  // LOT 추적 실행
  const handleTrace = async () => {
    if (!searchQuery.trim()) {
      toast.error('LOT 번호를 입력하세요.')
      return
    }

    setIsLoading(true)
    try {
      const result =
        traceDirection === 'BACKWARD'
          ? await traceBackward(searchQuery.trim())
          : await traceForward(searchQuery.trim())

      setTraceResult(result)
      setFlatNodes(flattenTraceTree(result))

      if (result.totalNodes === 1 && result.rootNode.status === 'NOT_FOUND') {
        toast.error('LOT를 찾을 수 없습니다.')
      } else {
        toast.success(`${result.totalNodes}개 노드 추적 완료`)
      }
    } catch (error) {
      console.error('Trace error:', error)
      toast.error('LOT 추적 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 투입 이력 검색
  const handleSearchInputHistory = async () => {
    if (!searchQuery.trim()) {
      toast.error('LOT 번호를 입력하세요.')
      return
    }

    setIsLoading(true)
    try {
      // 역방향 추적으로 자재 조회
      const result = await traceBackward(searchQuery.trim())
      const nodes = flattenTraceTree(result)

      const historyItems: InputHistoryItem[] = nodes
        .filter((n) => n.type === 'MATERIAL_LOT')
        .map((n) => {
          // n.date 형식: 'YYMMDD' (예: '241220')
          const dateStr = n.date
          const year = 2000 + parseInt(dateStr.substring(0, 2), 10)
          const month = parseInt(dateStr.substring(2, 4), 10) - 1
          const day = parseInt(dateStr.substring(4, 6), 10)
          return {
            timestamp: new Date(year, month, day),
            lotNumber: result.rootNode.lotNumber,
            processCode: result.rootNode.processCode,
            materialCode: n.materialCode || '-',
            materialName: n.materialName || '-',
            materialLotNo: n.lotNumber,
            quantity: n.quantity,
          }
        })

      setInputHistory(historyItems)

      if (historyItems.length === 0) {
        toast.info('투입된 자재가 없습니다.')
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('투입 이력 조회 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 조회 버튼 클릭
  const handleSearch = () => {
    if (reportId === 'production') {
      loadProductionData()
    } else if (reportId === 'trace') {
      handleTrace()
    } else if (reportId === 'input-history') {
      handleSearchInputHistory()
    }
  }

  // 엑셀 다운로드
  const handleDownloadExcel = () => {
    const dateStr = date ? format(date, 'yyyyMMdd') : format(new Date(), 'yyyyMMdd')

    if (reportId === 'production') {
      if (productionData.length === 0) {
        toast.info('다운로드할 데이터가 없습니다.')
        return
      }
      const data = productionData.map((item) => ({
        날짜: date ? format(date, 'yyyy-MM-dd') : '-',
        공정: item.processCode,
        품번: item.productCode,
        품명: item.productName,
        생산수량: item.completedQty,
        불량수량: item.defectQty,
        '직행률(%)': `${item.passRate.toFixed(1)}%`,
      }))
      downloadExcel(data, `생산현황_${dateStr}`, '생산리포트')
      toast.success('생산 현황이 다운로드되었습니다.')
    } else if (reportId === 'input-history') {
      if (inputHistory.length === 0) {
        toast.info('다운로드할 데이터가 없습니다.')
        return
      }
      const data = inputHistory.map((item) => ({
        투입일시: format(item.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        '완제품 LOT': item.lotNumber,
        공정: item.processCode,
        '투입 자재 코드': item.materialCode,
        '투입 자재명': item.materialName,
        '자재 LOT': item.materialLotNo,
        투입수량: item.quantity,
      }))
      downloadExcel(data, `투입이력_${dateStr}`, '투입이력')
      toast.success('투입 이력이 다운로드되었습니다.')
    } else if (reportId === 'trace') {
      if (flatNodes.length === 0) {
        toast.info('다운로드할 데이터가 없습니다.')
        return
      }
      const data = flatNodes.map((node) => ({
        LOT번호: node.lotNumber,
        유형: node.type === 'PRODUCTION_LOT' ? '생산LOT' : '자재LOT',
        공정: node.processCode,
        품번: node.productCode || node.materialCode || '-',
        품명: node.productName || node.materialName || '-',
        수량: node.quantity,
        상태: node.status,
        깊이: node.depth,
      }))
      downloadExcel(data, `LOT추적_${searchQuery}_${dateStr}`, 'LOT추적')
      toast.success('LOT 추적 결과가 다운로드되었습니다.')
    }
  }

  // 생산 현황 테이블
  const renderProductionTable = () => {
    if (isLoading) {
      return (
        <div className="p-8 text-center">
          <Loader2 size={32} className="mx-auto mb-4 animate-spin text-blue-500" />
          <p className="text-slate-500">데이터 로딩 중...</p>
        </div>
      )
    }

    if (productionData.length === 0) {
      return (
        <div className="p-8 text-center text-slate-500">
          <Factory size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">해당 날짜의 생산 데이터가 없습니다.</p>
        </div>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>공정</TableHead>
            <TableHead>품번</TableHead>
            <TableHead>품명</TableHead>
            <TableHead className="text-right">생산수량</TableHead>
            <TableHead className="text-right">불량수량</TableHead>
            <TableHead className="text-right">직행률(%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productionData.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{date ? format(date, 'yyyy-MM-dd') : '-'}</TableCell>
              <TableCell>
                <Badge variant="outline">{item.processCode}</Badge>
              </TableCell>
              <TableCell className="font-mono">{item.productCode}</TableCell>
              <TableCell>{item.productName}</TableCell>
              <TableCell className="text-right font-bold">
                {item.completedQty.toLocaleString()}
              </TableCell>
              <TableCell
                className={clsx(
                  'text-right',
                  item.defectQty > 0 ? 'text-red-600 font-bold' : ''
                )}
              >
                {item.defectQty.toLocaleString()}
              </TableCell>
              <TableCell
                className={clsx(
                  'text-right font-bold',
                  item.passRate >= 99
                    ? 'text-green-600'
                    : item.passRate >= 95
                      ? 'text-yellow-600'
                      : 'text-red-600'
                )}
              >
                {item.passRate.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  // LOT 추적 렌더링
  const renderTraceResult = () => {
    if (isLoading) {
      return (
        <div className="p-8 text-center">
          <Loader2 size={32} className="mx-auto mb-4 animate-spin text-blue-500" />
          <p className="text-slate-500">추적 중...</p>
        </div>
      )
    }

    if (!traceResult) {
      return (
        <div className="p-8 text-center text-slate-500">
          <GitBranch size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">LOT 번호를 검색하면 추적 트리가 표시됩니다.</p>
        </div>
      )
    }

    if (traceResult.rootNode.status === 'NOT_FOUND') {
      return (
        <div className="p-8 text-center text-slate-500">
          <Search size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">LOT를 찾을 수 없습니다: {traceResult.rootNode.lotNumber}</p>
        </div>
      )
    }

    return (
      <div className="p-6 space-y-6">
        {/* 추적 요약 */}
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant="outline" className="text-lg px-3 py-1">
            추적 방향:{' '}
            <span className="font-bold ml-1">
              {traceResult.direction === 'BACKWARD' ? '역방향' : '정방향'}
            </span>
          </Badge>
          <Badge variant="outline" className="text-lg px-3 py-1">
            총 노드:{' '}
            <span className="font-bold text-blue-600 ml-1">{traceResult.totalNodes}</span>
          </Badge>
          <Badge variant="outline" className="text-lg px-3 py-1">
            최대 깊이:{' '}
            <span className="font-bold text-blue-600 ml-1">{traceResult.maxDepth}</span>
          </Badge>
        </div>

        {/* 트리 시각화 */}
        <div className="border rounded-lg p-4 bg-slate-50">
          <h4 className="font-semibold text-slate-700 mb-4">추적 트리</h4>
          <div className="space-y-2">{renderTraceNode(traceResult.rootNode, 0)}</div>
        </div>

        {/* 플랫 테이블 */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>깊이</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>LOT번호</TableHead>
              <TableHead>공정</TableHead>
              <TableHead>품번/자재코드</TableHead>
              <TableHead>품명/자재명</TableHead>
              <TableHead className="text-right">수량</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flatNodes.map((node, idx) => (
              <TableRow
                key={idx}
                className={node.type === 'MATERIAL_LOT' ? 'bg-amber-50' : ''}
              >
                <TableCell>
                  <Badge variant="outline">{node.depth}</Badge>
                </TableCell>
                <TableCell>
                  {node.type === 'PRODUCTION_LOT' ? (
                    <Badge className="bg-blue-100 text-blue-700">생산LOT</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700">자재LOT</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono font-bold">{node.lotNumber}</TableCell>
                <TableCell>{node.processCode}</TableCell>
                <TableCell className="font-mono">
                  {node.productCode || node.materialCode || '-'}
                </TableCell>
                <TableCell>{node.productName || node.materialName || '-'}</TableCell>
                <TableCell className="text-right">{node.quantity.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      node.status === 'COMPLETED'
                        ? 'border-green-200 text-green-700'
                        : node.status === 'IN_PROGRESS'
                          ? 'border-blue-200 text-blue-700'
                          : ''
                    }
                  >
                    {node.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  // 트리 노드 렌더링 (재귀)
  const renderTraceNode = (node: TraceNode, level: number): React.ReactNode => {
    const isProduction = node.type === 'PRODUCTION_LOT'
    const Icon = isProduction ? Factory : Package

    return (
      <div key={`${node.type}-${node.id}-${node.lotNumber}`}>
        <div
          className={clsx(
            'flex items-center gap-2 p-2 rounded-md',
            isProduction ? 'bg-blue-50' : 'bg-amber-50'
          )}
          style={{ marginLeft: level * 24 }}
        >
          {level > 0 && <ChevronRight size={16} className="text-slate-400" />}
          <Icon
            size={18}
            className={isProduction ? 'text-blue-600' : 'text-amber-600'}
          />
          <span className="font-mono font-bold">{node.lotNumber}</span>
          <Badge variant="outline" className="text-xs">
            {node.processCode}
          </Badge>
          {node.productName && (
            <span className="text-slate-500 text-sm">{node.productName}</span>
          )}
          {node.materialName && (
            <span className="text-amber-600 text-sm">{node.materialName}</span>
          )}
          <span className="text-slate-400 text-sm ml-auto">
            {node.quantity.toLocaleString()}
          </span>
        </div>
        {node.children.map((child) => renderTraceNode(child, level + 1))}
      </div>
    )
  }

  // 투입 이력 테이블
  const renderInputHistoryTable = () => {
    if (isLoading) {
      return (
        <div className="p-8 text-center">
          <Loader2 size={32} className="mx-auto mb-4 animate-spin text-blue-500" />
          <p className="text-slate-500">데이터 로딩 중...</p>
        </div>
      )
    }

    if (inputHistory.length === 0 && !searchQuery) {
      return (
        <div className="p-8 text-center text-slate-500">
          <Package size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">LOT 번호를 검색하면 투입 이력이 표시됩니다.</p>
        </div>
      )
    }

    if (inputHistory.length === 0 && searchQuery) {
      return (
        <div className="p-8 text-center text-slate-500">
          <Package size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">투입된 자재가 없습니다.</p>
        </div>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>투입일시</TableHead>
            <TableHead>완제품 LOT</TableHead>
            <TableHead>공정</TableHead>
            <TableHead>투입 자재 코드</TableHead>
            <TableHead>투입 자재명</TableHead>
            <TableHead>자재 LOT</TableHead>
            <TableHead className="text-right">투입수량</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inputHistory.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{format(item.timestamp, 'yyyy-MM-dd HH:mm:ss')}</TableCell>
              <TableCell className="font-mono font-bold">{item.lotNumber}</TableCell>
              <TableCell>
                <Badge variant="outline">{item.processCode}</Badge>
              </TableCell>
              <TableCell className="font-mono">{item.materialCode}</TableCell>
              <TableCell>{item.materialName}</TableCell>
              <TableCell className="font-mono">{item.materialLotNo}</TableCell>
              <TableCell className="text-right font-bold">
                {item.quantity.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  // 테이블 렌더링
  const renderTable = () => {
    if (reportId === 'production') {
      return renderProductionTable()
    }
    if (reportId === 'trace') {
      return renderTraceResult()
    }
    if (reportId === 'input-history') {
      return renderInputHistoryTable()
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">{getTitle()}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadExcel}>
            <Download size={16} className="mr-2" /> 엑셀 다운로드
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">검색 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            {/* 날짜 선택 (생산 현황용) */}
            {reportId === 'production' && (
              <div className="space-y-2">
                <span className="text-sm font-medium leading-none">날짜 선택</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={clsx(
                        'w-[240px] justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP', { locale: ko }) : <span>날짜 선택</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      locale={ko}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* LOT 번호 검색 (추적/투입이력용) */}
            {(reportId === 'trace' || reportId === 'input-history') && (
              <div className="space-y-2 flex-1 min-w-[200px]">
                <span className="text-sm font-medium leading-none">LOT 번호</span>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="LOT 번호 입력"
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
            )}

            {/* 추적 방향 (LOT 추적용) */}
            {reportId === 'trace' && (
              <div className="space-y-2">
                <span className="text-sm font-medium leading-none">추적 방향</span>
                <div className="flex gap-2">
                  <Button
                    variant={traceDirection === 'BACKWARD' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTraceDirection('BACKWARD')}
                  >
                    역방향 (자재 확인)
                  </Button>
                  <Button
                    variant={traceDirection === 'FORWARD' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTraceDirection('FORWARD')}
                  >
                    정방향 (사용처 확인)
                  </Button>
                </div>
              </div>
            )}

            <Button
              className="bg-slate-800 hover:bg-slate-900"
              onClick={handleSearch}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Filter className="mr-2 h-4 w-4" />
              )}
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200 min-h-[500px]">
        <CardContent className="p-0">{renderTable()}</CardContent>
      </Card>
    </div>
  )
}

export default ReportView
