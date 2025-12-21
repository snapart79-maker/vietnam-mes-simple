/**
 * Bundle Dialog
 *
 * CA 번들 생성/관리 다이얼로그
 * - 번들 생성
 * - 개별 LOT 선택/추가
 * - 묶음 바코드 미리보기
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
import { Checkbox } from '@/app/components/ui/checkbox'
import {
  Package,
  Plus,
  Trash2,
  Loader2,
  ScanBarcode,
  Check,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createBundle,
  addToBundle,
  removeFromBundle,
  completeBundle,
  getAvailableLotsForBundle,
  type BundleLotWithItems,
} from '@/services/bundleService'
import { getAllProducts } from '@/services/productService'
import { createBundleLabel, previewLabel, printLabel, downloadLabel } from '@/services/labelService'
import { format } from 'date-fns'

interface BundleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bundle?: BundleLotWithItems | null
  onComplete?: (bundle: BundleLotWithItems) => void
}

interface AvailableLot {
  id: number
  lotNumber: string
  processCode: string
  completedQty: number
  completedAt: Date | null
  selected: boolean
}

interface Product {
  id: number
  code: string
  name: string
}

export function BundleDialog({
  open,
  onOpenChange,
  bundle: initialBundle,
  onComplete,
}: BundleDialogProps) {
  const [step, setStep] = useState<'create' | 'select' | 'preview'>('create')
  const [isLoading, setIsLoading] = useState(false)

  // 번들 생성 폼
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [setQuantity, setSetQuantity] = useState(4)

  // 현재 번들
  const [currentBundle, setCurrentBundle] = useState<BundleLotWithItems | null>(null)

  // 선택 가능한 LOT 목록
  const [availableLots, setAvailableLots] = useState<AvailableLot[]>([])
  const [scanInput, setScanInput] = useState('')

  // 라벨 미리보기 URL
  const [labelPreviewUrl, setLabelPreviewUrl] = useState<string | null>(null)

  // 제품 목록 로드
  const loadProducts = useCallback(async () => {
    try {
      const data = await getAllProducts()
      setProducts(
        data
          .filter((p) => p.processCode === 'CA')
          .map((p) => ({ id: p.id, code: p.code, name: p.name }))
      )
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }, [])

  // 선택 가능한 LOT 로드
  const loadAvailableLots = useCallback(async (productId: number) => {
    try {
      const lots = await getAvailableLotsForBundle(productId)
      setAvailableLots(
        lots.map((lot) => ({
          ...lot,
          selected: false,
        }))
      )
    } catch (error) {
      console.error('Failed to load available lots:', error)
    }
  }, [])

  // 초기화
  useEffect(() => {
    if (open) {
      loadProducts()
      if (initialBundle) {
        setCurrentBundle(initialBundle)
        setStep('select')
        loadAvailableLots(initialBundle.productId)
      } else {
        setCurrentBundle(null)
        setStep('create')
        setSelectedProductId(null)
        setSetQuantity(4)
        setAvailableLots([])
        setLabelPreviewUrl(null)
      }
    }
  }, [open, initialBundle, loadProducts, loadAvailableLots])

  // 번들 생성
  const handleCreateBundle = async () => {
    if (!selectedProductId) {
      toast.error('제품을 선택하세요.')
      return
    }

    setIsLoading(true)
    try {
      const product = products.find((p) => p.id === selectedProductId)
      if (!product) throw new Error('제품 정보를 찾을 수 없습니다.')

      const bundle = await createBundle({
        processCode: 'CA',
        productId: selectedProductId,
        productCode: product.code,
        setQuantity,
      })

      setCurrentBundle(bundle)
      await loadAvailableLots(selectedProductId)
      setStep('select')
      toast.success(`번들 ${bundle.bundleNo} 생성 완료`)
    } catch (error) {
      console.error('Create bundle error:', error)
      toast.error('번들 생성 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // LOT 선택 토글
  const handleToggleLot = (lotId: number) => {
    setAvailableLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, selected: !lot.selected } : lot
      )
    )
  }

  // 선택한 LOT 추가
  const handleAddSelectedLots = async () => {
    if (!currentBundle) return

    const selectedLots = availableLots.filter((lot) => lot.selected)
    if (selectedLots.length === 0) {
      toast.error('LOT를 선택하세요.')
      return
    }

    // 번들 수량 체크
    const currentCount = currentBundle.items.length
    const remaining = currentBundle.setQuantity - currentCount

    if (selectedLots.length > remaining) {
      toast.error(`최대 ${remaining}개만 추가할 수 있습니다.`)
      return
    }

    setIsLoading(true)
    try {
      let updatedBundle = currentBundle

      for (const lot of selectedLots) {
        updatedBundle = await addToBundle({
          bundleLotId: currentBundle.id,
          productionLotId: lot.id,
          quantity: lot.completedQty,
        })
      }

      setCurrentBundle(updatedBundle)

      // 선택된 LOT 제거
      setAvailableLots((prev) =>
        prev.filter((lot) => !selectedLots.some((s) => s.id === lot.id))
      )

      toast.success(`${selectedLots.length}개 LOT 추가 완료`)
    } catch (error) {
      console.error('Add lots error:', error)
      toast.error('LOT 추가 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 스캔으로 LOT 추가
  const handleScanAdd = async () => {
    if (!currentBundle || !scanInput.trim()) return

    const lot = availableLots.find(
      (l) => l.lotNumber === scanInput.trim() || l.lotNumber.includes(scanInput.trim())
    )

    if (!lot) {
      toast.error('해당 LOT를 찾을 수 없습니다.')
      setScanInput('')
      return
    }

    // 번들 수량 체크
    if (currentBundle.items.length >= currentBundle.setQuantity) {
      toast.error('번들이 가득 찼습니다.')
      setScanInput('')
      return
    }

    setIsLoading(true)
    try {
      const updatedBundle = await addToBundle({
        bundleLotId: currentBundle.id,
        productionLotId: lot.id,
        quantity: lot.completedQty,
      })

      setCurrentBundle(updatedBundle)
      setAvailableLots((prev) => prev.filter((l) => l.id !== lot.id))
      setScanInput('')
      toast.success(`${lot.lotNumber} 추가 완료`)
    } catch (error) {
      console.error('Scan add error:', error)
      toast.error('LOT 추가 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 번들에서 LOT 제거
  const handleRemoveFromBundle = async (itemId: number) => {
    if (!currentBundle) return

    setIsLoading(true)
    try {
      const updatedBundle = await removeFromBundle(itemId)
      setCurrentBundle(updatedBundle)
      await loadAvailableLots(currentBundle.productId)
      toast.success('LOT 제거 완료')
    } catch (error) {
      console.error('Remove from bundle error:', error)
      toast.error('LOT 제거 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 라벨 미리보기 생성
  const handleGeneratePreview = async () => {
    if (!currentBundle) return

    setIsLoading(true)
    try {
      const pdf = await createBundleLabel(
        currentBundle.bundleNo,
        currentBundle.productCode,
        currentBundle.productName,
        currentBundle.setQuantity,
        currentBundle.totalQty,
        format(new Date(), 'yyyy-MM-dd')
      )

      const url = previewLabel(pdf)
      setLabelPreviewUrl(url)
      setStep('preview')
    } catch (error) {
      console.error('Generate preview error:', error)
      toast.error('라벨 미리보기 생성 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 번들 완료
  const handleCompleteBundle = async () => {
    if (!currentBundle) return

    setIsLoading(true)
    try {
      const completedBundle = await completeBundle(currentBundle.id)
      toast.success('번들 완료')
      onComplete?.(completedBundle)
      onOpenChange(false)
    } catch (error) {
      console.error('Complete bundle error:', error)
      toast.error(error instanceof Error ? error.message : '번들 완료 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 라벨 인쇄
  const handlePrintLabel = async () => {
    if (!currentBundle) return

    try {
      const pdf = await createBundleLabel(
        currentBundle.bundleNo,
        currentBundle.productCode,
        currentBundle.productName,
        currentBundle.setQuantity,
        currentBundle.totalQty,
        format(new Date(), 'yyyy-MM-dd')
      )
      printLabel(pdf)
    } catch (error) {
      console.error('Print error:', error)
      toast.error('인쇄 실패')
    }
  }

  // 라벨 다운로드
  const handleDownloadLabel = async () => {
    if (!currentBundle) return

    try {
      const pdf = await createBundleLabel(
        currentBundle.bundleNo,
        currentBundle.productCode,
        currentBundle.productName,
        currentBundle.setQuantity,
        currentBundle.totalQty,
        format(new Date(), 'yyyy-MM-dd')
      )
      downloadLabel(pdf, `bundle_${currentBundle.bundleNo}`)
      toast.success('다운로드 완료')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('다운로드 실패')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {step === 'create' && 'CA 번들 생성'}
            {step === 'select' && `번들 LOT 선택 - ${currentBundle?.bundleNo || ''}`}
            {step === 'preview' && '번들 라벨 미리보기'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: 번들 생성 */}
        {step === 'create' && (
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>제품 선택</Label>
                <Select
                  value={selectedProductId?.toString() || ''}
                  onValueChange={(v) => setSelectedProductId(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="CA 공정 제품 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.code} - {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>번들 수량 (묶음 개수)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={setQuantity}
                  onChange={(e) => setSetQuantity(parseInt(e.target.value) || 4)}
                />
                <p className="text-xs text-slate-500">
                  하나의 번들에 포함될 개별 LOT 수량
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: LOT 선택 */}
        {step === 'select' && currentBundle && (
          <div className="space-y-6">
            {/* 번들 정보 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">번들 번호</span>
                  <p className="font-mono font-bold">{currentBundle.bundleNo}</p>
                </div>
                <div>
                  <span className="text-slate-500">제품</span>
                  <p className="font-bold">{currentBundle.productCode}</p>
                </div>
                <div>
                  <span className="text-slate-500">진행</span>
                  <p className="font-bold text-blue-600">
                    {currentBundle.items.length} / {currentBundle.setQuantity}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">총 수량</span>
                  <p className="font-bold">{currentBundle.totalQty.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* 바코드 스캔 입력 */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="바코드 스캔 또는 LOT 번호 입력"
                  className="pl-10"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanAdd()}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleScanAdd} disabled={isLoading || !scanInput.trim()}>
                <Plus className="h-4 w-4 mr-1" /> 추가
              </Button>
            </div>

            {/* 현재 번들 아이템 */}
            {currentBundle.items.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">번들에 포함된 LOT</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>순번</TableHead>
                        <TableHead>LOT 번호</TableHead>
                        <TableHead>공정</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentBundle.items.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-mono font-bold">
                            {item.lotNumber}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.processCode}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFromBundle(item.id)}
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 선택 가능한 LOT 목록 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">선택 가능한 LOT</h4>
                <Button
                  size="sm"
                  onClick={handleAddSelectedLots}
                  disabled={isLoading || !availableLots.some((l) => l.selected)}
                >
                  <Plus className="h-4 w-4 mr-1" /> 선택 추가
                </Button>
              </div>
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">선택</TableHead>
                      <TableHead>LOT 번호</TableHead>
                      <TableHead>공정</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead>완료일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableLots.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                          선택 가능한 LOT가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      availableLots.map((lot) => (
                        <TableRow
                          key={lot.id}
                          className={lot.selected ? 'bg-blue-50' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={lot.selected}
                              onCheckedChange={() => handleToggleLot(lot.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono">{lot.lotNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lot.processCode}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {lot.completedQty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">
                            {lot.completedAt
                              ? format(new Date(lot.completedAt), 'MM-dd HH:mm')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 라벨 미리보기 */}
        {step === 'preview' && currentBundle && (
          <div className="space-y-6">
            <div className="flex justify-center">
              {labelPreviewUrl ? (
                <iframe
                  src={labelPreviewUrl}
                  className="w-full h-[500px] border rounded-lg"
                  title="Label Preview"
                />
              ) : (
                <div className="w-full h-[500px] border rounded-lg flex items-center justify-center text-slate-400">
                  미리보기 로딩 중...
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handlePrintLabel}>
                <Printer className="h-4 w-4 mr-2" /> 인쇄
              </Button>
              <Button variant="outline" onClick={handleDownloadLabel}>
                다운로드
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'create' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button onClick={handleCreateBundle} disabled={isLoading || !selectedProductId}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                번들 생성
              </Button>
            </>
          )}

          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
              <Button
                variant="outline"
                onClick={handleGeneratePreview}
                disabled={isLoading || !currentBundle?.items.length}
              >
                라벨 미리보기
              </Button>
              <Button
                onClick={handleCompleteBundle}
                disabled={
                  isLoading ||
                  !currentBundle ||
                  currentBundle.items.length !== currentBundle.setQuantity
                }
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                <Check className="h-4 w-4 mr-2" />
                번들 완료
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                이전
              </Button>
              <Button onClick={handleCompleteBundle} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                <Check className="h-4 w-4 mr-2" />
                번들 완료 및 인쇄
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default BundleDialog
