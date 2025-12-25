/**
 * Purchase Order Dialog
 *
 * 발주서(일일 생산계획) 생성 다이얼로그
 *
 * 플로우:
 * 1. 날짜 선택
 * 2. 완제품 선택 → 라인 선택 → 완제품 수량 입력
 * 3. 절압착 품번 자동 조회 (BOM) → 각 절압착 수량 입력
 * 4. 검토 및 생성
 *
 * 1개 발주서 = 1개 라인 + 1개 완제품 + 해당 절압착 품번들
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Badge } from '@/app/components/ui/badge'
import { Calendar } from '@/app/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table'
import {
  CalendarIcon,
  Loader2,
  FileText,
  Package,
  Search,
  Check,
  ChevronRight,
  Factory,
  Scissors,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, startOfDay, isAfter, isBefore } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/app/components/ui/utils'
import { usePurchaseOrder, type PurchaseOrder } from '@/app/context/PurchaseOrderContext'
import { useProduct } from '@/app/context/ProductContext'
import { useBOM } from '@/app/context/BOMContext'
import { generatePOBarcode } from '@/services/barcodeService'
import { getActiveLinesByProcess, type Line } from '@/services/mock/lineService.mock'

// ============================================
// Types
// ============================================

interface PurchaseOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order?: PurchaseOrder | null
  onComplete?: (order: PurchaseOrder) => void
}

// 절압착 품번별 수량
interface CrimpItem {
  crimpCode: string
  quantity: number
  barcode?: string
}

// ============================================
// Component
// ============================================

export function PurchaseOrderDialog({
  open,
  onOpenChange,
  order: initialOrder,
  onComplete,
}: PurchaseOrderDialogProps) {
  const { createPurchaseOrder, addPurchaseOrderItem } = usePurchaseOrder()
  const { products } = useProduct()
  const { bomGroups } = useBOM()

  // 단계: date → setup → review
  const [step, setStep] = useState<'date' | 'setup' | 'review'>('date')
  const [isLoading, setIsLoading] = useState(false)

  // Step 1: 날짜
  const [orderDate, setOrderDate] = useState<Date>(new Date())
  const [description, setDescription] = useState('')

  // Step 2: 완제품 + 라인 + 수량
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [selectedLineCode, setSelectedLineCode] = useState<string>('')
  const [finishedProductQty, setFinishedProductQty] = useState<number>(100)
  const [lines, setLines] = useState<Line[]>([])

  // 완제품 검색
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [productDropdownIndex, setProductDropdownIndex] = useState(-1)
  const productInputRef = useRef<HTMLInputElement>(null)

  // Step 3: 절압착 품번별 수량 (추가된 항목)
  const [crimpItems, setCrimpItems] = useState<CrimpItem[]>([])

  // 절압착 선택용 (BOM에서 로드된 전체 목록)
  const [availableCrimpCodes, setAvailableCrimpCodes] = useState<string[]>([])
  const [selectedCrimpCode, setSelectedCrimpCode] = useState<string>('')
  const [crimpQty, setCrimpQty] = useState<number>(0)

  // 날짜 범위 (오늘 ~ 7일 후)
  const today = startOfDay(new Date())
  const maxDate = addDays(today, 7)

  // 선택된 완제품
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId)
  }, [products, selectedProductId])

  // 완제품 필터링 (검색어 기반)
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products
    const query = productSearchQuery.toLowerCase()
    return products.filter(p =>
      p.code.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query)
    )
  }, [products, productSearchQuery])

  // 선택된 라인 객체
  const selectedLine = useMemo(() => {
    return lines.find(l => l.code === selectedLineCode)
  }, [lines, selectedLineCode])

  // BOM에서 절압착 품번 가져오기
  const loadCrimpCodesFromBOM = useCallback((productCode: string) => {
    const bomGroup = bomGroups.find(g => g.productCode === productCode)

    let crimpCodes: string[] = []

    if (bomGroup) {
      const lv4Group = bomGroup.levelGroups.find(lg => lg.level === 4)
      if (lv4Group?.crimpGroups) {
        crimpCodes = lv4Group.crimpGroups
          .map(cg => cg.crimpCode)
          .filter(code => code !== '(미지정)')
      }
    }

    // BOM에 없으면 기본 절압착 품번 생성 (완제품코드-001 ~ 010)
    if (crimpCodes.length === 0) {
      for (let i = 1; i <= 10; i++) {
        crimpCodes.push(`${productCode}-${String(i).padStart(3, '0')}`)
      }
    }

    // 선택 가능한 절압착 품번 목록 설정
    setAvailableCrimpCodes(crimpCodes)
    // 추가된 아이템은 초기화
    setCrimpItems([])
    setSelectedCrimpCode('')
    setCrimpQty(0)
  }, [bomGroups])

  // 완제품 선택 핸들러
  const handleSelectProduct = useCallback((product: typeof products[0]) => {
    setSelectedProductId(product.id)
    setProductSearchQuery(`${product.code} - ${product.name}`)
    setShowProductDropdown(false)
    setProductDropdownIndex(-1)

    // 절압착 품번 로드
    loadCrimpCodesFromBOM(product.code)
  }, [loadCrimpCodesFromBOM])

  // 완제품 키보드 핸들러
  const handleProductKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const maxIndex = Math.min(filteredProducts.length - 1, 19)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setProductDropdownIndex(prev => Math.min(prev + 1, maxIndex))
        setShowProductDropdown(true)
        break
      case 'ArrowUp':
        e.preventDefault()
        setProductDropdownIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (productDropdownIndex >= 0 && productDropdownIndex <= maxIndex) {
          handleSelectProduct(filteredProducts[productDropdownIndex])
        } else if (filteredProducts.length === 1) {
          handleSelectProduct(filteredProducts[0])
        }
        break
      case 'Escape':
        setShowProductDropdown(false)
        setProductDropdownIndex(-1)
        break
    }
  }, [filteredProducts, productDropdownIndex, handleSelectProduct])

  // 라인 목록 로드 (CA 공정 기준)
  useEffect(() => {
    const loadLines = async () => {
      const activeLines = await getActiveLinesByProcess('CA')
      setLines(activeLines)
      if (activeLines.length > 0) {
        setSelectedLineCode(activeLines[0].code)
      }
    }
    loadLines()
  }, [])

  // 절압착 아이템 추가
  const handleAddCrimpItem = useCallback(() => {
    if (!selectedCrimpCode) {
      toast.error('절압착 품번을 선택해주세요')
      return
    }
    if (crimpQty <= 0) {
      toast.error('수량을 입력해주세요')
      return
    }
    // 이미 추가된 품번인지 확인
    if (crimpItems.some(item => item.crimpCode === selectedCrimpCode)) {
      toast.error('이미 추가된 절압착 품번입니다')
      return
    }

    setCrimpItems(prev => [...prev, {
      crimpCode: selectedCrimpCode,
      quantity: crimpQty,
    }])

    // 입력 초기화
    setSelectedCrimpCode('')
    setCrimpQty(0)
    toast.success('절압착 품번이 추가되었습니다')
  }, [selectedCrimpCode, crimpQty, crimpItems])

  // 절압착 아이템 삭제
  const handleRemoveCrimpItem = useCallback((crimpCode: string) => {
    setCrimpItems(prev => prev.filter(item => item.crimpCode !== crimpCode))
  }, [])

  // 아직 추가되지 않은 절압착 품번 목록
  const remainingCrimpCodes = useMemo(() => {
    const addedCodes = new Set(crimpItems.map(item => item.crimpCode))
    return availableCrimpCodes.filter(code => !addedCodes.has(code))
  }, [availableCrimpCodes, crimpItems])

  // 절압착 수량 합계
  const crimpQtyTotal = useMemo(() => {
    return crimpItems.reduce((sum, item) => sum + item.quantity, 0)
  }, [crimpItems])

  // 유효한 절압착 아이템 (수량 > 0)
  const validCrimpItems = useMemo(() => {
    return crimpItems.filter(item => item.quantity > 0)
  }, [crimpItems])

  // 초기화
  useEffect(() => {
    if (open) {
      if (initialOrder) {
        // 편집 모드 (현재는 미지원)
        setOrderDate(new Date(initialOrder.orderDate))
        setDescription(initialOrder.description || '')
        setStep('setup')
      } else {
        // 생성 모드
        setOrderDate(new Date())
        setDescription('')
        setStep('date')
      }
      setSelectedProductId(null)
      setSelectedLineCode(lines[0]?.code || '')
      setFinishedProductQty(100)
      setProductSearchQuery('')
      setShowProductDropdown(false)
      setProductDropdownIndex(-1)
      setCrimpItems([])
    }
  }, [open, initialOrder, lines])

  // 날짜 유효성 검사
  const isDateValid = useCallback((date: Date) => {
    const d = startOfDay(date)
    return !isBefore(d, today) && !isAfter(d, maxDate)
  }, [today, maxDate])

  // 다음 단계로
  const handleNextStep = () => {
    if (step === 'date') {
      if (!isDateValid(orderDate)) {
        toast.error('생산 예정일은 오늘부터 7일 이내여야 합니다')
        return
      }
      setStep('setup')
    } else if (step === 'setup') {
      if (!selectedProduct) {
        toast.error('완제품을 선택해주세요')
        return
      }
      if (!selectedLineCode) {
        toast.error('라인을 선택해주세요')
        return
      }
      if (finishedProductQty <= 0) {
        toast.error('완제품 수량을 입력해주세요')
        return
      }
      if (validCrimpItems.length === 0) {
        toast.error('최소 1개 이상의 절압착 수량을 입력해주세요')
        return
      }
      // 절압착 수량이 완제품 수량보다 적으면 경고
      if (crimpQtyTotal < finishedProductQty) {
        toast.warning('절압착 총 수량이 완제품 수량보다 적습니다. 계속하시겠습니까?')
      }
      setStep('review')
    }
  }

  // 이전 단계로
  const handlePrevStep = () => {
    if (step === 'setup') {
      setStep('date')
    } else if (step === 'review') {
      setStep('setup')
    }
  }

  // 발주서 생성
  const handleCreateOrder = async () => {
    if (!selectedProduct || !selectedLineCode) return

    setIsLoading(true)
    try {
      // 1. 발주서 생성
      const order = await createPurchaseOrder({
        orderDate,
        description: description || undefined,
        finishedProductQty: { [selectedProduct.code]: finishedProductQty },
      })

      // 2. 완제품 아이템 추가 (PA 공정)
      // 바코드는 Mock 서비스에서 자동 생성됨
      await addPurchaseOrderItem({
        purchaseOrderId: order.id,
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        productName: selectedProduct.name,
        processCode: 'PA', // 제품조립 공정
        plannedQty: finishedProductQty,
        lineCode: selectedLineCode,
        lineName: selectedLine?.name,
      })

      // 3. 절압착 아이템들 추가 (CA 공정)
      for (let i = 0; i < validCrimpItems.length; i++) {
        const crimp = validCrimpItems[i]
        // 바코드는 Mock 서비스에서 자동 생성됨
        await addPurchaseOrderItem({
          purchaseOrderId: order.id,
          productId: selectedProduct.id,
          productCode: selectedProduct.code,
          productName: selectedProduct.name,
          processCode: 'CA',
          plannedQty: crimp.quantity,
          crimpCode: crimp.crimpCode,
          lineCode: selectedLineCode,
          lineName: selectedLine?.name,
        })
      }

      toast.success(`발주서 ${order.orderNo}가 생성되었습니다`)
      onComplete?.(order)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '발주서 생성 실패'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            새 발주서 등록
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          <Badge variant={step === 'date' ? 'default' : 'outline'}>
            1. 날짜
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === 'setup' ? 'default' : 'outline'}>
            2. 품목/수량
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === 'review' ? 'default' : 'outline'}>
            3. 확인
          </Badge>
        </div>

        {/* Step 1: 날짜 선택 */}
        {step === 'date' && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <Label className="text-lg font-medium">생산 예정일</Label>
              <p className="text-sm text-muted-foreground">
                오늘부터 7일 이내의 날짜만 선택 가능합니다
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-[280px] justify-start text-left font-normal',
                      !orderDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {orderDate ? format(orderDate, 'PPP', { locale: ko }) : '날짜 선택'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={orderDate}
                    onSelect={(date) => date && setOrderDate(date)}
                    disabled={(date) => !isDateValid(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="발주서 메모를 입력하세요"
              />
            </div>
          </div>
        )}

        {/* Step 2: 품목 설정 */}
        {step === 'setup' && (
          <div className="space-y-6 py-4">
            <div className="text-sm text-muted-foreground text-center">
              생산 예정일: <strong>{format(orderDate, 'yyyy-MM-dd (EEEE)', { locale: ko })}</strong>
            </div>

            {/* 완제품 선택 */}
            <div className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <Label className="font-medium">완제품 선택</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 완제품 검색 */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">완제품</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={productInputRef}
                      placeholder="품번 또는 품명 입력..."
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value)
                        setShowProductDropdown(true)
                        setProductDropdownIndex(0)
                        if (selectedProductId && e.target.value !== `${selectedProduct?.code} - ${selectedProduct?.name}`) {
                          setSelectedProductId(null)
                          setCrimpItems([])
                        }
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                      onKeyDown={handleProductKeyDown}
                      className="pl-9"
                    />
                    {/* 드롭다운 */}
                    {showProductDropdown && filteredProducts.length > 0 && (
                      <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                        {filteredProducts.slice(0, 20).map((product, index) => (
                          <button
                            key={product.id}
                            type="button"
                            className={cn(
                              'w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between items-center',
                              selectedProductId === product.id && 'bg-blue-100',
                              index === productDropdownIndex && 'bg-blue-100 ring-1 ring-inset ring-blue-400'
                            )}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleSelectProduct(product)
                            }}
                          >
                            <span className="font-mono text-blue-600">{product.code}</span>
                            <span className="text-slate-500 truncate ml-2">{product.name}</span>
                            {selectedProductId === product.id && (
                              <Check className="h-4 w-4 text-blue-600 ml-2 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 라인 선택 */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">라인</Label>
                  <Select
                    value={selectedLineCode}
                    onValueChange={setSelectedLineCode}
                    disabled={lines.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={lines.length === 0 ? '라인 없음' : '라인 선택'} />
                    </SelectTrigger>
                    <SelectContent>
                      {lines.map((line) => (
                        <SelectItem key={line.code} value={line.code}>
                          {line.code} - {line.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 완제품 수량 */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm text-muted-foreground">완제품 생산 수량</Label>
                  <Input
                    type="number"
                    value={finishedProductQty}
                    onChange={(e) => setFinishedProductQty(Number(e.target.value))}
                    min={1}
                    className="max-w-[200px]"
                  />
                </div>
              </div>
            </div>

            {/* 절압착 품번 선택 및 수량 입력 */}
            {selectedProduct && (
              <div className="p-4 border rounded-lg bg-amber-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-amber-600" />
                    <Label className="font-medium">절압착 품번 선택</Label>
                  </div>
                  {crimpItems.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">합계: </span>
                      <span className={cn(
                        "font-medium",
                        crimpQtyTotal >= finishedProductQty ? "text-green-600" : "text-amber-600"
                      )}>
                        {crimpQtyTotal.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground"> / 완제품 {finishedProductQty.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  * 절압착 품번을 선택하고 수량을 입력한 후 추가 버튼을 눌러주세요
                </p>

                {/* 절압착 품번 선택 + 수량 입력 + 추가 버튼 */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">절압착 품번</Label>
                    <Select
                      value={selectedCrimpCode}
                      onValueChange={setSelectedCrimpCode}
                      disabled={remainingCrimpCodes.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          remainingCrimpCodes.length === 0
                            ? (availableCrimpCodes.length === 0 ? '품번 없음' : '모두 추가됨')
                            : '품번 선택'
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {remainingCrimpCodes.map((code) => (
                          <SelectItem key={code} value={code}>
                            <code className="text-blue-600">{code}</code>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[120px] space-y-1">
                    <Label className="text-xs text-muted-foreground">수량</Label>
                    <Input
                      type="number"
                      value={crimpQty || ''}
                      onChange={(e) => setCrimpQty(Number(e.target.value))}
                      min={1}
                      placeholder="수량"
                      disabled={!selectedCrimpCode}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddCrimpItem}
                    disabled={!selectedCrimpCode || crimpQty <= 0}
                    className="h-10"
                  >
                    추가
                  </Button>
                </div>

                {/* 추가된 절압착 품번 목록 */}
                {crimpItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="bg-slate-100 px-3 py-2 text-sm font-medium border-b">
                      추가된 절압착 품번 ({crimpItems.length}개)
                    </div>
                    <div className="divide-y">
                      {crimpItems.map((item, index) => (
                        <div
                          key={item.crimpCode}
                          className="flex items-center justify-between px-3 py-2 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                            <code className="text-sm text-blue-600 font-medium">{item.crimpCode}</code>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{item.quantity.toLocaleString()}개</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveCrimpItem(item.crimpCode)}
                              className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              삭제
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 빈 상태 메시지 */}
                {crimpItems.length === 0 && availableCrimpCodes.length > 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg bg-white">
                    절압착 품번을 선택하여 추가해주세요
                  </div>
                )}

                {availableCrimpCodes.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg bg-white">
                    BOM에서 절압착 품번을 찾을 수 없습니다
                  </div>
                )}
              </div>
            )}

            {!selectedProduct && (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>완제품을 선택하면 절압착 품번을 선택할 수 있습니다</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: 검토 */}
        {step === 'review' && selectedProduct && (
          <div className="space-y-4 py-4">
            {/* 요약 정보 */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">생산 예정일</span>
                <span className="font-medium">
                  {format(orderDate, 'yyyy-MM-dd (EEEE)', { locale: ko })}
                </span>
              </div>
              {description && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">메모</span>
                  <span>{description}</span>
                </div>
              )}
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">완제품</span>
                <div className="text-right">
                  <div className="font-mono text-blue-600">{selectedProduct.code}</div>
                  <div className="text-xs text-muted-foreground">{selectedProduct.name}</div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">라인</span>
                <span className="font-medium">{selectedLine?.name || selectedLineCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">완제품 수량</span>
                <span className="font-medium text-lg">{finishedProductQty.toLocaleString()}개</span>
              </div>
            </div>

            {/* 절압착 품목 목록 */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-amber-50 px-4 py-2 border-b flex items-center justify-between">
                <span className="font-medium text-amber-900">절압착 품목</span>
                <Badge variant="outline" className="text-amber-700">
                  {validCrimpItems.length}개
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>절압착 품번</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead>바코드 (미리보기)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validCrimpItems.map((item, index) => {
                    const barcode = generatePOBarcode(
                      item.crimpCode,
                      item.quantity,
                      orderDate,
                      index + 2
                    )
                    return (
                      <TableRow key={item.crimpCode}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <code className="text-blue-600">{item.crimpCode}</code>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {barcode}
                          </code>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="bg-slate-50 px-4 py-2 border-t flex justify-between">
                <span className="text-muted-foreground">절압착 총 수량</span>
                <span className="font-medium">{crimpQtyTotal.toLocaleString()}개</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step !== 'date' && (
              <Button variant="outline" onClick={handlePrevStep}>
                이전
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            {step === 'review' ? (
              <Button onClick={handleCreateOrder} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  '발주서 생성'
                )}
              </Button>
            ) : (
              <Button onClick={handleNextStep}>
                다음
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PurchaseOrderDialog
