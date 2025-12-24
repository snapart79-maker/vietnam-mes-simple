/**
 * Bundle Dialog
 *
 * CA 번들 생성/관리 다이얼로그 (Barcord 프로젝트 스타일)
 * - 절압착품번 선택
 * - CA 바코드 선택 (체크박스)
 * - 검색/필터, 전체 선택
 * - 선택 정보 표시
 * - 묶음 바코드 미리보기
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { hasBusinessAPI, getAPI } from '@/lib/electronBridge'
import { createBundleLabel, previewLabel, printLabel, downloadLabel } from '@/services/labelService'
import { format } from 'date-fns'

// ============================================
// Types (bundleService에서 가져온 타입 정의)
// ============================================
interface BundleItemInfo {
  id: number
  productionLotId: number
  lotNumber: string
  quantity: number
  processCode: string
  createdAt: Date
}

interface BundleLotWithItems {
  id: number
  bundleNo: string
  productId: number
  productCode: string
  productName: string
  bundleType: 'SAME_PRODUCT' | 'MULTI_PRODUCT'
  setQuantity: number
  totalQty: number
  status: 'CREATED' | 'SHIPPED' | 'UNBUNDLED'
  items: BundleItemInfo[]
  createdAt: Date
}

interface BundleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bundle?: BundleLotWithItems | null
  onComplete?: (bundle: BundleLotWithItems) => void
  /** 절압착품번 목록 (외부에서 전달) */
  crimpProducts?: CrimpProduct[]
}

interface AvailableLot {
  id: number
  lotNumber: string
  processCode: string
  completedQty: number
  completedAt: Date | null
  selected: boolean
  crimpProductCode?: string
}

interface Product {
  id: number
  code: string
  name: string
  parentProductCode?: string
  parentProductName?: string
}

/** 절압착품번 (반제품) */
export interface CrimpProduct {
  code: string
  name?: string
  parentProductCode?: string
  parentProductName?: string
}

export function BundleDialog({
  open,
  onOpenChange,
  bundle: initialBundle,
  onComplete,
  crimpProducts: externalCrimpProducts,
}: BundleDialogProps) {
  const [step, setStep] = useState<'create' | 'select' | 'preview'>('create')
  const [isLoading, setIsLoading] = useState(false)

  // 절압착품번 선택 (Barcord 스타일)
  const [crimpProducts, setCrimpProducts] = useState<CrimpProduct[]>([])
  const [selectedCrimpCode, setSelectedCrimpCode] = useState<string>('')
  const [parentProduct, setParentProduct] = useState<{ code: string; name: string } | null>(null)

  // 기존 호환용
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [setQuantity, setSetQuantity] = useState(4)

  // 현재 번들
  const [currentBundle, setCurrentBundle] = useState<BundleLotWithItems | null>(null)

  // 선택 가능한 LOT 목록
  const [availableLots, setAvailableLots] = useState<AvailableLot[]>([])
  const [scanInput, setScanInput] = useState('')

  // 검색/필터 (Barcord 스타일)
  const [searchText, setSearchText] = useState('')
  const [selectAll, setSelectAll] = useState(false)

  // 라벨 미리보기 URL
  const [labelPreviewUrl, setLabelPreviewUrl] = useState<string | null>(null)

  // 선택 정보 계산 (Barcord 스타일)
  const selectionInfo = useMemo(() => {
    const selectedLots = availableLots.filter((lot) => lot.selected)
    return {
      count: selectedLots.length,
      totalQty: selectedLots.reduce((sum, lot) => sum + lot.completedQty, 0),
    }
  }, [availableLots])

  // 검색 필터링된 LOT 목록
  const filteredLots = useMemo(() => {
    if (!searchText.trim()) return availableLots
    const search = searchText.toLowerCase()
    return availableLots.filter(
      (lot) =>
        lot.lotNumber.toLowerCase().includes(search) ||
        (lot.crimpProductCode && lot.crimpProductCode.toLowerCase().includes(search))
    )
  }, [availableLots, searchText])

  // 제품 목록 로드 및 절압착품번 추출
  const loadProducts = useCallback(async () => {
    try {
      if (!hasBusinessAPI()) {
        console.warn('[BundleDialog] electronAPI not available')
        return
      }
      const api = getAPI()
      const result = await api!.product.getAll()
      if (!result.success || !result.data) {
        console.error('Failed to load products:', result.error)
        return
      }
      const data = result.data as Array<{ id: number; code: string; name: string; processCode?: string }>
      const caProducts = data.filter((p) => p.processCode === 'CA')

      setProducts(
        caProducts.map((p) => ({ id: p.id, code: p.code, name: p.name }))
      )

      // 외부에서 전달된 절압착품번이 있으면 사용
      if (externalCrimpProducts && externalCrimpProducts.length > 0) {
        setCrimpProducts(externalCrimpProducts)
      } else {
        // 절압착품번 목록 추출 (반제품 품번)
        // - 형식: 완제품번호-회로번호 (예: 00315452-001)
        // - 또는 공정별 반제품 (예: CA00315452)
        const crimpSet = new Map<string, CrimpProduct>()
        caProducts.forEach((p) => {
          // 완제품-회로 패턴 (예: 00315452-001)
          const crimpMatch = p.code.match(/^(\d+)-(\d+)$/)
          if (crimpMatch) {
            const parentCode = crimpMatch[1]
            const parent = data.find((pr) => pr.code === parentCode)
            crimpSet.set(p.code, {
              code: p.code,
              name: p.name,
              parentProductCode: parent?.code,
              parentProductName: parent?.name,
            })
          } else if (p.code.startsWith('CA')) {
            // CA 접두어 패턴
            crimpSet.set(p.code, {
              code: p.code,
              name: p.name,
            })
          } else {
            // 그 외는 모두 절압착품번으로
            crimpSet.set(p.code, {
              code: p.code,
              name: p.name,
            })
          }
        })
        setCrimpProducts(Array.from(crimpSet.values()))
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }, [externalCrimpProducts])

  // 절압착품번 선택 시 완제품 표시
  const handleCrimpSelect = useCallback((crimpCode: string) => {
    setSelectedCrimpCode(crimpCode)
    const crimp = crimpProducts.find((c) => c.code === crimpCode)
    if (crimp?.parentProductCode) {
      setParentProduct({
        code: crimp.parentProductCode,
        name: crimp.parentProductName || '',
      })
    } else {
      setParentProduct(null)
    }
    // 기존 호환: productId 설정
    const product = products.find((p) => p.code === crimpCode)
    setSelectedProductId(product?.id || null)
  }, [crimpProducts, products])

  // 전체 선택/해제 핸들러
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked)
    setAvailableLots((prev) =>
      prev.map((lot) => ({
        ...lot,
        selected: filteredLots.some((f) => f.id === lot.id) ? checked : lot.selected,
      }))
    )
  }, [filteredLots])

  // 선택 가능한 LOT 로드
  const loadAvailableLots = useCallback(async (productId: number) => {
    try {
      if (!hasBusinessAPI()) {
        console.warn('[BundleDialog] electronAPI not available')
        return
      }
      const api = getAPI()
      const result = await api!.bundle.getAvailableLots(productId)
      if (!result.success || !result.data) {
        console.error('Failed to load available lots:', result.error)
        return
      }
      const lots = result.data as Array<{
        id: number
        lotNumber: string
        processCode: string
        completedQty: number
        completedAt: Date | null
      }>
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

  // 새로고침 버튼
  const handleRefresh = useCallback(async () => {
    if (selectedProductId) {
      setIsLoading(true)
      try {
        await loadAvailableLots(selectedProductId)
        setSelectAll(false)
        toast.success('목록을 새로고침했습니다.')
      } finally {
        setIsLoading(false)
      }
    }
  }, [selectedProductId, loadAvailableLots])

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
        setSelectedCrimpCode('')
        setParentProduct(null)
        setSetQuantity(4)
        setAvailableLots([])
        setLabelPreviewUrl(null)
        setSearchText('')
        setSelectAll(false)
      }
    }
  }, [open, initialBundle, loadProducts, loadAvailableLots])

  // 번들 생성
  const handleCreateBundle = async () => {
    if (!selectedCrimpCode) {
      toast.error('절압착품번을 선택하세요.')
      return
    }

    if (!hasBusinessAPI()) {
      console.warn('[BundleDialog] 브라우저 모드: 번들 생성 기능 제한')
      toast.info('이 기능은 데스크톱 앱에서 사용 가능합니다.')
      return
    }

    setIsLoading(true)
    try {
      // 선택된 절압착품번으로 제품 찾기
      const product = products.find((p) => p.code === selectedCrimpCode)
      if (!product) throw new Error('절압착품번 정보를 찾을 수 없습니다.')

      const api = getAPI()
      const result = await api!.bundle.create({
        processCode: 'CA',
        productId: product.id,
        productCode: selectedCrimpCode,
        setQuantity,
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || '번들 생성 실패')
      }

      const bundle = result.data as BundleLotWithItems
      setCurrentBundle(bundle)
      await loadAvailableLots(product.id)
      setStep('select')
      setSearchText('')
      setSelectAll(false)
      toast.success(`묶음 ${bundle.bundleNo} 생성 완료`)
    } catch (error) {
      console.error('Create bundle error:', error)
      toast.error('묶음 바코드 생성 실패')
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

  // 선택한 CA 바코드 추가
  const handleAddSelectedLots = async () => {
    if (!currentBundle) return

    const selectedLots = availableLots.filter((lot) => lot.selected)
    if (selectedLots.length === 0) {
      toast.error('CA 바코드를 선택하세요.')
      return
    }

    // 번들 수량 체크
    const currentCount = currentBundle.items.length
    const remaining = currentBundle.setQuantity - currentCount

    if (selectedLots.length > remaining) {
      toast.error(`최대 ${remaining}개만 추가할 수 있습니다.`)
      return
    }

    if (!hasBusinessAPI()) {
      console.warn('[BundleDialog] 브라우저 모드: LOT 추가 기능 제한')
      toast.info('이 기능은 데스크톱 앱에서 사용 가능합니다.')
      return
    }

    setIsLoading(true)
    try {
      const api = getAPI()
      let updatedBundle = currentBundle

      for (const lot of selectedLots) {
        const result = await api!.bundle.addToBundle({
          bundleLotId: currentBundle.id,
          productionLotId: lot.id,
          quantity: lot.completedQty,
        })
        if (result.success && result.data) {
          updatedBundle = result.data as BundleLotWithItems
        }
      }

      setCurrentBundle(updatedBundle)

      // 선택된 LOT 제거
      setAvailableLots((prev) =>
        prev.filter((lot) => !selectedLots.some((s) => s.id === lot.id))
      )

      // 선택 상태 초기화
      setSelectAll(false)

      toast.success(`${selectedLots.length}개 CA 바코드 추가 완료`)
    } catch (error) {
      console.error('Add lots error:', error)
      toast.error('CA 바코드 추가 실패')
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

    if (!hasBusinessAPI()) {
      console.warn('[BundleDialog] 브라우저 모드: 스캔 추가 기능 제한')
      toast.info('이 기능은 데스크톱 앱에서 사용 가능합니다.')
      return
    }

    setIsLoading(true)
    try {
      const api = getAPI()
      const result = await api!.bundle.addToBundle({
        bundleLotId: currentBundle.id,
        productionLotId: lot.id,
        quantity: lot.completedQty,
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || 'LOT 추가 실패')
      }

      const updatedBundle = result.data as BundleLotWithItems
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

    if (!hasBusinessAPI()) {
      console.warn('[BundleDialog] 브라우저 모드: LOT 제거 기능 제한')
      toast.info('이 기능은 데스크톱 앱에서 사용 가능합니다.')
      return
    }

    setIsLoading(true)
    try {
      const api = getAPI()
      const result = await api!.bundle.removeFromBundle(itemId)

      if (!result.success || !result.data) {
        throw new Error(result.error || 'LOT 제거 실패')
      }

      const updatedBundle = result.data as BundleLotWithItems
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

    if (!hasBusinessAPI()) {
      console.warn('[BundleDialog] 브라우저 모드: 번들 완료 기능 제한')
      toast.info('이 기능은 데스크톱 앱에서 사용 가능합니다.')
      return
    }

    setIsLoading(true)
    try {
      const api = getAPI()
      const result = await api!.bundle.complete(currentBundle.id)

      if (!result.success || !result.data) {
        throw new Error(result.error || '번들 완료 실패')
      }

      const completedBundle = result.data as BundleLotWithItems
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

        {/* Step 1: 번들 생성 (Barcord 스타일) */}
        {step === 'create' && (
          <div className="space-y-6">
            {/* 1. 절압착품번 선택 */}
            <div className="border rounded-lg p-4 bg-slate-50">
              <h4 className="font-medium mb-3 text-slate-700">1. 절압착품번 선택</h4>
              <div className="grid gap-4">
                <div className="flex items-center gap-4">
                  <Label className="w-24 text-sm">절압착품번:</Label>
                  <Select
                    value={selectedCrimpCode}
                    onValueChange={handleCrimpSelect}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="-- 선택 --" />
                    </SelectTrigger>
                    <SelectContent>
                      {crimpProducts.map((crimp) => (
                        <SelectItem key={crimp.code} value={crimp.code}>
                          {crimp.code}{crimp.name ? ` - ${crimp.name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <Label className="w-24 text-sm">완제품:</Label>
                  <span className="font-bold text-blue-600">
                    {parentProduct
                      ? `${parentProduct.code} - ${parentProduct.name}`
                      : selectedCrimpCode
                        ? '(연결된 완제품 없음)'
                        : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. 번들 수량 */}
            <div className="grid gap-2">
              <Label>묶음 수량 (번들에 포함할 CA 개수)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={setQuantity}
                onChange={(e) => setSetQuantity(parseInt(e.target.value) || 4)}
                className="w-32"
              />
              <p className="text-xs text-slate-500">
                하나의 번들에 포함될 개별 CA 바코드 수량
              </p>
            </div>
          </div>
        )}

        {/* Step 2: CA 바코드 선택 (Barcord 스타일) */}
        {step === 'select' && currentBundle && (
          <div className="space-y-6">
            {/* 번들 정보 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">번들 번호</span>
                  <p className="font-mono font-bold text-pink-600">{currentBundle.bundleNo}</p>
                </div>
                <div>
                  <span className="text-slate-500">절압착품번</span>
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
                <h4 className="font-medium mb-2">번들에 포함된 CA 바코드</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">순번</TableHead>
                        <TableHead>CA 바코드</TableHead>
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

            {/* 선택 가능한 CA 바코드 (Barcord 스타일) */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">2. CA 바코드 선택 (묶음에 포함할 바코드 체크)</h4>

              {/* 검색/필터 바 */}
              <div className="flex items-center gap-4 mb-3">
                <div className="relative flex-1 max-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="바코드 번호 검색..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex-1" />

                {/* 전체 선택 체크박스 */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectAll}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  />
                  <Label htmlFor="select-all" className="text-sm cursor-pointer">
                    전체 선택
                  </Label>
                </div>

                {/* 새로고침 버튼 */}
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  새로고침
                </Button>
              </div>

              {/* CA 바코드 테이블 */}
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>CA 바코드</TableHead>
                      <TableHead className="text-right w-24">수량</TableHead>
                      <TableHead className="w-36">생산일시</TableHead>
                      <TableHead className="w-32">절압착품번</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLots.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                          선택 가능한 CA 바코드가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLots.map((lot) => (
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
                          <TableCell className="text-right">
                            {lot.completedQty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">
                            {lot.completedAt
                              ? format(new Date(lot.completedAt), 'yyyy-MM-dd HH:mm')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {lot.crimpProductCode || currentBundle.productCode}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 선택 정보 (Barcord 스타일) */}
              <div className="flex items-center gap-6 mt-3">
                <span className="font-bold">
                  선택: <span className="text-blue-600">{selectionInfo.count}개</span>
                </span>
                <span className="font-bold">
                  총 수량: <span className="text-green-600">{selectionInfo.totalQty.toLocaleString()}</span>
                </span>
                <div className="flex-1" />
                <Button
                  onClick={handleAddSelectedLots}
                  disabled={isLoading || selectionInfo.count === 0}
                >
                  <Plus className="h-4 w-4 mr-1" /> 선택 추가
                </Button>
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
              <Button
                onClick={handleCreateBundle}
                disabled={isLoading || !selectedCrimpCode}
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                묶음 바코드 생성
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
