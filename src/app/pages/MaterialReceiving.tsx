/**
 * Material Issue Page (자재 불출)
 *
 * Phase 5: 3단계 재고 관리
 * - 자재 창고 → 생산 창고 불출
 * - 바코드 스캔 시 생산창고로 자동 등록 (issueToProduction)
 * - 소진된 LOT 재스캔 방지
 * - 남은 수량 있는 LOT 재스캔 허용
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Checkbox } from '../components/ui/checkbox'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  ScanBarcode,
  FileSpreadsheet,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
  PackageOpen,
  FileText,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadImportTemplate } from '@/services/excelImportService'
import { parseHQBarcode } from '@/services/barcodeService'
// StockContext 훅 사용 (Electron API 연결)
import { useStock, type IssueToProductionInput, type IssuingRecord } from '@/app/context/StockContext'
import { ExcelImportDialog, DocumentPreviewDialog, type DocumentData, type InputMaterialInfo } from '../components/dialogs'
// MaterialContext에서 HQ 코드로 자재 조회
import { useMaterial } from '@/app/context/MaterialContext'

interface ScannedItem {
  id: number
  barcode: string
  materialId: number
  materialCode: string
  materialName: string
  lotNumber: string
  quantity: number
  unit: string
  time: string
  status: 'success' | 'error' | 'pending'
  error?: string
  selected: boolean
}

// 확정된 항목 (스캔 후 즉시 등록되므로 ScannedItem과 동일)
type ConfirmedItem = ScannedItem

export const MaterialReceiving = () => {
  const [barcode, setBarcode] = useState('')
  const [pendingItems, setPendingItems] = useState<ScannedItem[]>([])  // 스캔된 대기 항목
  const [confirmedItems, setConfirmedItems] = useState<ConfirmedItem[]>([])  // 확정된 항목
  const [isProcessing, setIsProcessing] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastInputTimeRef = useRef<number>(0)

  // MaterialContext에서 자재 조회 함수 가져오기
  const { getMaterialByHQCode } = useMaterial()

  // StockContext에서 재고 함수 가져오기
  const {
    issueToProduction,
    getTodayIssuings,
    deleteStockItems,
    cancelIssue,
  } = useStock()

  // 전표 다이얼로그 상태
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false)
  const [selectedItemForDocument, setSelectedItemForDocument] = useState<ConfirmedItem | null>(null)

  // 금일 불출 내역 로드
  const loadTodayIssuings = useCallback(async () => {
    try {
      const issuings = await getTodayIssuings()
      const items: ConfirmedItem[] = issuings.map((r: IssuingRecord) => ({
        id: r.id,
        barcode: r.lotNumber,
        materialId: 0,
        materialCode: r.materialCode,
        materialName: r.materialName,
        lotNumber: r.lotNumber,
        quantity: r.quantity,
        unit: 'EA',
        time: new Date(r.issuedAt).toLocaleTimeString(),
        status: 'success' as const,
        selected: false,
      }))
      setConfirmedItems(items)
    } catch (error) {
      console.error('Failed to load today issuings:', error)
    }
  }, [getTodayIssuings])

  useEffect(() => {
    loadTodayIssuings()
  }, [loadTodayIssuings])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setDroppedFile(acceptedFiles[0])
      setShowImportDialog(true)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
  })

  const handleDownloadTemplate = () => {
    downloadImportTemplate('receiving')
    toast.success('양식 파일이 다운로드되었습니다.')
  }

  // 바코드 입력 핸들러 (자동 스캔 감지)
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBarcode(value)

    // 기존 타이머 취소
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    // 입력이 있으면 자동 스캔 타이머 설정 (300ms 후 자동 처리)
    if (value.trim()) {
      const now = Date.now()
      lastInputTimeRef.current = now

      // 바코드 스캐너는 빠르게 입력됨 (50ms 이내)
      // 300ms 동안 추가 입력이 없으면 스캔 완료로 판단
      scanTimeoutRef.current = setTimeout(() => {
        if (!isProcessing && value.trim()) {
          processBarcode(value.trim())
        }
      }, 300)
    }
  }

  // 바코드 처리 로직 (생산창고로 불출)
  const processBarcode = async (barcodeValue: string) => {
    if (!barcodeValue || isProcessing) return

    setIsProcessing(true)

    try {
      // 1. 바코드 파싱
      const parsed = parseHQBarcode(barcodeValue)

      if (!parsed || !parsed.isValid) {
        // 바코드 형식이 맞지 않으면 오류 표시
        const errorItem: ScannedItem = {
          id: Date.now(),
          barcode: barcodeValue,
          materialId: 0,
          materialCode: barcodeValue,
          materialName: '(인식 불가)',
          lotNumber: '',
          quantity: 0,
          unit: 'EA',
          time: new Date().toLocaleTimeString(),
          status: 'error',
          error: '바코드 형식 오류',
          selected: false,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error('올바른 바코드 형식이 아닙니다.')
        setBarcode('')
        setIsProcessing(false)
        inputRef.current?.focus()
        return
      }

      const qty = parsed.quantity || 1
      const hqCode = parsed.materialCode // 바코드에서 추출한 본사 코드
      const lotNumber = parsed.lotNumber

      // 2. 자재 조회 (본사 코드 → MES 자재)
      const material = getMaterialByHQCode(hqCode)

      if (!material) {
        const errorItem: ScannedItem = {
          id: Date.now(),
          barcode: barcodeValue,
          materialId: 0,
          materialCode: hqCode,
          materialName: '(미등록 자재)',
          lotNumber: lotNumber,
          quantity: qty,
          unit: 'EA',
          time: new Date().toLocaleTimeString(),
          status: 'error',
          error: `코드 ${hqCode} 미등록`,
          selected: false,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error(`코드 ${hqCode}에 해당하는 자재가 등록되어 있지 않습니다.`)
        setBarcode('')
        setIsProcessing(false)
        inputRef.current?.focus()
        return
      }

      // 3. 생산창고로 불출
      const issueInput: IssueToProductionInput = {
        materialId: material.id,
        materialCode: material.code,
        materialName: material.name,
        lotNumber: lotNumber,
        quantity: qty,
      }

      const result = await issueToProduction(issueInput)

      if (result.success) {
        // 등록 성공 - 확정 목록에 추가
        const successItem: ConfirmedItem = {
          id: result.productionStock?.id || Date.now(),
          barcode: barcodeValue,
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          lotNumber: lotNumber,
          quantity: result.issuedQty,
          unit: material.unit,
          time: new Date().toLocaleTimeString(),
          status: 'success',
          selected: false,
        }
        setConfirmedItems((prev) => [successItem, ...prev])
        toast.success(`${material.name} ${result.issuedQty}${material.unit} 불출 완료`)
      } else {
        // 등록 실패
        const errorItem: ScannedItem = {
          id: Date.now(),
          barcode: barcodeValue,
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          lotNumber: lotNumber,
          quantity: qty,
          unit: material.unit,
          time: new Date().toLocaleTimeString(),
          status: 'error',
          error: result.error || '불출 실패',
          selected: false,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error(result.error || '불출에 실패했습니다.')
      }
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('바코드 처리 중 오류가 발생했습니다.')
    } finally {
      setBarcode('')
      setIsProcessing(false)
      inputRef.current?.focus()
    }
  }

  // 폼 제출 핸들러 (Enter 키)
  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcode.trim() || isProcessing) return

    // 타이머 취소하고 즉시 처리
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }
    processBarcode(barcode.trim())
  }

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [])

  // 오류 목록 전체 삭제
  const handleClearErrors = () => {
    const errorCount = pendingItems.filter(i => i.status === 'error').length
    if (errorCount === 0) {
      toast.info('삭제할 오류 항목이 없습니다.')
      return
    }
    setPendingItems(prev => prev.filter(i => i.status !== 'error'))
    toast.success(`${errorCount}건 오류 항목 삭제됨`)
  }

  // 확정 목록 선택 토글
  const toggleConfirmedSelection = (id: number) => {
    setConfirmedItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    )
  }

  // 확정 목록 선택 삭제 (생산창고 재고 삭제)
  const handleDeleteConfirmed = async () => {
    const selectedItems = confirmedItems.filter((i) => i.selected)
    const selectedCount = selectedItems.length
    if (selectedCount === 0) {
      toast.error('삭제할 항목을 선택하세요.')
      return
    }

    try {
      // 선택된 항목의 ID 추출 (재고 ID)
      const ids = selectedItems.map((item) => item.id)

      // 재고 삭제 호출 (MOCK_STOCKS에서 삭제)
      const deletedCount = await deleteStockItems(ids)

      if (deletedCount > 0) {
        // 로컬 state에서도 제거
        setConfirmedItems((prev) => prev.filter((i) => !i.selected))
        toast.success(`${deletedCount}건 삭제 완료`)
      } else {
        // 삭제 실패해도 로컬 state에서 제거 시도
        setConfirmedItems((prev) => prev.filter((i) => !i.selected))
        toast.info('삭제 처리 중 일부 항목이 처리되지 않았습니다.')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  }

  // 개별 취소 핸들러
  const handleCancelItem = async (item: ConfirmedItem) => {
    try {
      const result = await cancelIssue(item.id)
      if (result.success) {
        setConfirmedItems((prev) => prev.filter((i) => i.id !== item.id))
        toast.success(`${item.materialName} 불출이 취소되었습니다.`)
      } else {
        toast.error(result.error || '취소에 실패했습니다.')
      }
    } catch (error) {
      console.error('Cancel failed:', error)
      toast.error('취소 중 오류가 발생했습니다.')
    }
  }

  // 전표 출력 핸들러
  const handleOpenDocument = (item: ConfirmedItem) => {
    setSelectedItemForDocument(item)
    setDocumentDialogOpen(true)
  }

  // 전표 데이터 생성
  const getDocumentData = (): DocumentData | null => {
    if (!selectedItemForDocument) return null

    return {
      lotNumber: selectedItemForDocument.lotNumber,
      productCode: selectedItemForDocument.materialCode,
      productName: selectedItemForDocument.materialName,
      quantity: selectedItemForDocument.quantity,
      unit: selectedItemForDocument.unit,
      productionDate: new Date(),
      processCode: 'MO',  // Material Out (자재 불출)
      processName: '자재 불출',
      inputMaterials: [{
        lotNumber: selectedItemForDocument.lotNumber,
        productCode: selectedItemForDocument.materialCode,
        name: selectedItemForDocument.materialName,
        quantity: selectedItemForDocument.quantity,
        unit: selectedItemForDocument.unit,
        sourceType: 'material',
      }],
    }
  }

  const pendingErrorCount = pendingItems.filter((i) => i.status === 'error').length
  const confirmedSelectedCount = confirmedItems.filter((i) => i.selected).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PackageOpen className="h-7 w-7 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-800">자재 불출</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            양식 다운로드
          </Button>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <PackageOpen className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">자재 불출 안내</p>
            <p className="text-sm text-blue-600 mt-1">
              바코드를 스캔하면 자재가 <strong>생산 창고</strong>로 불출됩니다.
              불출된 자재는 각 공정에서 스캔하여 사용할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="scan" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="scan">바코드 스캔 불출</TabsTrigger>
          <TabsTrigger value="manual">엑셀 일괄 업로드</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4 mt-4">
          {/* 바코드 스캔 입력 */}
          <Card>
            <CardHeader>
              <CardTitle>바코드 스캔</CardTitle>
              <CardDescription>
                바코드를 스캔하면 생산 창고로 자동 불출됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 바코드 입력 */}
              <form onSubmit={handleScan} className="flex gap-4">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    ref={inputRef}
                    placeholder="바코드를 스캔하세요... (자동 불출됨)"
                    className="pl-9"
                    value={barcode}
                    onChange={handleBarcodeChange}
                    autoFocus
                    disabled={isProcessing}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={isProcessing || !barcode.trim()}>
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ScanBarcode className="mr-2 h-4 w-4" />
                  )}
                  불출
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 스캔 오류 목록 */}
          {pendingErrorCount > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-red-600">
                    스캔 오류 목록 ({pendingErrorCount})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearErrors}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    오류 전체 삭제
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-red-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-red-50 text-slate-500 font-medium border-b">
                      <tr>
                        <th className="px-4 py-3">시간</th>
                        <th className="px-4 py-3">자재품번</th>
                        <th className="px-4 py-3">품명</th>
                        <th className="px-4 py-3">LOT번호</th>
                        <th className="px-4 py-3 text-right">수량</th>
                        <th className="px-4 py-3 text-center">오류</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingItems.filter(i => i.status === 'error').map((item) => (
                        <tr key={item.id} className="bg-red-50">
                          <td className="px-4 py-3">{item.time}</td>
                          <td className="px-4 py-3 font-mono">
                            {item.materialCode}
                          </td>
                          <td className="px-4 py-3">{item.materialName}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {item.lotNumber || '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {item.quantity.toLocaleString()} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"
                              title={item.error}
                            >
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {item.error || '오류'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 금일 불출 내역 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  금일 불출 내역 ({confirmedItems.length})
                </CardTitle>
                <div className="flex gap-2 items-center">
                  {confirmedSelectedCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteConfirmed}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      선택 삭제 ({confirmedSelectedCount})
                    </Button>
                  )}
                  <span className="text-sm text-green-600">
                    불출: {confirmedItems.length}건
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <Checkbox
                          checked={confirmedItems.length > 0 && confirmedItems.every(i => i.selected)}
                          onCheckedChange={() => {
                            const allSelected = confirmedItems.every(i => i.selected)
                            setConfirmedItems(prev => prev.map(i => ({ ...i, selected: !allSelected })))
                          }}
                          disabled={confirmedItems.length === 0}
                        />
                      </th>
                      <th className="px-4 py-3">시간</th>
                      <th className="px-4 py-3">자재품번</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3">LOT번호</th>
                      <th className="px-4 py-3 text-right">수량</th>
                      <th className="px-4 py-3 text-center">상태</th>
                      <th className="px-4 py-3 text-center">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {confirmedItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          불출된 내역이 없습니다. 바코드를 스캔하세요.
                        </td>
                      </tr>
                    ) : (
                      confirmedItems.map((item) => (
                        <tr
                          key={item.id}
                          className={item.selected ? 'bg-blue-50' : ''}
                        >
                          <td className="px-3 py-3">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={() => toggleConfirmedSelection(item.id)}
                            />
                          </td>
                          <td className="px-4 py-3">{item.time}</td>
                          <td className="px-4 py-3 font-mono">
                            {item.materialCode}
                          </td>
                          <td className="px-4 py-3">{item.materialName}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {item.lotNumber}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {item.quantity.toLocaleString()} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              <Check className="w-3 h-3 mr-1" /> 완료
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleOpenDocument(item)}
                                title="전표 출력"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleCancelItem(item)}
                                title="불출 취소"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>파일 업로드</CardTitle>
              <CardDescription>
                엑셀 파일을 드래그하여 업로드하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="font-medium">
                    파일을 드래그하거나 클릭하여 선택하세요
                  </p>
                  <p className="text-xs">지원 형식: .xlsx, .xls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={showImportDialog}
        onOpenChange={(open) => {
          setShowImportDialog(open)
          if (!open) {
            setDroppedFile(null)  // 다이얼로그 닫을 때 파일 초기화
          }
        }}
        importType="receiving"
        initialFile={droppedFile}
        onImportComplete={(result) => {
          if (result.success) {
            loadTodayIssuings()
            toast.success(`${result.importedRows}건 불출 완료`)
          }
        }}
      />

      {/* 불출 전표 다이얼로그 */}
      <DocumentPreviewDialog
        open={documentDialogOpen}
        onOpenChange={(open) => {
          setDocumentDialogOpen(open)
          if (!open) {
            setSelectedItemForDocument(null)
          }
        }}
        data={getDocumentData()}
      />
    </div>
  )
}

export default MaterialReceiving
