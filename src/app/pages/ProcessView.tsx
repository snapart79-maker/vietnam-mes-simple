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
import { useProduct } from '../context/ProductContext'
import { useBOM } from '../context/BOMContext'
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
  const { products } = useProduct()
  const { bomGroups, getBOMByProduct } = useBOM()
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

  // 작업 선택 상태: 완제품 + 절압착 품번
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [selectedCrimpCode, setSelectedCrimpCode] = useState('')
  const [showCrimpDropdown, setShowCrimpDropdown] = useState(false)
  const productInputRef = useRef<HTMLInputElement>(null)

  const processCode = processId?.toUpperCase() || 'CA'
  const processName = getProcessName(processCode)

  // 선택한 완제품 정보
  const selectedProduct = products.find(p => p.code === selectedProductCode)

  // 완제품 필터링 (검색어 기반)
  const filteredProducts = productSearchQuery.trim()
    ? products.filter(p =>
        p.code.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
      )
    : products

  // 선택한 완제품의 절압착 품번 목록 (BOM LV4 CA)
  const crimpCodes = React.useMemo(() => {
    if (!selectedProductCode) return []

    const bomGroup = bomGroups.find(g => g.productCode === selectedProductCode)
    if (!bomGroup) return []

    // LV4 (CA) 그룹에서 crimpCode 목록 추출
    const lv4Group = bomGroup.levelGroups.find(lg => lg.level === 4)
    if (!lv4Group?.crimpGroups) return []

    return lv4Group.crimpGroups.map(cg => cg.crimpCode).filter(code => code !== '(미지정)')
  }, [selectedProductCode, bomGroups])

  // 완제품 선택 핸들러
  const handleSelectProduct = (code: string) => {
    setSelectedProductCode(code)
    const product = products.find(p => p.code === code)
    setProductSearchQuery(product ? `${code} - ${product.name}` : code)
    setShowProductDropdown(false)
    // 완제품 변경 시 절압착 품번 초기화
    setSelectedCrimpCode('')
  }

  // 절압착 품번 선택 핸들러
  const handleSelectCrimpCode = (code: string) => {
    setSelectedCrimpCode(code)
    setShowCrimpDropdown(false)
  }

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
    // 작업 선택 초기화
    setSelectedProductCode('')
    setProductSearchQuery('')
    setSelectedCrimpCode('')
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

  // 선택 삭제
  const deleteSelectedItems = () => {
    const selectedItems = scannedItems.filter(item => item.isSelected)
    if (selectedItems.length === 0) {
      toast.error('삭제할 항목을 선택해주세요.')
      return
    }

    setScannedItems(prev => {
      const updated = prev.filter(item => !item.isSelected)
      if (updated.length > 0) {
        setSelectAll(updated.every(item => item.isSelected))
      } else {
        setSelectAll(false)
      }
      return updated
    })
    toast.success(`${selectedItems.length}개 항목이 삭제되었습니다.`)
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

    // 완제품 선택 검증
    if (!selectedProductCode) {
      toast.error('완제품을 선택해주세요.')
      productInputRef.current?.focus()
      return
    }

    // CA 공정일 때 절압착 품번 선택 검증
    if (processCode === 'CA' && crimpCodes.length > 0 && !selectedCrimpCode) {
      toast.error('절압착 품번을 선택해주세요.')
      return
    }

    setIsProcessing(true)
    clearError()

    try {
      // 총 수량 계산
      const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0)

      // 선택한 완제품의 ID 찾기
      const productId = selectedProduct?.id

      // 신규 LOT 생성
      const newLot = await createLot({
        processCode,
        productId,
        plannedQty: totalQty,
        lineCode: currentLine?.code,
        workerId: user?.id,
        // 투입 자재 정보 (선택된 바코드들)
        inputBarcodes: selectedItems.map(item => item.barcode),
        // CA 공정일 때 절압착 품번 추가
        ...(processCode === 'CA' && selectedCrimpCode && { crimpCode: selectedCrimpCode }),
      })

      setCurrentLot(newLot)
      setCompletedQty(0)
      setDefectQty(0)

      // 승인된 항목 제거
      setScannedItems(prev => prev.filter(item => !item.isSelected))
      setSelectAll(false)

      const crimpInfo = processCode === 'CA' && selectedCrimpCode ? ` [${selectedCrimpCode}]` : ''
      toast.success(`LOT ${newLot.lotNumber} 생성 완료${crimpInfo} (${selectedItems.length}개 항목, ${totalQty}EA)`)
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
          {/* 작업 선택 섹션: 완제품 + 절압착 품번 */}
          <Card className="shadow-md border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                작업 선택
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 완제품 선택 */}
              <div className="space-y-1.5 relative">
                <Label className="text-xs text-slate-600">완제품 품번</Label>
                <Input
                  ref={productInputRef}
                  placeholder="품번 또는 품명 입력..."
                  value={productSearchQuery}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value)
                    setShowProductDropdown(true)
                    // 입력이 변경되면 선택 해제
                    if (selectedProductCode && e.target.value !== `${selectedProductCode} - ${selectedProduct?.name}`) {
                      setSelectedProductCode('')
                      setSelectedCrimpCode('')
                    }
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  className="h-9 font-mono text-sm"
                />
                {/* 완제품 드롭다운 */}
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredProducts.slice(0, 20).map(product => (
                      <button
                        key={product.id}
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between items-center ${
                          selectedProductCode === product.code ? 'bg-blue-100' : ''
                        }`}
                        onMouseDown={() => handleSelectProduct(product.code)}
                      >
                        <span className="font-mono text-blue-600">{product.code}</span>
                        <span className="text-slate-500 truncate ml-2">{product.name}</span>
                      </button>
                    ))}
                    {filteredProducts.length > 20 && (
                      <div className="px-3 py-2 text-xs text-slate-400 text-center border-t">
                        외 {filteredProducts.length - 20}개 더...
                      </div>
                    )}
                  </div>
                )}
                {products.length === 0 && (
                  <p className="text-xs text-amber-600">⚠️ 완제품이 등록되지 않았습니다.</p>
                )}
              </div>

              {/* CA 공정일 때만 절압착 품번 선택 표시 */}
              {processCode === 'CA' && selectedProductCode && (
                <div className="space-y-1.5 relative">
                  <Label className="text-xs text-slate-600">절압착 품번</Label>
                  {crimpCodes.length > 0 ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-9 justify-between font-mono text-sm"
                        onClick={() => setShowCrimpDropdown(!showCrimpDropdown)}
                      >
                        <span className={selectedCrimpCode ? 'text-purple-600' : 'text-slate-400'}>
                          {selectedCrimpCode || '절압착 품번 선택...'}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      {showCrimpDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                          {crimpCodes.map(code => (
                            <button
                              key={code}
                              type="button"
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-purple-50 font-mono ${
                                selectedCrimpCode === code ? 'bg-purple-100 text-purple-700' : ''
                              }`}
                              onClick={() => handleSelectCrimpCode(code)}
                            >
                              {code}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-amber-600">⚠️ BOM에 절압착 품번이 없습니다.</p>
                  )}
                </div>
              )}

              {/* 선택 상태 표시 */}
              {selectedProductCode && (
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                    {selectedProductCode}
                  </Badge>
                  {processCode === 'CA' && selectedCrimpCode && (
                    <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
                      {selectedCrimpCode}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deleteSelectedItems}
                    disabled={selectedCount === 0}
                    className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 text-xs px-2"
                  >
                    <Trash2 size={12} className="mr-1" />
                    선택 삭제
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllItems}
                    disabled={scannedItems.length === 0}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs px-2"
                  >
                    <Trash2 size={12} className="mr-1" />
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
