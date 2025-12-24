/**
 * Process Material Scan Page (공정 자재 스캔)
 *
 * 공정별 자재 스캔 등록 (Phase D)
 * - 공정 선택 필수 (스캔 전 공정 선택)
 * - 바코드 스캔 시 공정 재고로 자동 등록 (registerProcessStock)
 * - 소진된 LOT 재스캔 방지 (checkProcessStockStatus)
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Label } from '../components/ui/label'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  ScanBarcode,
  FileSpreadsheet,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { downloadImportTemplate } from '@/services/excelImportService'
import { parseHQBarcode, type ParsedHQBarcode } from '@/services/barcodeService'
// StockContext 훅 사용 (Electron API 연결)
import { useStock, type ProcessStockInput, type ProcessReceivingRecord } from '@/app/context/StockContext'
import { ExcelImportDialog } from '../components/dialogs/ExcelImportDialog'
// MaterialContext에서 HQ 코드로 자재 조회
import { useMaterial } from '@/app/context/MaterialContext'
// 공정 목록
import { PROCESS_SEED_DATA } from '@/services/processService'

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
  processCode: string  // Phase D: 공정 코드 필수
}

// 확정된 항목 (스캔 후 즉시 등록되므로 ScannedItem과 동일)
type ConfirmedItem = ScannedItem

export const MaterialReceiving = () => {
  const [barcode, setBarcode] = useState('')
  const [pendingItems, setPendingItems] = useState<ScannedItem[]>([])  // 스캔된 대기 항목
  const [confirmedItems, setConfirmedItems] = useState<ScannedItem[]>([])  // 확정된 항목
  const [isProcessing, setIsProcessing] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [selectedProcess, setSelectedProcess] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastInputTimeRef = useRef<number>(0)

  // MaterialContext에서 자재 조회 함수 가져오기
  const { getMaterialByHQCode, getMaterialByCode } = useMaterial()

  // StockContext에서 재고 함수 가져오기
  const {
    registerProcessStock,
    checkProcessStockStatus,
    getTodayProcessReceivings,
    deleteStockItems,
  } = useStock()

  // 자재 투입 공정만 필터링 (hasMaterialInput: true)
  const materialInputProcesses = PROCESS_SEED_DATA.filter(p => p.hasMaterialInput)

  // 금일 스캔 내역 로드 (공정별)
  const loadTodayReceivings = useCallback(async () => {
    try {
      // 선택된 공정이 있으면 해당 공정만, 없으면 전체 조회
      const receivings = await getTodayProcessReceivings(selectedProcess || undefined)
      const items: ScannedItem[] = receivings.map((r) => ({
        id: r.id,
        barcode: r.lotNumber,
        materialId: 0,
        materialCode: r.materialCode,
        materialName: r.materialName,
        lotNumber: r.lotNumber,
        quantity: r.quantity,
        unit: 'EA',
        time: new Date(r.receivedAt).toLocaleTimeString(),
        status: 'success' as const,
        selected: false,
        processCode: r.processCode,
      }))
      setConfirmedItems(items)
    } catch (error) {
      console.error('Failed to load today receivings:', error)
    }
  }, [selectedProcess])

  useEffect(() => {
    loadTodayReceivings()
  }, [loadTodayReceivings])

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
      const timeSinceLastInput = now - lastInputTimeRef.current
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

  // 바코드 처리 로직 (공정 재고로 즉시 등록)
  const processBarcode = async (barcodeValue: string) => {
    if (!barcodeValue || isProcessing) return

    // Phase D: 공정 선택 필수
    if (!selectedProcess) {
      toast.error('먼저 공정을 선택하세요.')
      setBarcode('')
      inputRef.current?.focus()
      return
    }

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
          processCode: selectedProcess,
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
          error: `본사코드 ${hqCode} 미등록`,
          selected: false,
          processCode: selectedProcess,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error(`본사 코드 ${hqCode}에 해당하는 자재가 등록되어 있지 않습니다.`)
        setBarcode('')
        setIsProcessing(false)
        inputRef.current?.focus()
        return
      }

      // 3. 공정+LOT 상태 확인 (소진 여부)
      const status = await checkProcessStockStatus(selectedProcess, lotNumber)

      if (status.isExhausted) {
        // 소진된 LOT - 등록 불가
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
          error: '이미 사용 완료된 바코드',
          selected: false,
          processCode: selectedProcess,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error(`LOT ${lotNumber}은(는) 이미 사용이 완료되었습니다.`)
        setBarcode('')
        setIsProcessing(false)
        inputRef.current?.focus()
        return
      }

      // 4. 공정 재고로 즉시 등록
      const stockInput: ProcessStockInput = {
        processCode: selectedProcess,
        materialId: material.id,
        materialCode: material.code,
        materialName: material.name,
        lotNumber: lotNumber,
        quantity: qty,
      }

      const result = await registerProcessStock(stockInput)

      if (result.success) {
        // 등록 성공 - 확정 목록에 추가
        const successItem: ScannedItem = {
          id: result.id,
          barcode: barcodeValue,
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          lotNumber: lotNumber,
          quantity: qty,
          unit: material.unit,
          time: new Date().toLocaleTimeString(),
          status: 'success',
          selected: false,
          processCode: selectedProcess,
        }
        setConfirmedItems((prev) => [successItem, ...prev])

        const processName = materialInputProcesses.find(p => p.code === selectedProcess)?.name || selectedProcess
        const actionMsg = result.isNewEntry ? '등록' : '추가'
        toast.success(`[${processName}] ${material.name} ${qty}${material.unit} ${actionMsg} 완료`)
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
          error: result.error || '등록 실패',
          selected: false,
          processCode: selectedProcess,
        }
        setPendingItems((prev) => [errorItem, ...prev])
        toast.error(result.error || '등록에 실패했습니다.')
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

  // 확정 목록 선택 삭제 (공정 재고 삭제)
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

  const pendingErrorCount = pendingItems.filter((i) => i.status === 'error').length
  const confirmedSelectedCount = confirmedItems.filter((i) => i.selected).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">공정 자재 스캔</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            양식 다운로드
          </Button>
        </div>
      </div>

      <Tabs defaultValue="scan" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="scan">바코드 스캔 등록</TabsTrigger>
          <TabsTrigger value="manual">엑셀 일괄 업로드</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4 mt-4">
          {/* 바코드 스캔 입력 */}
          <Card>
            <CardHeader>
              <CardTitle>자재 스캔 등록</CardTitle>
              <CardDescription>
                공정을 선택하고 바코드를 스캔하면 해당 공정 재고로 즉시 등록됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 공정 선택 (스캔 전 필수) */}
              <div className="flex flex-col sm:flex-row gap-4 items-end pb-3 border-b">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="process" className="flex items-center gap-1">
                    <span className="text-red-500">*</span> 스캔 공정 선택
                  </Label>
                  <Select value={selectedProcess} onValueChange={setSelectedProcess}>
                    <SelectTrigger
                      id="process"
                      className={`w-full ${!selectedProcess ? 'border-red-300 bg-red-50' : ''}`}
                    >
                      <SelectValue placeholder="공정을 먼저 선택하세요..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materialInputProcesses.map((process) => (
                        <SelectItem key={process.code} value={process.code}>
                          {process.code} - {process.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedProcess && (
                  <div className="px-3 py-2 bg-blue-50 rounded-md text-sm text-blue-700">
                    현재 공정: <strong>{selectedProcess}</strong> ({materialInputProcesses.find(p => p.code === selectedProcess)?.name})
                  </div>
                )}
              </div>

              {/* 바코드 입력 */}
              <form onSubmit={handleScan} className="flex gap-4">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    ref={inputRef}
                    placeholder={selectedProcess ? '바코드를 스캔하세요... (자동 등록됨)' : '먼저 공정을 선택하세요'}
                    className={`pl-9 ${!selectedProcess ? 'bg-slate-100' : ''}`}
                    value={barcode}
                    onChange={handleBarcodeChange}
                    autoFocus
                    disabled={isProcessing || !selectedProcess}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={isProcessing || !barcode.trim() || !selectedProcess}>
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ScanBarcode className="mr-2 h-4 w-4" />
                  )}
                  스캔 등록
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
                        <th className="px-4 py-3">공정</th>
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
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
                              {item.processCode}
                            </span>
                          </td>
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

          {/* 금일 스캔 내역 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  금일 스캔 내역 ({confirmedItems.length})
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
                    등록: {confirmedItems.length}건
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
                      <th className="px-4 py-3">공정</th>
                      <th className="px-4 py-3">자재품번</th>
                      <th className="px-4 py-3">품명</th>
                      <th className="px-4 py-3">LOT번호</th>
                      <th className="px-4 py-3 text-right">수량</th>
                      <th className="px-4 py-3 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {confirmedItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          스캔된 내역이 없습니다. 공정을 선택하고 바코드를 스캔하세요.
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
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {item.processCode}
                            </span>
                          </td>
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
            loadTodayReceivings()
            toast.success(`${result.importedRows}건 입고 완료`)
          }
        }}
      />
    </div>
  )
}

export default MaterialReceiving
