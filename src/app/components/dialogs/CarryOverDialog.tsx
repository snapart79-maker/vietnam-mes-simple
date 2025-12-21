/**
 * Carry Over Dialog
 *
 * 이월 수량 조회/선택 다이얼로그
 * - 이월 수량 조회
 * - 품번별 이월 목록
 * - 이월 수량 선택
 */
import React, { useState, useEffect, useCallback } from 'react'
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import {
  ArrowRightLeft,
  Search,
  Loader2,
  Package,
  Calendar,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getCarryOversByProcess,
  getCarryOverSummary,
  useCarryOver,
  type CarryOverWithProduct,
} from '@/services/carryOverService'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface CarryOverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processCode?: string
  productId?: number
  targetLotNo?: string
  onSelect?: (carryOver: CarryOverWithProduct, usedQty: number) => void
}

interface CarryOverSummaryItem {
  productId: number
  productCode: string
  productName: string
  totalQuantity: number
  totalUsed: number
  totalAvailable: number
  count: number
}

export function CarryOverDialog({
  open,
  onOpenChange,
  processCode: initialProcessCode,
  productId: initialProductId,
  targetLotNo,
  onSelect,
}: CarryOverDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [processCode, setProcessCode] = useState(initialProcessCode || 'CA')
  const [searchQuery, setSearchQuery] = useState('')

  // 이월 수량 요약 (품번별)
  const [summary, setSummary] = useState<CarryOverSummaryItem[]>([])

  // 이월 수량 상세 (선택한 품번)
  const [carryOvers, setCarryOvers] = useState<CarryOverWithProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(initialProductId || null)

  // 선택한 이월 수량
  const [selectedCarryOver, setSelectedCarryOver] = useState<CarryOverWithProduct | null>(null)
  const [useQuantity, setUseQuantity] = useState(0)

  // 이월 수량 요약 로드
  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getCarryOverSummary(processCode)
      setSummary(data)
    } catch (error) {
      console.error('Failed to load carry over summary:', error)
      toast.error('이월 수량 조회 실패')
    } finally {
      setIsLoading(false)
    }
  }, [processCode])

  // 이월 수량 상세 로드
  const loadCarryOvers = useCallback(async () => {
    if (!selectedProductId && !processCode) return

    setIsLoading(true)
    try {
      const data = await getCarryOversByProcess(processCode, {
        includeUsed: false,
      })

      // 선택한 품번으로 필터링
      const filtered = selectedProductId
        ? data.filter((co) => co.productId === selectedProductId)
        : data

      setCarryOvers(filtered)
    } catch (error) {
      console.error('Failed to load carry overs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [processCode, selectedProductId])

  // 초기화
  useEffect(() => {
    if (open) {
      loadSummary()
      if (initialProductId) {
        setSelectedProductId(initialProductId)
      }
    }
  }, [open, loadSummary, initialProductId])

  // 품번 선택 시 상세 로드
  useEffect(() => {
    if (selectedProductId) {
      loadCarryOvers()
    }
  }, [selectedProductId, loadCarryOvers])

  // 공정 변경
  const handleProcessChange = (value: string) => {
    setProcessCode(value)
    setSelectedProductId(null)
    setCarryOvers([])
  }

  // 품번 선택
  const handleSelectProduct = (productId: number) => {
    setSelectedProductId(productId)
  }

  // 이월 수량 선택
  const handleSelectCarryOver = (carryOver: CarryOverWithProduct) => {
    setSelectedCarryOver(carryOver)
    setUseQuantity(carryOver.availableQty)
  }

  // 이월 수량 사용 확정
  const handleConfirmUse = async () => {
    if (!selectedCarryOver || useQuantity <= 0) {
      toast.error('사용할 수량을 입력하세요.')
      return
    }

    if (useQuantity > selectedCarryOver.availableQty) {
      toast.error('가용 수량을 초과했습니다.')
      return
    }

    if (onSelect) {
      // 콜백으로 선택 정보 전달 (외부에서 처리)
      onSelect(selectedCarryOver, useQuantity)
      onOpenChange(false)
      return
    }

    // 직접 사용 처리
    if (!targetLotNo) {
      toast.error('대상 LOT 번호가 필요합니다.')
      return
    }

    setIsLoading(true)
    try {
      await useCarryOver({
        carryOverId: selectedCarryOver.id,
        quantity: useQuantity,
        targetLotNo,
      })

      toast.success(`이월 수량 ${useQuantity}개 사용 처리 완료`)
      onOpenChange(false)
    } catch (error) {
      console.error('Use carry over error:', error)
      toast.error('이월 수량 사용 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 검색 필터링
  const filteredSummary = summary.filter(
    (item) =>
      item.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            이월 수량 조회
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 필터 영역 */}
          <div className="flex gap-4">
            <div className="w-[200px]">
              <Label className="text-xs text-slate-500">공정</Label>
              <Select value={processCode} onValueChange={handleProcessChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CA">자동절단압착 (CA)</SelectItem>
                  <SelectItem value="MC">수동압착 (MC)</SelectItem>
                  <SelectItem value="PA">제품조립 (PA)</SelectItem>
                  <SelectItem value="MS">중간스트립 (MS)</SelectItem>
                  <SelectItem value="SB">Sub (SB)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-xs text-slate-500">검색</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="품번 또는 품명으로 검색"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2 text-slate-500">로딩 중...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* 좌측: 품번별 이월 요약 */}
              <div className="border rounded-lg">
                <div className="bg-slate-50 px-4 py-2 border-b font-medium text-sm">
                  품번별 이월 현황
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {filteredSummary.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>이월 수량이 없습니다.</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible>
                      {filteredSummary.map((item) => (
                        <AccordionItem key={item.productId} value={item.productId.toString()}>
                          <AccordionTrigger
                            className="px-4 hover:bg-slate-50"
                            onClick={() => handleSelectProduct(item.productId)}
                          >
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="text-left">
                                <p className="font-mono font-bold">{item.productCode}</p>
                                <p className="text-xs text-slate-500">{item.productName}</p>
                              </div>
                              <div className="text-right">
                                <Badge
                                  variant="outline"
                                  className={
                                    item.totalAvailable > 0
                                      ? 'border-green-200 text-green-700'
                                      : 'border-slate-200 text-slate-500'
                                  }
                                >
                                  {item.totalAvailable.toLocaleString()} 가용
                                </Badge>
                                <p className="text-xs text-slate-400 mt-1">
                                  {item.count}건
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="text-sm space-y-1 bg-slate-50 p-3 rounded">
                              <div className="flex justify-between">
                                <span className="text-slate-500">총 수량</span>
                                <span>{item.totalQuantity.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">사용량</span>
                                <span className="text-red-600">
                                  -{item.totalUsed.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between font-bold border-t pt-1">
                                <span>가용량</span>
                                <span className="text-green-600">
                                  {item.totalAvailable.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              </div>

              {/* 우측: 이월 상세 목록 */}
              <div className="border rounded-lg">
                <div className="bg-slate-50 px-4 py-2 border-b font-medium text-sm">
                  이월 상세 목록
                  {selectedProductId && (
                    <span className="text-slate-400 ml-2">
                      ({carryOvers.length}건)
                    </span>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {!selectedProductId ? (
                    <div className="p-8 text-center text-slate-400">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>좌측에서 품번을 선택하세요.</p>
                    </div>
                  ) : carryOvers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>이월 수량이 없습니다.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>원 LOT</TableHead>
                          <TableHead>일자</TableHead>
                          <TableHead className="text-right">가용</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {carryOvers.map((co) => (
                          <TableRow
                            key={co.id}
                            className={
                              selectedCarryOver?.id === co.id
                                ? 'bg-blue-50'
                                : 'cursor-pointer hover:bg-slate-50'
                            }
                            onClick={() => handleSelectCarryOver(co)}
                          >
                            <TableCell>
                              <p className="font-mono text-xs">{co.sourceLotNo}</p>
                              <p className="text-xs text-slate-400">{co.lineCode}</p>
                            </TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(co.sourceDate), 'MM/dd', { locale: ko })}
                            </TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              {co.availableQty.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {selectedCarryOver?.id === co.id && (
                                <Check className="h-4 w-4 text-blue-600" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 선택된 이월 수량 사용 입력 */}
          {selectedCarryOver && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-3">이월 수량 사용</h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">원 LOT</Label>
                  <p className="font-mono font-bold">{selectedCarryOver.sourceLotNo}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">가용 수량</Label>
                  <p className="font-bold text-green-600">
                    {selectedCarryOver.availableQty.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">사용할 수량</Label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedCarryOver.availableQty}
                    value={useQuantity}
                    onChange={(e) => setUseQuantity(parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleConfirmUse}
                    disabled={isLoading || useQuantity <= 0}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    사용
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CarryOverDialog
