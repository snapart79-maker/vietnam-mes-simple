/**
 * Process View Page
 *
 * 공정 모니터링 (DB 연동)
 * - ProductionContext 연동
 * - 2단계 워크플로우: 스캔 → 임시 목록 → 선택 → 승인
 * - 전공정 바코드 투입 자재 등록
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Play,
  Square,
  RotateCcw,
  Printer,
  ScanLine,
  History,
  Factory,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  Package,
  Check,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useProduction } from '../context/ProductionContext'
import { useAuth } from '../context/AuthContext'
import { parseBarcode, getProcessName } from '@/services/barcodeService'
import { getLinesByProcess, type Line } from '@/services/mock/lineService.mock'
import { BundleDialog, LabelPreviewDialog } from '../components/dialogs'

// 스캔된 아이템 타입
interface ScannedItem {
  id: string
  barcode: string
  processCode: string
  productCode?: string
  quantity: number
  type: 'material' | 'semi_product' | 'production'
  scannedAt: Date
  isSelected: boolean
}

export const ProcessView = () => {
  const { processId } = useParams<{ processId: string }>()
  const { user } = useAuth()
  const {
    currentLot,
    todayLots,
    isLoading,
    error,
    createLot,
    startProduction,
    completeProduction,
    getLotByNumber,
    setCurrentLot,
    setCurrentProcess,
    refreshTodayLots,
    clearError,
  } = useProduction()

  const [barcode, setBarcode] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [completedQty, setCompletedQty] = useState<number>(0)
  const [defectQty, setDefectQty] = useState<number>(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showBundleDialog, setShowBundleDialog] = useState(false)
  const [showLabelDialog, setShowLabelDialog] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Phase 6: 스캔 임시 목록 상태
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [selectAll, setSelectAll] = useState(false)

  const processCode = processId?.toUpperCase() || 'CA'
  const processName = getProcessName(processCode)

  // 공정 변경 시 초기화
  useEffect(() => {
    setCurrentProcess(processCode)
    loadLines()
    refreshTodayLots()
    setCurrentLot(null)
    setCompletedQty(0)
    setDefectQty(0)
    setScannedItems([])
    setSelectAll(false)
  }, [processCode])

  // 라인 목록 로드
  const loadLines = async () => {
    try {
      const lineList = await getLinesByProcess(processCode)
      setLines(lineList)
      if (lineList.length > 0) {
        setCurrentLine(lineList[0])
      }
    } catch (err) {
      console.error('Failed to load lines:', err)
    }
  }

  // 바코드 입력 자동 포커스
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [processId])

  // 바코드 타입 추론
  const inferBarcodeType = (barcode: string, parsed: ReturnType<typeof parseBarcode>): ScannedItem['type'] => {
    if (!parsed.isValid) return 'material'

    const code = parsed.processCode.toUpperCase()

    // 검사 공정 바코드는 production
    if (code === 'CI' || code === 'VI') {
      return 'production'
    }

    // 생산 공정 바코드는 semi_product
    if (['CA', 'MC', 'MS', 'SB', 'HS', 'SP', 'PA'].includes(code)) {
      return 'semi_product'
    }

    // MO나 기타는 material
    return 'material'
  }

  // 바코드 스캔 처리 - 임시 목록에 추가
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcode.trim()) return

    const trimmedBarcode = barcode.trim()

    // 중복 체크
    if (scannedItems.some(item => item.barcode === trimmedBarcode)) {
      toast.error('이미 스캔된 바코드입니다.')
      setBarcode('')
      return
    }

    // 바코드 파싱
    const parsed = parseBarcode(trimmedBarcode)
    const itemType = inferBarcodeType(trimmedBarcode, parsed)

    // 임시 목록에 추가
    const newItem: ScannedItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      barcode: trimmedBarcode,
      processCode: parsed.isValid ? parsed.processCode : 'UNKNOWN',
      productCode: parsed.isValid ? parsed.productCode : undefined,
      quantity: parsed.isValid ? (parsed.quantity || 1) : 1,
      type: itemType,
      scannedAt: new Date(),
      isSelected: true, // 기본 선택됨
    }

    setScannedItems(prev => [...prev, newItem])
    toast.success(`스캔 완료: ${trimmedBarcode}`)
    setBarcode('')

    // 전체 선택 상태 업데이트
    setSelectAll(true)
  }

  // 개별 선택 토글
  const toggleItemSelection = (itemId: string) => {
    setScannedItems(prev => {
      const updated = prev.map(item =>
        item.id === itemId ? { ...item, isSelected: !item.isSelected } : item
      )
      // 전체 선택 상태 업데이트
      setSelectAll(updated.every(item => item.isSelected))
      return updated
    })
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    const newSelectAll = !selectAll
    setSelectAll(newSelectAll)
    setScannedItems(prev => prev.map(item => ({ ...item, isSelected: newSelectAll })))
  }

  // 개별 삭제
  const removeItem = (itemId: string) => {
    setScannedItems(prev => {
      const updated = prev.filter(item => item.id !== itemId)
      if (updated.length > 0) {
        setSelectAll(updated.every(item => item.isSelected))
      } else {
        setSelectAll(false)
      }
      return updated
    })
  }

  // 전체 삭제
  const clearAllItems = () => {
    if (scannedItems.length === 0) return

    if (window.confirm('모든 스캔 항목을 삭제하시겠습니까?')) {
      setScannedItems([])
      setSelectAll(false)
      toast.info('모든 항목이 삭제되었습니다.')
    }
  }

  // 선택된 항목 수
  const selectedCount = scannedItems.filter(item => item.isSelected).length

  // 승인 - 선택된 항목으로 LOT 생성
  const handleApprove = async () => {
    const selectedItems = scannedItems.filter(item => item.isSelected)

    if (selectedItems.length === 0) {
      toast.error('승인할 항목을 선택해주세요.')
      return
    }

    if (!currentLine) {
      toast.error('라인을 선택해주세요.')
      return
    }

    setIsProcessing(true)
    clearError()

    try {
      // 총 수량 계산
      const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0)

      // 신규 LOT 생성
      const newLot = await createLot({
        processCode,
        productId: undefined, // TODO: 품번 매핑
        plannedQty: totalQty,
        lineCode: currentLine?.code,
        workerId: user?.id,
        // 투입 자재 정보 (선택된 바코드들)
        inputBarcodes: selectedItems.map(item => item.barcode),
      })

      setCurrentLot(newLot)
      setCompletedQty(0)
      setDefectQty(0)

      // 승인된 항목 제거
      setScannedItems(prev => prev.filter(item => !item.isSelected))
      setSelectAll(false)

      toast.success(`LOT ${newLot.lotNumber} 생성 완료 (${selectedItems.length}개 항목, ${totalQty}EA)`)
      refreshTodayLots()
    } catch (err) {
      console.error('Approval error:', err)
      toast.error('LOT 생성 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // 작업 시작
  const handleStart = async () => {
    if (!currentLot || !currentLine) {
      toast.error('LOT와 라인을 선택해주세요.')
      return
    }

    setIsProcessing(true)
    try {
      const updatedLot = await startProduction(
        currentLot.id,
        currentLine.code,
        user?.id
      )
      setCurrentLot(updatedLot)
      toast.success('작업 시작')
    } catch (err) {
      toast.error('작업 시작 실패')
    } finally {
      setIsProcessing(false)
    }
  }

  // 작업 완료
  const handleComplete = async () => {
    if (!currentLot) return

    if (completedQty <= 0) {
      toast.error('완료 수량을 입력해주세요.')
      return
    }

    setIsProcessing(true)
    try {
      await completeProduction({
        lotId: currentLot.id,
        completedQty,
        defectQty,
      })

      toast.success(`LOT ${currentLot.lotNumber} 완료 (${completedQty}EA)`)
      setCurrentLot(null)
      setCompletedQty(0)
      setDefectQty(0)
      refreshTodayLots()
    } catch (err) {
      toast.error('작업 완료 처리 실패')
    } finally {
      setIsProcessing(false)
    }
  }

  // 초기화
  const handleReset = () => {
    setCurrentLot(null)
    setCompletedQty(0)
    setDefectQty(0)
    setBarcode('')
    clearError()
  }

  // 테스트 스캔 (개발용)
  const handleTestScan = async () => {
    const testBarcode = `${processCode}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
    setBarcode(testBarcode)
  }

  const isWorking = currentLot?.status === 'IN_PROGRESS'

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">
            {processCode} - {processName}
          </h2>

          {/* 라인 선택 */}
          {lines.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-blue-200 bg-blue-50 text-blue-700"
                >
                  <Factory size={16} />
                  <span className="font-semibold">
                    {currentLine
                      ? `${currentLine.name} (${currentLine.code})`
                      : '라인 선택'}
                  </span>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>작업 라인 선택</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {lines.map((line) => (
                  <DropdownMenuItem
                    key={line.id}
                    onClick={() => setCurrentLine(line)}
                    className="cursor-pointer"
                  >
                    <span className="font-medium">{line.name}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {line.code}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* CA 공정일 때만 번들 버튼 표시 */}
          {processCode === 'CA' && (
            <Button
              variant="outline"
              className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
              onClick={() => setShowBundleDialog(true)}
            >
              <Package className="mr-2 h-4 w-4" />
              번들 생성
            </Button>
          )}

          <Badge
            variant={isWorking ? 'default' : 'secondary'}
            className={isWorking ? 'bg-green-600' : 'bg-slate-500'}
          >
            {isWorking ? '작업 중 (RUNNING)' : '대기 (IDLE)'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
        {/* Left Panel: Scan & Scanned Items */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          {/* Scan Section */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-blue-600" />
                바코드 스캔
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-400 hover:text-blue-600"
                onClick={handleTestScan}
                disabled={isProcessing}
              >
                [개발용] 테스트
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScan} className="space-y-4">
                <Input
                  ref={barcodeInputRef}
                  placeholder="전공정 바코드를 스캔하세요"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="h-12 text-lg font-mono border-2 focus:border-blue-500"
                  autoComplete="off"
                  disabled={isProcessing}
                />
              </form>
            </CardContent>
          </Card>

          {/* Scanned Items List - 임시 목록 */}
          <Card className="flex-1 shadow-md border-slate-200 flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  스캔 목록 ({scannedItems.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllItems}
                    disabled={scannedItems.length === 0}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} className="mr-1" />
                    전체 삭제
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {scannedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[150px]">
                  <ScanLine size={32} className="mb-2 opacity-20" />
                  <p className="text-sm">스캔된 바코드가 없습니다.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>바코드</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannedItems.map((item) => (
                      <TableRow
                        key={item.id}
                        className={item.isSelected ? 'bg-blue-50/50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={item.isSelected}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <div>{item.barcode}</div>
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {item.type === 'material' ? '자재' :
                             item.type === 'semi_product' ? '반제품' : '생산'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(item.id)}
                          >
                            <XCircle size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>

            {/* 승인 버튼 */}
            <div className="p-4 border-t bg-slate-50">
              <Button
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                disabled={selectedCount === 0 || isProcessing}
                onClick={handleApprove}
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 animate-spin" />
                ) : (
                  <Check className="mr-2" />
                )}
                승인 ({selectedCount}개 선택)
              </Button>
            </div>
          </Card>
        </div>

        {/* Middle Panel: Current Job */}
        <div className="lg:col-span-1 flex flex-col">
          <Card className="flex-1 shadow-md border-slate-200 flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-lg">현재 작업</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pt-4 space-y-4">
              {!currentLot ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
                  <Package size={48} className="mb-4 opacity-20" />
                  <p>승인된 LOT가 없습니다.</p>
                  <p className="text-sm mt-2">바코드를 스캔하고 승인하세요.</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-slate-500">LOT 번호</Label>
                      <div className="font-mono text-sm font-bold text-slate-900 bg-slate-100 p-2 rounded">
                        {currentLot.lotNumber}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-500">지시 수량</Label>
                      <div className="font-mono text-lg font-bold text-blue-600 bg-blue-50 p-2 rounded text-right">
                        {currentLot.plannedQty} EA
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-500">품명</Label>
                    <div className="text-lg font-medium border-b border-slate-200 pb-1">
                      {currentLot.product?.name || '(품번 미지정)'}
                    </div>
                  </div>

                  {/* 수량 입력 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-slate-500">완료 수량</Label>
                      <Input
                        type="number"
                        value={completedQty}
                        onChange={(e) =>
                          setCompletedQty(parseInt(e.target.value) || 0)
                        }
                        className="text-lg font-bold"
                        min={0}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-500">불량 수량</Label>
                      <Input
                        type="number"
                        value={defectQty}
                        onChange={(e) =>
                          setDefectQty(parseInt(e.target.value) || 0)
                        }
                        className="text-lg font-bold text-red-600"
                        min={0}
                      />
                    </div>
                  </div>

                  {/* 투입 자재 */}
                  <div className="pt-2">
                    <Label className="text-slate-500 mb-2 block">
                      투입 자재 ({currentLot.lotMaterials?.length || 0})
                    </Label>
                    {currentLot.lotMaterials && currentLot.lotMaterials.length > 0 ? (
                      <ul className="space-y-1 text-sm max-h-[120px] overflow-auto">
                        {currentLot.lotMaterials.map((lm) => (
                          <li
                            key={lm.id}
                            className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100"
                          >
                            <span className="font-mono text-xs">{lm.materialLotNo}</span>
                            <Badge variant="outline" className="text-slate-500">
                              {lm.quantity}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400">투입된 자재가 없습니다.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>

            {/* Action Buttons */}
            <div className="p-4 border-t bg-slate-50 grid grid-cols-2 gap-3">
              {!isWorking ? (
                <Button
                  size="lg"
                  className="col-span-2 bg-blue-600 hover:bg-blue-700 h-12"
                  disabled={!currentLot || isProcessing}
                  onClick={handleStart}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 animate-spin" />
                  ) : (
                    <Play className="mr-2 fill-current" />
                  )}
                  작업 시작
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="destructive"
                  className="col-span-2 bg-red-600 hover:bg-red-700 h-12"
                  onClick={handleComplete}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 animate-spin" />
                  ) : (
                    <Square className="mr-2 fill-current" />
                  )}
                  작업 종료
                </Button>
              )}
              <Button
                variant="outline"
                disabled={!currentLot || isProcessing}
                onClick={() => setShowLabelDialog(true)}
              >
                <Printer className="mr-2 h-4 w-4" /> 라벨
              </Button>
              <Button
                variant="outline"
                disabled={isWorking || isProcessing}
                onClick={handleReset}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> 초기화
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Panel: History Grid */}
        <div className="lg:col-span-1 flex flex-col h-full">
          <Card className="h-full shadow-md border-slate-200 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-slate-500" />
                  금일 작업 ({todayLots.length})
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshTodayLots()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '새로고침'
                )}
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[60px]">시간</TableHead>
                    <TableHead>LOT</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-center w-[60px]">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayLots.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-10 text-slate-500"
                      >
                        작업 이력이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    todayLots.map((lot) => (
                      <TableRow
                        key={lot.id}
                        className={`cursor-pointer ${currentLot?.id === lot.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => {
                          setCurrentLot(lot)
                          setCompletedQty(lot.completedQty)
                          setDefectQty(lot.defectQty)
                        }}
                      >
                        <TableCell className="font-medium text-slate-500 text-xs">
                          {new Date(lot.startedAt).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {lot.lotNumber.length > 15
                            ? `...${lot.lotNumber.slice(-12)}`
                            : lot.lotNumber}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm">
                          {lot.completedQty}/{lot.plannedQty}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={lot.status === 'COMPLETED' ? 'default' : 'secondary'}
                            className={`text-[10px] ${lot.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'}`}
                          >
                            {lot.status === 'COMPLETED' ? '완료' : '진행'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CA 번들 다이얼로그 */}
      {processCode === 'CA' && (
        <BundleDialog
          open={showBundleDialog}
          onOpenChange={setShowBundleDialog}
          onComplete={(bundle) => {
            toast.success(`번들 ${bundle.bundleNo} 완료`)
            refreshTodayLots()
          }}
        />
      )}

      {/* 라벨 미리보기 다이얼로그 */}
      {currentLot && (
        <LabelPreviewDialog
          open={showLabelDialog}
          onOpenChange={setShowLabelDialog}
          lotData={{
            lotNumber: currentLot.lotNumber,
            processCode: currentLot.processCode,
            productCode: currentLot.product?.code,
            productName: currentLot.product?.name,
            quantity: currentLot.completedQty || currentLot.plannedQty,
            date: new Date(currentLot.startedAt).toISOString().split('T')[0],
            lineCode: currentLot.lineCode || undefined,
            workerName: currentLot.worker?.name,
          }}
          onPrint={() => {
            toast.success('라벨 인쇄 요청 완료')
          }}
        />
      )}
    </div>
  )
}

export default ProcessView
